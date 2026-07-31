# LTL mentor example review

Static, dependency-free review UI for compact checker trajectories.

Public review page:
<https://oscar-ge.github.io/demos/ltl-ui-mentor-examples/>

The published dataset contains 85 review cases:

- 69 controlled demonstrations, covering all 21 implemented Atomic
  Properties with 3–5 variants each;
- 16 candidates found during the 137-site G2 generated-website scan.

All controlled variants were observed as violations in two independent
Chrome/Bombadil replays under execution lock
`sha256:476a938a80d336aee41559746c42f4c3b91fcbddd923e9fdc35325f1c5653584`.
They demonstrate checker behavior, not natural failure prevalence. Natural
findings remain candidates until human adjudication.

Serve this directory over HTTP:

```sh
python3 -m http.server 8765 --directory demos/ltl-ui-mentor-examples
```

Then open `http://127.0.0.1:8765/`.

Validate the focus presentation and the published 85-case data gate with:

```sh
node --test demos/ltl-ui-mentor-examples/tests/*.test.mjs
```

## Data contract

The page reads `data/manifest.json` with schema
`ltl-ui-mentor-review-manifest/1`. Each case must contain:

- one Atomic Property, family, and source kind;
- a short failure statement, LTL formula, and Bombadil assertion;
- 3–5 explicit states with focus;
- 1–3 real screenshot objects with `role`, `src`, `alt`, `focus`,
  `focusKind`, `focusEvidence`, and an optional percentage-based `focusBox`;
- at least one exact drawable focus frame: an element with `focusBox`, or an
  explicitly captured document focus;
- a keyboard trajectory;
- evidence lineage.

Allowed source kinds are:

- `NATURAL_CANDIDATE`
- `CONTROLLED_SYNTHETIC_DEMONSTRATION`

Reviews are stored in `localStorage`, scoped to the dataset ID and identity.
JSON and CSV exports contain annotations only; source evidence is not modified.
The UI initially selects the first exact drawable frame. Element focus is drawn
with its captured viewport rectangle; document focus is shown as a dashed
full-viewport border. Legacy role/tag-only evidence is described but never
drawn as if it had an exact rectangle. A state may independently use
`"screenshot": null` when no frame exists for that transition.
