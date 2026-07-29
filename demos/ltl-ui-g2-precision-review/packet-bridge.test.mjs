import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import {
  buildReviewDatasetFromFindingPackets,
  presentationFromEvidence,
} from "./packet-bridge.mjs";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const ADMISSION_PATH =
  "online-v2/config/vertical-property-admission-v2.json";
const DESIGN_PATH =
  "online-v2/config/genui-g2-precision-campaign-v1.json";
const PROPERTY_PATH =
  "online-v2/specs/atomic/properties/dialog/ap-m1-03.ts";

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function write(filename, value) {
  mkdirSync(dirname(filename), { recursive: true });
  writeFileSync(filename, value);
}

function receipt(relativePath, bytes) {
  return {
    relativePath,
    sha256: sha256(bytes),
    byteCount: bytes.byteLength,
  };
}

function createLtlRepository(root) {
  git(root, "init", "-q");
  git(root, "config", "user.name", "Packet Bridge Test");
  git(root, "config", "user.email", "bridge@example.com");
  write(join(root, ADMISSION_PATH), `${JSON.stringify({
    schemaVersion: "vertical-property-admission/2",
    implemented: [{
      atomicId: "AP-M1-03",
      taxonomyClass: "M1",
      module: PROPERTY_PATH,
    }],
  }, null, 2)}\n`);
  write(join(root, DESIGN_PATH), `${JSON.stringify({
    schemaVersion: "genui-g2-precision-design/1",
    atomicIds: ["AP-M1-03"],
  }, null, 2)}\n`);
  write(join(root, PROPERTY_PATH), `import { always } from "@antithesishq/bombadil";

export const AP_M1_03_ID = "AP-M1-03";
export const AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG =
  always(() => m1EscapeDialogContractHolds(m1EscapeDialogObservation.current));

export const AP_M1_03 = Object.freeze({
  atomicId: AP_M1_03_ID,
  taxonomyClass: "M1",
  title: "Escape closes the exact active dialog",
  temporalFormula:
    "G(escape_in_visible_dialog(d) -> F_[0,500ms] !visible(d))",
  assertion: AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG,
});
`);
  git(root, "add", ".");
  git(root, "commit", "-qm", "producer");
  return git(root, "rev-parse", "HEAD");
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "ltl-packet-bridge-"));
  const ltlRoot = join(root, "ltl");
  const packetDirectory = join(root, "packets");
  const campaignRoot = join(root, "campaign");
  const outputDirectory = join(root, "review");
  mkdirSync(ltlRoot);
  mkdirSync(packetDirectory);
  mkdirSync(campaignRoot);
  mkdirSync(outputDirectory);

  const producerCommit = createLtlRepository(ltlRoot);
  const verifierCommit = "c".repeat(40);
  const attemptId =
    "000__site-1__g2-taxonomy-informed__120s__replay-1";
  const site = "site-1";
  const atomicId = "AP-M1-03";
  const occurrenceId =
    `${attemptId}:${atomicId}:first-counterexample`;
  const executionLockIdentity = sha256("execution-lock");
  const verificationLockIdentity = sha256("verification-lock");
  const artifactManifestIdentity = sha256("artifact-manifest");
  const artifactManifestPath = join(root, "artifact-manifest.json");
  const artifactIntegrityPath = join(root, "artifact-integrity.json");
  const designIdentity = sha256("design");
  const corpusManifestIdentity = sha256("corpus");
  const qualificationReportIdentity = sha256("qualification-report");
  const preflightReceiptIdentity = sha256("preflight");
  const smokeReceiptIdentity = sha256("smoke-receipt");
  const smokeResultIdentity = sha256("smoke-result");
  const resultRelativePath = `attempts/${attemptId}/result.json`;
  const screenshotWithinAttempt =
    "bombadil/screenshots/counterexample.png";
  const screenshotRelativePath =
    `attempts/${attemptId}/${screenshotWithinAttempt}`;
  write(join(campaignRoot, screenshotRelativePath), PNG_BYTES);

  const transitionContext = [{
    name: "AP-M1-03 trusted Escape dialog transaction",
    value: {
      documentId: "document-1",
      triggerInteractionEventId: 7,
      action: {
        key: "Escape",
        trusted: true,
        dialogId: "filters-dialog",
      },
      post: {
        sameDialogConnected: true,
        sameDialogVisible: true,
      },
    },
  }];
  const witness = {
    occurrenceId,
    traceEntryIndex: 4,
    violationIndex: 0,
    timestamp: 1.25,
    screenshot: "screenshots/counterexample.png",
    propertyObservation: transitionContext,
    violation: {
      name: "AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG",
    },
    screenshotArtifact: {
      relativePath: screenshotWithinAttempt,
      sha256: sha256(PNG_BYTES),
      byteCount: PNG_BYTES.byteLength,
    },
  };
  const producerSource = {
    commit: producerCommit,
    dirty: true,
    tree: "b".repeat(40),
  };
  const verifierSource = {
    commit: verifierCommit,
    dirty: false,
    tree: "d".repeat(40),
  };
  const result = {
    schemaVersion: "genui-g2-precision-result/1",
    status: "COMPLETED",
    attemptId,
    site,
    protocolLockIdentity: executionLockIdentity,
    executionLockIdentity,
    verificationLockIdentity: sha256("old-verification-lock"),
    source: producerSource,
    sourceCommit: producerCommit,
    propertyResults: [{
      atomicId,
      outcome: "VIOLATION_OBSERVED",
      witness,
      witnesses: [witness],
      violationOccurrenceCount: 1,
    }],
    candidateSignals: [],
    interactionHistory: [{
      eventId: 7,
      documentId: "document-1",
      kind: "keydown",
      trusted: true,
      key: "Escape",
      eventTarget: {
        id: "close-filters",
        name: "Close filters",
        tag: "BUTTON",
        role: null,
      },
    }],
  };
  const resultBytes = Buffer.from(`${JSON.stringify(result)}\n`);
  write(join(campaignRoot, resultRelativePath), resultBytes);

  const report = {
    schemaVersion: "genui-g2-precision-report/1",
    status: "COMPLETED",
    source: verifierSource,
    executionSource: producerSource,
    protocolLockIdentity: executionLockIdentity,
    executionLockIdentity,
    verificationLockIdentity,
    designIdentity,
    corpusManifestIdentity,
    qualificationReportIdentity,
    preflightReceiptIdentity,
    smokeReceiptIdentity,
    smokeResultIdentity,
    campaignRoot: realpathSync(campaignRoot),
    violationCount: 1,
    violations: [{
      attemptId,
      site,
      atomicId,
      occurrenceId,
      witness,
      witnesses: [witness],
      resultArtifact: resultRelativePath,
    }],
    candidateSignalCount: 0,
    candidates: [],
  };
  const reportBytes = Buffer.from(`${JSON.stringify(report)}\n`);
  const campaignReportPath = join(root, "campaign-report.json");
  write(campaignReportPath, reportBytes);
  const artifactManifest = {
    schemaVersion: "vertical-artifact-manifest/1",
    executionLockIdentity,
    artifactManifestIdentity,
  };
  const artifactManifestBytes =
    Buffer.from(`${JSON.stringify(artifactManifest)}\n`);
  write(artifactManifestPath, artifactManifestBytes);
  const artifactIntegrity = {
    schemaVersion: "vertical-artifact-verification/1",
    executionLockIdentity,
    verificationLockIdentity,
    artifactManifestIdentity,
    artifactsModified: false,
    issues: [],
    expectedArtifactCount: 3,
    verifiedArtifactCount: 3,
  };
  const artifactIntegrityBytes =
    Buffer.from(`${JSON.stringify(artifactIntegrity)}\n`);
  write(artifactIntegrityPath, artifactIntegrityBytes);
  const sourceDigest = sha256(JSON.stringify(verifierSource));
  const campaignLineage = {
    campaignReportSha256: sha256(reportBytes),
    source: verifierSource,
    sourceDigest,
    executionSource: producerSource,
    protocolLockIdentity: executionLockIdentity,
    executionLockIdentity,
    verificationLockIdentity,
    artifactManifestIdentity,
    artifactIntegrityReportIdentity: sha256(artifactIntegrityBytes),
    designIdentity,
    corpusManifestIdentity,
    qualificationReportIdentity,
    preflightReceiptIdentity,
    smokeReceiptIdentity,
    smokeResultIdentity,
  };

  const finding = {
    schemaVersion: "genui-g2-finding-packet/1",
    findingId: `F::${occurrenceId}`,
    findingKind: "FORMAL_VIOLATION",
    excludedFromClaims: false,
    sourceDigest,
    campaignLineage,
    attemptId,
    site,
    atomicId,
    occurrenceId,
    attemptLineage: {},
    formulaRef: {
      assertionName: "AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG",
      relativePath: "online-v2/specs/qualification/ap-m1-03.ts",
      sha256: sha256("qualification"),
      byteCount: 1,
    },
    traceOccurrence: {
      traceEntryIndex: 4,
      violationIndex: 0,
      assertionName: "AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG",
      timestamp: 1.25,
    },
    transitionContext,
    focusContext: null,
    witness,
    evidenceRefs: {
      result: receipt(resultRelativePath, resultBytes),
      trace: receipt(
        `attempts/${attemptId}/bombadil/trace.jsonl`,
        Buffer.from("trace\n"),
      ),
      evidence: receipt(
        `attempts/${attemptId}/atomic-evidence-events.jsonl`,
        Buffer.from("evidence\n"),
      ),
      screenshots: [{
        role: "formal-witness",
        ...receipt(screenshotRelativePath, PNG_BYTES),
        image: { width: 1, height: 1 },
      }],
    },
  };
  const formalBytes = Buffer.from(`${JSON.stringify(finding)}\n`);
  const formalPath = join(packetDirectory, "formal-violations.jsonl");
  write(formalPath, formalBytes);
  const manifest = {
    schemaVersion: "genui-g2-finding-packet-manifest/1",
    sourceReport: {
      path: realpathSync(campaignReportPath),
      sha256: sha256(reportBytes),
      byteCount: reportBytes.byteLength,
    },
    source: verifierSource,
    sourceDigest,
    executionSource: producerSource,
    campaignLineage,
    campaignRoot: realpathSync(campaignRoot),
    campaignReportSchemaVersion: report.schemaVersion,
    protocolLockIdentity: executionLockIdentity,
    executionLockIdentity,
    verificationLockIdentity,
    artifactManifestIdentity,
    artifactIntegrity: {
      ...artifactIntegrity,
      manifest: {
        path: realpathSync(artifactManifestPath),
        sha256: sha256(artifactManifestBytes),
        byteCount: artifactManifestBytes.byteLength,
      },
      report: {
        path: realpathSync(artifactIntegrityPath),
        sha256: sha256(artifactIntegrityBytes),
        byteCount: artifactIntegrityBytes.byteLength,
      },
    },
    designIdentity,
    corpusManifestIdentity,
    qualificationReportIdentity,
    preflightReceiptIdentity,
    smokeReceiptIdentity,
    smokeResultIdentity,
    verifiedAttemptCount: 1,
    verifiedPropertyResultCount: 1,
    attemptResults: [],
    formalViolationCount: 1,
    claimExcludedCandidateCount: 0,
    findingCount: 1,
    findingIds: [finding.findingId],
    outputs: {
      formalViolations: {
        relativePath: "formal-violations.jsonl",
        sha256: sha256(formalBytes),
        byteCount: formalBytes.byteLength,
        lineCount: 1,
      },
      claimExcludedCandidates: {
        relativePath: "claim-excluded-candidates.jsonl",
        sha256: sha256(Buffer.alloc(0)),
        byteCount: 0,
        lineCount: 0,
      },
    },
  };
  write(
    join(packetDirectory, "finding-packet-manifest.json"),
    `${JSON.stringify(manifest)}\n`,
  );

  return {
    root,
    ltlRoot,
    packetDirectory,
    campaignRoot,
    campaignReportPath,
    outputDirectory,
    producerCommit,
    verifierCommit,
    attemptId,
    atomicId,
    occurrenceId,
    resultBytes,
    report,
    formalPath,
    finding,
    manifest,
  };
}

