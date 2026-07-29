import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const examplesDir = dirname(fileURLToPath(import.meta.url));
const exampleDir = join(examplesDir, "airbnb-wishlist-focus-return");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

test("the Airbnb AP-M1-04 example is an evidence-bound three-state trace", () => {
  const evidence = readJson(join(exampleDir, "evidence.json"));

  assert.equal(evidence.schemaVersion, "ltl-ui-multistate-example/1");
  assert.equal(evidence.atomicId, "AP-M1-04");
  assert.equal(evidence.outcome, "VIOLATION_OBSERVED");
  assert.equal(
    evidence.temporalFormula,
    "G(bound_modal_escape_closes(d,i) -> F_[0,500ms] focus_is_exact_invoker(i))",
  );
  assert.equal(
    evidence.source.commit,
    "b9056ef3266c2adcc1476d5e7dbcacada35a63f2",
  );
  assert.equal(
    evidence.source.attemptId,
    "033__airbnb__g0-none__600s__replay-1",
  );

  assert.deepEqual(
    evidence.states.map((state) => state.id),
    ["invoker-focused", "modal-focused", "deadline-violation"],
  );
  assert.deepEqual(
    evidence.states.map((state) => state.traceLine),
    [521, 522, 525],
  );
  assert.deepEqual(
    evidence.states.map((state) => state.focus.tag),
    ["BUTTON", "INPUT", "BODY"],
  );
  assert.deepEqual(
    evidence.transitions.map((transition) => transition.action),
    ["Space", "Escape + 500 ms settlement"],
  );
  assert.ok(
    evidence.states.every(
      (state, index) =>
        index === 0 || state.timestamp > evidence.states[index - 1].timestamp,
    ),
    "state timestamps must increase",
  );

  for (const state of evidence.states) {
    const bytes = readFileSync(join(exampleDir, state.screenshot.path));
    assert.equal(sha256(bytes), state.screenshot.sha256);
    assert.equal(bytes.byteLength, state.screenshot.byteCount);
    assert.equal(state.screenshot.focusGeometry, null);
  }

  assert.deepEqual(evidence.violation, {
    originalDialogClosed: true,
    replacementModalCount: 0,
    invokerEligible: true,
    focusIsExactInvoker: false,
  });
  assert.match(evidence.claimBoundary, /archived/i);
  assert.match(evidence.claimBoundary, /not part of the 137-site/i);
  assert.match(evidence.captureLimitations, /no DOM event IDs/i);
  assert.match(evidence.captureLimitations, /no focus geometry/i);
});

test("published compressed artifacts match their uncompressed identities", () => {
  const evidence = readJson(join(exampleDir, "evidence.json"));

  for (const artifact of evidence.source.artifacts) {
    const compressed = readFileSync(join(exampleDir, artifact.path));
    const uncompressed = gunzipSync(compressed);
    assert.equal(sha256(uncompressed), artifact.uncompressedSha256);
    assert.equal(uncompressed.byteLength, artifact.uncompressedByteCount);
  }
});

test("the page exposes all three states, the formula, code, and claim boundary", () => {
  const page = readFileSync(join(exampleDir, "index.html"), "utf8");

  for (const requiredText of [
    "Wishlist closes, focus does not return",
    "State 1",
    "Heart button focused",
    "State 2",
    "Wishlist input focused",
    "State 3",
    "BODY focused",
    "G(bound_modal_escape_closes(d,i) -&gt; F_[0,500ms] focus_is_exact_invoker(i))",
    "always(() =&gt;",
    "m1ExactInvokerReturnContractHolds",
    "Archived worked example",
    "not part of the current 137-site / 26-finding dataset",
  ]) {
    assert.match(page, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
