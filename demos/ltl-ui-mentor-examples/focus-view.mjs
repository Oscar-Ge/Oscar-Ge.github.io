const EXACT_EVIDENCE = new Set([
  "SCREENSHOT_STATE_EXACT",
  "FINAL_CONTEXT_EXACT",
]);

function validBox(value) {
  if (!value || typeof value !== "object") return null;
  const numbers = ["x", "y", "width", "height"]
    .map((field) => Number(value[field]));
  if (numbers.some((number) =>
    !Number.isFinite(number) || number < 0 || number > 100)
    || numbers[2] <= 0
    || numbers[3] <= 0
    || numbers[0] + numbers[2] > 100.001
    || numbers[1] + numbers[3] > 100.001) {
    return null;
  }
  return {
    x: numbers[0],
    y: numbers[1],
    width: numbers[2],
    height: numbers[3],
  };
}

export function focusPresentation(screenshot) {
  const focus = String(screenshot?.focus ?? "not captured");
  const exact = EXACT_EVIDENCE.has(screenshot?.focusEvidence);
  const box = validBox(screenshot?.focusBox);

  if (exact && screenshot?.focusKind === "element" && box) {
    return {
      drawable: true,
      overlay: "element",
      label: `Focus: ${focus}`,
      box,
    };
  }
  if (exact && screenshot?.focusKind === "document") {
    return {
      drawable: true,
      overlay: "viewport",
      label: "Focus: document (no focused element)",
      box: null,
    };
  }
  if (exact && screenshot?.focusKind === "element") {
    return {
      drawable: false,
      overlay: null,
      label: `Focus: ${focus} (no visible rectangle)`,
      box: null,
    };
  }
  const legacy = screenshot?.focusEvidence === "LEGACY_ROLE_TAG_ONLY";
  return {
    drawable: false,
    overlay: null,
    label: legacy
      ? `Focus: ${focus} (legacy trace; exact box unavailable)`
      : `Focus: ${focus}`,
    box: null,
  };
}

export function preferredScreenshotIndex(screenshots) {
  if (!Array.isArray(screenshots) || screenshots.length === 0) return 0;
  const index = screenshots.findIndex(
    (screenshot) => focusPresentation(screenshot).drawable,
  );
  return index < 0 ? 0 : index;
}

export function caseHasDrawableFocus(item) {
  return Array.isArray(item?.screenshots)
    && item.screenshots.some(
      (screenshot) => focusPresentation(screenshot).drawable,
    );
}
