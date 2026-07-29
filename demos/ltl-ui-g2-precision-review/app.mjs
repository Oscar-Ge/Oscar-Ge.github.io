import {
  createExportPayload,
  importReviewsIntoStorage,
  reviewsToMap,
  storageKey,
  validateImportPayload,
} from "./review-protocol.mjs";

const DATA_SCHEMA = "ltl-ui-g2-precision-data/2";
const DECISION_LABELS = Object.freeze({
  "make-sense": "Make sense",
  unsure: "Unsure",
  reject: "Reject",
});

const rootElement = document.documentElement;
const app = document.querySelector("#app");
const root = rootElement.dataset.root ?? "./";
const view = rootElement.dataset.view ?? "hub";
const requestedSlug = rootElement.dataset.finding ?? "";
let data;
let reviews = new Map();
let notice = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function fail(message) {
  throw new Error(message);
}

function assertRuntimeData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("The generated dataset is missing.");
  }
  if (value.schemaVersion !== DATA_SCHEMA) {
    fail(`Unsupported dataset schema: ${String(value.schemaVersion)}`);
  }
  if (!value.dataset || typeof value.dataset !== "object") {
    fail("Dataset metadata is missing.");
  }
  for (const field of ["id", "identity", "title", "claimBoundary"]) {
    if (
      typeof value.dataset[field] !== "string"
      || value.dataset[field].trim() === ""
    ) {
      fail(`Dataset metadata field ${field} is invalid.`);
    }
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(value.dataset.identity)) {
    fail("Dataset identity is not a SHA-256 identity.");
  }
  if (!Array.isArray(value.properties) || !Array.isArray(value.findings)) {
    fail("Properties and findings must be arrays.");
  }

  const propertyIds = new Set();
  for (const property of value.properties) {
    if (!property || typeof property.atomicId !== "string") {
      fail("A property has no Atomic ID.");
    }
    if (propertyIds.has(property.atomicId)) {
      fail(`Duplicate Atomic ID: ${property.atomicId}`);
    }
    propertyIds.add(property.atomicId);
  }

  const findingIds = new Set();
  const slugs = new Set();
  for (const finding of value.findings) {
    if (!finding || typeof finding !== "object") {
      fail("A finding is malformed.");
    }
    if (findingIds.has(finding.id)) {
      fail(`Duplicate finding ID: ${String(finding.id)}`);
    }
    if (slugs.has(finding.slug)) {
      fail(`Duplicate finding slug: ${String(finding.slug)}`);
    }
    findingIds.add(finding.id);
    slugs.add(finding.slug);
    if (!propertyIds.has(finding.atomicId)) {
      fail(`Unknown Atomic ID: ${String(finding.atomicId)}`);
    }
    if (!Array.isArray(finding.steps) || finding.steps.length === 0) {
      fail(`Finding ${finding.id} has no screenshot-backed state.`);
    }
    const imagePaths = new Set();
    let witnessCount = 0;
    for (const step of finding.steps) {
      if (typeof step.image !== "string" || step.image.trim() === "") {
        fail(`Finding ${finding.id} has a missing image path.`);
      }
      if (imagePaths.has(step.image)) {
        fail(`Finding ${finding.id} reuses an image across states.`);
      }
      imagePaths.add(step.image);
      if (step.imageRole === "witness") {
        witnessCount += 1;
      } else if (step.imageRole !== "context-only") {
        fail(`Finding ${finding.id} has an unknown image role.`);
      }
      if (!Array.isArray(step.facts) || step.facts.length > 3) {
        fail(`Finding ${finding.id} has more than three step facts.`);
      }
      if (
        step.focusBox !== null
        && (
          !step.focusBox
          || typeof step.focusBox !== "object"
          || typeof step.focusBox.label !== "string"
        )
      ) {
        fail(`Finding ${finding.id} has malformed focus geometry.`);
      }
    }
    if (finding.findingKind === "formal") {
      if (
        finding.outcome !== "VIOLATION_OBSERVED"
        || finding.excludedFromClaims !== false
        || witnessCount === 0
      ) {
        fail(`Formal finding ${finding.id} lacks a valid violation witness.`);
      }
    } else if (finding.findingKind === "candidate") {
      if (
        finding.outcome !== "CANDIDATE_SIGNAL"
        || finding.excludedFromClaims !== true
        || witnessCount !== 0
      ) {
        fail(`Candidate finding ${finding.id} is not claim-excluded context.`);
      }
    } else {
      fail(`Finding ${finding.id} has an unknown kind.`);
    }
  }
  return value;
}

