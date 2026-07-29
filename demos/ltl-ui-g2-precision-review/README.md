# LTL Navigation Precision Review

This directory is an evidence-review UI for the 137-site G2 precision
campaign. The checked-in `dataset.json` contains the 26 formal
`VIOLATION_OBSERVED` counterexamples that passed the campaign's execution,
verification, artifact-integrity, and finding-packet checks.

## Boundary

- `formal` means the checker emitted `VIOLATION_OBSERVED`, the raw result is
  identity-bound, and at least one distinct screenshot is a witness.
- `candidate` means the item is context for human review. Every image is marked
  `context-only`, and `excludedFromClaims` must be `true`.
- A reviewer decision (`make-sense`, `unsure`, or `reject`) is an interpretation
  of the evidence. It does not rewrite the checker output.
- A focus rectangle is drawn only when the evidence contains trustworthy focus
  geometry. Missing geometry is stated explicitly; the UI never invents a box.

## Generate

Keep `dataset.json`, `assets/`, and `evidence/` in this directory, then run:

```sh
node generate.mjs --input dataset.json --output .
node generate.mjs --input dataset.json --output . --check
```

Every non-empty packet must include the verified
`evidence/campaign-report.json.gz` (`genui-g2-precision-report/1`) and each
finding must reference its compressed `genui-g2-precision-result/1`. Gzip is a
transport encoding only: the generator decompresses each file, verifies the
SHA-256 of the original JSON bytes, and separately binds the browser-evidence
producer commit/execution lock and the later verifier commit/verification lock,
along with attempt, site, Atomic ID, outcome, occurrence/signal ID, and report
inventory. A verifier-only commit never rewrites producer provenance.
A formal finding is accepted only when the result and report contain the same
single `VIOLATION_OBSERVED` witness and one displayed witness screenshot matches
the official screenshot receipt.

The generator computes the dataset SHA-256 identity and writes `findings.js`
plus one physical page per finding. It also rejects unknown Atomic IDs,
duplicate IDs/slugs/orders, missing or hash-mismatched evidence, candidates that
are not claim-excluded, and reused screenshot bytes.

Run the contract tests with:

```sh
node --test generate.test.mjs
```

Review exports carry both dataset ID and exact dataset identity. Imports are
atomic and rejected unless both match; unknown or duplicate finding IDs are
also rejected. Browser storage uses an identity-specific key.

## Property metadata

Reviewer-facing titles, temporal formulae, Bombadil snippets, and source links
must be generated from the exact LTL-UI Git commit named by the verified
campaign report. Do not transcribe them into the review packet by hand.

[`property-metadata.mjs`](property-metadata.mjs) reads, through Git objects:

- `online-v2/config/genui-g2-precision-campaign-v1.json`;
- `online-v2/config/vertical-property-admission-v2.json`; and
- every admitted reviewer-facing Atomic Property module.

It rejects inventory, Atomic ID, taxonomy-class, metadata-object, and assertion
reference mismatches. Source links are pinned to the full commit and source
line; each module and input manifest carries a SHA-256 receipt. Long source
formatting is whitespace-normalized into the same two-line Bombadil statement
for display without changing its identifiers or expression.

The campaign-to-UI bridge should call:

```js
const metadata = buildReviewerPropertyMetadata({
  ltlRepositoryRoot,
  sourceCommit: verifiedResult.source.commit,
  repositoryUrl: "https://github.com/Oscar-Ge/LTL-UI",
});
dataset.properties = reviewerPropertiesForDataset(metadata);
```

`verifiedResult.source.commit` is the browser-evidence producer commit.
`campaignReport.source.commit` is recorded separately as the verifier commit.

The metadata projection contains no focus geometry, expected user task, task
consequence, or BLV-validity judgment. Those facts must come from separately
bound evidence and must never be inferred from a property title.

Run both contracts with:

```sh
node --test generate.test.mjs property-metadata.test.mjs packet-bridge.test.mjs
```

## Finding-packet bridge

The default bridge publishes only hardened `FORMAL_VIOLATION` packets. It does
not read or publish the claim-excluded candidate JSONL:

```sh
node packet-bridge.mjs \
  --packet-dir /absolute/path/to/finding-packets \
  --campaign-report /absolute/path/to/campaign-report.json \
  --campaign-root /absolute/path/to/campaign \
  --ltl-repo /absolute/path/to/LTL-UI \
  --output /absolute/path/to/ltl-ui-g2-precision-review \
  --repository-url https://github.com/Oscar-Ge/LTL-UI
```

The bridge verifies the formal JSONL receipt, line count and exact formal ID
inventory from `finding-packet-manifest.json`. For each record, it reopens the
exact campaign `result.json` and official witness screenshot, verifies the
execution-lock/result/report/occurrence binding, and copies the bytes without
cropping, annotation, or recompression. It then generates `dataset.json`, runs
the existing site generator, and immediately checks the generated files.

Finding prose is deliberately limited to the recorded site, Atomic ID, trusted
action, control label, and `VIOLATION_OBSERVED`. Every reason reads “Checker
counterexample; pending reviewer validation.” Focus geometry is always `null`.
If a modern packet cannot uniquely bind the trusted action and its control, the
bridge fails closed instead of inventing a transition. Three legacy modal
observations did not retain trigger event IDs; for those property families the
bridge displays only the recorded key plus the property-level role
(`active dialog` or `new modal opener`), never a nearby node label inferred
from history. It does not add a task, user consequence, axe result,
BLV-validity judgment, or “only LTL” claim.

## Preliminary agent review

The three reviewer JSON files under `evidence/agent-reviews/` preserve the full
case-by-case reasoning. `summary.json` binds a normalized decision inventory to
the exact generated dataset identity. The primary reviewers handled disjoint
ranges. A fourth reviewer independently labels a small purposive overlap set;
the summary reports observed agreement and Cohen's kappa as a diagnostic only,
not as a population reliability or ground-truth estimate.
The UI intentionally starts with no selected user decisions; preliminary agent
judgments do not pre-populate or bias the browser annotation controls.
