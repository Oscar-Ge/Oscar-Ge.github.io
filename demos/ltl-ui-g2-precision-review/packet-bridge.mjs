#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path, {
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import {
  generateReviewSite,
  stableStringify,
} from "./generate.mjs";
import {
  buildReviewerPropertyMetadata,
  reviewerPropertiesForDataset,
} from "./property-metadata.mjs";

const PACKET_MANIFEST_SCHEMA =
  "genui-g2-finding-packet-manifest/1";
const PACKET_SCHEMA = "genui-g2-finding-packet/1";
const REPORT_SCHEMA = "genui-g2-precision-report/1";
const RESULT_SCHEMA = "genui-g2-precision-result/1";
const SOURCE_SCHEMA = "ltl-ui-g2-precision-source/2";
const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const FORMAL_FILE = "formal-violations.jsonl";
const MANIFEST_FILE = "finding-packet-manifest.json";

function fail(message) {
  throw new Error(message);
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function equalJson(left, right) {
  return stableStringify(left, 0) === stableStringify(right, 0);
}

function assertAbsolute(value, label) {
  if (!path.isAbsolute(value ?? "")) {
    fail(`${label} must be an absolute path`);
  }
  return resolve(value);
}

function safeRelativePath(value, label) {
  if (typeof value !== "string"
      || value === ""
      || value.includes("\\")
      || path.posix.isAbsolute(value)
      || path.posix.normalize(value) !== value
      || value === "."
      || value.split("/").includes("..")) {
    fail(`${label} must be a safe relative path`);
  }
  return value;
}

function assertInside(root, candidate, label) {
  const displacement = relative(root, candidate);
  if (displacement === ""
      || displacement === ".."
      || displacement.startsWith(`..${sep}`)
      || path.isAbsolute(displacement)) {
    fail(`${label} escapes its evidence root`);
  }
}

function regularBytes(filename, label) {
  const metadata = lstatSync(filename);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    fail(`${label} must be a regular non-symlink file`);
  }
  return readFileSync(realpathSync(filename));
}

function rootedArtifact(root, relativePath, expected, label) {
  const safePath = safeRelativePath(relativePath, `${label} path`);
  const filename = resolve(root, ...safePath.split("/"));
  assertInside(root, filename, label);
  const canonical = realpathSync(filename);
  assertInside(root, canonical, label);
  const bytes = regularBytes(filename, label);
  if (expected?.relativePath !== safePath
      || expected.sha256 !== digest(bytes)
      || expected.byteCount !== bytes.byteLength) {
    fail(`${label} receipt changed`);
  }
  return { relativePath: safePath, bytes };
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(`${label} is not valid JSON`);
  }
}

function parseJsonLines(bytes, label) {
  const source = bytes.toString("utf8");
  if (source !== "" && !source.endsWith("\n")) {
    fail(`${label} must end with a newline`);
  }
  const lines = source.split(/\r?\n/u).filter((line) => line !== "");
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      fail(`${label} line ${index + 1} is not valid JSON`);
    }
  });
}

function exactReceipt(receipt, relativePath, bytes, lineCount = null) {
  if (receipt?.relativePath !== relativePath
      || receipt.sha256 !== digest(bytes)
      || receipt.byteCount !== bytes.byteLength
      || (lineCount !== null && receipt.lineCount !== lineCount)) {
    fail(`${relativePath} does not match the packet manifest receipt`);
  }
}

function gitSource(source, label, { requireClean = true } = {}) {
  if (!source
      || typeof source !== "object"
      || Array.isArray(source)
      || !equalJson(Object.keys(source).sort(), ["commit", "dirty", "tree"])
      || !GIT_COMMIT.test(source.commit ?? "")
      || !GIT_COMMIT.test(source.tree ?? "")
      || typeof source.dirty !== "boolean"
      || (requireClean && source.dirty !== false)) {
    fail(`${label} is invalid`);
  }
  return source;
}