function findingIds() {
  return data.findings.map((finding) => finding.id);
}

function currentPayload() {
  return createExportPayload(data.dataset, findingIds(), reviews);
}

function setNotice(message, isError = false) {
  notice = { message, isError };
  const status = document.querySelector("#status");
  if (status) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }
}

function loadReviews() {
  const key = storageKey(data.dataset);
  let raw;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    notice = {
      message: "Local review storage is unavailable in this browser.",
      isError: true,
    };
    return;
  }
  if (!raw) {
    return;
  }
  try {
    const payload = validateImportPayload(
      JSON.parse(raw),
      data.dataset,
      findingIds(),
    );
    reviews = reviewsToMap(payload);
  } catch (error) {
    notice = {
      message: `Stored review was ignored: ${error.message}`,
      isError: true,
    };
  }
}

function saveReviews() {
  try {
    window.localStorage.setItem(
      storageKey(data.dataset),
      JSON.stringify(currentPayload()),
    );
    setNotice("Saved locally for this exact dataset.");
  } catch {
    setNotice("Could not save to local browser storage.", true);
  }
}

function downloadReviews() {
  const payload = currentPayload();
  const blob = new Blob(
    [`${JSON.stringify(payload, null, 2)}\n`],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${data.dataset.id}-reviews.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setNotice(`Exported ${payload.reviews.length} annotation(s).`);
}

async function importReviews(file) {
  let imported;
  try {
    imported = importReviewsIntoStorage(
      JSON.parse(await file.text()),
      data.dataset,
      findingIds(),
      window.localStorage,
    );
  } catch (error) {
    setNotice(`Import rejected: ${error.message}`, true);
    return;
  }
  reviews = imported.reviews;
  render();
  setNotice(`Imported ${imported.payload.reviews.length} annotation(s).`);
}

function toolbarHtml() {
  return `
    <div class="toolbar" aria-label="Review data controls">
      <button class="button primary" id="export-reviews" type="button">
        Export JSON
      </button>
      <button class="button" id="import-reviews" type="button">
        Import JSON
      </button>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
    </div>
  `;
}

function mastheadHtml() {
  return `
    <header class="masthead">
      <div>
        <p class="eyebrow">Evidence-first review</p>
        <h1>${escapeHtml(data.dataset.title)}</h1>
        <p class="lede">${escapeHtml(data.dataset.claimBoundary)}</p>
      </div>
      ${toolbarHtml()}
    </header>
    <div class="dataset-strip" aria-label="Dataset identity">
      <span>Dataset <code>${escapeHtml(data.dataset.id)}</code></span>
      <span>Identity <code>${escapeHtml(data.dataset.identity.slice(0, 20))}…</code></span>
      <span>Producer <code>${escapeHtml(
        data.dataset.producerSourceCommit?.slice(0, 12) ?? "none",
      )}</code></span>
      <span>Verifier <code>${escapeHtml(
        data.dataset.verifierSourceCommit?.slice(0, 12) ?? "none",
      )}</code></span>
      <span>${data.findings.length} finding${data.findings.length === 1 ? "" : "s"}</span>
      <span>
        <a href="${root}evidence/agent-reviews/summary.json">
          Preliminary agent triage
        </a>
      </span>
      <span>
        <a href="${root}examples/coinmarketcap-search-focus-return/?step=0">
          Current three-state demo
        </a>
      </span>
      <span>
        <a href="${root}examples/airbnb-wishlist-focus-return/?step=0">
          Archived three-state demo
        </a>
      </span>
    </div>
    <p id="status" class="status${notice?.isError ? " error" : ""}" role="status">
      ${notice ? escapeHtml(notice.message) : ""}
    </p>
  `;
}

function kindBadge(finding) {
  const label = finding.findingKind === "formal"
    ? "Formal finding"
    : "Candidate · context only";
  return `<span class="badge ${finding.findingKind}">${label}</span>`;
}

function reviewBadge(findingId) {
  const decision = reviews.get(findingId)?.decision;
  if (!decision) {
    return "";
  }
  return `<span class="badge reviewed">${escapeHtml(DECISION_LABELS[decision])}</span>`;
}

function renderHub() {
  const cards = data.findings.map((finding) => `
    <article class="finding-card">
      <div class="badge-row">
        ${kindBadge(finding)}
        <span class="badge ap">${escapeHtml(finding.atomicId)}</span>
        ${reviewBadge(finding.id)}
      </div>
      <h2>${escapeHtml(finding.title)}</h2>
      <div class="card-meta">
        <span>Site ${escapeHtml(finding.siteId)}</span>
        <span>Attempt ${escapeHtml(finding.attemptId)}</span>
      </div>
      <p class="card-summary">${escapeHtml(finding.summary)}</p>
      <a class="finding-link" href="${root}${encodeURIComponent(finding.slug)}/">
        Review evidence →
      </a>
    </article>
  `).join("");

  const content = data.findings.length === 0
    ? `
      <section class="empty-state">
        <strong>No findings loaded</strong>
        <p>
          This is an intentionally empty review packet. It contains no fabricated
          violations or placeholder screenshots. Run the validator/generator with
          provenance-backed findings to populate it.
        </p>
      </section>
    `
    : `<main id="findings" class="finding-grid">${cards}</main>`;

  app.innerHTML = `${mastheadHtml()}${content}`;
}

function propertyFor(finding) {
  return data.properties.find(
    (property) => property.atomicId === finding.atomicId,
  );
}

function annotationHtml(finding) {
  const review = reviews.get(finding.id) ?? { decision: null, note: "" };
  const buttons = Object.entries(DECISION_LABELS).map(([decision, label]) => `
    <button
      type="button"
      class="decision-button"
      data-decision="${decision}"
      aria-pressed="${review.decision === decision ? "true" : "false"}"
    >${label}</button>
  `).join("");
  return `
    <section class="panel" aria-labelledby="review-title">
      <p class="panel-label">Your annotation</p>
      <h2 id="review-title">Does this interpretation hold?</h2>
      <div class="decision-group">${buttons}</div>
      <label class="note-label" for="review-note">Short note</label>
      <textarea
        class="note"
        id="review-note"
        maxlength="5000"
        placeholder="What makes the trace convincing or questionable?"
      >${escapeHtml(review.note)}</textarea>
      <p class="review-hint">Saved only under this dataset’s exact SHA-256 identity.</p>
    </section>
  `;
}

function findingNavigation(finding) {
  const index = data.findings.findIndex((item) => item.id === finding.id);
  const previous = data.findings[index - 1];
  const next = data.findings[index + 1];
  return `
    <nav class="finding-nav" aria-label="Finding navigation">
      <span>${previous
        ? `<a href="${root}${encodeURIComponent(previous.slug)}/">← Previous</a>`
        : ""}</span>
      <span>${next
        ? `<a href="${root}${encodeURIComponent(next.slug)}/">Next →</a>`
        : ""}</span>
    </nav>
  `;
}

function stepHtml(finding, step, stepIndex) {
  const facts = step.facts.map((fact) => `
    <div class="fact">
      <dt>${escapeHtml(fact.label)}</dt>
      <dd>${escapeHtml(fact.value)}</dd>
    </div>
  `).join("");
  const box = step.focusBox;
  const focusLabel = box?.label ?? "No focus rectangle captured";
  const focusOverlay = box
    ? `
      <div
        class="focus-box"
        style="left:${box.xPct}%;top:${box.yPct}%;width:${box.widthPct}%;height:${box.heightPct}%"
        aria-hidden="true"
      >
        <span class="focus-label">${escapeHtml(box.label)}</span>
      </div>
    `
    : "";
  return `
    <div class="screenshot-frame" id="screenshot-frame">
      <img
        id="finding-image"
        src="${root}${escapeAttribute(step.image)}"
        alt="${escapeAttribute(`${finding.title}; ${step.label}; focus: ${focusLabel}`)}"
      >
      ${focusOverlay}
    </div>
    <div class="screenshot-meta">
      <span>State ${stepIndex + 1} of ${finding.steps.length}</span>
      <span class="badge ${step.imageRole === "witness" ? "formal" : "candidate"}">
        ${step.imageRole === "witness" ? "Witness" : "Context only"}
      </span>
    </div>
    <p class="transition">
      <strong>${escapeHtml(step.action)}</strong>
      → ${escapeHtml(step.state)}
    </p>
    ${facts ? `<dl class="fact-list">${facts}</dl>` : ""}
  `;
}

function renderFinding() {
  const finding = data.findings.find((item) => item.slug === requestedSlug);
  if (!finding) {
    fail(`Finding slug ${requestedSlug || "(empty)"} is not in this dataset.`);
  }
  const property = propertyFor(finding);
  const candidateNotice = finding.findingKind === "candidate"
    ? `
      Candidate signal only. Screenshots provide context, not a violation
      witness. This item is excluded from all result claims.
    `
    : `
      Formal means the checker reported VIOLATION_OBSERVED and the evidence
      package passed structural validation. Human review still decides whether
      the interpretation is meaningful.
    `;
  const tabs = finding.steps.map((step, index) => `
    <button
      class="step-tab"
      type="button"
      role="tab"
      id="step-tab-${index}"
      aria-controls="step-panel"
      aria-selected="${index === 0 ? "true" : "false"}"
      tabindex="${index === 0 ? "0" : "-1"}"
      data-step="${index}"
    >
      ${escapeHtml(step.label)}
      <small>${escapeHtml(step.action)}</small>
    </button>
  `).join("");

  app.innerHTML = `
    <a class="back-link" href="${root}">← All findings</a>
    <header class="finding-heading">
      <div>
        <div class="badge-row">
          ${kindBadge(finding)}
          <span class="badge ap">${escapeHtml(finding.atomicId)}</span>
          ${reviewBadge(finding.id)}
        </div>
        <h1>${escapeHtml(finding.title)}</h1>
        <p class="lede">
          Site ${escapeHtml(finding.siteId)} · Attempt ${escapeHtml(finding.attemptId)}
        </p>
      </div>
      ${toolbarHtml()}
    </header>
    <p class="claim-boundary ${finding.findingKind}">
      ${escapeHtml(candidateNotice.trim())}
    </p>
    <p id="status" class="status${notice?.isError ? " error" : ""}" role="status">
      ${notice ? escapeHtml(notice.message) : ""}
    </p>
    <main class="finding-layout">
      <div class="stack">
        <section class="panel" aria-labelledby="trace-title">
          <p class="panel-label">State transition</p>
          <h2 id="trace-title">${escapeHtml(finding.summary)}</h2>
          <div class="step-tabs" role="tablist" aria-label="Trace states">${tabs}</div>
          <div
            id="step-panel"
            role="tabpanel"
            aria-labelledby="step-tab-0"
          >
            ${stepHtml(finding, finding.steps[0], 0)}
          </div>
        </section>
        <section class="panel" aria-labelledby="spec-title">
          <p class="panel-label">Temporal contract</p>
          <h2 id="spec-title">${escapeHtml(property.title)}</h2>
          <code class="formula">${escapeHtml(property.ltlFormula)}</code>
          <p class="panel-label" style="margin-top:1rem">Bombadil · 2–3 lines</p>
          <pre class="bombadil"><code>${escapeHtml(property.bombadilAssertion)}</code></pre>
          <p style="margin:0.8rem 0 0">
            <a class="source-link" href="${escapeAttribute(property.sourceUrl)}">
              Open checker source ↗
            </a>
          </p>
        </section>
      </div>
      <aside class="stack">
        <section class="panel">
          <p class="panel-label">Why it was surfaced</p>
          <p>${escapeHtml(finding.reason)}</p>
          <p class="panel-label">Evidence identity</p>
          <code>${escapeHtml(
            finding.findingKind === "formal"
              ? finding.evidence.occurrenceId
              : finding.evidence.signalId,
          )}</code>
        </section>
        ${annotationHtml(finding)}
      </aside>
    </main>
    ${findingNavigation(finding)}
  `;

  wireStepTabs(finding);
  wireAnnotation(finding);
}

function wireStepTabs(finding) {
  const tabs = [...document.querySelectorAll(".step-tab")];
  const panel = document.querySelector("#step-panel");
  const selectStep = (index, moveFocus = false) => {
    tabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", `step-tab-${index}`);
    panel.innerHTML = stepHtml(finding, finding.steps[index], index);
    wireImageFailure(finding);
    if (moveFocus) {
      tabs[index].focus();
    }
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectStep(index));
    tab.addEventListener("keydown", (event) => {
      let target = null;
      if (event.key === "ArrowRight") {
        target = (index + 1) % tabs.length;
      } else if (event.key === "ArrowLeft") {
        target = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        target = 0;
      } else if (event.key === "End") {
        target = tabs.length - 1;
      }
      if (target !== null) {
        event.preventDefault();
        selectStep(target, true);
      }
    });
  });
  wireImageFailure(finding);
}

