# LTL mentor example review

Static, dependency-free review UI for compact checker trajectories.

The published dataset contains 85 review cases:

- 69 controlled demonstrations, covering all 21 implemented Atomic
  Properties with 3–5 variants each;
- 16 candidates found during the 137-site G2 generated-website scan.

All controlled variants were observed as violations in two independent
Chrome/Bombadil replays under execution lock
`sha256:8f31e711349101f32647a5140c3addbf051e13819a40470d3b5f6290cc9ec7d2`.
They demonstrate checker behavior, not natural failure prevalence. Natural
findings remain candidates until human adjudication.

Serve this directory over HTTP:

```sh
python3 -m http.server 8765 --directory demos/ltl-ui-mentor-examples
```

Then open `http://127.0.0.1:8765/`.

## Data contract

The page reads `data/manifest.json` with schema
`ltl-ui-mentor-review-manifest/1`. Each case must contain:

- one Atomic Property, family, and source kind;
- a short failure statement, LTL formula, and Bombadil assertion;
- 3–5 explicit states with focus;
- 1–3 real screenshot objects with `role`, `src`, `alt`, `focus`, and an
  optional percentage-based `focusBox`;
- a keyboard trajectory;
- evidence lineage.

Allowed source kinds are:

- `NATURAL_CANDIDATE`
- `CONTROLLED_SYNTHETIC_DEMONSTRATION`

Reviews are stored in `localStorage`, scoped to the dataset ID and identity.
JSON and CSV exports contain annotations only; source evidence is not modified.
The UI fills unused screenshot slots with “Unavailable”; it never duplicates a
frame to imply evidence that was not captured. A state may independently use
`"screenshot": null` when no frame exists for that transition.
