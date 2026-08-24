(() => {
  "use strict";

  const POLICY = "tier1-wait-tab4-shift1/1";
  const STORAGE_KEY = "ltl-ui-tab4-error-reviews-v1";
  const REVIEW_SCHEMA = "ltl-ui-tab4-error-review/1";
  const DATA = window.LTL_TAB4_ERROR_REVIEW;
  const APP = document.querySelector("#review");
  const DECISIONS = Object.freeze({
    valid: "Valid error",
    "false-positive": "False positive",
    duplicate: "Duplicate",
    unsure: "Unsure",
  });
  const PROPERTY_DEFINITIONS = Object.freeze({
    "AP-FM1-01": "When a trusted keyboard activation removes, hides, makes inert, or disables the focused control without changing the view, focus must settle on a concrete, connected, rendered, accessibility-exposed element. Focus falling to the document/body or another unavailable element is a violation.",
    "AP-M1-01": "Every visible dialog or alert dialog must expose a non-empty accessible name through aria-label, resolvable aria-labelledby text, or a title. A visible unnamed dialog is a violation.",
    "AP-M1-03": "When trusted Escape is pressed while focus is inside a visible dialog, that exact dialog must no longer be exposed at the first post-action checkpoint. The same dialog remaining connected and visible is a violation.",
    "AP-M1-04": "When trusted keyboard activation opens one exact modal and trusted Escape closes it, focus must return to the exact original invoker if that invoker remains connected, visible, and enabled.",
    "AP-M1-05": "When trusted Enter or Space opens exactly one new modal, settled focus must be on that modal or one of its descendants. Focus remaining in the obscured page behind it is a violation.",
    "AP-N1-01": "A completed document must expose at least one visible orientation anchor: a heading or a main, navigation, banner, contentinfo, complementary, form, or search landmark.",
    "AP-N2-01": "If at least 20 visible enabled keyboard stops precede the main region, that prefix must contain a visible, named, same-document link whose fragment resolves to exactly one target.",
    "AP-PS1-01": "After an actual trusted Tab action, settled focus must not be inside a hidden, inert, or aria-hidden subtree. This property concerns the settled target, not a transient focus visit.",
    "AP-W3-01": "A trusted role-supported activation must produce the exact effect required for that control, such as changing checked state, selecting a tab, toggling a disclosure, or reaching the declared link target. Unrelated page changes do not count as success.",
  });

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);

  if (!APP || !DATA || !Array.isArray(DATA.cases)
      || DATA.cases.length !== 531
      || DATA.cases.some((item) =>
        item.actionPolicyVersion !== POLICY
        || !Object.hasOwn(PROPERTY_DEFINITIONS, item.property))) {
    if (APP) APP.innerHTML = '<div class="empty"><h2>Review data failed validation</h2><p>This page requires exactly 531 cases from <code>tier1-wait-tab4-shift1/1</code>.</p></div>';
    return;
  }

  const cases = DATA.cases;
  let store = readStore();
  let filtered = [...cases];
  let currentId = filtered[0].errorId;

  function blankStore() { return { schemaVersion: REVIEW_SCHEMA, reviews: {} }; }
  function normalizeReview(value) {
    if (!value || typeof value !== "object") return null;
    const decision = Object.hasOwn(DECISIONS, value.decision) ? value.decision : null;
    const note = typeof value.note === "string" ? value.note.slice(0, 20_000) : "";
    if (!decision && !note) return null;
    return { decision, note, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString() };
  }
  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed?.reviews) return blankStore();
      const reviews = {};
      Object.entries(parsed.reviews).forEach(([id, value]) => {
        const normalized = normalizeReview(value);
        if (normalized) reviews[id] = normalized;
      });
      return { schemaVersion: REVIEW_SCHEMA, reviews };
    } catch { return blankStore(); }
  }
  function writeStore() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch { toast("Review could not be saved in this browser.", true); }
  }
  function reviewFor(id) { return store.reviews[id] || { decision: null, note: "", updatedAt: null }; }
  function saveReview(id, patch) {
    const normalized = normalizeReview({ ...reviewFor(id), ...patch, updatedAt: new Date().toISOString() });
    if (normalized) store.reviews[id] = normalized; else delete store.reviews[id];
    writeStore();
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
  function focusLabel(focus) {
    if (!focus) return { title: "Unavailable", detail: "No focus evidence" };
    if (focus.kind === "document") return { title: "Document focus", detail: "No concrete focused element" };
    const element = focus.element || {};
    return {
      title: [element.tag, element.role].filter(Boolean).join(" · ") || focus.kind,
      detail: element.name || element.id || "Unnamed focused element",
    };
  }
  function evidencePanel(title, image, focus) {
    const label = focusLabel(focus);
    const box = focus?.focusBox;
    const overlay = box ? `<span class="focus-box" style="left:${Number(box.x)}%;top:${Number(box.y)}%;width:${Number(box.width)}%;height:${Number(box.height)}%"></span>` : "";
    return `<section class="evidence-card"><h3>${title}</h3><div class="shot${focus?.kind === "document" ? " document-focus" : ""}"><img src="${escapeHtml(image)}" alt="${escapeHtml(`${title} screenshot`)}">${overlay}</div><p class="focus-label"><strong>${escapeHtml(label.title)}</strong><span>${escapeHtml(label.detail)}</span></p></section>`;
  }
  function summary() {
    const counts = { reviewed: 0, valid: 0, "false-positive": 0, duplicate: 0, unsure: 0 };
    cases.forEach((item) => {
      const decision = reviewFor(item.errorId).decision;
      if (decision) { counts.reviewed += 1; counts[decision] += 1; }
    });
    return counts;
  }
  function render() {
    const item = filtered.find((candidate) => candidate.errorId === currentId) || filtered[0];
    if (!item) {
      APP.innerHTML = '<div class="empty"><h2>No matching errors</h2><p>Change the filters to continue reviewing.</p></div>';
      return;
    }
    currentId = item.errorId;
    const saved = reviewFor(item.errorId);
    const counts = summary();
    const position = filtered.findIndex((candidate) => candidate.errorId === item.errorId);
    APP.innerHTML = `<div class="review-shell"><aside class="sidebar"><div class="progress-track" aria-label="${counts.reviewed} of 531 reviewed"><div class="progress-fill" style="width:${100 * counts.reviewed / cases.length}%"></div></div><div class="summary"><strong>${counts.reviewed}/531 reviewed</strong><span>${filtered.length} shown</span></div><div class="filters"><label>Website<select data-filter="website"><option value="">All websites</option>${options(cases.map((row) => row.website), state("website"))}</select></label><label>Property<select data-filter="property"><option value="">All properties</option>${options(cases.map((row) => row.property), state("property"))}</select></label><label>Status<select data-filter="status"><option value="">All statuses</option><option value="unreviewed">Unreviewed</option>${Object.entries(DECISIONS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label></div><ul class="case-list">${filtered.map((row) => { const decision = reviewFor(row.errorId).decision; return `<li><button type="button" data-case="${row.errorId}" aria-current="${row.errorId === item.errorId}"><span class="case-id">${row.errorId}<span class="status-dot ${decision || ""}">●</span></span><span class="case-sub">${escapeHtml(row.website)} · ${escapeHtml(row.property)}</span></button></li>`; }).join("")}</ul></aside><section class="content"><header class="case-header"><h2>${item.errorId} · ${escapeHtml(item.website)}</h2><div class="chips"><span class="chip">${escapeHtml(item.property)}</span><span class="chip">${escapeHtml(item.actionLabel)}</span><span class="chip">${escapeHtml(item.representativeReplay)}</span><span class="chip">${escapeHtml(item.identityQuality)}</span></div><div class="property-definition"><strong>Property definition</strong><p>${escapeHtml(PROPERTY_DEFINITIONS[item.property])}</p></div><p class="identity">${escapeHtml(item.identity)}</p></header><div class="evidence-grid">${evidencePanel("Before", item.beforeImage, item.beforeFocus)}${evidencePanel("After", item.afterImage, item.afterFocus)}</div><div class="action-arrow">Before → ${escapeHtml(item.actionLabel)} → After</div><section class="review-card"><div class="decision-row">${Object.entries(DECISIONS).map(([value, label], index) => `<button type="button" data-decision="${value}" aria-pressed="${saved.decision === value}">${index + 1}. ${label}</button>`).join("")}</div><label class="note-label">Reviewer note<textarea data-note placeholder="Why is this valid, false positive, duplicate, or unclear?">${escapeHtml(saved.note)}</textarea></label><div class="navigation"><button type="button" data-nav="previous">← Previous</button><span>${position + 1} / ${filtered.length}</span><button type="button" data-nav="next">Next →</button></div></section></section></div>`;
    document.querySelector('[data-filter="status"]').value = state("status");
    bind(item, position);
  }
  const filterState = { website: "", property: "", status: "" };
  function state(key) { return filterState[key]; }
  function options(values, selected) {
    return [...new Set(values)].sort().map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
  }
  function applyFilters() {
    filtered = cases.filter((item) => {
      const decision = reviewFor(item.errorId).decision;
      return (!filterState.website || item.website === filterState.website)
        && (!filterState.property || item.property === filterState.property)
        && (!filterState.status || (filterState.status === "unreviewed" ? !decision : decision === filterState.status));
    });
    if (!filtered.some((item) => item.errorId === currentId)) currentId = filtered[0]?.errorId;
    render();
  }
  function move(position, delta) {
    if (!filtered.length) return;
    currentId = filtered[(position + delta + filtered.length) % filtered.length].errorId;
    render();
  }
  function bind(item, position) {
    document.querySelectorAll("[data-filter]").forEach((select) => {
      select.addEventListener("change", () => { filterState[select.dataset.filter] = select.value; applyFilters(); });
    });
    document.querySelectorAll("[data-case]").forEach((button) => button.addEventListener("click", () => { currentId = button.dataset.case; render(); }));
    document.querySelectorAll("[data-decision]").forEach((button) => button.addEventListener("click", () => { saveReview(item.errorId, { decision: button.dataset.decision }); render(); }));
    document.querySelector("[data-note]").addEventListener("change", (event) => saveReview(item.errorId, { note: event.target.value }));
    document.querySelector('[data-nav="previous"]').addEventListener("click", () => move(position, -1));
    document.querySelector('[data-nav="next"]').addEventListener("click", () => move(position, 1));
  }
  function exportReviews() {
    const lines = cases.map((item) => JSON.stringify({
      schemaVersion: REVIEW_SCHEMA,
      errorId: item.errorId,
      website: item.website,
      property: item.property,
      actionPolicyVersion: item.actionPolicyVersion,
      ...reviewFor(item.errorId),
    }));
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "application/x-ndjson" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ltl-ui-tab4-review-${new Date().toISOString().slice(0, 10)}.jsonl`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast(`Exported ${summary().reviewed}/531 reviewed cases.`);
  }
  async function importReviews(file) {
    try {
      const text = await file.text();
      let rows;
      try { const parsed = JSON.parse(text); rows = Array.isArray(parsed) ? parsed : parsed.reviews || [parsed]; }
      catch { rows = text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line)); }
      const known = new Set(cases.map((item) => item.errorId));
      let imported = 0;
      rows.forEach((row) => {
        if (!known.has(row.errorId)) return;
        const normalized = normalizeReview(row);
        if (normalized) { store.reviews[row.errorId] = normalized; imported += 1; }
      });
      writeStore(); render(); toast(`Imported ${imported} reviews.`);
    } catch (error) { toast(`Import failed: ${error.message}`, true); }
  }
  document.querySelector('[data-action="export"]').addEventListener("click", exportReviews);
  document.querySelector('[data-action="import"]').addEventListener("click", () => document.querySelector("[data-review-file]").click());
  document.querySelector("[data-review-file]").addEventListener("change", (event) => { if (event.target.files[0]) importReviews(event.target.files[0]); });
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("textarea,input,select")) return;
    const item = filtered.find((candidate) => candidate.errorId === currentId);
    const position = filtered.findIndex((candidate) => candidate.errorId === currentId);
    if (!item) return;
    if (["1", "2", "3", "4"].includes(event.key)) { saveReview(item.errorId, { decision: Object.keys(DECISIONS)[Number(event.key) - 1] }); render(); }
    if (event.key === "ArrowLeft") move(position, -1);
    if (event.key === "ArrowRight") move(position, 1);
  });
  render();
})();
