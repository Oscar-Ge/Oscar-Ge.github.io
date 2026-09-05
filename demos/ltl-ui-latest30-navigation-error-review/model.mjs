export const REVIEW_SCHEMA = "ltl-ui-latest30-navigation-error-review/1";
export const DECISIONS = Object.freeze({
  correct: "Correct error",
  "false-positive": "False positive",
  duplicate: "Duplicate",
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

export function scopeAnalysis(cases, reviews) {
  const counts = {
    total: cases.length,
    correct: 0,
    "false-positive": 0,
    duplicate: 0,
    unsure: 0,
    unreviewed: 0,
  };
  for (const item of cases) {
    const decision = normalizeReview(reviews[item.errorId])?.decision;
    counts[decision || "unreviewed"] += 1;
  }
  counts.annotated = counts.total - counts.unreviewed;
  counts.coverage = counts.total ? counts.annotated / counts.total : 0;
  const classified = counts.correct + counts["false-positive"];
  counts.correctness = classified ? counts.correct / classified : null;
  return counts;
}

export function buildExportDocument(data, reviews, generatedAt = new Date().toISOString()) {
  const normalized = Object.fromEntries(data.cases.map((item) => [
    item.errorId,
    normalizeReview(reviews[item.errorId]),
  ]));
  return {
    schemaVersion: REVIEW_SCHEMA,
    dataset: {
      schemaVersion: data.schemaVersion,
      title: data.title,
      actionPolicyVersion: data.actionPolicyVersion,
      expectedCaseCount: data.expectedCaseCount,
      sourceGeneratedAt: data.sourceGeneratedAt,
    },
    reviews: data.cases.map((item) => ({
      errorId: item.errorId,
      website: item.website,
      property: item.property,
      route: item.route,
      identity: item.identity,
      replays: item.replays,
      decision: normalized[item.errorId]?.decision ?? null,
      note: normalized[item.errorId]?.note ?? "",
      updatedAt: normalized[item.errorId]?.updatedAt ?? null,
    })),
    analysis: scopeAnalysis(data.cases, normalized),
    generatedAt,
  };
}

export function importReviewDocument(document, cases) {
  if (document?.schemaVersion !== REVIEW_SCHEMA || !Array.isArray(document.reviews)) {
    throw new TypeError(`Expected ${REVIEW_SCHEMA} JSON`);
  }
  const knownIds = new Set(cases.map((item) => item.errorId));
  const reviews = {};
  for (const row of document.reviews) {
    if (!knownIds.has(row?.errorId)) continue;
    const review = normalizeReview(row);
    if (review) reviews[row.errorId] = review;
  }
  return reviews;
}