function sha256Identity(value, label) {
  if (!SHA256.test(value ?? "")) fail(`${label} is invalid`);
  return value;
}

function absoluteReceiptArtifact(receipt, label) {
  if (!receipt
      || typeof receipt !== "object"
      || Array.isArray(receipt)
      || !equalJson(
        Object.keys(receipt).sort(),
        ["byteCount", "path", "sha256"],
      )
      || !path.isAbsolute(receipt.path ?? "")) {
    fail(`${label} receipt is invalid`);
  }
  const canonical = realpathSync(receipt.path);
  const bytes = regularBytes(canonical, label);
  if (canonical !== receipt.path
      || receipt.sha256 !== digest(bytes)
      || receipt.byteCount !== bytes.byteLength) {
    fail(`${label} receipt changed`);
  }
  return {
    bytes,
    value: parseJson(bytes, label),
  };
}

function verifyCurrentPacketLineage({
  manifest,
  report,
  reportBytes,
}) {
  const verifierSource = gitSource(
    report.source,
    "campaign report verifier source",
  );
  const executionSource = gitSource(
    report.executionSource,
    "campaign report execution source",
    { requireClean: false },
  );
  const sourceDigest = digest(
    Buffer.from(stableStringify(verifierSource, 0), "utf8"),
  );
  const identities = [
    "executionLockIdentity",
    "verificationLockIdentity",
    "designIdentity",
    "corpusManifestIdentity",
    "qualificationReportIdentity",
    "preflightReceiptIdentity",
    "smokeReceiptIdentity",
    "smokeResultIdentity",
  ];
  identities.forEach((field) =>
    sha256Identity(report[field], `campaign report ${field}`));
  if (report.protocolLockIdentity !== report.executionLockIdentity) {
    fail("campaign report protocol lock is not its execution lock");
  }

  const artifactManifestIdentity = sha256Identity(
    manifest.artifactManifestIdentity,
    "finding packet artifact manifest identity",
  );
  const integrity = manifest.artifactIntegrity;
  if (!integrity
      || integrity.schemaVersion !== "vertical-artifact-verification/1"
      || integrity.executionLockIdentity !== report.executionLockIdentity
      || integrity.verificationLockIdentity
        !== report.verificationLockIdentity
      || integrity.artifactManifestIdentity !== artifactManifestIdentity
      || integrity.artifactsModified !== false
      || !Array.isArray(integrity.issues)
      || integrity.issues.length !== 0
      || !Number.isInteger(integrity.expectedArtifactCount)
      || integrity.expectedArtifactCount <= 0
      || integrity.verifiedArtifactCount
        !== integrity.expectedArtifactCount) {
    fail("finding packet artifact integrity is invalid");
  }
  const artifactManifestArtifact = absoluteReceiptArtifact(
    integrity.manifest,
    "finding packet artifact manifest",
  );
  const integrityReportArtifact = absoluteReceiptArtifact(
    integrity.report,
    "finding packet artifact integrity report",
  );
  const {
    manifest: ignoredManifestReceipt,
    report: ignoredReportReceipt,
    ...integrityPayload
  } = integrity;
  if (artifactManifestArtifact.value?.schemaVersion
        !== "vertical-artifact-manifest/1"
      || artifactManifestArtifact.value.artifactManifestIdentity
        !== artifactManifestIdentity
      || artifactManifestArtifact.value.executionLockIdentity
        !== report.executionLockIdentity
      || !equalJson(integrityReportArtifact.value, integrityPayload)) {
    fail("finding packet artifact integrity binding is invalid");
  }

  const expectedLineage = {
    campaignReportSha256: digest(reportBytes),
    source: verifierSource,
    sourceDigest,
    executionSource,
    protocolLockIdentity: report.protocolLockIdentity,
    executionLockIdentity: report.executionLockIdentity,
    verificationLockIdentity: report.verificationLockIdentity,
    artifactManifestIdentity,
    artifactIntegrityReportIdentity: integrity.report.sha256,
    designIdentity: report.designIdentity,
    corpusManifestIdentity: report.corpusManifestIdentity,
    qualificationReportIdentity: report.qualificationReportIdentity,
    preflightReceiptIdentity: report.preflightReceiptIdentity,
    smokeReceiptIdentity: report.smokeReceiptIdentity,
    smokeResultIdentity: report.smokeResultIdentity,
  };
  if (!equalJson(manifest.source, verifierSource)
      || manifest.sourceDigest !== sourceDigest
      || !equalJson(manifest.executionSource, executionSource)
      || manifest.protocolLockIdentity !== report.protocolLockIdentity
      || manifest.executionLockIdentity !== report.executionLockIdentity
      || manifest.verificationLockIdentity
        !== report.verificationLockIdentity
      || !equalJson(manifest.campaignLineage, expectedLineage)
      || identities.slice(2).some((field) =>
        manifest[field] !== report[field])) {
    fail("finding packet manifest lineage differs from the campaign report");
  }
  return Object.freeze({
    verifierSource,
    executionSource,
    sourceDigest,
    campaignLineage: Object.freeze(expectedLineage),
  });
}

