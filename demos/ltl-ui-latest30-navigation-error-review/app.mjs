import {
  buildExportDocument,
  DECISIONS,
  importReviewDocument,
  normalizeReview,
  REVIEW_SCHEMA,
  scopeAnalysis,
} from "./model.mjs";

const DATA = window.LTL_LATEST30_NAVIGATION_ERROR_REVIEW;
const APP = document.querySelector("#review");
const STORAGE_KEY = "ltl-ui-latest30-navigation-error-review-20260904-r3";
const PROPERTY_DEFINITIONS = Object.freeze({
  "AP-FD1-03": "After an exposed enabled button is activated, the user must receive a screen-reader-notifiable response through focus, state, live notification, or committed navigation.",
  "AP-S2-05": "When button activation reveals disclosure content, the button must expose its matching expanded state to assistive technology.",
  "AP-FM1-02": "After a major same-document view transition, focus or current-location state must preserve orientation to the new view.",
  "AP-CAC1-01": "Every programmatically exposed meaningful or actionable element that requires identification must have an accessible name or text alternative.",
  "AP-N1-02": "Exposed headings must preserve an understandable hierarchy without unsupported level discontinuities.",
  "AP-N2-04": "Adjacent image and text links to the same destination must not create a redundant sequential-navigation burden.",
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);
const percent = (value) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;

if (!APP || !validDataset(DATA)) {
  if (APP) APP.innerHTML = '<div class="empty"><h2>Review data failed validation</h2><p>The generated 2,358-case dataset is missing or incomplete.</p></div>';
} else {
  start();
}

function validDataset(data) {
  return data?.schemaVersion === "ltl-ui-latest30-navigation-error-review-cases/1"
    && data.actionPolicyVersion === "tier1-wait-tab4-shift1/1"
    && data.expectedCaseCount === 2358
    && Array.isArray(data.cases)
    && data.cases.length === data.expectedCaseCount
    && data.cases.every((item) => item.errorId && item.website && item.property
      && Array.isArray(item.replays) && Array.isArray(item.evidence));
}

function start() {
  const cases = [...DATA.cases];
  let store = readStore();
  let filtered = cases;
  let currentId = cases[0].errorId;
  const selectedReplay = {};
  const filters = { search: "", website: "", property: "", status: "", suggestion: "" };

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed?.schemaVersion !== REVIEW_SCHEMA || !parsed.reviews) throw new Error("new store");
      return { schemaVersion: REVIEW_SCHEMA, reviews: Object.fromEntries(Object.entries(parsed.reviews)
        .map(([id, value]) => [id, normalizeReview(value)]).filter(([, value]) => value)) };
    } catch {
      return { schemaVersion: REVIEW_SCHEMA, reviews: {} };
    }
  }

  function saveStore() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch { toast("Review could not be saved in this browser.", true); }
  }

  function reviewFor(id) {
    return normalizeReview(store.reviews[id]) ?? { decision: null, note: "", updatedAt: null };
  }

  function saveReview(id, patch) {
    const review = normalizeReview({ ...reviewFor(id), ...patch, updatedAt: new Date().toISOString() });
    if (review) store.reviews[id] = review;
    else delete store.reviews[id];
    saveStore();
  }

  function optionList(values, selected) {
    return [...new Set(values)].sort().map((value) =>
      `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
  }

  function analysisTable(analysis) {
    return `<div class="analysis-wrap"><table><caption>Manual review progress</caption><thead><tr><th>Total</th><th>Correct</th><th>False positive</th><th>Duplicate</th><th>Unsure</th><th>Unreviewed</th><th>Correctness*</th><th>Coverage</th></tr></thead><tbody><tr><td>${analysis.total}</td><td>${analysis.correct}</td><td>${analysis["false-positive"]}</td><td>${analysis.duplicate}</td><td>${analysis.unsure}</td><td>${analysis.unreviewed}</td><td>${percent(analysis.correctness)}</td><td>${percent(analysis.coverage)}</td></tr></tbody></table><small>* correct / (correct + false positive); duplicate and unsure excluded.</small></div>`;
  }

  function filterControls() {
    return `<div class="filters"><label class="wide">Search<input data-filter="search" value="${escapeHtml(filters.search)}" placeholder="X-ID, route, identity"></label><label>Website<select data-filter="website"><option value="">All</option>${optionList(cases.map((item) => item.website), filters.website)}</select></label><label>Property<select data-filter="property"><option value="">All</option>${optionList(cases.map((item) => item.property), filters.property)}</select></label><label>Manual status<select data-filter="status"><option value="">All</option><option value="unreviewed"${filters.status === "unreviewed" ? " selected" : ""}>Unreviewed</option>${optionList(Object.keys(DECISIONS), filters.status)}</select></label><label>Agent suggestion<select data-filter="suggestion"><option value="">All</option>${optionList(Object.keys(DECISIONS), filters.suggestion)}</select></label></div>`;
  }

  function caseList(item) {
    return `<ul class="case-list">${filtered.map((row) => {
      const decision = reviewFor(row.errorId).decision;
      return `<li><button type="button" data-case="${row.errorId}" aria-current="${row.errorId === item.errorId}"><span class="case-id">${row.errorId}<span class="status-dot ${decision || ""}">●</span></span><span class="case-sub">${escapeHtml(row.website)} · ${escapeHtml(row.property)} · ${escapeHtml(row.route)}</span></button></li>`;
    }).join("")}</ul>`;
  }

  function focusLabel(focus) {
    const element = focus?.element;
    if (!focus) return ["Focus unavailable", "No focus snapshot"];
    if (focus.kind === "document") return ["Document focus", "No concrete focused element"];
    return [[element?.tag, element?.role].filter(Boolean).join(" · ") || focus.kind || "Element", element?.name || element?.id || "Unnamed"];
  }

  function screenshotCard(title, shot) {
    const [focusTitle, focusDetail] = focusLabel(shot?.focus);
    const box = shot?.focus?.focusBox;
    const overlay = box ? `<span class="focus-box" style="left:${Number(box.x)}%;top:${Number(box.y)}%;width:${Number(box.width)}%;height:${Number(box.height)}%"></span>` : "";
    return `<section class="evidence-card"><h3>${title}</h3>${shot?.image ? `<div class="shot"><img src="${escapeHtml(shot.image)}" alt="${escapeHtml(`${title} screenshot`)}" loading="lazy">${overlay}</div>` : '<div class="shot"><p>Screenshot unavailable</p></div>'}<p class="focus-label"><strong>${escapeHtml(focusTitle)}</strong><span>${escapeHtml(focusDetail)}</span></p></section>`;
  }

  function render() {
    const item = filtered.find((candidate) => candidate.errorId === currentId) ?? filtered[0];
    if (!item) {
      APP.innerHTML = `<div class="empty"><h2>No matching errors</h2><p>Change the filters to continue.</p>${filterControls()}</div>`;
      bindFilters();
      return;
    }
    currentId = item.errorId;
    const saved = reviewFor(item.errorId);
    const position = filtered.findIndex((candidate) => candidate.errorId === item.errorId);
    const replay = item.replays.includes(selectedReplay[item.errorId]) ? selectedReplay[item.errorId] : item.replays[0];
    selectedReplay[item.errorId] = replay;
    const evidence = item.evidence.find((entry) => entry.replay === replay) ?? item.evidence[0];
    const analysis = scopeAnalysis(cases, store.reviews);
    const suggestion = item.suggestion;
    APP.innerHTML = `<div class="review-shell"><aside class="sidebar"><div class="progress-track"><div class="progress-fill" style="width:${100 * analysis.coverage}%"></div></div><div class="summary"><strong>${analysis.annotated}/${analysis.total} annotated</strong><span>${filtered.length} shown</span></div>${filterControls()}${caseList(item)}</aside><section class="content"><div class="facts"><span>${DATA.expectedCaseCount.toLocaleString()} candidates</span><span>${DATA.websiteCount} websites</span>${Object.entries(DATA.propertyCounts).filter(([, count]) => count).map(([property, count]) => `<span>${property}: ${count}</span>`).join("")}</div>${analysisTable(analysis)}<header class="case-header"><h2>${item.errorId} · ${escapeHtml(item.website)}</h2><div class="chips"><span class="chip">${escapeHtml(item.property)}</span><span class="chip">${escapeHtml(item.identityQuality)}</span><span class="chip">${item.replays.length} replay${item.replays.length === 1 ? "" : "s"}</span></div><div class="definition"><strong>Property definition</strong><p>${escapeHtml(PROPERTY_DEFINITIONS[item.property])}</p></div><p class="route"><strong>Route:</strong> ${escapeHtml(item.route)}</p><p class="identity"><strong>Identity:</strong> ${escapeHtml(item.identity)}</p></header><section class="suggestion"><h3>Agent first-pass suggestion: ${escapeHtml(DECISIONS[suggestion.decision])}</h3><div class="suggestion-grid"><strong>Basis</strong><span>${escapeHtml(suggestion.basis)}</span>${suggestion.duplicateOf ? `<strong>Duplicate of</strong><span>${escapeHtml(suggestion.duplicateOf)}</span>` : ""}<strong>Rationale</strong><span>${escapeHtml(suggestion.note)}</span></div><p><button type="button" data-use-suggestion>Use this suggestion as my manual decision</button></p></section><div class="replay-tabs" role="tablist" aria-label="Evidence replay">${item.replays.map((value) => `<button type="button" role="tab" data-replay="${value}" aria-selected="${value === replay}">${escapeHtml(value.replace("replay-", "Replay "))}</button>`).join("")}</div><div class="evidence-meta"><strong>${escapeHtml(evidence.actionLabel)}</strong><span>${escapeHtml(evidence.triggerId)} · trace entry ${evidence.traceEntryIndex}</span></div><div class="evidence-grid">${screenshotCard("Before", evidence.before)}${screenshotCard("After / trigger", evidence.after)}</div><div class="evidence-details"><details open><summary>Checker snapshot</summary><pre>${escapeHtml(JSON.stringify(evidence.propertySnapshot, null, 2))}</pre></details><details><summary>Historical evidence</summary><pre>${escapeHtml(JSON.stringify(item.historical, null, 2))}</pre></details><details><summary>Fresh DOM and source evidence</summary><pre>${escapeHtml(JSON.stringify({ freshDOM: item.freshDOM, sourceMatches: item.sourceMatches }, null, 2))}</pre></details><details><summary>Evidence gaps</summary><pre>${escapeHtml(JSON.stringify(item.evidenceGaps, null, 2))}</pre></details></div><section class="review-card"><h3>Your manual review</h3><div class="decision-row">${Object.entries(DECISIONS).map(([value, label], index) => `<button type="button" data-decision="${value}" aria-pressed="${saved.decision === value}">${index + 1}. ${label}</button>`).join("")}</div><label class="note-label">Reviewer note<textarea data-note placeholder="Describe the observed BLV consequence and evidence.">${escapeHtml(saved.note)}</textarea></label><div class="navigation"><button type="button" data-nav="previous">← Previous</button><span>${position + 1} / ${filtered.length}</span><button type="button" data-nav="next">Next →</button></div></section></section></div>`;
    bind(item, position);
  }

  function applyFilters() {
    const query = filters.search.trim().toLowerCase();
    filtered = cases.filter((item) => {
      const decision = reviewFor(item.errorId).decision;
      const text = `${item.errorId} ${item.website} ${item.property} ${item.route} ${item.identity}`.toLowerCase();
      return (!query || text.includes(query))
        && (!filters.website || item.website === filters.website)
        && (!filters.property || item.property === filters.property)
        && (!filters.status || (filters.status === "unreviewed" ? !decision : decision === filters.status))
        && (!filters.suggestion || item.suggestion.decision === filters.suggestion);
    });
    if (!filtered.some((item) => item.errorId === currentId)) currentId = filtered[0]?.errorId;
    render();
  }

  function bindFilters() {
    document.querySelectorAll("[data-filter]").forEach((control) => control.addEventListener("change", () => {
      filters[control.dataset.filter] = control.value;
      applyFilters();
    }));
  }

  function move(position, delta) {
    if (!filtered.length) return;
    currentId = filtered[(position + delta + filtered.length) % filtered.length].errorId;
    render();
  }

  function bind(item, position) {
    bindFilters();
    document.querySelectorAll("[data-case]").forEach((button) => button.addEventListener("click", () => { currentId = button.dataset.case; render(); }));
    document.querySelectorAll("[data-replay]").forEach((button) => button.addEventListener("click", () => { selectedReplay[item.errorId] = button.dataset.replay; render(); }));
    document.querySelectorAll("[data-decision]").forEach((button) => button.addEventListener("click", () => {
      saveReview(item.errorId, { decision: reviewFor(item.errorId).decision === button.dataset.decision ? null : button.dataset.decision });
      render();
    }));
    document.querySelector("[data-use-suggestion]").addEventListener("click", () => {
      saveReview(item.errorId, { decision: item.suggestion.decision, note: item.suggestion.note });
      render();
    });
    document.querySelector("[data-note]").addEventListener("input", (event) => saveReview(item.errorId, { note: event.target.value }));
    document.querySelector('[data-nav="previous"]').addEventListener("click", () => move(position, -1));
    document.querySelector('[data-nav="next"]').addEventListener("click", () => move(position, 1));
  }

  function exportReviews() {
    const documentValue = buildExportDocument(DATA, store.reviews);
    const blob = new Blob([`${JSON.stringify(documentValue, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ltl-ui-latest30-navigation-review-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast(`Exported ${documentValue.analysis.annotated}/${cases.length} annotations.`);
  }

  async function importReviews(file) {
    try {
      store.reviews = { ...store.reviews, ...importReviewDocument(JSON.parse(await file.text()), cases) };
      saveStore(); render(); toast("Review imported.");
    } catch (error) { toast(`Import failed: ${error.message}`, true); }
  }

  document.querySelector('[data-action="export"]').addEventListener("click", exportReviews);
  document.querySelector('[data-action="import"]').addEventListener("click", () => document.querySelector("[data-review-file]").click());
  document.querySelector("[data-review-file]").addEventListener("change", (event) => { if (event.target.files[0]) importReviews(event.target.files[0]); });
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("textarea,input,select")) return;
    const position = filtered.findIndex((item) => item.errorId === currentId);
    if (["1", "2", "3", "4"].includes(event.key)) {
      const decision = Object.keys(DECISIONS)[Number(event.key) - 1];
      saveReview(currentId, { decision: reviewFor(currentId).decision === decision ? null : decision }); render();
    } else if (event.key === "ArrowLeft") move(position, -1);
    else if (event.key === "ArrowRight") move(position, 1);
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