function resealReportAndPacket(fixture) {
  const reportBytes = Buffer.from(`${JSON.stringify(fixture.report)}\n`);
  write(fixture.campaignReportPath, reportBytes);
  fixture.manifest.sourceReport.sha256 = sha256(reportBytes);
  fixture.manifest.sourceReport.byteCount = reportBytes.byteLength;
  fixture.manifest.executionSource = fixture.report.executionSource;
  fixture.manifest.campaignLineage = {
    ...fixture.manifest.campaignLineage,
    campaignReportSha256: sha256(reportBytes),
    executionSource: fixture.report.executionSource,
  };
  fixture.finding.campaignLineage = fixture.manifest.campaignLineage;
  const formalBytes =
    Buffer.from(`${JSON.stringify(fixture.finding)}\n`);
  write(fixture.formalPath, formalBytes);
  fixture.manifest.outputs.formalViolations = {
    relativePath: "formal-violations.jsonl",
    sha256: sha256(formalBytes),
    byteCount: formalBytes.byteLength,
    lineCount: 1,
  };
  write(
    join(fixture.packetDirectory, "finding-packet-manifest.json"),
    `${JSON.stringify(fixture.manifest)}\n`,
  );
}

test("a hardened formal packet becomes a provenance-split review page", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const dataset = buildReviewDatasetFromFindingPackets({
    packetDirectory: fixture.packetDirectory,
    campaignReportPath: fixture.campaignReportPath,
    campaignRoot: fixture.campaignRoot,
    ltlRepositoryRoot: fixture.ltlRoot,
    outputDirectory: fixture.outputDirectory,
    repositoryUrl: "https://github.com/Oscar-Ge/LTL-UI",
  });

  assert.equal(dataset.dataset.producerSourceCommit, fixture.producerCommit);
  assert.equal(dataset.dataset.verifierSourceCommit, fixture.verifierCommit);
  assert.equal(dataset.findings.length, 1);
  const [finding] = dataset.findings;
  assert.equal(finding.findingKind, "formal");
  assert.equal(finding.outcome, "VIOLATION_OBSERVED");
  assert.equal(finding.title, `site-1 · ${fixture.atomicId}`);
  assert.equal(
    finding.summary,
    "Escape · Close filters · VIOLATION_OBSERVED",
  );
  assert.equal(
    finding.reason,
    "Checker counterexample; pending reviewer validation.",
  );
  assert.equal(finding.steps[0].focusBox, null);
  assert.deepEqual(
    gunzipSync(readFileSync(
      join(fixture.outputDirectory, finding.evidence.resultPath),
    )),
    fixture.resultBytes,
  );
  assert.equal(finding.evidence.resultPath.endsWith(".json.gz"), true);
  assert.equal(
    existsSync(join(fixture.outputDirectory, finding.slug, "index.html")),
    true,
  );
  assert.doesNotThrow(() =>
    JSON.parse(readFileSync(
      join(fixture.outputDirectory, "dataset.json"),
      "utf8",
    )));
});

