export const REVIEW_SCHEMA = "ltl-ui-cross-replay-error-review/1";
export const DECISIONS = Object.freeze({
  correct: "Correct error",
  "false-positive": "False positive",
  unsure: "Unsure",
});

export function normalizeReview(value) {
  if (!value || typeof value !== "object") return null;
  const decision = Object.hasOwn(DECISIONS, value.decision) ? value.decision : null;
  const note = typeof value.note === "string" ? value.note.slice(0, 20_000) : "";
  if (!decision && !note) return null;
  return {
    decision,
    note,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function scopeAnalysis(cases, reviews) {
  const counts = {
    totalErrorCount: cases.length,
    correctErrorCount: 0,
    falsePositiveCount: 0,
    unsureCount: 0,
    unreviewedCount: 0,
  };
  for (const item of cases) {
    const decision = normalizeReview(reviews[item.errorId])?.decision;
    if (decision === "correct") counts.correctErrorCount += 1;
    else if (decision === "false-positive") counts.falsePositiveCount += 1;
    else if (decision === "unsure") counts.unsureCount += 1;
    else counts.unreviewedCount += 1;
  }
  counts.decidedErrorCount = counts.correctErrorCount + counts.falsePositiveCount;
  counts.correctnessRate = counts.decidedErrorCount === 0
    ? null
    : counts.correctErrorCount / counts.decidedErrorCount;
  counts.annotationCoverageRate = counts.totalErrorCount === 0
    ? null
    : (counts.totalErrorCount - counts.unreviewedCount) / counts.totalErrorCount;
  return counts;
}

export function computeAnalysis(cases, reviews) {
  return {
    overall: scopeAnalysis(cases, reviews),
    byReplay: Object.fromEntries(["replay-1", "replay-2", "replay-3"].map((replay) => [
      replay,
      scopeAnalysis(cases.filter((item) => item.replays.includes(replay)), reviews),
    ])),
  };
}

export function buildExportDocument(data, reviews, generatedAt = new Date().toISOString()) {
  return {
    schemaVersion: REVIEW_SCHEMA,
    dataset: {
      schemaVersion: data.schemaVersion,
      title: data.title,
      actionPolicyVersion: data.actionPolicyVersion,
      deduplication: data.deduplication,
      expectedCaseCount: data.expectedCaseCount,
      replayErrorCounts: data.replayErrorCounts,
    },
    reviews: data.cases.map((item) => {
      const review = normalizeReview(reviews[item.errorId]);
      return {
        errorId: item.errorId,
        website: item.website,
        property: item.property,
        route: item.route,
        identity: item.identity,
        identityQuality: item.identityQuality,
        replays: item.replays,
        decision: review?.decision ?? null,
        note: review?.note ?? "",
        updatedAt: review?.updatedAt ?? null,
      };
    }),
    analysis: computeAnalysis(data.cases, reviews),
    generatedAt,
  };
}

export function importReviewDocument(document, cases) {
  if (document?.schemaVersion !== REVIEW_SCHEMA || !Array.isArray(document.reviews)) {
    throw new TypeError("Expected ltl-ui-cross-replay-error-review/1 JSON");
  }
  const knownIds = new Set(cases.map((item) => item.errorId));
  const reviews = {};
  let importedCount = 0;
  for (const row of document.reviews) {
    if (!knownIds.has(row?.errorId)) continue;
    const normalized = normalizeReview(row);
    if (!normalized) continue;
    reviews[row.errorId] = normalized;
    importedCount += 1;
  }
  return { reviews, importedCount };
}
