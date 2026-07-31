import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { caseHasDrawableFocus } from "../focus-view.mjs";

const manifest = JSON.parse(await readFile(
  new URL("../data/manifest.json", import.meta.url),
  "utf8",
));

test("all 85 published cases contain an exact drawable focus frame", () => {
  assert.equal(manifest.cases.length, 85);
  assert.deepEqual(
    manifest.cases
      .filter((item) => !caseHasDrawableFocus(item))
      .map((item) => item.id),
    [],
  );
});
