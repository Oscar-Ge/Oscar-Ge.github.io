(() => {
  "use strict";

  const DATA = window.TASKAUDIT_NAV_ERROR_REVIEW;
  const APP = document.querySelector("#review");
  const STORAGE_KEY = "taskaudit-five-site-luna-xhigh-error-reviews-v1";
  const REVIEW_SCHEMA = "taskaudit-five-site-luna-xhigh-error-review/1";
  const DECISIONS = {
    valid: "Valid error",
    "false-positive": "False positive",
    duplicate: "Duplicate",
    unsure: "Unsure",
  };
  const NAVIGATION_CATEGORIES = new Set([
    "Navigation & Orientation",
    "Focus Management",
    "Page Structure",
    "Widget Interaction",
  ]);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);

  if (!APP || !DATA || DATA.schemaVersion !== "taskaudit-recorded-navigation-error-review-cases/1"
      || !Array.isArray(DATA.cases) || DATA.cases.length !== DATA.caseCount) {
    if (APP) APP.innerHTML = '<div class="empty"><h2>Review data failed validation</h2><p>The recorded TaskAudit evidence payload is incomplete.</p></div>';
    return;
  }

  const cases = DATA.cases;
  const filters = { website: "", family: "", taxonomy: "", evidence: "", status: "" };
  let reviews = readReviews();
  let filtered = [...cases];
  let currentId = cases[0]?.errorId;

  const datasetSummary = document.querySelector("#dataset-summary");
  const baselineComparison = document.querySelector("#baseline-comparison");
  const reviewSummary = document.querySelector("#review-summary");
  if (datasetSummary) {
    const sites = Object.entries(DATA.bySite || {}).map(([site, count]) => `${site} ${count}`).join(" · ");
    datasetSummary.textContent = `${DATA.caseCount} Analyzer-positive events across ${DATA.runCount} tasks · ${DATA.reviewGroupCount} task-taxonomy review groups · ${DATA.unmappedAccessibilityErrorCount} unmapped · ${sites}`;
  }
	if (baselineComparison) {
		const overlappingEvents = Object.entries(DATA.bySite || {})
			.filter(([site]) => site !== "cargurus")
			.reduce((total, [, count]) => total + Number(count), 0);
		const currentRate = overlappingEvents / 73;
		const baselineRate = 105 / 73;
		baselineComparison.textContent = `Reference only: the first four-site pilot reported 105 raw events across 73 tasks (${baselineRate.toFixed(2)} per task). The same four sites in this batch report ${overlappingEvents} across 73 tasks (${currentRate.toFixed(2)} per task, ${(100 * currentRate / baselineRate).toFixed(0)}% of that rate); Cargurus adds ${DATA.bySite?.cargurus || 0} events. Runs, prompts, models, and trajectories are not a paired comparison.`;
	}

  function readReviews() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveReviews() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews)); }
    catch { toast("Review could not be saved in this browser.", true); }
  }
  function normalizeReview(value) {
    if (!value || typeof value !== "object") return null;
    const decision = Object.hasOwn(DECISIONS, value.decision) ? value.decision : null;
    const note = typeof value.note === "string" ? value.note.slice(0, 20_000) : "";
    return decision || note ? { decision, note, updatedAt: value.updatedAt || new Date().toISOString() } : null;
  }
  function updateReview(id, patch) {
    const value = normalizeReview({ ...(reviews[id] || {}), ...patch, updatedAt: new Date().toISOString() });
    if (value) reviews[id] = value; else delete reviews[id];
    saveReviews();
  }
  function decisionCounts() {
    const counts = { reviewed: 0, valid: 0, "false-positive": 0, duplicate: 0, unsure: 0 };
    cases.forEach((item) => {
      const decision = reviews[item.errorId]?.decision;
      if (decision && Object.hasOwn(DECISIONS, decision)) {
        counts.reviewed += 1;
        counts[decision] += 1;
      }
    });
    return counts;
  }
  function updateReviewSummary() {
    if (!reviewSummary) return;
    const counts = decisionCounts();
    const judged = counts.valid + counts.duplicate + counts["false-positive"];
    const precision = judged ? `${(100 * (counts.valid + counts.duplicate) / judged).toFixed(1)}%` : "pending";
    reviewSummary.textContent = `Reviewer decisions: ${counts.reviewed}/${cases.length} · valid ${counts.valid} · false positive ${counts["false-positive"]} · duplicate ${counts.duplicate} · unsure ${counts.unsure} · event-label precision ${precision}`;
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
    const element = focus?.focusedElement || {};
    if (focus?.focusDomain === "BROWSER_CHROME") return ["Browser chrome focus", "Focus is outside the webpage"];
    return [
      [element.tag, element.role].filter(Boolean).join(" · ") || focus?.focusDomain || "Unavailable",
      element.name || element.value || element.id || element.path || "No concrete focused element",
    ];
  }
  function evidencePanel(title, image, focus, status) {
    const [label, detail] = focusLabel(focus);
    const box = focus?.focusBox;
    const overlay = box ? `<span class="focus-box" style="left:${Number(box.x)}%;top:${Number(box.y)}%;width:${Number(box.width)}%;height:${Number(box.height)}%"></span>` : "";
    const chrome = focus?.focusDomain === "BROWSER_CHROME" ? '<span class="domain-banner">Focus escaped to browser chrome</span>' : "";
    const offscreen = focus?.focusOffscreen ? `<span class="domain-banner">Focused element is ${escapeHtml(focus.focusOffscreen)} the recorded viewport</span>` : "";
    return `<section class="evidence-card"><h3>${title}</h3><a href="${escapeHtml(image)}" target="_blank" rel="noopener"><div class="shot${focus?.focusDomain === "BROWSER_CHROME" ? " browser-chrome" : ""}"><img src="${escapeHtml(image)}" alt="${escapeHtml(`${title} recorded action screenshot`)}">${overlay}${chrome}${offscreen}</div></a><p class="focus-label"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span><span>Recorded URL: ${escapeHtml(focus?.url || "Unavailable")}</span><span>Capture stability: ${escapeHtml(status)}</span></p></section>`;
  }
  function choices(values, selected) {
    return [...new Set(values)].sort().map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
  }
  function render() {
    updateReviewSummary();
    const item = filtered.find((row) => row.errorId === currentId) || filtered[0];
    if (!item) {
      APP.innerHTML = '<div class="empty"><h2>No matching errors</h2><p>Change the filters to continue reviewing.</p></div>';
      return;
    }
    currentId = item.errorId;
    const saved = reviews[item.errorId] || {};
    const position = filtered.findIndex((row) => row.errorId === item.errorId);
    const counts = decisionCounts();
    const list = filtered.map((row) => `<li><button type="button" data-case="${row.errorId}" aria-current="${row.errorId === item.errorId}"><span class="case-id">${row.errorId}<span class="status-dot ${reviews[row.errorId]?.decision || ""}">●</span></span><span class="case-sub">${escapeHtml(row.website)} · ${escapeHtml(row.taxonomyId)} · step ${row.step}</span></button></li>`).join("");
    const warning = item.visualReady ? "" : `<div class="mismatch"><strong>Recorded stability not confirmed</strong><p>At least one runtime screenshot lacks a positive visual-stability signal (${escapeHtml(item.beforeVisualStatus)} before, ${escapeHtml(item.afterVisualStatus)} after). Inspect modal and layout timing carefully.</p></div>`;
    APP.innerHTML = `<div class="review-shell"><aside class="sidebar"><div class="progress-track" aria-label="${counts.reviewed} of ${cases.length} reviewed"><div class="progress-fill" style="width:${cases.length ? 100 * counts.reviewed / cases.length : 0}%"></div></div><div class="summary"><strong>${counts.reviewed}/${cases.length} reviewed</strong><span>${filtered.length} shown</span></div><div class="filters"><label>Website<select data-filter="website"><option value="">All websites</option>${choices(cases.map((row) => row.website), filters.website)}</select></label><label>Error family<select data-filter="family"><option value="">All error families</option><option value="navigation">Navigation / interaction-related</option><option value="other">Feedback / content-related</option><option value="unmapped">Unmapped</option></select></label><label>Taxonomy<select data-filter="taxonomy"><option value="">All categories</option>${choices(cases.map((row) => `${row.taxonomyId} · ${row.taxonomyName}`), filters.taxonomy)}</select></label><label>Recorded evidence<select data-filter="evidence"><option value="">All evidence states</option><option value="stable">Stability confirmed</option><option value="review">Needs timing review</option></select></label><label>Review status<select data-filter="status"><option value="">All statuses</option><option value="unreviewed">Unreviewed</option>${Object.entries(DECISIONS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label></div><ul class="case-list">${list}</ul></aside><section class="content"><header class="case-header"><h2>${item.errorId} · ${escapeHtml(item.website)} · step ${item.step}</h2><div class="chips"><span class="chip">${escapeHtml(item.taxonomyId)}</span><span class="chip">${escapeHtml(item.taxonomyName)}</span><span class="chip">${escapeHtml(item.taxonomyCategory)}</span><span class="chip">${escapeHtml(item.actionLabel)}</span><span class="chip">${escapeHtml(item.agentStatus)}</span><span class="chip ${item.beforeVisualStatus === "stable" ? "good" : "warn"}">Before ${escapeHtml(item.beforeVisualStatus)}</span><span class="chip ${item.afterVisualStatus === "stable" ? "good" : "warn"}">After ${escapeHtml(item.afterVisualStatus)}</span></div><p class="task">${escapeHtml(item.task)}</p><p class="identity">task index ${item.index} · ${escapeHtml(item.runId)} · ${escapeHtml(item.executorModel)} → ${escapeHtml(item.analyzerModel)} · taxonomy ${escapeHtml(item.taxonomyStatus || "unknown")}</p></header><div class="evidence-grid">${evidencePanel("Before action", item.beforeImage, item.before, item.beforeVisualStatus)}${evidencePanel("After action", item.afterImage, item.after, item.afterVisualStatus)}</div><div class="action-arrow">Before → ${escapeHtml(item.actionLabel)} → After</div><section class="analysis-card"><h3>Agent decision</h3><h4>Reasoning before action</h4><p>${escapeHtml(item.agentThought || "Not recorded")}</p><h4>Action intent</h4><p>${escapeHtml(item.actionDescription || "Not recorded")}</p><h4>Reflection after action</h4><p>${escapeHtml(item.agentReflection || "Not recorded")}</p><div class="transcript-grid"><div><h4>Screen reader before</h4><pre class="transcript">${escapeHtml((item.screenReaderBefore || []).join("\n") || "No speech captured")}</pre></div><div><h4>Screen reader after</h4><pre class="transcript">${escapeHtml((item.screenReaderAfter || []).join("\n") || "No speech captured")}</pre></div></div></section><section class="analysis-card"><h3>Analyzer finding</h3><p><strong>${escapeHtml(item.taxonomyId)} · ${escapeHtml(item.taxonomyName)}</strong> · ${escapeHtml(item.taxonomyCategory)}</p><h4>Classification explanation</h4><p>${escapeHtml(item.analyzerExplanation)}</p><h4>Local analysis trace</h4><p>${escapeHtml(item.analyzerThought)}</p><h4>Problematic element</h4><p>${escapeHtml(item.problematicElement || "Not identified")}</p>${warning}</section><section class="review-card"><div class="decision-row">${Object.entries(DECISIONS).map(([value, label], index) => `<button type="button" data-decision="${value}" aria-pressed="${saved.decision === value}">${index + 1}. ${label}</button>`).join("")}</div><label class="note-label">Reviewer note<textarea data-note placeholder="Why is this valid, a false positive, a duplicate, or unclear?">${escapeHtml(saved.note)}</textarea></label><div class="navigation"><button type="button" data-nav="previous">← Previous</button><span>${position + 1} / ${filtered.length}</span><button type="button" data-nav="next">Next →</button></div></section></section></div>`;
    document.querySelector('[data-filter="family"]').value = filters.family;
    document.querySelector('[data-filter="evidence"]').value = filters.evidence;
    document.querySelector('[data-filter="status"]').value = filters.status;
    bind(item, position);
  }
  function family(item) {
    if (item.taxonomyCategory === "Unmapped") return "unmapped";
    return NAVIGATION_CATEGORIES.has(item.taxonomyCategory) ? "navigation" : "other";
  }
  function applyFilters() {
    filtered = cases.filter((item) => {
      const taxonomy = `${item.taxonomyId} · ${item.taxonomyName}`;
      const decision = reviews[item.errorId]?.decision;
      return (!filters.website || item.website === filters.website)
        && (!filters.family || family(item) === filters.family)
        && (!filters.taxonomy || taxonomy === filters.taxonomy)
        && (!filters.evidence || (filters.evidence === "stable" ? item.visualReady : !item.visualReady))
        && (!filters.status || (filters.status === "unreviewed" ? !decision : decision === filters.status));
    });
    if (!filtered.some((row) => row.errorId === currentId)) currentId = filtered[0]?.errorId;
    render();
  }
  function move(position, delta) {
    if (!filtered.length) return;
    currentId = filtered[(position + delta + filtered.length) % filtered.length].errorId;
    render();
  }
  function bind(item, position) {
    document.querySelectorAll("[data-filter]").forEach((select) => select.addEventListener("change", () => {
      filters[select.dataset.filter] = select.value;
      applyFilters();
    }));
    document.querySelectorAll("[data-case]").forEach((button) => button.addEventListener("click", () => {
      currentId = button.dataset.case;
      render();
    }));
    document.querySelectorAll("[data-decision]").forEach((button) => button.addEventListener("click", () => {
      updateReview(item.errorId, { decision: button.dataset.decision });
      render();
    }));
    document.querySelector("[data-note]").addEventListener("change", (event) => updateReview(item.errorId, { note: event.target.value }));
    document.querySelector('[data-nav="previous"]').addEventListener("click", () => move(position, -1));
    document.querySelector('[data-nav="next"]').addEventListener("click", () => move(position, 1));
  }
  function exportReviews() {
    const lines = cases.map((item) => JSON.stringify({
      schemaVersion: REVIEW_SCHEMA,
      errorId: item.errorId,
      website: item.website,
      taskIndex: item.index,
      step: item.step,
      taxonomyId: item.taxonomyId,
      ...(reviews[item.errorId] || {}),
    }));
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "application/x-ndjson" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `taskaudit-five-site-luna-xhigh-review-${new Date().toISOString().slice(0, 10)}.jsonl`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast(`Exported ${decisionCounts().reviewed}/${cases.length} reviewed cases.`);
  }
  async function importReviews(file) {
    try {
      const text = await file.text();
      let rows;
      try {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : parsed.reviews || [parsed];
      } catch {
        rows = text.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
      }
      const known = new Set(cases.map((item) => item.errorId));
      let imported = 0;
      rows.forEach((row) => {
        const value = known.has(row.errorId) && normalizeReview(row);
        if (value) {
          reviews[row.errorId] = value;
          imported += 1;
        }
      });
      saveReviews();
      render();
      toast(`Imported ${imported} reviews.`);
    } catch (error) {
      toast(`Import failed: ${error.message}`, true);
    }
  }

  document.querySelector('[data-action="export"]').addEventListener("click", exportReviews);
  document.querySelector('[data-action="import"]').addEventListener("click", () => document.querySelector("[data-review-file]").click());
  document.querySelector("[data-review-file]").addEventListener("change", (event) => {
    if (event.target.files[0]) importReviews(event.target.files[0]);
  });
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("textarea,input,select")) return;
    const position = filtered.findIndex((row) => row.errorId === currentId);
    if (position < 0) return;
    if (["1", "2", "3", "4"].includes(event.key)) {
      updateReview(currentId, { decision: Object.keys(DECISIONS)[Number(event.key) - 1] });
      render();
    }
    if (event.key === "ArrowLeft") move(position, -1);
    if (event.key === "ArrowRight") move(position, 1);
  });
  render();
})();
