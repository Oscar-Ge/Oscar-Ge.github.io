import {access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {countDecisions, filterCases, makeSearchIndex, validateDataset} from './model.mjs';

const [casesPath, baselinePath] = process.argv.slice(2);
if (!casesPath) throw new Error('Usage: node verify.mjs CASES_JSON [BASELINE_CASES_JSON]');

const data = JSON.parse(await readFile(casesPath, 'utf8'));
validateDataset(data);
const historical = data.cases.filter(row => row.dataset === 'H');
const searchIndex = makeSearchIndex(data.cases);
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
  for (const row of comparable.cases) {
    if (row.dataset !== 'R') continue;
    for (const evidence of row.evidence || []) delete evidence.beforeImage;
  }
  if (JSON.stringify(comparable) !== JSON.stringify(baseline)) {
    throw new Error('Current cases differ from the published baseline beyond generatedAt and beforeImage fields');
  }
}

console.log(JSON.stringify({rows: data.cases.length, historical: historical.length, latestScreenshotPairs: pairs, replayCounts: expected, passAt3: expectedPassAt3, baselinePreserved: Boolean(baselinePath)}, null, 2));
