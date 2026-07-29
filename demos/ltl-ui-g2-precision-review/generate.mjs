#!/usr/bin/env node

import {
  createHash,
} from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const SOURCE_SCHEMA = "ltl-ui-g2-precision-source/2";
export const DATA_SCHEMA = "ltl-ui-g2-precision-data/2";
export const GENUI_G2_PRECISION_RESULT = "genui-g2-precision-result/1";
export const GENUI_G2_PRECISION_REPORT = "genui-g2-precision-report/1";

const FINDING_KINDS = new Set(["formal", "candidate"]);
const IMAGE_ROLES = new Set(["witness", "context-only"]);
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const GIT_OBJECT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const CAMPAIGN_REPORT_PATHS = [
  "evidence/campaign-report.json.gz",
  "evidence/campaign-report.json",
];

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertObject(value, path) {
  if (!isPlainObject(value)) {
    fail(path, "must be a plain object");
  }
}

function assertExactKeys(value, expected, path) {
  assertObject(value, path);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])
  ) {
    fail(
      path,
      `must contain exactly [${wanted.join(", ")}], found [${actual.join(", ")}]`,
    );
  }
}

function assertNonemptyString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "must be a non-empty string");
  }
}

function assertNullableString(value, path) {
  if (value !== null) {
    assertNonemptyString(value, path);
  }
}

function assertArray(value, path) {
  if (!Array.isArray(value)) {
    fail(path, "must be an array");
  }
}

function assertUnique(items, valueOf, path) {
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    const value = valueOf(item);
    if (seen.has(value)) {
      fail(`${path}[${index}]`, `duplicate value ${JSON.stringify(value)}`);
    }
    seen.add(value);
  }
}

function assertSafeRelativePath(value, path) {
  assertNonemptyString(value, path);
  if (
    isAbsolute(value)
    || value.includes("\\")
    || value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail(path, "must be a normalized relative path without traversal");
  }
}

function assertInside(baseDir, candidate, path) {
  const rel = relative(baseDir, candidate);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) {
    return;
  }
  fail(path, "resolves outside the dataset directory");
}

function sha256(bufferOrString) {
  return `sha256:${createHash("sha256").update(bufferOrString).digest("hex")}`;
}

function readRegularDatasetFile(baseDir, relativePath, path, label) {
  assertSafeRelativePath(relativePath, path);
  const filePath = resolve(baseDir, relativePath);
  assertInside(baseDir, filePath, path);
  if (!existsSync(filePath)) {
    fail(path, `${label} is missing (${relativePath})`);
  }
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(path, `${label} must be a regular, non-symlink file`);
  }
  assertInside(realpathSync(baseDir), realpathSync(filePath), path);
  return readFileSync(filePath);
}

function readJsonDatasetFile(baseDir, relativePath, path, label) {
  const storedBytes = readRegularDatasetFile(
    baseDir,
    relativePath,
    path,
    label,
  );
  if (!relativePath.endsWith(".gz")) {
    return storedBytes;
  }
  try {
    return gunzipSync(storedBytes);
  } catch {
    fail(path, `${label} is not valid gzip data`);
  }
}

