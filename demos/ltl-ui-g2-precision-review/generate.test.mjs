import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  generateReviewSite,
  validateDataset,
} from "./generate.mjs";
import {
  createExportPayload,
  importReviewsIntoStorage,
  storageKey,
  validateImportPayload,
} from "./review-protocol.mjs";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function clone(value) {
  return structuredClone(value);
}

function emptySource() {
  return {
    schemaVersion: "ltl-ui-g2-precision-source/2",
    dataset: {
      id: "review-test",
      title: "Review test",
      producerSourceCommit: null,
      verifierSourceCommit: null,
      campaignReportIdentity: null,
      claimBoundary: "Formal and candidate evidence stay separate.",
    },
    properties: [],
    findings: [],
  };
}

function createFixture() {
  const baseDir = mkdtempSync(join(tmpdir(), "ltl-g2-review-"));
  mkdirSync(join(baseDir, "assets"), { recursive: true });
  mkdirSync(join(baseDir, "evidence"), { recursive: true });

  const imagePath = join(baseDir, "assets", "state-1.png");
  const secondImagePath = join(baseDir, "assets", "state-2.png");
  writeFileSync(imagePath, PNG_BYTES);
  writeFileSync(secondImagePath, Buffer.concat([PNG_BYTES, Buffer.from([0])]));

  const sourceIdentity = {
    commit: "a".repeat(40),
    tree: "b".repeat(40),
    dirty: false,
  };
  const occurrenceId =
    "attempt-1:AP-M1-03:first-counterexample";
  const witness = {
    occurrenceId,
    propertyObservation: [{
      name: "AP-M1-03 observation",
      value: {
        beforeFocus: "#search",
        afterFocus: "#search",
      },
    }],
    screenshotArtifact: {
      relativePath: "bombadil/screenshots/state-1.png",
      sha256: sha256(PNG_BYTES),
      byteCount: PNG_BYTES.byteLength,
    },
  };
  const result = {
    schemaVersion: "genui-g2-precision-result/1",
    status: "COMPLETED",
    attemptId: "attempt-1",
    site: "site-1",
    protocolLockIdentity: sha256("protocol-lock"),
    executionLockIdentity: sha256("protocol-lock"),
    verificationLockIdentity: sha256("producer-verification-lock"),
    source: sourceIdentity,
    sourceCommit: sourceIdentity.commit,
    propertyResults: [{
      atomicId: "AP-M1-03",
      outcome: "VIOLATION_OBSERVED",
      witness,
      witnesses: [witness],
      violationOccurrenceCount: 1,
    }],
    candidateSignals: [],
  };
  const resultBytes = Buffer.from(
    `${JSON.stringify(result)}\n`,
  );
  writeFileSync(join(baseDir, "evidence", "result.json"), resultBytes);

  const report = {
    schemaVersion: "genui-g2-precision-report/1",
    status: "COMPLETED",
    source: sourceIdentity,
    executionSource: sourceIdentity,
    protocolLockIdentity: result.protocolLockIdentity,
    executionLockIdentity: result.executionLockIdentity,
    verificationLockIdentity: sha256("report-verification-lock"),
    violationCount: 1,
    violations: [{
      attemptId: result.attemptId,
      site: result.site,
      atomicId: result.propertyResults[0].atomicId,
      occurrenceId,
      witness,
      witnesses: [witness],
      resultArtifact: `attempts/${result.attemptId}/result.json`,
    }],
    candidateSignalCount: 0,
    candidates: [],
  };
  const reportBytes = Buffer.from(`${JSON.stringify(report)}\n`);
  writeFileSync(
    join(baseDir, "evidence", "campaign-report.json"),
    reportBytes,
  );

  const source = emptySource();
  source.dataset.producerSourceCommit = sourceIdentity.commit;
  source.dataset.verifierSourceCommit = sourceIdentity.commit;
  source.dataset.campaignReportIdentity = sha256(reportBytes);
  source.properties.push({
    atomicId: "AP-M1-03",
    title: "Escape closes the exact active dialog",
    ltlFormula: "G(escape_in_visible_dialog(d) -> F_[0,500ms] !visible(d))",
    bombadilAssertion: "export const AP_M1_03 = always(() =>\n  escapeClosesExactActiveDialog(currentTrace));",
    sourceUrl: "https://example.com/ap-m1-03.mjs",
  });
  source.findings.push({
    id: "finding-1",
    slug: "finding-1",
    order: 1,
    findingKind: "formal",
    outcome: "VIOLATION_OBSERVED",
    excludedFromClaims: false,
    siteId: "site-1",
    attemptId: "attempt-1",
    atomicId: "AP-M1-03",
    title: "Escape left the active dialog visible",
    summary: "The exact dialog remained visible after the Escape deadline.",
    reason: "The trace preserves the complete dialog transition witness.",
    steps: [
      {
        id: "state-1",
        label: "After Escape deadline",
        action: "Escape",
        state: "The exact active dialog remains visible",
        image: "assets/state-1.png",
        imageRole: "witness",
        imageSha256: sha256(PNG_BYTES),
        focusBox: {
          xPct: 10,
          yPct: 20,
          widthPct: 30,
          heightPct: 10,
          label: "Active dialog",
        },
        facts: [
          {
            label: "Dialog before",
            value: "#active-dialog",
          },
          {
            label: "Dialog after",
            value: "#active-dialog (visible)",
          },
        ],
      },
    ],
    evidence: {
      occurrenceId,
      resultPath: "evidence/result.json",
      resultSha256: sha256(resultBytes),
    },
  });

  return {
    baseDir,
    report,
    result,
    source,
    secondImageSha256: sha256(Buffer.concat([PNG_BYTES, Buffer.from([0])])),
  };
}