test("bridge binds every result to the report execution source", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  fixture.report.executionSource = {
    commit: "e".repeat(40),
    dirty: false,
    tree: "f".repeat(40),
  };
  resealReportAndPacket(fixture);

  assert.throws(
    () => buildReviewDatasetFromFindingPackets({
      packetDirectory: fixture.packetDirectory,
      campaignReportPath: fixture.campaignReportPath,
      campaignRoot: fixture.campaignRoot,
      ltlRepositoryRoot: fixture.ltlRoot,
      outputDirectory: fixture.outputDirectory,
      repositoryUrl: "https://github.com/Oscar-Ge/LTL-UI",
    }),
    /result provenance is invalid/,
  );
});

test("a legacy modal witness uses a property-level control label", () => {
  const packet = {
    atomicId: "AP-M1-03",
    transitionContext: [{
      value: {
        action: {
          key: "Escape",
          trusted: true,
        },
        observation: {
          complete: true,
          contaminatedByLaterAction: false,
          deadlineMs: 500,
        },
      },
    }],
  };

  assert.deepEqual(
    presentationFromEvidence(packet, {}),
    {
      action: "Escape",
      control: "active dialog",
    },
  );
});

test("an unsupported legacy witness cannot invent a control label", () => {
  const packet = {
    atomicId: "AP-UNKNOWN",
    transitionContext: [{
      value: {
        action: {
          key: "Escape",
          trusted: true,
        },
        observation: {
          complete: true,
          contaminatedByLaterAction: false,
          deadlineMs: 500,
        },
      },
    }],
  };

  assert.throws(
    () => presentationFromEvidence(packet, {}),
    /no stable action identity or property-level label/,
  );
});

