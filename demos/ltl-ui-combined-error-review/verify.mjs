import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {countDecisions, filterCases, makeSearchIndex, validateDataset} from './model.mjs';

const [casesPath, baselinePath] = process.argv.slice(2);
if (!casesPath) throw new Error('Usage: node verify.mjs CASES_JSON [BASELINE_CASES_JSON]');

const data = JSON.parse(await readFile(casesPath, 'utf8'));
validateDataset(data);
const historical = data.cases.filter(row => row.dataset === 'H');
const searchIndex = makeSearchIndex(data.cases);
const summary = JSON.parse(await readFile(path.join(path.dirname(casesPath), 'summary.json'), 'utf8'));
const html = await readFile(path.join(path.dirname(casesPath), 'index.html'), 'utf8');
assert.deepEqual(summary.scope.counts, data.scope.counts);
assert.equal(data.cases.filter(row => row.humanReview && row.humanConfirmed).length, 14);
for (const replay of ['replay-1', 'replay-2', 'replay-3', 'pass@3']) {
  const rows = replay === 'pass@3' ? data.cases : filterCases(data.cases, {replay}, searchIndex);
  const counts = countDecisions(rows);
  const reported = summary.scope.combinedReplayBreakdown[replay];
  assert.equal(reported.total, rows.length);
  assert.equal(Object.values(counts).reduce((a, b) => a + b), rows.length);
  for (const [label, count] of Object.entries(counts)) assert.equal(reported[label], count);
  for (const key of ['total', 'correct', 'false-positive', 'unsure', 'duplicate']) {
    assert.equal(reported[key], summary.scope.replayBreakdownByDataset.H[replay][key] + summary.scope.replayBreakdownByDataset.R[replay][key]);
  }
  assert.equal(reported.correctness, counts.correct / (counts.correct + counts['false-positive']));
  const title = replay === 'pass@3' ? 'Pass@3' : replay.replace('replay-', 'Replay ');
  assert.ok(html.includes(`<th scope="row">${title}</th>` + [rows.length, counts.correct, counts['false-positive'], counts.duplicate, (reported.correctness * 100).toFixed(1) + '%'].map(cell => `<td>${cell}</td>`).join('')));
}
assert.deepEqual(countDecisions(data.cases), {correct: 424, 'false-positive': 69, unsure: 0, duplicate: 2279});
assert.equal(summary.scope.combinedReplayBreakdown['pass@3'].total, 2772);
const expected = {
  'replay-1': {correct: 121, 'false-positive': 11, unsure: 0, duplicate: 103},
  'replay-2': {correct: 113, 'false-positive': 17, unsure: 0, duplicate: 119},
  'replay-3': {correct: 100, 'false-positive': 16, unsure: 0, duplicate: 101},
};

for (const [replay, expectedCounts] of Object.entries(expected)) {
  const rows = filterCases(data.cases, {dataset: 'H', replay}, searchIndex);
  const actualCounts = countDecisions(rows);
  if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCounts)) {
    throw new Error(`${replay} filter differs: ${JSON.stringify(actualCounts)}`);
  }
}

const passAt3 = countDecisions(historical);
const expectedPassAt3 = {correct: 215, 'false-positive': 28, unsure: 0, duplicate: 241};
if (JSON.stringify(passAt3) !== JSON.stringify(expectedPassAt3)) {
  throw new Error(`Pass@3 differs: ${JSON.stringify(passAt3)}`);
}

let pairs = 0;
for (const row of data.cases) {
  if (row.dataset !== 'R') continue;
  for (const evidence of row.evidence || []) {
    if (!evidence.beforeImage || !evidence.afterImage) throw new Error(`Incomplete image pair: ${row.id}`);
    await Promise.all([
      access(path.join(path.dirname(casesPath), evidence.beforeImage)),
      access(path.join(path.dirname(casesPath), evidence.afterImage)),
    ]);
    pairs++;
  }
}
if (pairs !== 250) throw new Error(`Expected 250 latest screenshot pairs, found ${pairs}`);

if (baselinePath) {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  const comparable = structuredClone(data);
  comparable.generatedAt = baseline.generatedAt;
  comparable.scope = baseline.scope;
  for (const row of comparable.cases) {
    if (!row.humanReview) continue;
    assert.equal(row.humanReview.reviewer, 'user');
    assert.equal(row.decision, 'correct');
    assert.equal(row.humanReview.previousDecision, 'unsure');
    row.decision = row.humanReview.previousDecision;
    row.baseDecision = row.humanReview.previousBaseDecision;
    row.humanConfirmed = row.humanReview.previousHumanConfirmed;
    row.updatedAt = row.humanReview.previousUpdatedAt;
    delete row.humanReview;
  }
  if (JSON.stringify(comparable) !== JSON.stringify(baseline)) {
    throw new Error('Unexpected case changes beyond the 14 user-confirmed annotations');
  }
}

console.log(JSON.stringify({rows: data.cases.length, latestScreenshotPairs: pairs, combinedReplayCounts: summary.scope.combinedReplayBreakdown, humanConfirmedRows: 14, allOtherCaseDataPreserved: Boolean(baselinePath)}, null, 2));