function rewriteFixtureResult(fixture) {
  const bytes = Buffer.from(`${JSON.stringify(fixture.result)}\n`);
  writeFileSync(
    join(fixture.baseDir, "evidence", "result.json"),
    bytes,
  );
  fixture.source.findings[0].evidence.resultSha256 = sha256(bytes);
}

function rewriteFixtureReport(fixture) {
  const bytes = Buffer.from(`${JSON.stringify(fixture.report)}\n`);
  writeFileSync(
    join(fixture.baseDir, "evidence", "campaign-report.json"),
    bytes,
  );
  fixture.source.dataset.campaignReportIdentity = sha256(bytes);
}

function convertFixtureToCandidate(fixture) {
  const finding = fixture.source.findings[0];
  const signal = {
    signalId: "signal-1",
    atomicId: finding.atomicId,
    reason: "focus_transition_needs_human_review",
    excludedFromClaims: true,
  };
  finding.findingKind = "candidate";
  finding.outcome = "CANDIDATE_SIGNAL";
  finding.excludedFromClaims = true;
  finding.steps[0].imageRole = "context-only";
  finding.evidence = {
    signalId: signal.signalId,
    resultPath: finding.evidence.resultPath,
    resultSha256: finding.evidence.resultSha256,
  };
  fixture.result.candidateSignals = [signal];
  fixture.report.candidateSignalCount = 1;
  fixture.report.candidates = [{
    attemptId: finding.attemptId,
    site: finding.siteId,
    atomicId: finding.atomicId,
    signalId: signal.signalId,
    signal,
    resultArtifact: `attempts/${finding.attemptId}/result.json`,
  }];
  rewriteFixtureResult(fixture);
  rewriteFixtureReport(fixture);
}

test("empty source validates and receives a deterministic identity", () => {
  const source = emptySource();
  const first = validateDataset(source);
  const second = validateDataset(clone(source));
  assert.deepEqual(first, second);
  assert.match(first.dataset.identity, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(first.findings, []);
});

test("valid formal finding keeps a witness and known property", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const output = validateDataset(fixture.source, { baseDir: fixture.baseDir });
  assert.equal(output.findings[0].findingKind, "formal");
  assert.equal(output.findings[0].steps[0].imageRole, "witness");
});