function wireImageFailure(finding) {
  const image = document.querySelector("#finding-image");
  image?.addEventListener("error", () => {
    const frame = document.querySelector("#screenshot-frame");
    if (frame) {
      frame.innerHTML = `
        <p class="fatal">
          Evidence image failed to load. Annotation is disabled because this
          finding cannot be reviewed fail-closed.
        </p>
      `;
    }
    document.querySelectorAll(".decision-button, #review-note").forEach((control) => {
      control.disabled = true;
    });
    setNotice(`Finding ${finding.id} has a missing deployed image.`, true);
  }, { once: true });
}

function wireAnnotation(finding) {
  const buttons = [...document.querySelectorAll(".decision-button")];
  const note = document.querySelector("#review-note");
  const update = (nextDecision) => {
    const current = reviews.get(finding.id) ?? { decision: null, note: "" };
    reviews.set(finding.id, {
      decision: nextDecision,
      note: note.value,
    });
    buttons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.decision === nextDecision),
      );
    });
    saveReviews();
  };
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const current = reviews.get(finding.id)?.decision ?? null;
      const selected = button.dataset.decision;
      update(current === selected ? null : selected);
    });
  });
  note.addEventListener("input", () => {
    const current = reviews.get(finding.id) ?? { decision: null, note: "" };
    reviews.set(finding.id, {
      decision: current.decision,
      note: note.value,
    });
    saveReviews();
  });
}

function wireToolbar() {
  document.querySelector("#export-reviews")?.addEventListener(
    "click",
    downloadReviews,
  );
  const input = document.querySelector("#import-file");
  document.querySelector("#import-reviews")?.addEventListener(
    "click",
    () => input?.click(),
  );
  input?.addEventListener("change", async () => {
    const [file] = input.files;
    if (file) {
      await importReviews(file);
    }
    input.value = "";
  });
}

function render() {
  if (view === "finding") {
    renderFinding();
  } else if (view === "hub") {
    renderHub();
  } else {
    fail(`Unknown page view: ${view}`);
  }
  wireToolbar();
}

try {
  data = assertRuntimeData(window.LTL_G2_PRECISION_REVIEW);
  loadReviews();
  render();
} catch (error) {
  app.innerHTML = `
    <main class="fatal" role="alert">
      <h1>Review packet rejected</h1>
      <p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
      <p>No finding is shown and no annotation is accepted.</p>
    </main>
  `;
}
