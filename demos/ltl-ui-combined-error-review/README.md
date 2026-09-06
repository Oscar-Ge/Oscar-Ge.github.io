# LTL-UI combined annotation browser

Read-only public snapshot of the latest30 FP-fix 2,288 candidates and historical
cross-replay 484 candidates. Entry point: `index.html`. No build dependencies.

The 2,772 rows preserve original labels, notes, and dataset-scoped IDs (`R:X…`
and `H:X…`). Removing rows already labelled Duplicate leaves 493 representatives:
410 TP, 69 FP, 14 unsure. This is **not** new cross-dataset defect deduplication,
one checker run, or human-confirmed ground truth. The old 2,358-case development
baseline is not included.

All latest30 rows include their existing AI notes verbatim. Historical notes are
empty in the canonical source; do not invent historical annotation provenance.
The 69-case AI mechanism-review supplement includes 28 historical FP cases and
41 latest30 FP cases. It is shown separately and does not change their labels.
The other 456 historical rows have no notes in these sources.

Latest30 non-Duplicate representatives include one exact current-rerun trigger
before/after screenshot pair each (250 pairs, 500 images). The existing after
images were checked against their exact trace entries before the preceding trace
frame was added as the before image. Duplicate rows preserve trigger references and
link to their canonical representative; that representative's screenshot is not
claimed to show the duplicate row's action. Historical before/after evidence
uses existing relative assets in `../ltl-ui-cross-replay-error-review/`.
Screenshots show visual state, not screen-reader speech or reading position.

Historical rows retain their replay membership metadata. The page exposes it as
a Replay 1/2/3 filter and reports 235, 249, and 217 appearances respectively;
the Pass@3 union contains 484 unique candidates.

`cases.json` is the downloadable snapshot, schema
`ltl-ui-combined-error-review/1`; it is not an import for either older review UI.
`summary.json` contains scope, provenance filenames, and counts without cases.
This page does not read, mutate, or overwrite other review pages' localStorage.

Canonical inputs (annotation snapshot 2026-09-05):

- `ltl-ui-cross-replay-review-2026-09-03.json`
- `ltl-ui-latest30-fpfix-rerun-blv-review-2026-09-05.json`
- `ltl-current-69-fp-source-review-2026-09-05.json`

Checker commit: `bfb4996a`. Machine-local paths are omitted from metadata; notes
are preserved, not re-adjudicated. No checker or annotation changes are made by
publishing this viewer.

Run `node verify.mjs cases.json` to check the scoped IDs, labels, replay filters,
Pass@3 counts, and all latest30 screenshot pairs. Passing the previous published
`cases.json` as a second argument additionally verifies that only `generatedAt`
and the new `beforeImage` fields differ from that baseline.