test("verifier-only commits do not rewrite the producer provenance", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const producerCommit = fixture.result.source.commit;
  const verifierCommit = "c".repeat(40);
  fixture.result.executionLockIdentity =
    fixture.result.protocolLockIdentity;
  fixture.result.verificationLockIdentity = sha256("producer-verifier-lock");
  fixture.report.executionLockIdentity =
    fixture.result.executionLockIdentity;
  fixture.report.verificationLockIdentity = sha256("current-verifier-lock");
  fixture.report.source = {
    commit: verifierCommit,
    tree: "d".repeat(40),
    dirty: false,
  };
  fixture.source.dataset.producerSourceCommit = producerCommit;
  fixture.source.dataset.verifierSourceCommit = verifierCommit;
  rewriteFixtureResult(fixture);
  rewriteFixtureReport(fixture);

  const output = validateDataset(fixture.source, {
    baseDir: fixture.baseDir,
  });
  assert.equal(output.dataset.producerSourceCommit, producerCommit);
  assert.equal(output.dataset.verifierSourceCommit, verifierCommit);
});

test("a finding may state that no trustworthy focus rectangle was captured", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  fixture.source.findings[0].steps[0].focusBox = null;
  const output = validateDataset(fixture.source, { baseDir: fixture.baseDir });
  assert.equal(output.findings[0].steps[0].focusBox, null);
});

test("formal findings reject hash-matched arbitrary JSON evidence", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const forgedBytes = Buffer.from('{"occurrenceId":"occ-1"}\n');
  writeFileSync(
    join(fixture.baseDir, "evidence", "result.json"),
    forgedBytes,
  );
  fixture.source.findings[0].evidence.resultSha256 = sha256(forgedBytes);
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /official G2 precision result/,
  );
});

test("formal findings reject a mismatched result attempt identity", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  fixture.result.attemptId = "attempt-forged";
  const forgedBytes = Buffer.from(`${JSON.stringify(fixture.result)}\n`);
  writeFileSync(
    join(fixture.baseDir, "evidence", "result.json"),
    forgedBytes,
  );
  fixture.source.findings[0].evidence.resultSha256 = sha256(forgedBytes);
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /attempt ID does not match/,
  );
});

test("non-empty datasets reject a missing official campaign report", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  rmSync(join(fixture.baseDir, "evidence", "campaign-report.json"));
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /campaign report.*missing/,
  );
});

test("formal findings reject a screenshot outside the official witness receipt", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const screenshot = fixture.result.propertyResults[0]
    .witness.screenshotArtifact;
  screenshot.sha256 = fixture.secondImageSha256;
  screenshot.byteCount = PNG_BYTES.byteLength + 1;
  rewriteFixtureResult(fixture);
  rewriteFixtureReport(fixture);
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /witness screenshot does not match/,
  );
});

