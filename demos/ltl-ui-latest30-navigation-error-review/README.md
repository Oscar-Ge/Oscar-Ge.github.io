# LTL-UI latest30 navigation error review

This static review site contains the 2,358 individual candidates produced by the seven properties added between the frozen latest23 and latest30 Selected-31 checker. The source experiment replayed 31 websites across three previously recorded traces with action policy `tier1-wait-tab4-shift1/1`.

The site preserves each canonical `X####` ID and separates two kinds of annotation:

- **Agent first-pass suggestion:** evidence-based guidance generated on 2026-09-04. It is not human-confirmed ground truth.
- **Manual review:** the decision and note entered in the browser. These values remain in `localStorage` until exported.

Each replay panel uses one representative trigger for that case and replay. “Before” is the trace entry immediately preceding the matched trigger screenshot; “After / trigger” is the screenshot recorded on the matching violation entry. A red rectangle is shown when the trace includes a focus box. Checker snapshots, historical Orca evidence, fresh-route DOM/source leads, and known evidence gaps appear below the screenshots.

Manual decisions are `correct`, `false-positive`, `duplicate`, and `unsure`. Exported files use schema `ltl-ui-latest30-navigation-error-review/1`. Import accepts that same schema and ignores IDs outside this fixed 2,358-case dataset.

`dataset-summary.json` records candidate, property, evidence, image, trace-match, and missing-image counts from the build. `cases.js` is the generated browser payload. The images directory stores each source screenshot once and allows multiple cases to reference the same asset.