function uniqueTriggerIdentity(value) {
  const identities = new Map();
  function visit(current) {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== "object") return;
    if (typeof current.documentId === "string"
        && current.documentId !== ""
        && Number.isInteger(current.triggerInteractionEventId)
        && current.triggerInteractionEventId > 0) {
      const identity =
        `${current.documentId}:${current.triggerInteractionEventId}`;
      identities.set(identity, {
        documentId: current.documentId,
        eventId: current.triggerInteractionEventId,
      });
    }
    Object.values(current).forEach(visit);
  }
  visit(value);
  return identities.size === 1
    ? [...identities.values()][0]
    : null;
}

function controlLabel(target) {
  for (const field of ["name", "id", "role", "tag"]) {
    if (typeof target?.[field] === "string"
        && target[field].trim() !== "") {
      return target[field].trim();
    }
  }
  fail("trusted action has no evidence-backed control label");
}

function transactionAction(packet) {
  const actions = [];
  function visit(current) {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== "object") return;
    if (current.action?.trusted === true
        && typeof current.action.key === "string"
        && current.action.key !== ""
        && current.observation?.complete === true
        && current.observation?.contaminatedByLaterAction === false
        && Number.isFinite(current.observation?.deadlineMs)) {
      actions.push({
        key: current.action.key,
        deadlineMs: current.observation.deadlineMs,
      });
    }
    Object.values(current).forEach(visit);
  }
  visit(packet.transitionContext);
  const unique = new Map(
    actions.map((action) => [
      `${action.key}:${action.deadlineMs}`,
      action,
    ]),
  );
  if (unique.size !== 1) {
    fail("formal packet has no unique completed trusted action");
  }
  return [...unique.values()][0];
}

function propertyLevelControlLabel(packet) {
  const labels = {
    "AP-M1-03": "active dialog",
    "AP-M1-04": "active dialog",
    "AP-M1-05": "new modal opener",
  };
  const label = labels[packet.atomicId];
  if (!label) {
    fail("formal packet has no stable action identity or property-level label");
  }
  return label;
}

export function presentationFromEvidence(packet, result) {
  const trigger = uniqueTriggerIdentity(packet.transitionContext);
  let actionEvent;
  if (trigger) {
    const matches = (result.interactionHistory ?? []).filter((event) =>
      event?.documentId === trigger.documentId
        && event?.eventId === trigger.eventId
        && event?.kind === "keydown"
        && event?.trusted === true);
    if (matches.length !== 1) {
      fail("formal packet trusted action is not uniquely bound to the result");
    }
    [actionEvent] = matches;
  } else {
    const action = transactionAction(packet);
    return {
      action: action.key,
      // The legacy modal observations did not retain a trigger event ID.
      // Use only their property-level role; never infer an exact node label
      // from nearby actions in the history.
      control: propertyLevelControlLabel(packet),
    };
  }
  if (typeof actionEvent.key !== "string" || actionEvent.key === "") {
    fail("formal packet trusted action has no key");
  }
  return {
    action: actionEvent.key,
    control: controlLabel(
      actionEvent.eventTarget ?? actionEvent.focusBefore,
    ),
  };
}