function assertSupportedImage(buffer, filePath, path) {
  const isPng = (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  );
  const isJpeg = (
    buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff
  );
  const isWebp = (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
  if (!isPng && !isJpeg && !isWebp) {
    fail(path, `${filePath} is not a supported PNG, JPEG, or WebP image`);
  }
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value, spacing = 2) {
  return JSON.stringify(stableValue(value), null, spacing);
}

function equalJson(left, right) {
  return stableStringify(left, 0) === stableStringify(right, 0);
}

function validateProperty(property, path) {
  assertExactKeys(
    property,
    ["atomicId", "title", "ltlFormula", "bombadilAssertion", "sourceUrl"],
    path,
  );
  assertNonemptyString(property.atomicId, `${path}.atomicId`);
  if (!ID_PATTERN.test(property.atomicId)) {
    fail(`${path}.atomicId`, "contains unsupported characters");
  }
  assertNonemptyString(property.title, `${path}.title`);
  assertNonemptyString(property.ltlFormula, `${path}.ltlFormula`);
  assertNonemptyString(property.bombadilAssertion, `${path}.bombadilAssertion`);
  const assertionLines = property.bombadilAssertion
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (assertionLines.length < 2 || assertionLines.length > 3) {
    fail(`${path}.bombadilAssertion`, "must contain 2–3 non-empty lines");
  }
  assertNonemptyString(property.sourceUrl, `${path}.sourceUrl`);
  let source;
  try {
    source = new URL(property.sourceUrl);
  } catch {
    fail(`${path}.sourceUrl`, "must be an absolute HTTPS URL");
  }
  if (source.protocol !== "https:") {
    fail(`${path}.sourceUrl`, "must use HTTPS");
  }
}

function validateFocusBox(box, path) {
  if (box === null) {
    return;
  }
  assertExactKeys(box, ["xPct", "yPct", "widthPct", "heightPct", "label"], path);
  for (const field of ["xPct", "yPct", "widthPct", "heightPct"]) {
    if (!Number.isFinite(box[field])) {
      fail(`${path}.${field}`, "must be a finite number");
    }
  }
  if (
    box.xPct < 0
    || box.yPct < 0
    || box.widthPct <= 0
    || box.heightPct <= 0
    || box.xPct + box.widthPct > 100
    || box.yPct + box.heightPct > 100
  ) {
    fail(path, "must describe a positive rectangle inside the screenshot");
  }
  assertNonemptyString(box.label, `${path}.label`);
}

function validateStep(step, path, baseDir) {
  assertExactKeys(
    step,
    [
      "id",
      "label",
      "action",
      "state",
      "image",
      "imageRole",
      "imageSha256",
      "focusBox",
      "facts",
    ],
    path,
  );
  assertNonemptyString(step.id, `${path}.id`);
  if (!ID_PATTERN.test(step.id)) {
    fail(`${path}.id`, "contains unsupported characters");
  }
  for (const field of ["label", "action", "state"]) {
    assertNonemptyString(step[field], `${path}.${field}`);
  }
  assertSafeRelativePath(step.image, `${path}.image`);
  if (!IMAGE_ROLES.has(step.imageRole)) {
    fail(`${path}.imageRole`, "must be witness or context-only");
  }
  if (!SHA256_PATTERN.test(step.imageSha256)) {
    fail(`${path}.imageSha256`, "must be sha256:<64 lowercase hex>");
  }
  validateFocusBox(step.focusBox, `${path}.focusBox`);
  assertArray(step.facts, `${path}.facts`);
  if (step.facts.length > 3) {
    fail(`${path}.facts`, "must contain at most three facts");
  }
  for (const [index, fact] of step.facts.entries()) {
    const factPath = `${path}.facts[${index}]`;
    assertExactKeys(fact, ["label", "value"], factPath);
    assertNonemptyString(fact.label, `${factPath}.label`);
    assertNonemptyString(fact.value, `${factPath}.value`);
  }

  const imagePath = resolve(baseDir, step.image);
  assertInside(baseDir, imagePath, `${path}.image`);
  if (!existsSync(imagePath)) {
    fail(`${path}.image`, `missing file ${step.image}`);
  }
  const imageStat = lstatSync(imagePath);
  if (!imageStat.isFile() || imageStat.isSymbolicLink()) {
    fail(`${path}.image`, "must resolve to a regular, non-symlink file");
  }
  assertInside(
    realpathSync(baseDir),
    realpathSync(imagePath),
    `${path}.image`,
  );
  const imageBytes = readFileSync(imagePath);
  assertSupportedImage(imageBytes, step.image, `${path}.image`);
  const actualSha256 = sha256(imageBytes);
  if (actualSha256 !== step.imageSha256) {
    fail(
      `${path}.imageSha256`,
      `does not match file (expected ${actualSha256})`,
    );
  }
  return {
    sha256: actualSha256,
    byteCount: imageBytes.byteLength,
  };
}

function validateEvidence(finding, path, baseDir, report, dataset) {
  const evidencePath = `${path}.evidence`;
  if (finding.findingKind === "formal") {
    assertExactKeys(
      finding.evidence,
      ["occurrenceId", "resultPath", "resultSha256"],
      evidencePath,
    );
    assertNonemptyString(finding.evidence.occurrenceId, `${evidencePath}.occurrenceId`);
  } else {
    assertExactKeys(
      finding.evidence,
      ["signalId", "resultPath", "resultSha256"],
      evidencePath,
    );
    assertNonemptyString(finding.evidence.signalId, `${evidencePath}.signalId`);
  }
  assertSafeRelativePath(finding.evidence.resultPath, `${evidencePath}.resultPath`);
  if (!SHA256_PATTERN.test(finding.evidence.resultSha256)) {
    fail(`${evidencePath}.resultSha256`, "must be sha256:<64 lowercase hex>");
  }
  const resultPath = resolve(baseDir, finding.evidence.resultPath);
  assertInside(baseDir, resultPath, `${evidencePath}.resultPath`);
  if (!existsSync(resultPath)) {
    fail(
      `${evidencePath}.resultPath`,
      `missing file ${finding.evidence.resultPath}`,
    );
  }
  const resultStat = lstatSync(resultPath);
  if (!resultStat.isFile() || resultStat.isSymbolicLink()) {
    fail(`${evidencePath}.resultPath`, "must resolve to a regular, non-symlink file");
  }
  assertInside(
    realpathSync(baseDir),
    realpathSync(resultPath),
    `${evidencePath}.resultPath`,
  );
  const resultBytes = readJsonDatasetFile(
    baseDir,
    finding.evidence.resultPath,
    `${evidencePath}.resultPath`,
    "result evidence",
  );
  const resultSha256 = sha256(resultBytes);
  if (resultSha256 !== finding.evidence.resultSha256) {
    fail(
      `${evidencePath}.resultSha256`,
      `does not match file (expected ${resultSha256})`,
    );
  }
  let result;
  try {
    result = JSON.parse(resultBytes.toString("utf8"));
  } catch {
    fail(`${evidencePath}.resultPath`, "must contain valid JSON evidence");
  }
  if (
    !isPlainObject(result)
    || result.schemaVersion !== GENUI_G2_PRECISION_RESULT
    || result.status !== "COMPLETED"
  ) {
    fail(
      `${evidencePath}.resultPath`,
      "must contain a completed official G2 precision result",
    );
  }
  if (result.attemptId !== finding.attemptId) {
    fail(
      `${evidencePath}.resultPath`,
      "result attempt ID does not match the finding",
    );
  }
  if (result.site !== finding.siteId) {
    fail(
      `${evidencePath}.resultPath`,
      "result site does not match the finding",
    );
  }
  if (!Array.isArray(result.propertyResults)) {
    fail(
      `${evidencePath}.resultPath`,
      "official G2 precision result must contain propertyResults",
    );
  }
  if (!Array.isArray(result.candidateSignals)) {
    fail(
      `${evidencePath}.resultPath`,
      "official G2 precision result must contain candidateSignals",
    );
  }
  if (
    result.protocolLockIdentity !== report.protocolLockIdentity
    || result.executionLockIdentity !== report.executionLockIdentity
    || result.sourceCommit !== dataset.producerSourceCommit
    || result.source?.commit !== dataset.producerSourceCommit
    || !equalJson(result.source, report.executionSource)
  ) {
    fail(
      `${evidencePath}.resultPath`,
      "result source lineage does not match the campaign report",
    );
  }
  if (finding.findingKind === "formal") {
    const matches = result.propertyResults.filter(
      (propertyResult) => propertyResult?.atomicId === finding.atomicId,
    );
    if (matches.length !== 1) {
      fail(
        `${evidencePath}.resultPath`,
        "result must contain exactly one matching Atomic property result",
      );
    }
    const [propertyResult] = matches;
    const witness = propertyResult.witness;
    if (
      propertyResult.outcome !== "VIOLATION_OBSERVED"
      || propertyResult.violationOccurrenceCount !== 1
      || !isPlainObject(witness)
      || witness.occurrenceId !== finding.evidence.occurrenceId
      || witness.occurrenceId
        !== `${finding.attemptId}:${finding.atomicId}:first-counterexample`
      || !Array.isArray(witness.propertyObservation)
      || witness.propertyObservation.length === 0
      || !Array.isArray(propertyResult.witnesses)
      || propertyResult.witnesses.length !== 1
      || !equalJson(propertyResult.witnesses[0], witness)
    ) {
      fail(
        `${evidencePath}.resultPath`,
        "formal finding does not match one complete VIOLATION_OBSERVED witness",
      );
    }
    const screenshot = witness.screenshotArtifact;
    if (
      !isPlainObject(screenshot)
      || typeof screenshot.relativePath !== "string"
      || !SHA256_PATTERN.test(screenshot.sha256)
      || !Number.isSafeInteger(screenshot.byteCount)
      || screenshot.byteCount <= 0
    ) {
      fail(
        `${evidencePath}.resultPath`,
        "formal G2 witness screenshot receipt is invalid",
      );
    }
    const reportMatches = report.violations.filter((violation) =>
      violation?.attemptId === finding.attemptId
      && violation.site === finding.siteId
      && violation.atomicId === finding.atomicId
      && violation.occurrenceId === finding.evidence.occurrenceId);
    const reportFinding = reportMatches[0];
    if (
      reportMatches.length !== 1
      || reportFinding.resultArtifact
        !== `attempts/${finding.attemptId}/result.json`
      || !equalJson(reportFinding.witness, witness)
      || !Array.isArray(reportFinding.witnesses)
      || reportFinding.witnesses.length !== 1
      || !equalJson(reportFinding.witnesses[0], witness)
    ) {
      fail(
        `${evidencePath}.resultPath`,
        "formal finding does not match the campaign report",
      );
    }
  } else {
    const resultMatches = result.candidateSignals.filter((signal) =>
      signal?.signalId === finding.evidence.signalId
      && signal.atomicId === finding.atomicId
      && signal.excludedFromClaims === true);
    const reportMatches = report.candidates.filter((candidate) =>
      candidate?.attemptId === finding.attemptId
      && candidate.site === finding.siteId
      && candidate.atomicId === finding.atomicId
      && candidate.signalId === finding.evidence.signalId);
    const reportFinding = reportMatches[0];
    if (
      resultMatches.length !== 1
      || reportMatches.length !== 1
      || reportFinding.resultArtifact
        !== `attempts/${finding.attemptId}/result.json`
      || !equalJson(reportFinding.signal, resultMatches[0])
    ) {
      fail(
        `${evidencePath}.resultPath`,
        "candidate signal does not match the result and campaign report",
      );
    }
  }
  return { result, resultSha256 };
}

function validateFinding(
  finding,
  path,
  propertyIds,
  baseDir,
  report,
  dataset,
) {
  assertExactKeys(
    finding,
    [
      "id",
      "slug",
      "order",
      "findingKind",
      "outcome",
      "excludedFromClaims",
      "siteId",
      "attemptId",
      "atomicId",
      "title",
      "summary",
      "reason",
      "steps",
      "evidence",
    ],
    path,
  );
  assertNonemptyString(finding.id, `${path}.id`);
  if (!ID_PATTERN.test(finding.id)) {
    fail(`${path}.id`, "contains unsupported characters");
  }
  assertNonemptyString(finding.slug, `${path}.slug`);
  if (!SLUG_PATTERN.test(finding.slug)) {
    fail(`${path}.slug`, "must use lowercase kebab-case");
  }
  if (!Number.isSafeInteger(finding.order) || finding.order < 0) {
    fail(`${path}.order`, "must be a non-negative safe integer");
  }
  if (!FINDING_KINDS.has(finding.findingKind)) {
    fail(`${path}.findingKind`, "must be formal or candidate");
  }
  if (typeof finding.excludedFromClaims !== "boolean") {
    fail(`${path}.excludedFromClaims`, "must be boolean");
  }
  for (const field of [
    "siteId",
    "attemptId",
    "atomicId",
    "title",
    "summary",
    "reason",
  ]) {
    assertNonemptyString(finding[field], `${path}.${field}`);
  }
  if (!propertyIds.has(finding.atomicId)) {
    fail(`${path}.atomicId`, `unknown property ${JSON.stringify(finding.atomicId)}`);
  }

  if (finding.findingKind === "formal") {
    if (finding.outcome !== "VIOLATION_OBSERVED") {
      fail(`${path}.outcome`, "formal findings must be VIOLATION_OBSERVED");
    }
    if (finding.excludedFromClaims !== false) {
      fail(`${path}.excludedFromClaims`, "formal findings must not be excluded");
    }
  } else {
    if (finding.outcome !== "CANDIDATE_SIGNAL") {
      fail(`${path}.outcome`, "candidate findings must be CANDIDATE_SIGNAL");
    }
    if (finding.excludedFromClaims !== true) {
      fail(`${path}.excludedFromClaims`, "candidate findings must be excluded");
    }
  }

  assertArray(finding.steps, `${path}.steps`);
  if (finding.steps.length === 0) {
    fail(`${path}.steps`, "must contain at least one screenshot-backed state");
  }
  assertUnique(finding.steps, (step) => step.id, `${path}.steps.id`);
  assertUnique(finding.steps, (step) => step.image, `${path}.steps.image`);

  const imageReceipts = finding.steps.map((step, index) =>
    validateStep(step, `${path}.steps[${index}]`, baseDir));
  assertUnique(
    imageReceipts,
    (receipt) => receipt.sha256,
    `${path}.steps.imageSha256`,
  );

  const witnessCount = finding.steps.filter(
    (step) => step.imageRole === "witness",
  ).length;
  if (finding.findingKind === "formal" && witnessCount === 0) {
    fail(`${path}.steps`, "formal findings require at least one witness image");
  }
  if (finding.findingKind === "candidate" && witnessCount !== 0) {
    fail(`${path}.steps`, "candidate images must all be context-only");
  }

  const evidence = validateEvidence(
    finding,
    path,
    baseDir,
    report,
    dataset,
  );
  if (finding.findingKind === "formal") {
    const screenshot = evidence.result.propertyResults.find(
      (propertyResult) => propertyResult.atomicId === finding.atomicId,
    ).witness.screenshotArtifact;
    const witnessMatches = finding.steps.some((step, index) =>
      step.imageRole === "witness"
      && imageReceipts[index].sha256 === screenshot.sha256
      && imageReceipts[index].byteCount === screenshot.byteCount);
    if (!witnessMatches) {
      fail(
        `${path}.steps`,
        "formal witness screenshot does not match the official receipt",
      );
    }
  }
}

function validateCampaignReport(dataset, baseDir) {
  const reportPath = CAMPAIGN_REPORT_PATHS.find((relativePath) =>
    existsSync(resolve(baseDir, relativePath)));
  if (!reportPath) {
    fail(
      "root.dataset.campaignReportIdentity",
      "campaign report is missing",
    );
  }
  const reportBytes = readJsonDatasetFile(
    baseDir,
    reportPath,
    "root.dataset.campaignReportIdentity",
    "campaign report",
  );
  const actualIdentity = sha256(reportBytes);
  if (dataset.campaignReportIdentity !== actualIdentity) {
    fail(
      "root.dataset.campaignReportIdentity",
      `does not match campaign report (expected ${actualIdentity})`,
    );
  }
  let report;
  try {
    report = JSON.parse(reportBytes.toString("utf8"));
  } catch {
    fail(
      "root.dataset.campaignReportIdentity",
      "campaign report must contain valid JSON",
    );
  }
  if (
    !isPlainObject(report)
    || report.schemaVersion !== GENUI_G2_PRECISION_REPORT
    || report.status !== "COMPLETED"
  ) {
    fail(
      "root.dataset.campaignReportIdentity",
      "must identify a completed official G2 precision report",
    );
  }
  if (
    !isPlainObject(report.source)
    || report.source.dirty !== false
    || !GIT_OBJECT_PATTERN.test(report.source.commit ?? "")
    || !GIT_OBJECT_PATTERN.test(report.source.tree ?? "")
    || report.source.commit !== dataset.verifierSourceCommit
  ) {
    fail(
      "root.dataset.verifierSourceCommit",
      "does not match the clean source identity in the campaign report",
    );
  }
  if (
    !SHA256_PATTERN.test(report.protocolLockIdentity ?? "")
    || !SHA256_PATTERN.test(report.executionLockIdentity ?? "")
    || !SHA256_PATTERN.test(report.verificationLockIdentity ?? "")
    || report.protocolLockIdentity !== report.executionLockIdentity
    || !Array.isArray(report.violations)
    || !Array.isArray(report.candidates)
    || report.violationCount !== report.violations.length
    || report.candidateSignalCount !== report.candidates.length
  ) {
    fail(
      "root.dataset.campaignReportIdentity",
      "campaign report finding inventory is invalid",
    );
  }
  const occurrenceIds = report.violations.map(
    (violation) => violation?.occurrenceId,
  );
  if (
    occurrenceIds.some(
      (occurrenceId) => typeof occurrenceId !== "string" || occurrenceId === "",
    )
    || new Set(occurrenceIds).size !== occurrenceIds.length
  ) {
    fail(
      "root.dataset.campaignReportIdentity",
      "campaign report violation identities are invalid",
    );
  }
  return report;
}

export function validateDataset(source, { baseDir = process.cwd() } = {}) {
  assertExactKeys(
    source,
    ["schemaVersion", "dataset", "properties", "findings"],
    "root",
  );
  if (source.schemaVersion !== SOURCE_SCHEMA) {
    fail("root.schemaVersion", `must equal ${SOURCE_SCHEMA}`);
  }
  assertExactKeys(
    source.dataset,
    [
      "id",
      "title",
      "producerSourceCommit",
      "verifierSourceCommit",
      "campaignReportIdentity",
      "claimBoundary",
    ],
    "root.dataset",
  );
  for (const field of ["id", "title", "claimBoundary"]) {
    assertNonemptyString(source.dataset[field], `root.dataset.${field}`);
  }
  if (!ID_PATTERN.test(source.dataset.id)) {
    fail("root.dataset.id", "contains unsupported characters");
  }
  assertNullableString(
    source.dataset.producerSourceCommit,
    "root.dataset.producerSourceCommit",
  );
  assertNullableString(
    source.dataset.verifierSourceCommit,
    "root.dataset.verifierSourceCommit",
  );
  assertNullableString(
    source.dataset.campaignReportIdentity,
    "root.dataset.campaignReportIdentity",
  );

  assertArray(source.properties, "root.properties");
  source.properties.forEach((property, index) =>
    validateProperty(property, `root.properties[${index}]`));
  assertUnique(source.properties, (property) => property.atomicId, "root.properties.atomicId");

  assertArray(source.findings, "root.findings");
  let campaignReport = null;
  if (source.findings.length > 0) {
    if (
      typeof source.dataset.producerSourceCommit !== "string"
      || !GIT_OBJECT_PATTERN.test(source.dataset.producerSourceCommit)
      || typeof source.dataset.verifierSourceCommit !== "string"
      || !GIT_OBJECT_PATTERN.test(source.dataset.verifierSourceCommit)
    ) {
      fail(
        "root.dataset.producerSourceCommit",
        "non-empty datasets require full producer and verifier Git commits",
      );
    }
    if (
      typeof source.dataset.campaignReportIdentity !== "string"
      || !SHA256_PATTERN.test(source.dataset.campaignReportIdentity)
    ) {
      fail(
        "root.dataset.campaignReportIdentity",
        "non-empty datasets require a sha256 report identity",
      );
    }
    campaignReport = validateCampaignReport(source.dataset, resolve(baseDir));
  }

  const propertyIds = new Set(source.properties.map((property) => property.atomicId));
  source.findings.forEach((finding, index) =>
    validateFinding(
      finding,
      `root.findings[${index}]`,
      propertyIds,
      resolve(baseDir),
      campaignReport,
      source.dataset,
    ));
  assertUnique(source.findings, (finding) => finding.id, "root.findings.id");
  assertUnique(source.findings, (finding) => finding.slug, "root.findings.slug");
  assertUnique(source.findings, (finding) => finding.order, "root.findings.order");

  const normalized = {
    schemaVersion: DATA_SCHEMA,
    dataset: {
      ...source.dataset,
      identity: sha256(stableStringify(source, 0)),
    },
    properties: [...source.properties].sort((a, b) =>
      a.atomicId.localeCompare(b.atomicId)),
    findings: [...source.findings].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    ),
  };

  return stableValue(normalized);
}

