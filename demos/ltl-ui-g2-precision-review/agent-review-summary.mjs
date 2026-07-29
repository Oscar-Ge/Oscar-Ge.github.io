#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

import { stableStringify } from "./generate.mjs";

const DECISIONS = new Set(["make-sense", "unsure", "reject"]);

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function reviewerName(item, filename) {
  if (typeof item.reviewer === "string" && item.reviewer.trim() !== "") {
    return item.reviewer.trim();
  }
  const match = basename(filename).match(/reviewer-([a-z])/iu);
  if (!match) fail(`${filename} has no reviewer identity`);
  return match[1].toUpperCase();
}

function normalizeReview(item, filename) {
  const line = item.line ?? item.lineNumber;
  if (!Number.isInteger(line) || line <= 0) {
    fail(`${filename} has an invalid review line`);
  }
  if (typeof item.findingId !== "string" || item.findingId === "") {
    fail(`${filename} line ${line} has no finding ID`);
  }
  if (typeof item.atomicId !== "string" || item.atomicId === "") {
    fail(`${filename} line ${line} has no Atomic ID`);
  }
  if (!DECISIONS.has(item.decision)) {
    fail(`${filename} line ${line} has an invalid decision`);
  }
  return {
    reviewer: reviewerName(item, filename),
    line,
    findingId: item.findingId,
    atomicId: item.atomicId,
    decision: item.decision,
  };
}

export function buildSummary(
  datasetBytes,
  reviewDocuments,
  overlapDocument = null,
) {
  const dataset = parseJson(datasetBytes, "dataset");
  if (!Array.isArray(dataset.findings) || !dataset.dataset?.id) {
    fail("dataset has no finding inventory or ID");
  }
  const datasetIdentity = sha256(stableStringify(dataset, 0));
  const expected = new Map(
    dataset.findings.map((finding) => [
      finding.id,
      finding.atomicId,
    ]),
  );
  const reviews = reviewDocuments.flatMap(({ filename, bytes }) => {
    const document = parseJson(bytes, filename);
    if (!Array.isArray(document)) {
      fail(`${filename} must contain a review array`);
    }
    return document.map((item) => normalizeReview(item, filename));
  });
  const seen = new Set();
  for (const review of reviews) {
    if (seen.has(review.findingId)) {
      fail(`duplicate review for ${review.findingId}`);
    }
    seen.add(review.findingId);
    if (expected.get(review.findingId) !== review.atomicId) {
      fail(`review inventory differs at ${review.findingId}`);
    }
  }
  if (
    seen.size !== expected.size
    || [...expected.keys()].some((findingId) => !seen.has(findingId))
  ) {
    fail("review inventory does not exactly cover the dataset");
  }
  reviews.sort((left, right) => left.line - right.line);
  const counts = Object.fromEntries(
    [...DECISIONS].map((decision) => [
      decision,
      reviews.filter((review) => review.decision === decision).length,
    ]),
  );
  let overlap = null;
  if (overlapDocument) {
    const document = parseJson(
      overlapDocument.bytes,
      overlapDocument.filename,
    );
    if (!Array.isArray(document) || document.length === 0) {
      fail("overlap review must contain a non-empty review array");
    }
    const overlapReviews = document.map((item) =>
      normalizeReview(item, overlapDocument.filename));
    const overlapIds = new Set();
    for (const review of overlapReviews) {
      if (overlapIds.has(review.findingId)) {
        fail(`duplicate overlap review for ${review.findingId}`);
      }
      overlapIds.add(review.findingId);
      if (expected.get(review.findingId) !== review.atomicId) {
        fail(`overlap inventory differs at ${review.findingId}`);
      }
    }
    const primaryById = new Map(
      reviews.map((review) => [review.findingId, review.decision]),
    );
    const agreementCount = overlapReviews.filter((review) =>
      primaryById.get(review.findingId) === review.decision).length;
    const sampleSize = overlapReviews.length;
    const observedAgreement = agreementCount / sampleSize;
    const expectedAgreement = [...DECISIONS].reduce(
      (sum, decision) => {
        const primaryShare = overlapReviews.filter((review) =>
          primaryById.get(review.findingId) === decision).length / sampleSize;
        const overlapShare = overlapReviews.filter((review) =>
          review.decision === decision).length / sampleSize;
        return sum + primaryShare * overlapShare;
      },
      0,
    );
    const cohenKappa = expectedAgreement === 1
      ? null
      : (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
    overlap = {
      report: {
        relativePath: basename(overlapDocument.filename),
        sha256: sha256(overlapDocument.bytes),
        byteCount: overlapDocument.bytes.byteLength,
      },
      sampleSize,
      agreementCount,
      observedAgreement,
      expectedAgreement,
      cohenKappa,
      samplingBoundary:
        "The overlap set was a small purposive sample spanning properties and initial decisions; this is diagnostic agreement, not a population reliability estimate.",
    };
  }
  return {
    schemaVersion: "ltl-ui-agent-review-summary/1",
    datasetId: dataset.dataset.id,
    datasetIdentity,
    reviewedFindingCount: reviews.length,
    counts,
    reports: reviewDocuments.map(({ filename, bytes }) => {
      const document = parseJson(bytes, filename);
      return {
        reviewer: reviewerName(document[0], filename),
        relativePath: basename(filename),
        sha256: sha256(bytes),
        byteCount: bytes.byteLength,
      };
    }),
    overlap,
    method:
      "Three reviewers triaged disjoint finding ranges; a fourth independently reviewed a small purposive overlap sample. This is preliminary case screening, not ground-truth annotation.",
    agreementBoundary:
      overlap
        ? "Kappa describes only the purposive overlap sample and is not a population reliability estimate."
        : "No kappa is reported because no overlapping sample was provided.",
    claimBoundary:
      "A make-sense decision supports the checker interpretation for demo triage; it is not BLV ground truth or a task-effectiveness claim.",
    reviews,
  };
}

function main(args) {
  if (
    (args.length !== 6 && args.length !== 7)
    || args[0] !== "--output"
  ) {
    fail(
      "usage: agent-review-summary.mjs --output OUTPUT_DIR DATASET REVIEW_A REVIEW_B REVIEW_C [OVERLAP]",
    );
  }
  const outputDirectory = resolve(args[1]);
  const datasetPath = resolve(args[2]);
  const reviewPaths = args.slice(3, 6).map((filename) => resolve(filename));
  const overlapPath = args[6] ? resolve(args[6]) : null;
  const datasetBytes = readFileSync(datasetPath);
  const reviewDocuments = reviewPaths.map((filename) => ({
    filename,
    bytes: readFileSync(filename),
  }));
  const overlapDocument = overlapPath
    ? {
        filename: overlapPath,
        bytes: readFileSync(overlapPath),
      }
    : null;
  const summary = buildSummary(
    datasetBytes,
    reviewDocuments,
    overlapDocument,
  );
  const reviewDirectory = join(
    outputDirectory,
    "evidence",
    "agent-reviews",
  );
  mkdirSync(reviewDirectory, { recursive: true });
  for (const document of reviewDocuments) {
    writeFileSync(
      join(reviewDirectory, basename(document.filename)),
      document.bytes,
    );
  }
  if (overlapDocument) {
    writeFileSync(
      join(reviewDirectory, basename(overlapDocument.filename)),
      overlapDocument.bytes,
    );
  }
  const summaryBytes =
    Buffer.from(`${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(
    join(reviewDirectory, "summary.json"),
    summaryBytes,
  );
  process.stdout.write(
    `Summarized ${summary.reviewedFindingCount} reviews; ${sha256(summaryBytes)}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