function safeSlugPart(value) {
  const slug = String(value).toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (slug === "") fail("finding has no safe slug component");
  return slug;
}

function writeExact(filename, bytes, label) {
  mkdirSync(dirname(filename), { recursive: true });
  if (existsSync(filename)) {
    const existing = regularBytes(filename, label);
    if (!existing.equals(bytes)) {
      fail(`${label} already exists with different bytes`);
    }
    return;
  }
  const temporary =
    `${filename}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(temporary, bytes, { flag: "wx", mode: 0o644 });
  renameSync(temporary, filename);
}

function removeLegacyExact(filename, expectedBytes, label) {
  if (!existsSync(filename)) return;
  const current = regularBytes(filename, label);
  if (!current.equals(expectedBytes)) {
    fail(`${label} differs from the verified source`);
  }
  unlinkSync(filename);
}

function writeDataset(filename, source) {
  const bytes = Buffer.from(`${JSON.stringify(source, null, 2)}\n`);
  const temporary =
    `${filename}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(temporary, bytes, { flag: "wx", mode: 0o644 });
  renameSync(temporary, filename);
}

function verifiedFormalRecord({
  packet,
  report,
  manifest,
  campaignRoot,
}) {
  if (packet?.schemaVersion !== PACKET_SCHEMA
      || packet.findingKind !== "FORMAL_VIOLATION"
      || packet.excludedFromClaims !== false
      || typeof packet.findingId !== "string"
      || !packet.findingId.startsWith("F::")
      || !SAFE_ID.test(packet.findingId)
      || typeof packet.attemptId !== "string"
      || !SAFE_ID.test(packet.attemptId)
      || typeof packet.site !== "string"
      || packet.site === ""
      || typeof packet.atomicId !== "string"
      || typeof packet.occurrenceId !== "string"
      || packet.findingId !== `F::${packet.occurrenceId}`
      || !Array.isArray(packet.witness?.propertyObservation)
      || packet.witness.propertyObservation.length === 0
      || !equalJson(
        packet.transitionContext,
        packet.witness.propertyObservation,
      )
      || !equalJson(packet.sourceDigest, manifest.sourceDigest)
        && manifest.sourceDigest !== undefined
      || !equalJson(packet.campaignLineage, manifest.campaignLineage)
        && manifest.campaignLineage !== undefined) {
    fail("formal finding packet envelope is invalid");
  }
  const reportMatches = report.violations.filter((finding) =>
    finding?.attemptId === packet.attemptId
      && finding.site === packet.site
      && finding.atomicId === packet.atomicId
      && finding.occurrenceId === packet.occurrenceId);
  if (reportMatches.length !== 1
      || !equalJson(reportMatches[0].witness, packet.witness)
      || !Array.isArray(reportMatches[0].witnesses)
      || reportMatches[0].witnesses.length !== 1
      || !equalJson(reportMatches[0].witnesses[0], packet.witness)) {
    fail(`${packet.findingId}: packet does not match the campaign report`);
  }
  const resultReference = packet.evidenceRefs?.result;
  if (reportMatches[0].resultArtifact !== resultReference?.relativePath) {
    fail(`${packet.findingId}: result reference changed`);
  }
  const resultArtifact = rootedArtifact(
    campaignRoot,
    resultReference.relativePath,
    resultReference,
    `${packet.findingId} result`,
  );
  const result = parseJson(resultArtifact.bytes, `${packet.findingId} result`);
  if (result?.schemaVersion !== RESULT_SCHEMA
      || result.status !== "COMPLETED"
      || result.attemptId !== packet.attemptId
      || result.site !== packet.site
      || result.protocolLockIdentity !== report.protocolLockIdentity
      || result.executionLockIdentity !== report.executionLockIdentity
      || result.sourceCommit !== report.executionSource.commit
      || !equalJson(result.source, report.executionSource)
      || !Array.isArray(result.interactionHistory)) {
    fail(`${packet.findingId}: result provenance is invalid`);
  }
  const propertyMatches = (result.propertyResults ?? []).filter((entry) =>
    entry?.atomicId === packet.atomicId);
  if (propertyMatches.length !== 1
      || propertyMatches[0].outcome !== "VIOLATION_OBSERVED"
      || propertyMatches[0].violationOccurrenceCount !== 1
      || !equalJson(propertyMatches[0].witness, packet.witness)
      || !Array.isArray(propertyMatches[0].witnesses)
      || propertyMatches[0].witnesses.length !== 1
      || !equalJson(propertyMatches[0].witnesses[0], packet.witness)) {
    fail(`${packet.findingId}: result has no exact formal counterexample`);
  }
  const screenshotReceipt = packet.witness?.screenshotArtifact;
  const expectedScreenshotPath =
    `attempts/${packet.attemptId}/${
      safeRelativePath(
        screenshotReceipt?.relativePath,
        `${packet.findingId} witness screenshot`,
      )
    }`;
  const packetScreenshotMatches =
    (packet.evidenceRefs?.screenshots ?? []).filter((entry) =>
      entry?.role === "formal-witness"
        && entry.relativePath === expectedScreenshotPath
        && entry.sha256 === screenshotReceipt.sha256
        && entry.byteCount === screenshotReceipt.byteCount);
  if (packetScreenshotMatches.length !== 1) {
    fail(`${packet.findingId}: official witness screenshot is not unique`);
  }
  const screenshotArtifact = rootedArtifact(
    campaignRoot,
    expectedScreenshotPath,
    packetScreenshotMatches[0],
    `${packet.findingId} witness screenshot`,
  );
  let presentation;
  try {
    presentation = presentationFromEvidence(packet, result);
  } catch (error) {
    fail(`${packet.findingId}: ${error.message}`);
  }
  return {
    packet,
    result,
    resultArtifact,
    screenshotArtifact,
    presentation,
  };
}

