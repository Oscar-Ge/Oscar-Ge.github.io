import {
  caseHasDrawableFocus,
  focusPresentation,
  preferredScreenshotIndex,
} from "./focus-view.mjs";

const SCHEMA_VERSION = "ltl-ui-mentor-review-manifest/1";
const STORAGE_SCHEMA = "ltl-ui-mentor-review-annotations/1";
const MANIFEST_URL = new URL("./data/manifest.json", import.meta.url);
const DECISIONS = Object.freeze({
  "make-sense": "Make sense",
  unsure: "Unsure",
  reject: "Reject",
});
const SOURCE_LABELS = Object.freeze({
  NATURAL_CANDIDATE: "Natural candidate",
  CONTROLLED_SYNTHETIC_DEMONSTRATION: "Controlled demo",
});

const app = document.querySelector("#app");
let manifest;
let reviews = {};
let notice = "";
let noticeIsError = false;
const screenshotIndexByCase = new Map();
const filters = {
  query: "",
  atomicId: "all",
  family: "all",
  source: "all",
  review: "all",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeAssetPath(value) {
  const path = String(value ?? "").trim();
  if (
    path === ""
    || path.startsWith("/")
    || path.includes("\\")
    || path.split("/").includes("..")
    || /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    return "";
  }
  return path;
}

function manifestAssetUrl(value) {
  const path = safeAssetPath(value);
  return path ? new URL(path, MANIFEST_URL).href : "";
}

function safeLink(value) {
  const href = String(value ?? "").trim();
  if (
    href.startsWith("./")
    || href.startsWith("../")
    || /^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(href)
  ) {
    return href;
  }
  return "";
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }
}

function validateManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Manifest must be an object.");
  }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema: ${String(value.schemaVersion)}`);
  }
  if (!value.dataset || typeof value.dataset !== "object") {
    throw new Error("Dataset metadata is missing.");
  }
  for (const field of ["id", "identity", "title", "claimBoundary"]) {
    requireText(value.dataset[field], `dataset.${field}`);
  }
  if (!Array.isArray(value.cases)) {
    throw new Error("cases must be an array.");
  }

  const ids = new Set();
  for (const item of value.cases) {
    for (const field of [
      "id",
      "atomicId",
      "family",
      "sourceKind",
      "title",
      "failure",
      "formula",
      "bombadil",
      "currentFocus",
    ]) {
      requireText(item?.[field], `case.${field}`);
    }
    if (ids.has(item.id)) {
      throw new Error(`Duplicate case id: ${item.id}`);
    }
    ids.add(item.id);
    if (!Object.hasOwn(SOURCE_LABELS, item.sourceKind)) {
      throw new Error(`Unknown source kind for ${item.id}.`);
    }
    if (
      !Array.isArray(item.states)
      || item.states.length < 3
      || item.states.length > 5
    ) {
      throw new Error(`${item.id} must have 3–5 states.`);
    }
    if (!Array.isArray(item.trajectory) || item.trajectory.length === 0) {
      throw new Error(`${item.id} has no keyboard trajectory.`);
    }
    if (
      !Array.isArray(item.screenshots)
      || item.screenshots.length < 1
      || item.screenshots.length > 3
    ) {
      throw new Error(`${item.id} must have 1–3 real screenshots.`);
    }
    for (const [index, shot] of item.screenshots.entries()) {
      requireText(shot?.role, `${item.id}.screenshots[${index}].role`);
      requireText(shot?.src, `${item.id}.screenshots[${index}].src`);
      requireText(shot?.alt, `${item.id}.screenshots[${index}].alt`);
      requireText(shot?.focus, `${item.id}.screenshots[${index}].focus`);
      requireText(
        shot?.focusKind,
        `${item.id}.screenshots[${index}].focusKind`,
      );
      requireText(
        shot?.focusEvidence,
        `${item.id}.screenshots[${index}].focusEvidence`,
      );
      if (!safeAssetPath(shot.src)) {
        throw new Error(`${item.id} has an unsafe screenshot path.`);
      }
    }
    if (!caseHasDrawableFocus(item)) {
      throw new Error(`${item.id} has no exact drawable focus frame.`);
    }
    if (!Array.isArray(item.lineage) || item.lineage.length === 0) {
      throw new Error(`${item.id} has no evidence lineage.`);
    }
  }
  return value;
}

function storageKey() {
  return `${STORAGE_SCHEMA}:${manifest.dataset.id}:${manifest.dataset.identity}`;
}

function loadReviews() {
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (
      stored?.schemaVersion === STORAGE_SCHEMA
      && stored.datasetIdentity === manifest.dataset.identity
      && stored.reviews
      && typeof stored.reviews === "object"
    ) {
      reviews = stored.reviews;
    }
  } catch {
    setNotice("Stored review could not be read.", true);
  }
}

function reviewPayload() {
  return {
    schemaVersion: STORAGE_SCHEMA,
    datasetId: manifest.dataset.id,
    datasetIdentity: manifest.dataset.identity,
    exportedAt: new Date().toISOString(),
    reviews,
  };
}

function saveReviews(message = "Saved in this browser.") {
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(reviewPayload()));
    setNotice(message);
  } catch {
    setNotice("Local browser storage is unavailable.", true);
  }
}

function setNotice(message, isError = false) {
  notice = message;
  noticeIsError = isError;
  const status = document.querySelector("#status");
  if (status) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  download(
    `${manifest.dataset.id}-mentor-reviews.json`,
    `${JSON.stringify(reviewPayload(), null, 2)}\n`,
    "application/json",
  );
  setNotice("Exported JSON.");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  const columns = [
    "case_id",
    "atomic_id",
    "family",
    "source_kind",
    "site",
    "decision",
    "notes",
    "updated_at",
  ];
  const rows = manifest.cases.map((item) => {
    const review = reviews[item.id] ?? {};
    return [
      item.id,
      item.atomicId,
      item.family,
      item.sourceKind,
      item.site ?? "",
      review.decision ?? "",
      review.notes ?? "",
      review.updatedAt ?? "",
    ].map(csvCell).join(",");
  });
  download(
    `${manifest.dataset.id}-mentor-reviews.csv`,
    `${columns.join(",")}\n${rows.join("\n")}\n`,
    "text/csv;charset=utf-8",
  );
  setNotice("Exported CSV.");
}

function unique(field) {
  return [...new Set(manifest.cases.map((item) => item[field]))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function optionList(values, selected, labels = {}) {
  return values.map((value) => `
    <option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>
      ${escapeHtml(labels[value] ?? value)}
    </option>
  `).join("");
}

function reviewFor(id) {
  return reviews[id] ?? { decision: "", notes: "", updatedAt: "" };
}

function decisionBadge(id) {
  const decision = reviewFor(id).decision;
  if (!decision) return '<span class="badge pending">Pending</span>';
  return `<span class="badge ${escapeHtml(decision)}">${escapeHtml(DECISIONS[decision])}</span>`;
}

function filteredCases() {
  const query = filters.query.toLowerCase();
  return manifest.cases.filter((item) => {
    const review = reviewFor(item.id);
    const haystack = [
      item.id,
      item.atomicId,
      item.family,
      item.site,
      item.title,
      item.failure,
      item.formula,
    ].join(" ").toLowerCase();
    return (
      (filters.atomicId === "all" || item.atomicId === filters.atomicId)
      && (filters.family === "all" || item.family === filters.family)
      && (filters.source === "all" || item.sourceKind === filters.source)
      && (
        filters.review === "all"
        || (filters.review === "pending" && !review.decision)
        || review.decision === filters.review
      )
      && (query === "" || haystack.includes(query))
    );
  });
}

function focusOverlayHtml(presentation) {
  if (presentation.overlay === "viewport") {
    return '<span class="focus-viewport" aria-hidden="true"></span>';
  }
  if (presentation.overlay !== "element" || !presentation.box) return "";
  const box = presentation.box;
  return `
    <span
      class="focus-box"
      aria-hidden="true"
      style="left:${box.x}%;top:${box.y}%;width:${box.width}%;height:${box.height}%"
    ></span>
  `;
}

function screenshotIndexFor(item) {
  const saved = screenshotIndexByCase.has(item.id)
    ? Number(screenshotIndexByCase.get(item.id))
    : preferredScreenshotIndex(item.screenshots);
  const lastIndex = item.screenshots.length - 1;
  if (!Number.isInteger(saved)) return 0;
  return Math.max(0, Math.min(saved, lastIndex));
}

function statesHtml(states) {
  return states.map((state, index) => `
    ${index === 0 ? "" : '<span class="arrow" aria-hidden="true">→</span>'}
    <div class="state${state.violation ? " violation" : ""}">
      <strong>${escapeHtml(state.label)}</strong>
      <p>${escapeHtml(state.description)}</p>
      <span class="focus-chip">focus: ${escapeHtml(state.focus)}</span>
    </div>
  `).join("");
}

function screenshotFigureHtml(shot, index, selectedIndex) {
  const presentation = focusPresentation(shot);
  const focusValue = presentation.label.replace(/^Focus:\s*/u, "");
  return `
    <figure class="shot" data-shot-index="${index}"${index === selectedIndex ? "" : " hidden"}>
      <div class="shot-frame">
        <img src="${escapeHtml(manifestAssetUrl(shot.src))}" alt="${escapeHtml(shot.alt)}" loading="lazy">
        <div class="focus-readout${presentation.drawable ? "" : " unavailable"}" aria-hidden="true">
          <span>Focus</span>
          <strong>${escapeHtml(focusValue)}</strong>
        </div>
        ${focusOverlayHtml(presentation)}
      </div>
      <figcaption>
        <strong>${escapeHtml(shot.role)}</strong>
        <span>Recorded evidence frame</span>
      </figcaption>
    </figure>
  `;
}

function screenshotsHtml(item) {
  const selectedIndex = screenshotIndexFor(item);
  const selected = item.screenshots[selectedIndex];
  const selectedFocus = focusPresentation(selected);
  const stageId = `screenshot-stage-${item.id}`;
  const lastIndex = item.screenshots.length - 1;
  return `
    <div class="screenshot-carousel" data-screenshot-index="${selectedIndex}">
      <div class="screenshot-controls">
        <button
          class="screenshot-nav"
          type="button"
          data-direction="-1"
          aria-label="Previous screenshot for ${escapeHtml(item.atomicId)}"
          aria-controls="${escapeHtml(stageId)}"
          ${selectedIndex === 0 ? "disabled" : ""}
        >← Previous</button>
        <p class="screenshot-status" aria-live="polite" aria-atomic="true">
          <span data-frame-count>Frame ${selectedIndex + 1} / ${item.screenshots.length}</span>
          <strong data-frame-role>${escapeHtml(selected.role)}</strong>
          <span data-frame-focus>${escapeHtml(selectedFocus.label)}</span>
        </p>
        <button
          class="screenshot-nav"
          type="button"
          data-direction="1"
          aria-label="Next screenshot for ${escapeHtml(item.atomicId)}"
          aria-controls="${escapeHtml(stageId)}"
          ${selectedIndex === lastIndex ? "disabled" : ""}
        >Next →</button>
      </div>
      <div class="shot-stage" id="${escapeHtml(stageId)}">
        ${item.screenshots.map((shot, index) =>
          screenshotFigureHtml(shot, index, selectedIndex)).join("")}
      </div>
    </div>
  `;
}

function updateScreenshotCarousel(caseElement, item, requestedIndex) {
  const carousel = caseElement.querySelector(".screenshot-carousel");
  if (!carousel) return;

  const lastIndex = item.screenshots.length - 1;
  const nextIndex = Math.max(0, Math.min(requestedIndex, lastIndex));
  const selected = item.screenshots[nextIndex];
  screenshotIndexByCase.set(item.id, nextIndex);
  carousel.dataset.screenshotIndex = String(nextIndex);

  for (const shot of carousel.querySelectorAll("[data-shot-index]")) {
    shot.hidden = Number(shot.dataset.shotIndex) !== nextIndex;
  }
  carousel.querySelector("[data-frame-count]").textContent =
    `Frame ${nextIndex + 1} / ${item.screenshots.length}`;
  carousel.querySelector("[data-frame-role]").textContent = selected.role;
  carousel.querySelector("[data-frame-focus]").textContent =
    focusPresentation(selected).label;

  for (const button of carousel.querySelectorAll(".screenshot-nav")) {
    const direction = Number(button.dataset.direction);
    button.disabled = direction < 0 ? nextIndex === 0 : nextIndex === lastIndex;
  }
}

function trajectoryHtml(trajectory) {
  return trajectory.map((step, index) => `
    <li>
      <span class="trajectory-step">Step ${index + 1}</span>
      <kbd>${escapeHtml(step.key ?? step.action)}</kbd>
      <span class="trajectory-target">target: ${escapeHtml(step.target ?? "not captured")}</span>
    </li>
  `).join("");
}

function lineageHtml(lineage) {
  return lineage.map((entry) => {
    const href = safeLink(entry.href);
    const value = href
      ? `<a href="${escapeHtml(href)}">${escapeHtml(entry.value)}</a>`
      : escapeHtml(entry.value);
    return `<dt>${escapeHtml(entry.label)}</dt><dd>${value}</dd>`;
  }).join("");
}

function caseHtml(item, index) {
  const review = reviewFor(item.id);
  const sourceClass = item.sourceKind === "NATURAL_CANDIDATE"
    ? "natural"
    : "controlled";
  return `
    <details class="case" data-case-id="${escapeHtml(item.id)}"${index === 0 ? " open" : ""}>
      <summary>
        <div>
          <div class="badges">
            <span class="badge">${escapeHtml(item.atomicId)}</span>
            <span class="badge">${escapeHtml(item.family)}</span>
            <span class="badge ${sourceClass}">${escapeHtml(SOURCE_LABELS[item.sourceKind])}</span>
            ${decisionBadge(item.id)}
          </div>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="summary-failure">${escapeHtml(item.failure)}</p>
        </div>
      </summary>
      <div class="case-body">
        <section class="contract" aria-label="Temporal contract">
          <div class="formula">
            <p class="section-label">LTL</p>
            <code>${escapeHtml(item.formula)}</code>
          </div>
          <div class="bombadil">
            <p class="section-label">Bombadil</p>
            <code>${escapeHtml(item.bombadil)}</code>
          </div>
        </section>

        <section aria-label="State transitions">
          <p class="section-label">State transition · current focus ${escapeHtml(item.currentFocus)}</p>
          <div class="state-flow">${statesHtml(item.states)}</div>
        </section>

        <section class="keyboard-panel" aria-label="Keyboard action sequence">
          <p class="section-label">Keyboard actions</p>
          <ol class="trajectory">${trajectoryHtml(item.trajectory)}</ol>
        </section>

        <section aria-label="Screenshot evidence">
          <p class="section-label">Captured frames · one frame at a time</p>
          ${screenshotsHtml(item)}
        </section>

        <section class="panel lineage-panel">
          <p class="section-label">Evidence lineage</p>
          <dl class="lineage">${lineageHtml(item.lineage)}</dl>
        </section>

        <section class="review" aria-label="Mentor review">
          <div class="review-top">
            <h3>Does this represent a meaningful failure?</h3>
            <div class="decisions" role="group" aria-label="Decision for ${escapeHtml(item.id)}">
              ${Object.entries(DECISIONS).map(([decision, label]) => `
                <button
                  class="decision"
                  type="button"
                  data-decision="${decision}"
                  aria-pressed="${review.decision === decision}"
                >${label}</button>
              `).join("")}
            </div>
          </div>
          <label class="field" for="notes-${escapeHtml(item.id)}">
            Notes
            <textarea
              class="notes"
              id="notes-${escapeHtml(item.id)}"
              placeholder="Why? What should change?"
            >${escapeHtml(review.notes)}</textarea>
          </label>
        </section>
      </div>
    </details>
  `;
}

function render() {
  const shown = filteredCases();
  const reviewedCount = manifest.cases.filter((item) => reviewFor(item.id).decision).length;
  const percent = manifest.cases.length === 0
    ? 0
    : Math.round((reviewedCount / manifest.cases.length) * 100);

  app.innerHTML = `
    <header class="masthead">
      <div>
        <p class="eyebrow">Mentor review · temporal evidence</p>
        <h1>${escapeHtml(manifest.dataset.title)}</h1>
        <p class="lede">${escapeHtml(manifest.dataset.claimBoundary)}</p>
      </div>
      <div class="toolbar" aria-label="Export controls">
        <button class="button primary" id="export-json" type="button">Export JSON</button>
        <button class="button" id="export-csv" type="button">Export CSV</button>
      </div>
    </header>

    <div class="dataset-strip">
      <span>Dataset <code>${escapeHtml(manifest.dataset.id)}</code></span>
      <span>Identity <code>${escapeHtml(manifest.dataset.identity.slice(0, 18))}…</code></span>
      <span>${manifest.cases.length} cases</span>
      <span>${unique("atomicId").length} APs</span>
    </div>
    <p id="status" class="status${noticeIsError ? " error" : ""}" aria-live="polite">${escapeHtml(notice)}</p>

    <div class="progress" aria-label="${reviewedCount} of ${manifest.cases.length} reviewed">
      <span>Reviewed</span>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <strong>${reviewedCount}/${manifest.cases.length}</strong>
    </div>

    <section class="filters" aria-label="Case filters">
      <label class="field">
        Search
        <input id="filter-query" type="search" value="${escapeHtml(filters.query)}" placeholder="Title, site, formula…">
      </label>
      <label class="field">
        Atomic property
        <select id="filter-ap">
          ${optionList(["all", ...unique("atomicId")], filters.atomicId, { all: "All APs" })}
        </select>
      </label>
      <label class="field">
        Family
        <select id="filter-family">
          ${optionList(["all", ...unique("family")], filters.family, { all: "All families" })}
        </select>
      </label>
      <label class="field">
        Source
        <select id="filter-source">
          ${optionList(["all", ...unique("sourceKind")], filters.source, {
            all: "All sources",
            ...SOURCE_LABELS,
          })}
        </select>
      </label>
      <label class="field">
        Review
        <select id="filter-review">
          ${optionList(
            ["all", "pending", "make-sense", "unsure", "reject"],
            filters.review,
            { all: "All reviews", pending: "Pending", ...DECISIONS },
          )}
        </select>
      </label>
    </section>

    <section id="cases" class="case-list" aria-label="Example cases">
      ${shown.length > 0
        ? shown.map(caseHtml).join("")
        : '<p class="empty">No cases match these filters.</p>'}
    </section>
  `;
}

function updateReview(caseId, patch) {
  const current = reviewFor(caseId);
  reviews[caseId] = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

app.addEventListener("click", (event) => {
  if (event.target.closest("#export-json")) {
    exportJson();
    return;
  }
  if (event.target.closest("#export-csv")) {
    exportCsv();
    return;
  }
  const screenshotButton = event.target.closest(".screenshot-nav");
  if (screenshotButton) {
    const caseElement = screenshotButton.closest(".case");
    const caseId = caseElement?.dataset.caseId;
    const item = manifest.cases.find((candidate) => candidate.id === caseId);
    if (!caseElement || !item) return;
    const currentIndex = screenshotIndexFor(item);
    const direction = Number(screenshotButton.dataset.direction);
    updateScreenshotCarousel(
      caseElement,
      item,
      currentIndex + direction,
    );
    if (screenshotButton.disabled) {
      caseElement
        .querySelector(`.screenshot-nav[data-direction="${-direction}"]`)
        ?.focus();
    }
    return;
  }
  const button = event.target.closest(".decision");
  if (!button) return;
  const caseElement = button.closest(".case");
  const caseId = caseElement?.dataset.caseId;
  if (!caseId) return;
  const decision = button.dataset.decision;
  const previous = reviewFor(caseId).decision;
  updateReview(caseId, { decision: previous === decision ? "" : decision });
  saveReviews();
  render();
  document.querySelector(`[data-case-id="${CSS.escape(caseId)}"]`)?.setAttribute("open", "");
});

app.addEventListener("change", (event) => {
  const mapping = {
    "filter-ap": "atomicId",
    "filter-family": "family",
    "filter-source": "source",
    "filter-review": "review",
  };
  const field = mapping[event.target.id];
  if (field) {
    filters[field] = event.target.value;
    render();
  }
});

app.addEventListener("input", (event) => {
  if (event.target.id === "filter-query") {
    filters.query = event.target.value;
    render();
    document.querySelector("#filter-query")?.focus();
    return;
  }
  if (!event.target.classList.contains("notes")) return;
  const caseId = event.target.closest(".case")?.dataset.caseId;
  if (!caseId) return;
  updateReview(caseId, { notes: event.target.value });
  saveReviews("Notes saved.");
});

try {
  const response = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Manifest request failed (${response.status}).`);
  }
  manifest = validateManifest(await response.json());
  loadReviews();
  render();
} catch (error) {
  app.innerHTML = `
    <section class="fatal">
      <p class="eyebrow">Unable to load examples</p>
      <h1>Manifest error</h1>
      <p>${escapeHtml(error.message)}</p>
      <p>Serve this directory over HTTP; browsers do not allow <code>fetch()</code> from a local file URL.</p>
    </section>
  `;
}
