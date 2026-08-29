import {
  buildExportDocument,
  computeAnalysis,
  DECISIONS,
  importReviewDocument,
  normalizeReview,
  REVIEW_SCHEMA,
} from "./model.mjs";

const POLICY = "tier1-wait-tab4-shift1/1";
const STORAGE_KEY = "ltl-ui-cross-replay-error-reviews-v1";
const DATA = window.LTL_CROSS_REPLAY_ERROR_REVIEW;
const APP = document.querySelector("#review");
const PROPERTY_DEFINITIONS = Object.freeze({
  "AP-FD2-01": "After invalid form submission, every invalid field must expose usable validation guidance.",
  "AP-FD2-02": "When an invalid field transition is observed, the affected field must expose usable validation guidance.",
  "AP-FM1-01": "When keyboard activation invalidates the focused control without changing the view, focus must settle on a concrete, connected, rendered, accessibility-exposed element.",
  "AP-M1-01": "Every visible dialog or alert dialog must expose a non-empty accessible name.",
  "AP-M1-03": "After Escape is pressed inside a visible dialog, that exact dialog must no longer be exposed at the first post-action checkpoint.",
  "AP-M1-04": "When Escape closes a keyboard-opened modal, focus must return to the exact original invoker when it remains available.",
  "AP-M1-05": "When Enter or Space opens exactly one modal, settled focus must be on that modal or one of its descendants.",
  "AP-N1-01": "A completed document must expose at least one visible heading or orientation landmark.",
  "AP-N2-01": "A long keyboard-stop prefix before main content must contain a visible, named, same-document bypass link.",
  "AP-PS1-01": "After an actual Tab action, settled focus must not be inside a hidden, inert, or aria-hidden subtree.",
  "AP-W3-01": "A role-supported keyboard activation must produce the exact effect required for that control.",
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);
const percent = (value) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;

if (!APP || !validDataset(DATA)) {
  if (APP) APP.innerHTML = '<div class="empty"><h2>Review data failed validation</h2><p>This page requires 484 cross-replay cases with replay totals 235, 249, and 217.</p></div>';
} else {
  start();
}

function validDataset(data) {
  return data?.actionPolicyVersion === POLICY
    && data.expectedCaseCount === 484
    && data.replayErrorCounts?.["replay-1"] === 235
    && data.replayErrorCounts?.["replay-2"] === 249
    && data.replayErrorCounts?.["replay-3"] === 217
    && Array.isArray(data.cases)
    && data.cases.length === 484
    && data.cases.every((item) => item.actionPolicyVersion === POLICY
      && item.replays.length === item.evidence.length
      && item.replays.every((replay) => item.evidence.some((entry) => entry.replay === replay)));
}

function start() {
  const cases = DATA.cases;
  let store = readStore();
  let filtered = [...cases];
  let currentId = filtered[0].errorId;
  const filterState = { website: "", property: "", status: "", replay: "" };
  const evidenceReplay = {};

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed?.schemaVersion !== REVIEW_SCHEMA || !parsed.reviews) {
        return { schemaVersion: REVIEW_SCHEMA, reviews: {} };
      }
      const reviews = Object.fromEntries(Object.entries(parsed.reviews)
        .map(([id, value]) => [id, normalizeReview(value)])
        .filter(([, value]) => value));
      return { schemaVersion: REVIEW_SCHEMA, reviews };
    } catch {
      return { schemaVersion: REVIEW_SCHEMA, reviews: {} };
    }
  }

  function writeStore() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch { toast("Review could not be saved in this browser.", true); }
  }

  function reviewFor(id) {
    return normalizeReview(store.reviews[id])
      ?? { decision: null, note: "", updatedAt: null };
  }

  function saveReview(id, patch) {
    const value = normalizeReview({
      ...reviewFor(id),
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    if (value) store.reviews[id] = value;
    else delete store.reviews[id];
    writeStore();
  }

  function options(values, selected) {
    return [...new Set(values)].sort().map((value) =>
      `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`
    ).join("");
  }

  function analysisTable(analysis) {
    const rows = [["Overall", analysis.overall], ...Object.entries(analysis.byReplay)
      .map(([replay, value]) => [replay.replace("replay-", "Replay "), value])];
    return `<div class="analysis-wrap"><table><caption>Live review analysis</caption><thead><tr><th>Scope</th><th>Total</th><th>Correct</th><th>False positive</th><th>Unsure</th><th>Duplicate</th><th>Unreviewed</th><th>Correctness</th><th>Coverage</th></tr></thead><tbody>${rows.map(([label, value]) => `<tr><th>${label}</th><td>${value.totalErrorCount}</td><td>${value.correctErrorCount}</td><td>${value.falsePositiveCount}</td><td>${value.unsureCount}</td><td>${value.duplicateCount}</td><td>${value.unreviewedCount}</td><td>${percent(value.correctnessRate)}</td><td>${percent(value.annotationCoverageRate)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function focusLabel(focus) {
    if (!focus) return { title: "Unavailable", detail: "No focus evidence" };
    if (focus.kind === "document") {
      return { title: "Document focus", detail: "No concrete focused element" };
    }
    const element = focus.element || {};
    return {
      title: [element.tag, element.role].filter(Boolean).join(" · ")
        || focus.kind || "Focused element",
      detail: element.name || element.id || "Unnamed focused element",
    };
  }

  function evidencePanel(title, image, focus) {
    const label = focusLabel(focus);
    const box = focus?.focusBox;
    const overlay = box
      ? `<span class="focus-box" style="left:${Number(box.x)}%;top:${Number(box.y)}%;width:${Number(box.width)}%;height:${Number(box.height)}%"></span>`
      : "";
    return `<section class="evidence-card"><h3>${title}</h3><div class="shot${focus?.kind === "document" ? " document-focus" : ""}"><img src="${escapeHtml(image)}" alt="${escapeHtml(`${title} screenshot`)}">${overlay}</div><p class="focus-label"><strong>${escapeHtml(label.title)}</strong><span>${escapeHtml(label.detail)}</span></p></section>`;
  }

  function filterControls() {
    return `<div class="filters"><label>Website<select data-filter="website"><option value="">All websites</option>${options(cases.map((row) => row.website), filterState.website)}</select></label><label>Property<select data-filter="property"><option value="">All properties</option>${options(cases.map((row) => row.property), filterState.property)}</select></label><label>Status<select data-filter="status"><option value="">All statuses</option><option value="unreviewed"${filterState.status === "unreviewed" ? " selected" : ""}>Unreviewed</option>${Object.entries(DECISIONS).map(([value, label]) => `<option value="${value}"${filterState.status === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><label>Replay<select data-filter="replay"><option value="">Any replay</option>${[1, 2, 3].map((number) => `<option value="replay-${number}"${filterState.replay === `replay-${number}` ? " selected" : ""}>Replay ${number}</option>`).join("")}</select></label></div>`;
  }

  function caseList(item) {
    return `<ul class="case-list">${filtered.map((row) => {
      const decision = reviewFor(row.errorId).decision;
      return `<li><button type="button" data-case="${row.errorId}" aria-current="${row.errorId === item.errorId}"><span class="case-id">${row.errorId}<span class="status-dot ${decision || ""}">●</span></span><span class="case-sub">${escapeHtml(row.website)} · ${escapeHtml(row.property)} · ${row.replays.length} replay${row.replays.length === 1 ? "" : "s"}</span></button></li>`;
    }).join("")}</ul>`;
  }

  function render() {
    const item = filtered.find((candidate) => candidate.errorId === currentId)
      || filtered[0];
    if (!item) {
      APP.innerHTML = '<div class="empty"><h2>No matching errors</h2><p>Change the filters to continue reviewing.</p></div>';
      return;
    }
    currentId = item.errorId;
    const saved = reviewFor(item.errorId);
    const position = filtered.findIndex((candidate) => candidate.errorId === item.errorId);
    const selectedReplay = item.replays.includes(evidenceReplay[item.errorId])
      ? evidenceReplay[item.errorId] : item.replays[0];
    evidenceReplay[item.errorId] = selectedReplay;
    const evidence = item.evidence.find((entry) => entry.replay === selectedReplay);
    const analysis = computeAnalysis(cases, store.reviews);
    const annotated = analysis.overall.totalErrorCount - analysis.overall.unreviewedCount;

    APP.innerHTML = `<div class="review-shell"><aside class="sidebar"><div class="progress-track" aria-label="${annotated} of 484 annotated"><div class="progress-fill" style="width:${100 * analysis.overall.annotationCoverageRate}%"></div></div><div class="summary"><strong>${annotated}/484 annotated</strong><span>${filtered.length} shown</span></div>${filterControls()}${caseList(item)}</aside><section class="content">${analysisTable(analysis)}<header class="case-header"><h2>${item.errorId} · ${escapeHtml(item.website)}</h2><div class="chips"><span class="chip">${escapeHtml(item.property)}</span><span class="chip">${escapeHtml(item.identityQuality)}</span><span class="chip">${item.replays.length} replay${item.replays.length === 1 ? "" : "s"}</span><span class="chip">${item.observationCount} observation${item.observationCount === 1 ? "" : "s"}</span></div><div class="property-definition"><strong>Property definition</strong><p>${escapeHtml(PROPERTY_DEFINITIONS[item.property] || "No definition available.")}</p></div><p class="route">${escapeHtml(item.route)}</p><p class="identity">${escapeHtml(item.identity)}</p></header><div class="replay-tabs" role="tablist" aria-label="Evidence replay">${item.replays.map((replay) => `<button type="button" role="tab" data-replay="${replay}" aria-selected="${replay === selectedReplay}">${escapeHtml(replay.replace("replay-", "Replay "))}</button>`).join("")}</div><div class="evidence-meta"><strong>${escapeHtml(evidence.actionLabel)}</strong><span>${escapeHtml(evidence.attempt)} · ${escapeHtml(evidence.timestamp)}</span></div><div class="evidence-grid">${evidencePanel("Before", evidence.beforeImage, evidence.beforeFocus)}${evidencePanel("After", evidence.afterImage, evidence.afterFocus)}</div><div class="action-arrow">Before → ${escapeHtml(evidence.actionLabel)} → After</div><section class="review-card"><div class="decision-row">${Object.entries(DECISIONS).map(([value, label], index) => `<button type="button" data-decision="${value}" aria-pressed="${saved.decision === value}">${index + 1}. ${label}</button>`).join("")}</div><label class="note-label">Reviewer note<textarea data-note placeholder="Why is this correct, a false positive, or unclear?">${escapeHtml(saved.note)}</textarea></label><div class="navigation"><button type="button" data-nav="previous">← Previous</button><span>${position + 1} / ${filtered.length}</span><button type="button" data-nav="next">Next →</button></div></section></section></div>`;
    bind(item, position);
  }

  function applyFilters() {
    filtered = cases.filter((item) => {
      const decision = reviewFor(item.errorId).decision;
      return (!filterState.website || item.website === filterState.website)
        && (!filterState.property || item.property === filterState.property)
        && (!filterState.status
          || (filterState.status === "unreviewed"
            ? !decision : decision === filterState.status))
        && (!filterState.replay || item.replays.includes(filterState.replay));
    });
    if (!filtered.some((item) => item.errorId === currentId)) {
      currentId = filtered[0]?.errorId;
    }
    render();
  }

  function move(position, delta) {
    if (!filtered.length) return;
    currentId = filtered[(position + delta + filtered.length) % filtered.length].errorId;
    render();
  }

  function bind(item, position) {
    document.querySelectorAll("[data-filter]").forEach((select) =>
      select.addEventListener("change", () => {
        filterState[select.dataset.filter] = select.value;
        applyFilters();
      }));
    document.querySelectorAll("[data-case]").forEach((button) =>
      button.addEventListener("click", () => {
        currentId = button.dataset.case;
        render();
      }));
    document.querySelectorAll("[data-replay]").forEach((button) =>
      button.addEventListener("click", () => {
        evidenceReplay[item.errorId] = button.dataset.replay;
        render();
      }));
    document.querySelectorAll("[data-decision]").forEach((button) =>
      button.addEventListener("click", () => {
        const decision = reviewFor(item.errorId).decision === button.dataset.decision
          ? null : button.dataset.decision;
        saveReview(item.errorId, { decision });
        render();
      }));
    document.querySelector("[data-note]").addEventListener("input", (event) =>
      saveReview(item.errorId, { note: event.target.value }));
    document.querySelector('[data-nav="previous"]').addEventListener("click", () =>
      move(position, -1));
    document.querySelector('[data-nav="next"]').addEventListener("click", () =>
      move(position, 1));
  }

  function exportReviews() {
    const documentValue = buildExportDocument(DATA, store.reviews);
    const blob = new Blob([`${JSON.stringify(documentValue, null, 2)}
`], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ltl-ui-cross-replay-review-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    const annotated = documentValue.analysis.overall.totalErrorCount
      - documentValue.analysis.overall.unreviewedCount;
    toast(`Exported ${annotated}/484 annotated cases.`);
  }

  async function importReviews(file) {
    try {
      const imported = importReviewDocument(JSON.parse(await file.text()), cases);
      store = {
        schemaVersion: REVIEW_SCHEMA,
        reviews: { ...store.reviews, ...imported.reviews },
      };
      writeStore();
      render();
      toast(`Imported ${imported.importedCount} reviews.`);
    } catch (error) {
      toast(`Import failed: ${error.message}`, true);
    }
  }

  document.querySelector('[data-action="export"]').addEventListener("click", exportReviews);
  document.querySelector('[data-action="import"]').addEventListener("click", () =>
    document.querySelector("[data-review-file]").click());
  document.querySelector("[data-review-file]").addEventListener("change", (event) => {
    if (event.target.files[0]) importReviews(event.target.files[0]);
  });
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("textarea,input,select")) return;
    const item = filtered.find((candidate) => candidate.errorId === currentId);
    const position = filtered.findIndex((candidate) => candidate.errorId === currentId);
    if (!item) return;
    if (["1", "2", "3", "4"].includes(event.key)) {
      const decision = Object.keys(DECISIONS)[Number(event.key) - 1];
      saveReview(item.errorId, {
        decision: reviewFor(item.errorId).decision === decision ? null : decision,
      });
      render();
    }
    if (event.key === "ArrowLeft") move(position, -1);
    if (event.key === "ArrowRight") move(position, 1);
  });
  render();
}

function toast(message, error = false) {
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div");
  node.className = `toast${error ? " error" : ""}`;
  node.setAttribute("role", "status");
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), 3200);
}
