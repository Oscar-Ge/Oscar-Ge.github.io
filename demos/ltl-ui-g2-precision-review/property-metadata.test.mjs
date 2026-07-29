import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildReviewerPropertyMetadata,
  reviewerPropertiesForDataset,
} from "./property-metadata.mjs";

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

function write(root, relativePath, source) {
  const filename = join(root, relativePath);
  mkdirSync(join(filename, ".."), { recursive: true });
  writeFileSync(filename, source);
}

function propertySource(
  title = "Escape closes the exact active dialog",
  taxonomyClass = "M1",
) {
  return `import { always } from "@antithesishq/bombadil";

export const AP_M1_03_ID = "AP-M1-03";

export function m1EscapeDialogContractHolds(value) {
  return value === true;
}

export const AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG =
  always(() => m1EscapeDialogContractHolds(m1EscapeDialogObservation.current));

export const AP_M1_03 = Object.freeze({
  atomicId: AP_M1_03_ID,
  taxonomyClass: ${JSON.stringify(taxonomyClass)},
  title: ${JSON.stringify(title)},
  temporalFormula:
    "G(escape_in_visible_dialog(d) -> F_[0,500ms] !visible(d))",
  assertion: AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG,
});
`;
}

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "ltl-property-metadata-"));
  git(root, "init", "-q");
  git(root, "config", "user.name", "Metadata Test");
  git(root, "config", "user.email", "metadata@example.com");
  write(root, ADMISSION_PATH, `${JSON.stringify({
    schemaVersion: "vertical-property-admission/2",
    implemented: [{
      atomicId: "AP-M1-03",
      taxonomyClass: "M1",
      module: PROPERTY_PATH,
    }],
  }, null, 2)}\n`);
  write(root, DESIGN_PATH, `${JSON.stringify({
    schemaVersion: "genui-g2-precision-design/1",
    atomicIds: ["AP-M1-03"],
  }, null, 2)}\n`);
  const source = propertySource();
  write(root, PROPERTY_PATH, source);
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  return {
    root,
    commit: git(root, "rev-parse", "HEAD"),
    source,
  };
}

test("reviewer metadata is generated from one exact committed property source", (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));

  const metadata = buildReviewerPropertyMetadata({
    ltlRepositoryRoot: fixture.root,
    sourceCommit: fixture.commit,
    repositoryUrl: "https://github.com/Oscar-Ge/LTL-UI",
  });

  assert.equal(metadata.properties.length, 1);
  assert.deepEqual(metadata.properties[0], {
    atomicId: "AP-M1-03",
    taxonomyClass: "M1",
    title: "Escape closes the exact active dialog",
    ltlFormula:
      "G(escape_in_visible_dialog(d) -> F_[0,500ms] !visible(d))",
    assertionExport: "AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG",
    bombadilAssertion:
      "export const AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG =\n"
      + "  always(() => m1EscapeDialogContractHolds(m1EscapeDialogObservation.current));",
    sourcePath: PROPERTY_PATH,
    sourceSha256: sha256(fixture.source),
    sourceUrl:
      `https://github.com/Oscar-Ge/LTL-UI/blob/${fixture.commit}/${PROPERTY_PATH}#L9`,
  });
  assert.equal(metadata.source.commit, fixture.commit);
  assert.equal(metadata.source.admissionManifest.relativePath, ADMISSION_PATH);
  assert.equal(metadata.source.campaignDesign.relativePath, DESIGN_PATH);
  assert.match(
    metadata.metadataIdentity,
    /^sha256:[a-f0-9]{64}$/,
  );
});

test("property metadata taxonomy must match the committed admission manifest", (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  write(fixture.root, PROPERTY_PATH, propertySource(
    "Escape closes the exact active dialog",
    "W3",
  ));
  git(fixture.root, "add", ".");
  git(fixture.root, "commit", "-qm", "mismatched taxonomy");
  const commit = git(fixture.root, "rev-parse", "HEAD");

  assert.throws(
    () => buildReviewerPropertyMetadata({
      ltlRepositoryRoot: fixture.root,
      sourceCommit: commit,
      repositoryUrl: "https://github.com/Oscar-Ge/LTL-UI",
    }),
    /taxonomyClass.*admission manifest/,
  );
});

test("dataset projection exposes only source-backed reviewer fields", (t) => {
  const fixture = createRepository();
  t.after(() => rmSync(fixture.root, { recursive: true, force: true }));
  const metadata = buildReviewerPropertyMetadata({
    ltlRepositoryRoot: fixture.root,
    sourceCommit: fixture.commit,
    repositoryUrl: "https://github.com/Oscar-Ge/LTL-UI",
  });

  assert.deepEqual(reviewerPropertiesForDataset(metadata), [{
    atomicId: "AP-M1-03",
    title: "Escape closes the exact active dialog",
    ltlFormula:
      "G(escape_in_visible_dialog(d) -> F_[0,500ms] !visible(d))",
    bombadilAssertion:
      "export const AP_M1_03_ESCAPE_CLOSES_EXACT_ACTIVE_DIALOG =\n"
      + "  always(() => m1EscapeDialogContractHolds(m1EscapeDialogObservation.current));",
    sourceUrl:
      `https://github.com/Oscar-Ge/LTL-UI/blob/${fixture.commit}/${PROPERTY_PATH}#L9`,
  }]);
});