export function buildReviewDatasetFromFindingPackets(options) {
  const packetDirectory = realpathSync(assertAbsolute(
    options.packetDirectory,
    "packetDirectory",
  ));
  const campaignRoot = realpathSync(assertAbsolute(
    options.campaignRoot,
    "campaignRoot",
  ));
  const campaignReportPath = realpathSync(assertAbsolute(
    options.campaignReportPath,
    "campaignReportPath",
  ));
  const ltlRepositoryRoot = realpathSync(assertAbsolute(
    options.ltlRepositoryRoot,
    "ltlRepositoryRoot",
  ));
  const outputDirectory = assertAbsolute(
    options.outputDirectory,
    "outputDirectory",
  );
  mkdirSync(outputDirectory, { recursive: true });

  const manifestBytes = regularBytes(
    join(packetDirectory, MANIFEST_FILE),
    "finding packet manifest",
  );
  const manifest = parseJson(
    manifestBytes,
    "finding packet manifest",
  );
  const reportBytes = regularBytes(campaignReportPath, "campaign report");
  const report = parseJson(reportBytes, "campaign report");
  if (manifest?.schemaVersion !== PACKET_MANIFEST_SCHEMA
      || !Array.isArray(manifest.findingIds)
      || !Number.isInteger(manifest.formalViolationCount)
      || manifest.formalViolationCount < 0
      || !Number.isInteger(manifest.claimExcludedCandidateCount)
      || manifest.claimExcludedCandidateCount < 0
      || !Number.isInteger(manifest.findingCount)
      || manifest.findingCount !== manifest.findingIds.length
      || manifest.findingCount
        !== manifest.formalViolationCount
          + manifest.claimExcludedCandidateCount
      || report?.schemaVersion !== REPORT_SCHEMA
      || report.status !== "COMPLETED"
      || !SHA256.test(report.protocolLockIdentity ?? "")
      || report.protocolLockIdentity !== report.executionLockIdentity
      || !SHA256.test(report.verificationLockIdentity ?? "")
      || realpathSync(manifest.campaignRoot ?? "") !== campaignRoot
      || realpathSync(manifest.sourceReport?.path ?? "")
        !== campaignReportPath
      || manifest.sourceReport.sha256 !== digest(reportBytes)
      || manifest.sourceReport.byteCount !== reportBytes.byteLength
      || manifest.campaignReportSchemaVersion !== report.schemaVersion
      || manifest.protocolLockIdentity !== report.protocolLockIdentity
      || manifest.formalViolationCount !== report.violationCount) {
    fail(
      "finding packet manifest inventory or campaign report lineage differ",
    );
  }
  verifyCurrentPacketLineage({ manifest, report, reportBytes });

  const formalBytes = regularBytes(
    join(packetDirectory, FORMAL_FILE),
    "formal finding packet",
  );
  const records = parseJsonLines(formalBytes, "formal finding packet");
  exactReceipt(
    manifest.outputs?.formalViolations,
    FORMAL_FILE,
    formalBytes,
    records.length,
  );
  if (manifest.formalViolationCount !== records.length) {
    fail("formal finding packet count changed");
  }
  const formalIds = records.map((record) => record?.findingId);
  if (new Set(formalIds).size !== formalIds.length
      || !equalJson(
        [...formalIds].sort(),
        (manifest.findingIds ?? [])
          .filter((findingId) => findingId.startsWith("F::"))
          .sort(),
      )) {
    fail("formal finding packet ID inventory changed");
  }

  const verified = records.map((packet) => verifiedFormalRecord({
    packet,
    report,
    manifest,
    campaignRoot,
  }));
  const producerCommits = new Set(
    verified.map((entry) => entry.result.sourceCommit),
  );
  if (producerCommits.size !== 1) {
    fail("formal findings were produced by more than one source commit");
  }
  const producerSourceCommit = [...producerCommits][0];
  const metadata = buildReviewerPropertyMetadata({
    ltlRepositoryRoot,
    sourceCommit: producerSourceCommit,
    repositoryUrl: options.repositoryUrl,
  });
  const properties = reviewerPropertiesForDataset(metadata);
  const metadataById = new Map(
    metadata.properties.map((property) => [property.atomicId, property]),
  );
  for (const entry of verified) {
    const property = metadataById.get(entry.packet.atomicId);
    if (!property
        || property.assertionExport
          !== entry.packet.formulaRef?.assertionName) {
      fail(`${entry.packet.findingId}: property metadata binding changed`);
    }
  }

  const reportDestination = "evidence/campaign-report.json.gz";
  writeExact(
    join(outputDirectory, reportDestination),
    gzipSync(reportBytes, { level: 9 }),
    "compressed campaign report",
  );
  removeLegacyExact(
    join(outputDirectory, "evidence/campaign-report.json"),
    reportBytes,
    "legacy campaign report",
  );
  const findings = verified.map((entry, index) => {
    const resultDestination =
      `evidence/results/${entry.packet.attemptId}.json.gz`;
    writeExact(
      join(outputDirectory, resultDestination),
      gzipSync(entry.resultArtifact.bytes, { level: 9 }),
      `${entry.packet.findingId} compressed result`,
    );
    removeLegacyExact(
      join(
        outputDirectory,
        `evidence/results/${entry.packet.attemptId}.json`,
      ),
      entry.resultArtifact.bytes,
      `${entry.packet.findingId} legacy result`,
    );
    const extension = [".png", ".jpg", ".jpeg", ".webp"].includes(
      extname(entry.screenshotArtifact.relativePath).toLowerCase(),
    )
      ? extname(entry.screenshotArtifact.relativePath).toLowerCase()
      : fail(`${entry.packet.findingId}: witness image type is unsupported`);
    const imageSha256 = digest(entry.screenshotArtifact.bytes);
    const imageDestination =
      `assets/${imageSha256.slice("sha256:".length)}${extension}`;
    writeExact(
      join(outputDirectory, imageDestination),
      entry.screenshotArtifact.bytes,
      `${entry.packet.findingId} copied witness screenshot`,
    );
    const slug = [
      "formal",
      String(index + 1),
      safeSlugPart(entry.packet.site),
      safeSlugPart(entry.packet.atomicId),
      digest(entry.packet.occurrenceId).slice(7, 19),
    ].join("-");
    return {
      id: entry.packet.findingId,
      slug,
      order: index + 1,
      findingKind: "formal",
      outcome: "VIOLATION_OBSERVED",
      excludedFromClaims: false,
      siteId: entry.packet.site,
      attemptId: entry.packet.attemptId,
      atomicId: entry.packet.atomicId,
      title: `${entry.packet.site} · ${entry.packet.atomicId}`,
      summary:
        `${entry.presentation.action} · ${entry.presentation.control}`
        + " · VIOLATION_OBSERVED",
      reason: "Checker counterexample; pending reviewer validation.",
      steps: [{
        id: "counterexample",
        label: "Counterexample",
        action: entry.presentation.action,
        state:
          `${entry.presentation.control} · VIOLATION_OBSERVED`,
        image: imageDestination,
        imageRole: "witness",
        imageSha256,
        focusBox: null,
        facts: [
          { label: "Site", value: entry.packet.site },
          { label: "Control", value: entry.presentation.control },
          { label: "Outcome", value: "VIOLATION_OBSERVED" },
        ],
      }],
      evidence: {
        occurrenceId: entry.packet.occurrenceId,
        resultPath: resultDestination,
        resultSha256: digest(entry.resultArtifact.bytes),
      },
    };
  });
  const source = {
    schemaVersion: SOURCE_SCHEMA,
    dataset: {
      id:
        `g2-formal-${digest(reportBytes).slice(7, 23)}`,
      title: "G2 checker counterexamples",
      producerSourceCommit,
      verifierSourceCommit: report.source.commit,
      campaignReportIdentity: digest(reportBytes),
      claimBoundary:
        "Checker counterexamples; pending reviewer validation. "
        + "No user-impact or effectiveness claim.",
    },
    properties,
    findings,
  };
  const datasetPath = join(outputDirectory, "dataset.json");
  writeDataset(datasetPath, source);
  const dataset = generateReviewSite({
    inputPath: datasetPath,
    outputDir: outputDirectory,
  });
  generateReviewSite({
    inputPath: datasetPath,
    outputDir: outputDirectory,
    check: true,
  });
  return dataset;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value) fail(`${flag} requires a value`);
    if (flag === "--packet-dir") options.packetDirectory = value;
    else if (flag === "--campaign-report") {
      options.campaignReportPath = value;
    } else if (flag === "--campaign-root") options.campaignRoot = value;
    else if (flag === "--ltl-repo") options.ltlRepositoryRoot = value;
    else if (flag === "--output") options.outputDirectory = value;
    else if (flag === "--repository-url") options.repositoryUrl = value;
    else fail(`unknown packet bridge argument: ${flag}`);
  }
  return options;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) {
  try {
    const dataset = buildReviewDatasetFromFindingPackets(
      parseArgs(process.argv.slice(2)),
    );
    process.stdout.write(
      `Generated ${dataset.findings.length} formal findings; `
      + `${dataset.dataset.identity}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