for (const [label, mutate, pattern] of [
  [
    "formal JSONL hash",
    (fixture) => {
      fixture.manifest.outputs.formalViolations.sha256 = sha256("forged");
    },
    /formal-violations\.jsonl.*manifest receipt/,
  ],
  [
    "formal JSONL count",
    (fixture) => {
      fixture.manifest.outputs.formalViolations.lineCount = 2;
    },
    /formal-violations\.jsonl.*manifest receipt/,
  ],
  [
    "formal finding IDs",
    (fixture) => {
      fixture.manifest.findingIds = ["F::forged"];
    },
    /formal finding packet ID inventory/,
  ],
  [
    "manifest finding count",
    (fixture) => {
      fixture.manifest.findingCount = 2;
    },
    /finding packet manifest.*inventory/,
  ],
  [
    "producer execution source",
    (fixture) => {
      delete fixture.manifest.executionSource;
    },
    /finding packet manifest.*lineage/,
  ],
  [
    "verification lock lineage",
    (fixture) => {
      fixture.manifest.verificationLockIdentity = sha256("other-verifier");
    },
    /finding packet manifest.*lineage/,
  ],
  [
    "artifact integrity status",
    (fixture) => {
      fixture.manifest.artifactIntegrity.artifactsModified = true;
    },
    /artifact integrity/,
  ],
]) {
  test(`bridge rejects a changed ${label}`, (t) => {
    const fixture = createFixture();
    t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
    mutate(fixture);
    write(
      join(fixture.packetDirectory, "finding-packet-manifest.json"),
      `${JSON.stringify(fixture.manifest)}\n`,
    );
    assert.throws(
      () => buildReviewDatasetFromFindingPackets({
        packetDirectory: fixture.packetDirectory,
        campaignReportPath: fixture.campaignReportPath,
        campaignRoot: fixture.campaignRoot,
        ltlRepositoryRoot: fixture.ltlRoot,
        outputDirectory: fixture.outputDirectory,
        repositoryUrl: "https://github.com/Oscar-Ge/LTL-UI",
      }),
      pattern,
    );
  });
}
