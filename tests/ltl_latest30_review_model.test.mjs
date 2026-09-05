import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExportDocument,
  importReviewDocument,
  REVIEW_SCHEMA,
  scopeAnalysis,
} from "../demos/ltl-ui-latest30-navigation-error-review/model.mjs";

const cases = [
  { errorId: "X0001", website: "aa", property: "AP-FD1-03", route: "/", identity: "button", replays: ["replay-1"] },
  { errorId: "X0002", website: "aa", property: "AP-S2-05", route: "/", identity: "menu", replays: ["replay-2"] },
];
const data = {
  schemaVersion: "ltl-ui-latest30-navigation-error-review-cases/1",
  title: "fixture",
  actionPolicyVersion: "tier1-wait-tab4-shift1/1",
  expectedCaseCount: 2,
  sourceGeneratedAt: "2026-09-04T00:00:00Z",
  cases,
};

test("analysis keeps duplicate and unsure outside correctness", () => {
  const analysis = scopeAnalysis(cases, {
    X0001: { decision: "correct" },
    X0002: { decision: "duplicate" },
  });
  assert.deepEqual(
    { correct: analysis.correct, duplicate: analysis.duplicate, annotated: analysis.annotated, correctness: analysis.correctness },
    { correct: 1, duplicate: 1, annotated: 2, correctness: 1 },
  );
});

test("export and import preserve only known reviewed IDs", () => {
  const exported = buildExportDocument(data, { X0001: { decision: "unsure", note: "Need Orca evidence" } }, "2026-09-04T01:00:00Z");
  assert.equal(exported.schemaVersion, REVIEW_SCHEMA);
  exported.reviews.push({ errorId: "X9999", decision: "correct", note: "outside dataset" });
  assert.deepEqual(importReviewDocument(exported, cases), {
    X0001: { decision: "unsure", note: "Need Orca evidence", updatedAt: null },
  });
});
