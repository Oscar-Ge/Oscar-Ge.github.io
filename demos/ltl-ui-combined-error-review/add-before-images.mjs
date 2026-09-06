import {copyFile, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';

const [casesPath, resultsRoot] = process.argv.slice(2);
if (!casesPath || !resultsRoot) {
  throw new Error('Usage: node add-before-images.mjs CASES_JSON RESULTS_ROOT');
}

const data = JSON.parse(await readFile(casesPath, 'utf8'));
const imagesDir = path.join(path.dirname(casesPath), 'images');
const itemsByTrace = new Map();

for (const row of data.cases) {
  if (row.dataset !== 'R') continue;
  for (const evidence of row.evidence || []) {
    const tracePath = path.join(resultsRoot, evidence.replay, 'attempts', evidence.attemptId, 'bombadil', 'trace.jsonl');
    if (!itemsByTrace.has(tracePath)) itemsByTrace.set(tracePath, []);
    itemsByTrace.get(tracePath).push({row, evidence});
  }
}

let pairs = 0;
for (const [tracePath, items] of itemsByTrace) {
  const trace = (await readFile(tracePath, 'utf8')).trimEnd().split('\n').map(line => JSON.parse(line));
  for (const {row, evidence} of items) {
    const after = trace[evidence.traceEntryIndex];
    const before = trace[evidence.traceEntryIndex - 1];
    if (!after?.state?.screenshot || !before?.state?.screenshot) {
      throw new Error(`Missing trace frame for ${row.id} at ${evidence.traceEntryIndex}`);
    }

    const publishedAfter = path.join(path.dirname(casesPath), evidence.afterImage);
    const [publishedBytes, traceBytes] = await Promise.all([
      readFile(publishedAfter),
      readFile(after.state.screenshot),
    ]);
    if (!publishedBytes.equals(traceBytes)) {
      throw new Error(`Published after image does not match trace frame for ${row.id}`);
    }

    const beforeName = `${row.id.replace(':', '-')}-before.jpeg`;
    await copyFile(before.state.screenshot, path.join(imagesDir, beforeName));
    evidence.beforeImage = `images/${beforeName}`;
    pairs++;
  }
}

const expectedReplayCounts = {
  'replay-1': {total: 235, correct: 121, 'false-positive': 11, duplicate: 103},
  'replay-2': {total: 249, correct: 113, 'false-positive': 17, duplicate: 119},
  'replay-3': {total: 217, correct: 100, 'false-positive': 16, duplicate: 101},
};
const historical = data.cases.filter(row => row.dataset === 'H');
for (const [replay, expected] of Object.entries(expectedReplayCounts)) {
  const rows = historical.filter(row => row.replays.includes(replay));
  const actual = {total: rows.length, correct: 0, 'false-positive': 0, duplicate: 0};
  for (const row of rows) actual[row.decision]++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${replay} counts differ: ${JSON.stringify(actual)}`);
  }
}

const ids = new Set(data.cases.map(row => row.id));
if (data.cases.length !== 2772 || ids.size !== 2772 || historical.length !== 484 || pairs !== 250) {
  throw new Error(`Integrity check failed: rows=${data.cases.length}, ids=${ids.size}, historical=${historical.length}, pairs=${pairs}`);
}

data.generatedAt = new Date().toISOString();
const temporaryPath = `${casesPath}.tmp`;
await writeFile(temporaryPath, JSON.stringify(data));
await rename(temporaryPath, casesPath);
console.log(JSON.stringify({rows: data.cases.length, historical: historical.length, latestScreenshotPairs: pairs, replayCounts: expectedReplayCounts}, null, 2));
