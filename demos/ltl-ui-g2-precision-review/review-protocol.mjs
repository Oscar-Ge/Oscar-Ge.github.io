export const REVIEW_EXPORT_SCHEMA = "ltl-ui-g2-precision-review-export/1";
export const REVIEW_DECISIONS = Object.freeze([
  "make-sense",
  "unsure",
  "reject",
]);

const DECISION_SET = new Set(REVIEW_DECISIONS);

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function exactKeys(value, expected, path) {
  if (!isPlainObject(value)) {
    throw new Error(`${path} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])
  ) {
    throw new Error(
      `${path} must contain exactly [${wanted.join(", ")}]`,
    );
  }
}

function nonemptyString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function normalizeReview(review, path, knownIds) {
  exactKeys(review, ["findingId", "decision", "note"], path);
  nonemptyString(review.findingId, `${path}.findingId`);
  if (!knownIds.has(review.findingId)) {
    throw new Error(`${path}.findingId is not part of this dataset`);
  }
  if (review.decision !== null && !DECISION_SET.has(review.decision)) {
    throw new Error(
      `${path}.decision must be make-sense, unsure, reject, or null`,
    );
  }
  if (typeof review.note !== "string") {
    throw new Error(`${path}.note must be a string`);
  }
  if (review.note.length > 5_000) {
    throw new Error(`${path}.note exceeds 5,000 characters`);
  }
  return {
    findingId: review.findingId,
    decision: review.decision,
    note: review.note,
  };
}

export function storageKey(dataset) {
  exactKeys(
    dataset,
    [
      "campaignReportIdentity",
      "claimBoundary",
      "id",
      "identity",
      "producerSourceCommit",
      "verifierSourceCommit",
      "title",
    ],
    "dataset",
  );
  nonemptyString(dataset.id, "dataset.id");
  nonemptyString(dataset.identity, "dataset.identity");
  return `ltl-ui-g2-precision-reviews-v1:${encodeURIComponent(dataset.id)}:${dataset.identity}`;
}

export function createExportPayload(dataset, findingIds, reviewsById) {
  const knownIds = new Set(findingIds);
  const reviews = [];
  for (const findingId of findingIds) {
    const review = reviewsById.get(findingId);
    if (!review) {
      continue;
    }
    const normalized = normalizeReview(
      {
        findingId,
        decision: review.decision ?? null,
        note: review.note ?? "",
      },
      `reviews.${findingId}`,
      knownIds,
    );
    if (normalized.decision !== null || normalized.note !== "") {
      reviews.push(normalized);
    }
  }
  return {
    schemaVersion: REVIEW_EXPORT_SCHEMA,
    dataset: {
      id: dataset.id,
      identity: dataset.identity,
    },
    reviews,
  };
}

export function validateImportPayload(payload, dataset, findingIds) {
  exactKeys(payload, ["schemaVersion", "dataset", "reviews"], "root");
  if (payload.schemaVersion !== REVIEW_EXPORT_SCHEMA) {
    throw new Error(`root.schemaVersion must equal ${REVIEW_EXPORT_SCHEMA}`);
  }
  exactKeys(payload.dataset, ["id", "identity"], "root.dataset");
  if (payload.dataset.id !== dataset.id) {
    throw new Error("root.dataset.id does not match the loaded dataset");
  }
  if (payload.dataset.identity !== dataset.identity) {
    throw new Error("root.dataset.identity does not match the loaded dataset");
  }
  if (!Array.isArray(payload.reviews)) {
    throw new Error("root.reviews must be an array");
  }

  const knownIds = new Set(findingIds);
  const seen = new Set();
  const reviews = payload.reviews.map((review, index) => {
    const normalized = normalizeReview(
      review,
      `root.reviews[${index}]`,
      knownIds,
    );
    if (seen.has(normalized.findingId)) {
      throw new Error(
        `root.reviews[${index}].findingId is duplicated`,
      );
    }
    seen.add(normalized.findingId);
    return normalized;
  });

  return {
    schemaVersion: REVIEW_EXPORT_SCHEMA,
    dataset: {
      id: dataset.id,
      identity: dataset.identity,
    },
    reviews,
  };
}

export function reviewsToMap(payload) {
  return new Map(
    payload.reviews.map((review) => [
      review.findingId,
      {
        decision: review.decision,
        note: review.note,
      },
    ]),
  );
}

export function importReviewsIntoStorage(
  payload,
  dataset,
  findingIds,
  storage,
) {
  const validated = validateImportPayload(payload, dataset, findingIds);
  const importedReviews = reviewsToMap(validated);
  storage.setItem(
    storageKey(dataset),
    JSON.stringify(validated),
  );
  return {
    payload: validated,
    reviews: importedReviews,
  };
}
