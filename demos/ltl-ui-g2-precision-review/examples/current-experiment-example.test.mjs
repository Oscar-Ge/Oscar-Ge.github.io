import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const examplesDir = dirname(fileURLToPath(import.meta.url));
const exampleDir = join(examplesDir, "coinmarketcap-search-focus-return");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

test("the current-campaign CoinMarketCap demo binds three states to real evidence", () => {
  const evidence = readJson(join(exampleDir, "evidence.json"));

  assert.equal(evidence.schemaVersion, "ltl-ui-current-campaign-example/1");
  assert.equal(evidence.atomicId, "AP-M1-04");
  assert.equal(evidence.outcome, "VIOLATION_OBSERVED");
  assert.equal(
    evidence.findingId,
    "F::026__coinmarketcap__g2-taxonomy-informed__120s__replay-1:AP-M1-04:first-counterexample",
  );
  assert.equal(
    evidence.source.commit,
    "1bba7afd98e2d198911c2bdf48ea4213d2c3eaca",
  );
  assert.equal(
    evidence.source.datasetIdentity,
    "sha256:587e8ab8d5e1dbee38b2e8178187edf9b3e1a58acbc8971eb3597b0fb3d29307",
  );
  assert.equal(
    evidence.source.executionLockIdentity,
    "sha256:3cc5b39086e453285ca94bfd737d28a9f973d2822d698d47b5a2e68f39853120",
  );
  assert.equal(evidence.source.dirty, true);

  assert.deepEqual(
    evidence.states.map((state) => state.id),
    ["invoker-focused", "dialog-focused", "deadline-violation"],
  );
  assert.deepEqual(
    evidence.states.map((state) => state.traceLine),
    [158, 159, 163],
  );
  assert.deepEqual(
    evidence.states.map((state) => state.timestamp),
    [1785278761364810, 1785278761631546, 1785278762595617],
  );
  assert.deepEqual(
    evidence.states.map((state) => state.focus.tag),
    ["BUTTON", "INPUT", "BODY"],
  );
  assert.deepEqual(
    evidence.transitions.map((transition) => transition.action),
    ["Enter", "Tab → Escape → settle 500 ms"],
  );
  assert.equal(evidence.states[0].focus.eventId, 394);
  assert.equal(evidence.states[1].focus.eventId, 398);
  assert.equal(evidence.states[2].triggerEventId, 405);
  assert.equal(evidence.states[2].traceEntryIndex, 161);
  assert.deepEqual(evidence.recovery, {
    keydownEventId: 408,
    focusEventId: 409,
    focusTag: "A",
    focusName: "Skip to main content",
  });

  for (const state of evidence.states) {
    const bytes = readFileSync(join(exampleDir, state.screenshot.path));
    assert.equal(sha256(bytes), state.screenshot.sha256);
    assert.equal(bytes.byteLength, state.screenshot.byteCount);
  }

  assert.deepEqual(evidence.violation, {
    originalDialogClosed: true,
    replacementModalCount: 0,
    invokerEligible: true,
    focusIsExactInvoker: false,
  });
  assert.match(evidence.claimBoundary, /current 137-site/i);
  assert.match(evidence.claimBoundary, /pending mentor review/i);
});

test("the current-campaign demo publishes identity-bound trace and result bytes", () => {
  const evidence = readJson(join(exampleDir, "evidence.json"));

  for (const artifact of evidence.source.artifacts) {
    const compressed = readFileSync(join(exampleDir, artifact.path));
    const uncompressed = gunzipSync(compressed);
    assert.equal(sha256(uncompressed), artifact.uncompressedSha256);
    assert.equal(uncompressed.byteLength, artifact.uncompressedByteCount);
  }
});

test("the current-campaign page is a one-screenshot shareable stepper", () => {
  const page = readFileSync(join(exampleDir, "index.html"), "utf8");
  const stepper = readFileSync(join(exampleDir, "stepper.js"), "utf8");

  assert.equal((page.match(/<img\b/g) ?? []).length, 1);
  for (const requiredText of [
    "Search closes, keyboard position resets",
    "Current 137-site experiment",
    'id="state-image"',
    'data-step="0"',
    'data-step="1"',
    'data-step="2"',
    'id="previous"',
    'id="next"',
    "AP-M1-04",
  ]) {
    assert.match(page, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(
    stepper,
    /new URLSearchParams\(window\.location\.search\)\.get\("step"\)/,
  );
  assert.match(stepper, /history\.replaceState/);
});
