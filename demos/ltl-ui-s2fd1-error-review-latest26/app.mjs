import {
  buildExportDocument,
  computeAnalysis,
  DECISIONS,
  importReviewDocument,
  normalizeReview,
  REVIEW_SCHEMA,
} from "./model.mjs";

const POLICY = "tier1-wait-tab4-shift1/1";
const STORAGE_KEY = "ltl-ui-s2fd1-error-reviews-latest26-website-order-v2";
const DATA = window.LTL_S2FD1_ERROR_REVIEW;
const APP = document.querySelector("#review");
const PROPERTY_DEFINITIONS = Object.freeze({
  "AP-S2-05": "When button activation exposes previously hidden disclosure content, the button must expose the matching expanded state to assistive technology.",
  "AP-FD1-03": "After an exposed enabled button is activated, at least one screen-reader-notifiable response must occur: exposed focus changes, the focused button's relevant AT state changes, or a live/status/alert notification changes.",
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[character]);
const percent = (value) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;

if (!APP || !validDataset(DATA)) {
  if (APP) APP.innerHTML = '<div class="empty"><h2>Review data failed validation</h2><p>This page requires a complete latest26 S2-05/FD1-03 export.</p></div>';
} else {
  start();
}

function validDataset(data) {
  return data?.actionPolicyVersion === POLICY
    && data.schemaVersion === "ltl-ui-s2fd1-error-review-cases/1"
    && Number.isInteger(data.expectedCaseCount)
    && data.expectedCaseCount > 0
    && Number.isInteger(data.uniqueInteractionOccurrences)
    && data.uniqueInteractionOccurrences >= data.expectedCaseCount
    && Number.isInteger(data.propertyCounts?.["AP-S2-05"])
    && Number.isInteger(data.propertyCounts?.["AP-FD1-03"])
    && data.propertyCounts["AP-S2-05"] + data.propertyCounts["AP-FD1-03"] === data.expectedCaseCount
    && Array.isArray(data.cases)
    && data.cases.length === data.expectedCaseCount
    && data.cases.every((item) => item.actionPolicyVersion === POLICY
      && ["AP-S2-05", "AP-FD1-03"].includes(item.property)
      && item.replays.length === item.evidence.length
      && item.replays.every((replay) => item.evidence.some((entry) => entry.replay === replay)));
}

function start() {
  const propertyPriority = { "AP-S2-05": 0, "AP-FD1-03": 1 };
  const cases = [...DATA.cases].sort((left, right) =>
    left.website.localeCompare(right.website)
    || propertyPriority[left.property] - propertyPriority[right.property]
    || right.replays.length - left.replays.length
    || left.identityQuality.localeCompare(right.identityQuality)
    || left.errorId.localeCompare(right.errorId));
  let store = readStore();
  let filtered = [...cases];
  let currentId = filtered[0].errorId;
  const filterState = { website: "", property: "", status: "", replay: "", repeatability: "" };
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
    return `<div class="filters"><label>Website<select data-filter="website"><option value="">All websites</option>${options(cases.map((row) => row.website), filterState.website)}</select></label><label>Property<select data-filter="property"><option value="">All properties</option>${options(cases.map((row) => row.property), filterState.property)}</select></label><label>Status<select data-filter="status"><option value="">All statuses</option><option value="unreviewed"${filterState.status === "unreviewed" ? " selected" : ""}>Unreviewed</option>${Object.entries(DECISIONS).map(([value, label]) => `<option value="${value}"${filterState.status === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><label>Replay<select data-filter="replay"><option value="">Any replay</option>${[1, 2, 3].map((number) => `<option value="replay-${number}"${filterState.replay === `replay-${number}` ? " selected" : ""}>Replay ${number}</option>`).join("")}</select></label><label>Repeatability<select data-filter="repeatability"><option value="">Any repeatability</option>${[1, 2, 3].map((number) => `<option value="${number}"${filterState.repeatability === String(number) ? " selected" : ""}>${number} replay${number === 1 ? "" : "s"}</option>`).join("")}</select></label></div>`;
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

    APP.innerHTML = `<div class="review-shell"><aside class="sidebar"><div class="progress-track" aria-label="${annotated} of ${cases.length} annotated"><div class="progress-fill" style="width:${100 * analysis.overall.annotationCoverageRate}%"></div></div><div class="summary"><strong>${annotated}/${cases.length} annotated</strong><span>${filtered.length} shown</span></div>${filterControls()}${caseList(item)}</aside><section class="content"><section class="dataset-facts" aria-label="Dataset summary"><strong>${DATA.expectedCaseCount.toLocaleString()} unique interactions</strong><span>${DATA.uniqueInteractionOccurrences.toLocaleString()} replay/epoch occurrences</span><span>AP-FD1-03: ${DATA.propertyCounts["AP-FD1-03"].toLocaleString()}</span><span>AP-S2-05: ${DATA.propertyCounts["AP-S2-05"].toLocaleString()}</span><span>Seen in all 3 replays: ${DATA.repeatabilityCounts?.["3"] ?? 0}</span></section>${analysisTable(analysis)}<header class="case-header"><h2>${item.errorId} · ${escapeHtml(item.website)}</h2><div class="chips"><span class="chip">${escapeHtml(item.property)}</span><span class="chip">${escapeHtml(item.identityQuality)}</span><span class="chip">${item.replays.length} replay${item.replays.length === 1 ? "" : "s"}</span><span class="chip">${item.observationCount} occurrence${item.observationCount === 1 ? "" : "s"}</span></div><div class="property-definition"><strong>Property definition</strong><p>${escapeHtml(PROPERTY_DEFINITIONS[item.property] || "No definition available.")}</p></div><p class="route">${escapeHtml(item.route)}</p><p class="identity">${escapeHtml(item.identity)}</p></header><div class="replay-tabs" role="tablist" aria-label="Evidence replay">${item.replays.map((replay) => `<button type="button" role="tab" data-replay="${replay}" aria-selected="${replay === selectedReplay}">${escapeHtml(replay.replace("replay-", "Replay "))}</button>`).join("")}</div><div class="evidence-meta"><strong>${escapeHtml(evidence.actionLabel)}</strong><span>${escapeHtml(evidence.attempt)} · epoch ${escapeHtml(evidence.actionEpoch)} · ${escapeHtml(evidence.timestamp)}</span></div><div class="evidence-grid">${evidencePanel("Before", evidence.beforeImage, evidence.beforeFocus)}${evidencePanel("After", evidence.afterImage, evidence.afterFocus)}</div><div class="action-arrow">Before → ${escapeHtml(evidence.actionLabel)} → After</div><details class="checker-evidence"><summary>Checker evidence</summary><pre>${escapeHtml(JSON.stringify(evidence.propertySnapshot, null, 2))}</pre></details><section class="review-card"><div class="decision-row">${Object.entries(DECISIONS).map(([value, label], index) => `<button type="button" data-decision="${value}" aria-pressed="${saved.decision === value}">${index + 1}. ${label}</button>`).join("")}</div><label class="note-label">Reviewer note<textarea data-note placeholder="Why is this correct, a false positive, or unclear?">${escapeHtml(saved.note)}</textarea></label><div class="navigation"><button type="button" data-nav="previous">← Previous</button><span>${position + 1} / ${filtered.length}</span><button type="button" data-nav="next">Next →</button></div></section></section></div>`;
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
        && (!filterState.replay || item.replays.includes(filterState.replay))
        && (!filterState.repeatability || item.replays.length === Number(filterState.repeatability));
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
    link.download = `ltl-ui-s2fd1-review-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    const annotated = documentValue.analysis.overall.totalErrorCount
      - documentValue.analysis.overall.unreviewedCount;
    toast(`Exported ${annotated}/${cases.length} annotated cases.`);
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