export function renderDatasetScript(dataset) {
  return `// Generated by generate.mjs. Do not edit by hand.
(() => {
  const deepFreeze = (value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.values(value).forEach(deepFreeze);
    }
    return value;
  };

  window.LTL_G2_PRECISION_REVIEW = deepFreeze(${stableStringify(dataset, 2)});
})();
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderFindingPage(finding) {
  const slug = escapeHtml(finding.slug);
  const title = escapeHtml(finding.title);
  return `<!doctype html>
<html lang="en" data-view="finding" data-root="../" data-finding="${slug}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${title} · LTL Precision Review</title>
    <link rel="stylesheet" href="../styles.css">
  </head>
  <body>
    <a class="skip-link" href="#app">Skip to finding</a>
    <div id="app" class="app-shell" aria-live="polite">
      <p class="loading">Loading reviewed evidence…</p>
    </div>
    <script src="../findings.js"></script>
    <script type="module" src="../app.mjs"></script>
  </body>
</html>
`;
}

function parseArgs(argv) {
  const result = {
    input: "dataset.json",
    output: ".",
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      result.check = true;
    } else if (arg === "--input" || arg === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      result[arg.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return result;
}

function assertGeneratedFile(path, expected) {
  if (!existsSync(path)) {
    throw new Error(`${path}: generated file is missing`);
  }
  const actual = readFileSync(path, "utf8");
  if (actual !== expected) {
    throw new Error(`${path}: generated file is stale`);
  }
}

export function generateReviewSite({
  inputPath,
  outputDir,
  check = false,
}) {
  const absoluteInput = resolve(inputPath);
  const absoluteOutput = resolve(outputDir);
  if (absoluteOutput !== dirname(absoluteInput)) {
    throw new Error(
      "The output directory must equal the dataset directory so evidence paths stay stable",
    );
  }
  const source = JSON.parse(readFileSync(absoluteInput, "utf8"));
  const dataset = validateDataset(source, { baseDir: dirname(absoluteInput) });
  const datasetScript = renderDatasetScript(dataset);
  const datasetScriptPath = join(absoluteOutput, "findings.js");

  if (check) {
    assertGeneratedFile(datasetScriptPath, datasetScript);
  } else {
    writeFileSync(datasetScriptPath, datasetScript, "utf8");
  }

  for (const finding of dataset.findings) {
    const pagePath = join(absoluteOutput, finding.slug, "index.html");
    const page = renderFindingPage(finding);
    if (check) {
      assertGeneratedFile(pagePath, page);
    } else {
      const pageDir = dirname(pagePath);
      mkdirSync(pageDir, { recursive: true });
      writeFileSync(pagePath, page, "utf8");
    }
  }

  return dataset;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const dataset = generateReviewSite({
      inputPath: args.input,
      outputDir: args.output,
      check: args.check,
    });
    process.stdout.write(
      `${args.check ? "Checked" : "Generated"} ${dataset.findings.length} findings; dataset identity ${dataset.dataset.identity}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