for (const [name, mutate, pattern] of [
  [
    "result hash",
    (fixture) => {
      fixture.source.findings[0].evidence.resultSha256 = sha256("forged");
    },
    /resultSha256.*does not match/,
  ],
  [
    "campaign report hash",
    (fixture) => {
      fixture.source.dataset.campaignReportIdentity = sha256("forged");
    },
    /campaignReportIdentity.*does not match/,
  ],
  [
    "campaign report schema",
    (fixture) => {
      fixture.report.schemaVersion = "forged-report/1";
      rewriteFixtureReport(fixture);
    },
    /completed official G2 precision report/,
  ],
  [
    "campaign source state",
    (fixture) => {
      fixture.report.source.dirty = true;
      rewriteFixtureReport(fixture);
    },
    /clean source identity/,
  ],
  [
    "site",
    (fixture) => {
      fixture.result.site = "site-forged";
      rewriteFixtureResult(fixture);
    },
    /result site does not match/,
  ],
  [
    "Atomic ID",
    (fixture) => {
      fixture.result.propertyResults[0].atomicId = "AP-M1-04";
      rewriteFixtureResult(fixture);
    },
    /matching Atomic property result/,
  ],
  [
    "outcome",
    (fixture) => {
      fixture.result.propertyResults[0].outcome =
        "NO_VIOLATION_OBSERVED";
      rewriteFixtureResult(fixture);
    },
    /VIOLATION_OBSERVED witness/,
  ],
  [
    "occurrence",
    (fixture) => {
      fixture.result.propertyResults[0].witness.occurrenceId =
        "attempt-1:AP-M1-03:forged-counterexample";
      rewriteFixtureResult(fixture);
    },
    /VIOLATION_OBSERVED witness/,
  ],
  [
    "source commit",
    (fixture) => {
      fixture.result.sourceCommit = "c".repeat(40);
      rewriteFixtureResult(fixture);
    },
    /source lineage/,
  ],
  [
    "protocol lock",
    (fixture) => {
      fixture.result.protocolLockIdentity = sha256("forged-lock");
      rewriteFixtureResult(fixture);
    },
    /source lineage/,
  ],
  [
    "campaign report finding",
    (fixture) => {
      fixture.report.violations[0].atomicId = "AP-M1-04";
      rewriteFixtureReport(fixture);
    },
    /does not match the campaign report/,
  ],
]) {
  test(`formal findings reject mismatched ${name}`, (t) => {
    const fixture = createFixture();
    t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
    mutate(fixture);
    assert.throws(
      () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
      pattern,
    );
  });
}

test("generator writes deterministic data and physical finding pages", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const inputPath = join(fixture.baseDir, "dataset.json");
  writeFileSync(inputPath, `${JSON.stringify(fixture.source, null, 2)}\n`);

  const generated = generateReviewSite({
    inputPath,
    outputDir: fixture.baseDir,
  });
  assert.equal(generated.findings.length, 1);
  assert.equal(existsSync(join(fixture.baseDir, "findings.js")), true);
  assert.equal(
    existsSync(join(fixture.baseDir, "finding-1", "index.html")),
    true,
  );
  const firstScript = readFileSync(join(fixture.baseDir, "findings.js"), "utf8");

  assert.doesNotThrow(() =>
    generateReviewSite({
      inputPath,
      outputDir: fixture.baseDir,
      check: true,
    }));
  assert.equal(
    readFileSync(join(fixture.baseDir, "findings.js"), "utf8"),
    firstScript,
  );
});

test("duplicate finding IDs fail closed", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const duplicate = clone(fixture.source.findings[0]);
  duplicate.slug = "finding-2";
  duplicate.order = 2;
  fixture.source.findings.push(duplicate);
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /duplicate value "finding-1"/,
  );
});

test("duplicate finding slugs fail closed", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const duplicate = clone(fixture.source.findings[0]);
  duplicate.id = "finding-2";
  duplicate.order = 2;
  fixture.source.findings.push(duplicate);
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /duplicate value "finding-1"/,
  );
});

test("unknown Atomic IDs fail closed", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  fixture.source.findings[0].atomicId = "AP-UNKNOWN";
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /unknown property "AP-UNKNOWN"/,
  );
});

test("missing screenshot files fail closed", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  fixture.source.findings[0].steps[0].image = "assets/missing.png";
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /missing file assets\/missing\.png/,
  );
});

test("formal findings without a witness fail closed", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  fixture.source.findings[0].steps[0].imageRole = "context-only";
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /require at least one witness image/,
  );
});

test("candidate findings must be excluded and context-only", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  convertFixtureToCandidate(fixture);
  const finding = fixture.source.findings[0];
  assert.doesNotThrow(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
  );

  finding.excludedFromClaims = false;
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /candidate findings must be excluded/,
  );
});

test("candidate findings reject signals absent from the campaign report", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  convertFixtureToCandidate(fixture);
  fixture.source.findings[0].evidence.signalId = "signal-forged";
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /candidate signal does not match/,
  );
});

test("same screenshot content cannot represent two states", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const secondStep = clone(fixture.source.findings[0].steps[0]);
  secondStep.id = "state-2";
  secondStep.label = "A second state";
  secondStep.image = "assets/state-copy.png";
  writeFileSync(join(fixture.baseDir, secondStep.image), PNG_BYTES);
  fixture.source.findings[0].steps.push(secondStep);
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /duplicate value "sha256:/,
  );
});

