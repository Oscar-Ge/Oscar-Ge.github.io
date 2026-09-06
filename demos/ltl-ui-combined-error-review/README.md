# LTL-UI combined annotation browser

Read-only public snapshot of the latest30 FP-fix 2,288 candidates and historical
cross-replay 484 candidates. Entry point: `index.html`. No build dependencies.

All 2,772 rows retain their notes and dataset-scoped IDs (`R:X…` and `H:X…`).
On 2026-09-06 the user confirmed reviewing all 14 unsure cases and classified
them as TP. Each changed row records that confirmation in `humanReview`, retains
its prior decision, and sets `humanConfirmed: true`. Existing Duplicate groups
are retained. The 493 representatives now comprise 424 TP and 69 FP (0 unsure).
The old 2,358-case development baseline is not included.

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

The replay table and filter cover both sources: 484 historical + 2,288 latest30.
Each run counts rows whose `replays` include that run. Pass@3 counts all 2,772
scoped IDs once. Correctness is Correct / (Correct + FP), excluding Duplicate.
`summary.json` records this combined breakdown as well as the historical-only
breakdown for reference. The table is generated from the current case labels.

`cases.json` is the downloadable snapshot, schema
`ltl-ui-combined-error-review/1`; it is not an import for either older review UI.
`summary.json` contains scope, provenance filenames, and counts without cases.
This page does not read, mutate, or overwrite other review pages' localStorage.

Canonical inputs (annotation snapshot 2026-09-05):

- `ltl-ui-cross-replay-review-2026-09-03.json`
- `ltl-ui-latest30-fpfix-rerun-blv-review-2026-09-05.json`
- `ltl-current-69-fp-source-review-2026-09-05.json`

Checker commit: `bfb4996a`. Machine-local paths are omitted from metadata; notes
are preserved. Only the 14 user-confirmed unsure labels were changed in this update.

Run `node verify.mjs cases.json` to check the scoped IDs, labels, replay filters,
Pass@3 counts, and all latest30 screenshot pairs. Passing the previous published
`cases.json` (722e4eb4) as a second argument also verifies that only the 14
user-confirmed annotations and their summary metadata changed.
