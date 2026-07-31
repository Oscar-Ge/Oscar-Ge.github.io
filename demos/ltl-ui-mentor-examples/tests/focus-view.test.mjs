import assert from "node:assert/strict";
import test from "node:test";

import {
  caseHasDrawableFocus,
  focusPresentation,
  preferredScreenshotIndex,
} from "../focus-view.mjs";

test("case opens on its first exact drawable focus frame", () => {
  const screenshots = [{
    focus: "button",
    focusKind: "element",
    focusEvidence: "LEGACY_ROLE_TAG_ONLY",
    focusBox: null,
  }, {
    focus: "Continue",
    focusKind: "element",
    focusEvidence: "SCREENSHOT_STATE_EXACT",
    focusBox: { x: 10, y: 20, width: 30, height: 5 },
  }, {
    focus: "document",
    focusKind: "document",
    focusEvidence: "SCREENSHOT_STATE_EXACT",
    focusBox: null,
  }];

  assert.equal(preferredScreenshotIndex(screenshots), 1);
});

test("exact element focus produces a rectangular overlay", () => {
  assert.deepEqual(focusPresentation({
    focus: "Continue",
    focusKind: "element",
    focusEvidence: "SCREENSHOT_STATE_EXACT",
    focusBox: { x: 10, y: 20, width: 30, height: 5 },
  }), {
    drawable: true,
    overlay: "element",
    label: "Focus: Continue",
    box: { x: 10, y: 20, width: 30, height: 5 },
  });
});

test("exact document focus produces an honest viewport overlay", () => {
  assert.deepEqual(focusPresentation({
    focus: "document",
    focusKind: "document",
    focusEvidence: "SCREENSHOT_STATE_EXACT",
    focusBox: null,
  }), {
    drawable: true,
    overlay: "viewport",
    label: "Focus: document (no focused element)",
    box: null,
  });
});

test("legacy element identity is described but not drawn", () => {
  assert.deepEqual(focusPresentation({
    focus: "button",
    focusKind: "element",
    focusEvidence: "LEGACY_ROLE_TAG_ONLY",
    focusBox: null,
  }), {
    drawable: false,
    overlay: null,
    label: "Focus: button (legacy trace; exact box unavailable)",
    box: null,
  });
});

test("exact element focus without a visible rectangle stays explicit", () => {
  assert.deepEqual(focusPresentation({
    focus: "Skip booking filters",
    focusKind: "element",
    focusEvidence: "SCREENSHOT_STATE_EXACT",
    focusBox: null,
  }), {
    drawable: false,
    overlay: null,
    label: "Focus: Skip booking filters (no visible rectangle)",
    box: null,
  });
});

test("a review case passes the focus gate only with exact drawable evidence", () => {
  assert.equal(caseHasDrawableFocus({ screenshots: [{
    focus: "button",
    focusKind: "element",
    focusEvidence: "LEGACY_ROLE_TAG_ONLY",
    focusBox: null,
  }] }), false);

  assert.equal(caseHasDrawableFocus({ screenshots: [{
    focus: "document",
    focusKind: "document",
    focusEvidence: "SCREENSHOT_STATE_EXACT",
    focusBox: null,
  }] }), true);

  assert.equal(caseHasDrawableFocus({ screenshots: [{
    focus: "Continue",
    focusKind: "element",
    focusEvidence: "FINAL_CONTEXT_EXACT",
    focusBox: { x: 10, y: 20, width: 30, height: 5 },
  }] }), true);

  assert.equal(caseHasDrawableFocus({ screenshots: [{
    focus: "Continue",
    focusKind: "element",
    focusEvidence: "FINAL_CONTEXT_EXACT",
    focusBox: { x: 90, y: 20, width: 20, height: 5 },
  }] }), false);

  assert.equal(caseHasDrawableFocus({ screenshots: [{
    focus: "Continue",
    focusKind: "element",
    focusEvidence: "FINAL_CONTEXT_EXACT",
    focusBox: { x: 10, y: 20, width: 0, height: 5 },
  }] }), false);
});