test("distinct screenshots may represent distinct states", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  const secondStep = clone(fixture.source.findings[0].steps[0]);
  secondStep.id = "state-2";
  secondStep.label = "A second state";
  secondStep.image = "assets/state-2.png";
  secondStep.imageSha256 = fixture.secondImageSha256;
  fixture.source.findings[0].steps.push(secondStep);
  assert.doesNotThrow(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
  );
});

test("Bombadil display snippets must remain two or three lines", (t) => {
  const fixture = createFixture();
  t.after(() => rmSync(fixture.baseDir, { recursive: true, force: true }));
  fixture.source.properties[0].bombadilAssertion = "always(() => holds())";
  assert.throws(
    () => validateDataset(fixture.source, { baseDir: fixture.baseDir }),
    /must contain 2–3 non-empty lines/,
  );
});

test("review import requires exact dataset identity and known finding IDs", () => {
  const dataset = {
    campaignReportIdentity: null,
    claimBoundary: "Boundary",
    id: "review-test",
    identity: sha256("dataset"),
    producerSourceCommit: null,
    verifierSourceCommit: null,
    title: "Review",
  };
  const reviews = new Map([
    ["finding-1", { decision: "make-sense", note: "Trace is coherent." }],
  ]);
  const payload = createExportPayload(dataset, ["finding-1"], reviews);
  assert.deepEqual(
    validateImportPayload(payload, dataset, ["finding-1"]),
    payload,
  );

  const wrongIdentity = clone(payload);
  wrongIdentity.dataset.identity = sha256("other");
  assert.throws(
    () => validateImportPayload(wrongIdentity, dataset, ["finding-1"]),
    /identity does not match/,
  );

  const unknownFinding = clone(payload);
  unknownFinding.reviews[0].findingId = "finding-2";
  assert.throws(
    () => validateImportPayload(unknownFinding, dataset, ["finding-1"]),
    /not part of this dataset/,
  );

  const duplicateFinding = clone(payload);
  duplicateFinding.reviews.push(clone(duplicateFinding.reviews[0]));
  assert.throws(
    () => validateImportPayload(duplicateFinding, dataset, ["finding-1"]),
    /findingId is duplicated/,
  );

  const invalidDecision = clone(payload);
  invalidDecision.reviews[0].decision = "false-positive";
  assert.throws(
    () => validateImportPayload(invalidDecision, dataset, ["finding-1"]),
    /must be make-sense, unsure, reject, or null/,
  );
});

test("localStorage keys are isolated by exact dataset identity", () => {
  const dataset = {
    campaignReportIdentity: null,
    claimBoundary: "Boundary",
    id: "review-test",
    identity: sha256("dataset"),
    producerSourceCommit: null,
    verifierSourceCommit: null,
    title: "Review",
  };
  const changed = {
    ...dataset,
    identity: sha256("changed"),
  };
  assert.notEqual(storageKey(dataset), storageKey(changed));
});

test("review import fails atomically when exact-dataset persistence fails", () => {
  const dataset = {
    campaignReportIdentity: null,
    claimBoundary: "Boundary",
    id: "review-test",
    identity: sha256("dataset"),
    producerSourceCommit: null,
    verifierSourceCommit: null,
    title: "Review",
  };
  const payload = createExportPayload(
    dataset,
    ["finding-1"],
    new Map([[
      "finding-1",
      { decision: "make-sense", note: "Evidence is coherent." },
    ]]),
  );
  let attemptedKey = null;
  const unavailableStorage = {
    setItem(key) {
      attemptedKey = key;
      throw new Error("storage unavailable");
    },
  };

  assert.throws(
    () => importReviewsIntoStorage(
      payload,
      dataset,
      ["finding-1"],
      unavailableStorage,
    ),
    /storage unavailable/,
  );
  assert.equal(attemptedKey, storageKey(dataset));
});
