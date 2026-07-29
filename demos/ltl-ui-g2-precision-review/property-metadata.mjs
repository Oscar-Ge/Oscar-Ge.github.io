import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

export const REVIEWER_PROPERTY_METADATA_SCHEMA =
  "ltl-ui-reviewer-property-metadata/1";

const ADMISSION_PATH =
  "online-v2/config/vertical-property-admission-v2.json";
const DESIGN_PATH =
  "online-v2/config/genui-g2-precision-campaign-v1.json";
const ATOMIC_ID = /^AP-[A-Z]+[0-9]+-[0-9]{2}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;

function fail(message) {
  throw new Error(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stable(value[key])]),
  );
}

function stableStringify(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function safeRelativePath(value, label) {
  if (typeof value !== "string"
      || value === ""
      || value.includes("\\")
      || path.posix.isAbsolute(value)
      || path.posix.normalize(value) !== value
      || value.split("/").includes("..")) {
    fail(`${label} is not a safe repository-relative path`);
  }
  return value;
}

function committedBytes(root, commit, relativePath) {
  safeRelativePath(relativePath, "committed file");
  try {
    return execFileSync(
      "git",
      ["-C", root, "show", `${commit}:${relativePath}`],
      {
        encoding: "buffer",
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    fail(`cannot read ${relativePath} from commit ${commit}`);
  }
}

function committedJson(root, commit, relativePath) {
  const bytes = committedBytes(root, commit, relativePath);
  try {
    return {
      bytes,
      value: JSON.parse(bytes.toString("utf8")),
    };
  } catch {
    fail(`${relativePath} is not valid JSON at commit ${commit}`);
  }
}

function exactCommit(root, sourceCommit) {
  if (!GIT_COMMIT.test(sourceCommit ?? "")) {
    fail("sourceCommit must be a full Git commit ID");
  }
  let observed;
  try {
    observed = execFileSync(
      "git",
      ["-C", root, "rev-parse", "--verify", `${sourceCommit}^{commit}`],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
  } catch {
    fail(`sourceCommit is not present in the LTL repository: ${sourceCommit}`);
  }
  if (observed !== sourceCommit) {
    fail("sourceCommit must use the repository's canonical full commit ID");
  }
  return observed;
}

function repositoryBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("repositoryUrl must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:"
      || url.search !== ""
      || url.hash !== "") {
    fail("repositoryUrl must be an absolute HTTPS URL without query or hash");
  }
  return url.href.replace(/\/$/u, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function oneMatch(source, expression, label) {
  const matches = [...source.matchAll(expression)];
  if (matches.length !== 1) {
    fail(`${label} must occur exactly once in the property source`);
  }
  return matches[0];
}

function objectString(block, field, label) {
  const match = oneMatch(
    block,
    new RegExp(
      `\\b${escapeRegExp(field)}\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`,
      "gu",
    ),
    label,
  );
  try {
    return JSON.parse(match[1]);
  } catch {
    fail(`${label} must be a JSON-compatible string literal`);
  }
}

function propertyMetadata({
  atomicId,
  taxonomyClass,
  module,
  bytes,
  commit,
  repositoryUrl,
}) {
  const source = bytes.toString("utf8");
  const symbol = atomicId.replaceAll("-", "_");
  oneMatch(
    source,
    new RegExp(
      `export\\s+const\\s+${escapeRegExp(symbol)}_ID\\s*=\\s*`
        + `${JSON.stringify(atomicId)}\\s*;`,
      "gu",
    ),
    `${atomicId} ID declaration`,
  );
  const objectMarker = `export const ${symbol} = Object.freeze({`;
  const objectStart = source.indexOf(objectMarker);
  if (objectStart < 0 || source.indexOf(objectMarker, objectStart + 1) >= 0) {
    fail(`${atomicId} metadata object must occur exactly once`);
  }
  const objectEnd = source.indexOf("\n});", objectStart);
  if (objectEnd < 0) {
    fail(`${atomicId} metadata object is not closed`);
  }
  const block = source.slice(objectStart, objectEnd + 4);
  oneMatch(
    block,
    new RegExp(
      `\\batomicId\\s*:\\s*${escapeRegExp(symbol)}_ID\\s*,`,
      "gu",
    ),
    `${atomicId} metadata Atomic ID`,
  );
  const declaredTaxonomy = objectString(
    block,
    "taxonomyClass",
    `${atomicId} taxonomyClass`,
  );
  if (declaredTaxonomy !== taxonomyClass) {
    fail(
      `${atomicId} taxonomyClass does not match the admission manifest`,
    );
  }
  const title = objectString(block, "title", `${atomicId} title`);
  const ltlFormula = objectString(
    block,
    "temporalFormula",
    `${atomicId} temporal formula`,
  );
  const assertionMatch = oneMatch(
    block,
    /\bassertion\s*:\s*(AP_[A-Z0-9_]+)\s*,/gu,
    `${atomicId} assertion reference`,
  );
  const assertionExport = assertionMatch[1];
  const declaration = `export const ${assertionExport}`;
  const statementStart = source.indexOf(declaration);
  if (statementStart < 0
      || source.indexOf(declaration, statementStart + 1) >= 0) {
    fail(`${atomicId} assertion declaration must occur exactly once`);
  }
  const statementEnd = source.indexOf(";", statementStart);
  if (statementEnd < 0 || statementEnd > objectStart) {
    fail(`${atomicId} assertion declaration is not a complete statement`);
  }
  const statement = source.slice(statementStart, statementEnd + 1);
  const equals = statement.indexOf("=");
  if (equals < 0) {
    fail(`${atomicId} assertion declaration has no initializer`);
  }
  const rightHandSide = statement.slice(equals + 1, -1)
    .replace(/\s+/gu, " ")
    .trim();
  if (!rightHandSide.startsWith("always(() =>")) {
    fail(`${atomicId} assertion must be a direct Bombadil always contract`);
  }
  const bombadilAssertion =
    `${statement.slice(0, equals + 1).trim()}\n  ${rightHandSide};`;
  const assertionLine =
    source.slice(0, statementStart).split(/\r?\n/u).length;
  return Object.freeze({
    atomicId,
    taxonomyClass,
    title,
    ltlFormula,
    assertionExport,
    bombadilAssertion,
    sourcePath: module,
    sourceSha256: sha256(bytes),
    sourceUrl:
      `${repositoryUrl}/blob/${commit}/${module}#L${assertionLine}`,
  });
}

export function buildReviewerPropertyMetadata({
  ltlRepositoryRoot,
  sourceCommit,
  repositoryUrl,
}) {
  if (!path.isAbsolute(ltlRepositoryRoot ?? "")) {
    fail("ltlRepositoryRoot must be an absolute path");
  }
  const commit = exactCommit(ltlRepositoryRoot, sourceCommit);
  const baseUrl = repositoryBaseUrl(repositoryUrl);
  const admissionArtifact = committedJson(
    ltlRepositoryRoot,
    commit,
    ADMISSION_PATH,
  );
  const designArtifact = committedJson(
    ltlRepositoryRoot,
    commit,
    DESIGN_PATH,
  );
  const admission = admissionArtifact.value;
  const design = designArtifact.value;
  if (admission?.schemaVersion !== "vertical-property-admission/2"
      || !Array.isArray(admission.implemented)) {
    fail("committed vertical property admission manifest is invalid");
  }
  if (design?.schemaVersion !== "genui-g2-precision-design/1"
      || !Array.isArray(design.atomicIds)) {
    fail("committed G2 precision design is invalid");
  }
  const implemented = new Map();
  for (const entry of admission.implemented) {
    if (!ATOMIC_ID.test(entry?.atomicId ?? "")
        || implemented.has(entry.atomicId)
        || typeof entry.taxonomyClass !== "string"
        || entry.taxonomyClass === "") {
      fail("admission manifest implemented property inventory is invalid");
    }
    implemented.set(entry.atomicId, entry);
  }
  if (new Set(design.atomicIds).size !== design.atomicIds.length
      || design.atomicIds.some((atomicId) => !implemented.has(atomicId))
      || implemented.size !== design.atomicIds.length) {
    fail("campaign and admission Atomic Property inventories differ");
  }
  const properties = design.atomicIds.map((atomicId) => {
    const entry = implemented.get(atomicId);
    const module = safeRelativePath(
      entry.module,
      `${atomicId} module`,
    );
    const bytes = committedBytes(ltlRepositoryRoot, commit, module);
    return propertyMetadata({
      atomicId,
      taxonomyClass: entry.taxonomyClass,
      module,
      bytes,
      commit,
      repositoryUrl: baseUrl,
    });
  });
  const unsigned = {
    schemaVersion: REVIEWER_PROPERTY_METADATA_SCHEMA,
    source: {
      repositoryUrl: baseUrl,
      commit,
      admissionManifest: {
        relativePath: ADMISSION_PATH,
        sha256: sha256(admissionArtifact.bytes),
      },
      campaignDesign: {
        relativePath: DESIGN_PATH,
        sha256: sha256(designArtifact.bytes),
      },
    },
    properties,
  };
  return Object.freeze({
    ...unsigned,
    metadataIdentity: sha256(stableStringify(unsigned)),
  });
}

export function reviewerPropertiesForDataset(metadata) {
  if (metadata?.schemaVersion !== REVIEWER_PROPERTY_METADATA_SCHEMA
      || !Array.isArray(metadata.properties)
      || typeof metadata.metadataIdentity !== "string") {
    fail("reviewer property metadata envelope is invalid");
  }
  const { metadataIdentity, ...unsigned } = metadata;
  if (metadataIdentity !== sha256(stableStringify(unsigned))) {
    fail("reviewer property metadata identity changed");
  }
  const seen = new Set();
  return Object.freeze(metadata.properties.map((property) => {
    for (const field of [
      "atomicId",
      "title",
      "ltlFormula",
      "bombadilAssertion",
      "sourceUrl",
    ]) {
      if (typeof property?.[field] !== "string"
          || property[field] === "") {
        fail(`reviewer property ${field} is invalid`);
      }
    }
    if (!ATOMIC_ID.test(property.atomicId)
        || seen.has(property.atomicId)) {
      fail("reviewer property Atomic ID inventory is invalid");
    }
    seen.add(property.atomicId);
    return Object.freeze({
      atomicId: property.atomicId,
      title: property.title,
      ltlFormula: property.ltlFormula,
      bombadilAssertion: property.bombadilAssertion,
      sourceUrl: property.sourceUrl,
    });
  }));
}
