(() => {
  'use strict';
  const data = window.STATIC_A11Y_REVIEW;
  const labels = {correct:'TP', 'false-positive':'FP', duplicate:'Duplicate', excluded:'Excluded', unsure:'Unsure'};
  const key = 'static-a11y-selected31-v3-human-reviews';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pretty = value => esc(JSON.stringify(value, null, 2));
  const rows = data.cases;
  const byId = new Map(rows.map(row => [row.errorId, row]));
  let overrides = {}, selected = location.hash.slice(1), filtered = [], renderToken = 0;
  function notify(message) { $('status').textContent = message; }
  function effective(row, edits = overrides) { return {...row.review, ...edits[row.errorId]}; }
  function validate(edits) {
    for (const [id, value] of Object.entries(edits)) {
      if (!byId.has(id) || !value || !Object.hasOwn(labels, value.decision) || !['in-scope','outside-target'].includes(value.scope) || typeof value.note !== 'string' || typeof value.updatedAt !== 'string' || value.humanConfirmed !== true || value.annotationOrigin !== 'human-browser-review') throw Error(`Invalid annotation: ${id}`);
    }
    for (const row of rows) {
      const review = effective(row, edits);
      if (review.decision === 'excluded' && review.scope !== 'outside-target') throw Error(`${row.errorId}: Excluded must be outside target scope.`);
      if (review.decision === 'duplicate') {
        const target = byId.get(review.canonicalId);
        if (!target || target.errorId === row.errorId || target.engine !== row.engine || target.site !== row.site || effective(target, edits).scope !== review.scope || effective(target, edits).decision === 'duplicate') throw Error(`${row.errorId}: choose a non-Duplicate representative from the same tool, website and scope.`);
      } else if (review.canonicalId) throw Error(`${row.errorId}: only Duplicate may have a canonical ID.`);
    }
  }
  try { overrides = JSON.parse(localStorage.getItem(key) || '{}'); validate(overrides); }
  catch (error) { overrides = {}; notify(`Saved annotations could not be loaded: ${error.message}. Existing storage has not been overwritten.`); }
  function persist(next) { validate(next); localStorage.setItem(key, JSON.stringify(next)); overrides = next; }
  function options(values) { return [...new Set(values)].sort().map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(''); }
  function toolOptions() {
    const subset = rows.filter(row => row.engine === $('tool').value);
    for (const field of ['site','rule','category']) {
      const before = $(field).value;
      $(field).innerHTML = `<option value="">All ${field === 'site' ? 'websites' : field === 'rule' ? 'rules' : 'categories'}</option>` + options(subset.map(row => row[field === 'rule' ? 'ruleId' : field]));
      if ([...$(field).options].some(option => option.value === before)) $(field).value = before;
    }
  }
  function stats() {
    $('stats').innerHTML = `<table><caption>Current labels · tools counted separately · baseline + local human overrides</caption><thead><tr><th>Tool</th><th>Candidates</th><th>TP</th><th>FP</th><th>Duplicate</th><th>Unsure</th><th>Excluded</th><th>Outside target (incl. dup.)</th><th>Outside duplicates</th><th>Locally reviewed</th></tr></thead><tbody>${['axe','wave'].map(tool => {
      const subset = rows.filter(row => row.engine === tool), count = Object.fromEntries(Object.keys(labels).map(value => [value,0]));
      let outside = 0, outsideDup = 0;
      subset.forEach(row => { const r = effective(row); count[r.decision]++; if (r.scope === 'outside-target') { outside++; if (r.decision === 'duplicate') outsideDup++; } });
      return `<tr data-stat="${tool}"><th>${tool === 'axe' ? 'axe-core' : 'WAVE'}</th><td>${subset.length}</td><td>${count.correct}</td><td>${count['false-positive']}</td><td>${count.duplicate}</td><td>${count.unsure}</td><td>${count.excluded}</td><td>${outside}</td><td>${outsideDup}</td><td>${subset.filter(row => overrides[row.errorId]).length}</td></tr>`;
    }).join('')}</tbody></table><p class="meta">Counts are not precision/recall. TP here preserves the existing agent-review decision; dynamic/temporal qualification remains unverified. Excluded representatives plus outside-target duplicates preserve the full outside-scope population.</p>`;
  }
  function applyFilters() {
    const query = $('search').value.trim().toLowerCase();
    filtered = rows.filter(row => {
      const r = effective(row);
      return row.engine === $('tool').value && (!$('site').value || row.site === $('site').value)
        && (!$('rule').value || row.ruleId === $('rule').value) && (!$('category').value || row.category === $('category').value)
        && (!$('scope').value || r.scope === $('scope').value) && (!$('decision').value || r.decision === $('decision').value)
        && (!$('origin').value || ($('origin').value === 'human' ? !!overrides[row.errorId] : !overrides[row.errorId]))
        && (!query || (/^st\d{4}$/i.test(query) ? row.errorId.toLowerCase() === query : [row.errorId,row.site,row.ruleId,row.text,row.help,r.note].join(' ').toLowerCase().includes(query)));
    });
    if (!filtered.some(row => row.errorId === selected)) selected = filtered[0]?.errorId;
    stats(); renderList(); renderDetail();
  }
  function renderList() {
    $('list-count').textContent = `${filtered.length} findings shown`;
    $('case-list').innerHTML = filtered.map(row => `<li><button data-id="${row.errorId}" aria-current="${row.errorId === selected}"><strong>${row.errorId}</strong> <span class="badge ${effective(row).decision}">${labels[effective(row).decision]}</span><small>${esc(row.site)} · ${esc(row.ruleId)}</small></button></li>`).join('');
  }
  function openCase(id, clearFilters = false) {
    selected = id;
    if (clearFilters) {
      for (const field of ['site','rule','category','scope','decision','origin','search']) $(field).value = '';
      $('tool').value = byId.get(id).engine; toolOptions();
    }
    applyFilters(); $('detail').focus({preventScroll:true});
  }
  async function renderDetail() {
    const token = ++renderToken, row = byId.get(selected);
    if (!row) { $('detail').innerHTML = '<div class="card"><h2>No matching findings</h2><p>Change or reset the filters.</p></div>'; return; }
    history.replaceState(null, '', `#${row.errorId}`);
    const r = effective(row), position = filtered.indexOf(row);
    $('detail').innerHTML = `<div class="card"><h2>${row.errorId} · ${esc(row.site)}</h2><span class="badge">${row.engine}</span><span class="badge">${esc(row.category)}</span><span class="badge">${esc(row.ruleId)}</span><span class="badge ${r.decision}">${labels[r.decision]}</span><span class="badge">${esc(r.scope)}</span><p>${esc(row.help)}</p><p class="meta">Route / · ${esc(row.title)} · ${overrides[row.errorId] ? 'Local human review' : 'Three-agent baseline; not human confirmed'}</p><div class="actions"><button id="previous" ${position === 0 ? 'disabled' : ''}>← Previous</button><span>${position+1} / ${filtered.length}</span><button id="next" ${position === filtered.length-1 ? 'disabled' : ''}>Next →</button>${r.canonicalId ? `<button data-canonical="${esc(r.canonicalId)}">Representative: ${esc(r.canonicalId)}</button>` : ''}</div></div>
      <form id="review-form" class="card"><h3>Your review</h3><p class="meta">Save explicitly to record a human review. Explain the specific consequence; for Duplicate, explain the shared cause/fix. Scope and decision are separate.</p><div class="review-fields"><label>Decision<select id="edit-decision">${Object.entries(labels).map(([value,label]) => `<option value="${value}" ${r.decision === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Scope<select id="edit-scope"><option value="in-scope" ${r.scope === 'in-scope' ? 'selected' : ''}>In scope</option><option value="outside-target" ${r.scope === 'outside-target' ? 'selected' : ''}>Outside target</option></select></label><label>Canonical ST ID (Duplicate only)<input id="edit-canonical" value="${esc(r.canonicalId || '')}" placeholder="ST0002"></label><label class="wide">Review note<textarea id="edit-note" required>${esc(r.note)}</textarea></label></div><div class="actions"><button type="submit">Save review</button><button type="button" id="restore">Restore agent baseline</button><span id="save-status" role="status"></span></div></form>
      <div class="card"><h3>Recorded screenshot and target</h3><div class="evidence-grid"><div><a href="${row.screenshot}" target="_blank" rel="noopener"><img class="shot" src="${row.screenshot}" alt="${esc(row.site)} initial homepage screenshot recorded during the ${row.engine} scan"></a><p class="meta">Original 1440 × 900 scan viewport; not a before/after action replay. Later DOM evidence may differ. No target overlay is asserted; offscreen or hidden targets may not appear.</p></div><div><h3>Reported target</h3><pre>${esc(row.html || row.text || '(page-level finding)')}</pre><p class="meta">${esc(row.selector)}</p><p class="warning">${esc(row.temporalEvidence)}</p><p class="meta">${row.blockedNetworkRequests} external requests blocked in this scan; missing resources may affect appearance.</p><a href="${row.evidence}">Download this finding’s full evidence JSON</a>${row.ax ? ` · <a href="${row.ax}">Supplemental AX tree</a>` : ''}<div id="target-detail">Loading DOM evidence…</div></div></div></div>
      <div class="card"><h3>Original agent adjudication (immutable)</h3><p><span class="badge ${row.review.decision}">${labels[row.review.decision]}</span> ${esc(row.review.scope)}</p><p>${esc(row.review.note)}</p><details><summary>Three-agent votes, duplicate metadata and provenance</summary><pre>${pretty(row.review)}</pre></details></div><div class="card" id="full-evidence"><h3>Scanner / DOM evidence</h3><p>Loading…</p></div>`;
    $('previous').onclick = () => openCase(filtered[position-1].errorId);
    $('next').onclick = () => openCase(filtered[position+1].errorId);
    document.querySelector('[data-canonical]')?.addEventListener('click', event => openCase(event.currentTarget.dataset.canonical, true));
    $('review-form').onsubmit = event => {
      event.preventDefault();
      const decision = $('edit-decision').value;
      const patch = {decision, scope:$('edit-scope').value, canonicalId:decision === 'duplicate' ? $('edit-canonical').value.trim().toUpperCase() : null, note:$('edit-note').value.trim(), annotationOrigin:'human-browser-review', humanConfirmed:true, reviewer:'local-human-reviewer', updatedAt:new Date().toISOString()};
      if (!patch.note) { $('save-status').textContent = 'Please explain your review.'; return; }
      try { persist({...overrides, [row.errorId]:patch}); applyFilters(); notify(`${row.errorId} saved locally. Export to keep a portable copy.`); }
      catch (error) { $('save-status').textContent = error.message; }
    };
    $('restore').onclick = () => {
      const next = {...overrides}; delete next[row.errorId];
      try { persist(next); applyFilters(); notify(`${row.errorId}: agent baseline restored locally.`); }
      catch (error) { $('save-status').textContent = error.message; }
    };
    $('detail').querySelectorAll('pre').forEach(pre => { pre.tabIndex = 0; });
    try {
      const response = await fetch(row.evidence);
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const evidence = await response.json();
      if (token !== renderToken) return;
      $('target-detail').innerHTML = `<details><summary>Target DOM / computed style / bounds</summary><pre>${pretty(evidence.dom)}</pre></details>`;
      $('full-evidence').innerHTML = `<h3>Scanner / DOM evidence</h3><p class="meta">Static evidence captured for adjudication, not a new interaction trace. CSS matched rules can include inactive media rules; computed style is authoritative.</p><details><summary>Full recorded candidate and page structure</summary><pre>${pretty(evidence)}</pre></details>`;
      $('detail').querySelectorAll('pre').forEach(pre => { pre.tabIndex = 0; });
    } catch (error) { if (token === renderToken) { $('target-detail').textContent = 'Evidence unavailable.'; $('full-evidence').textContent = `Could not load evidence: ${error.message}`; } }
  }
  $('case-list').onclick = event => { const button = event.target.closest('[data-id]'); if (button) openCase(button.dataset.id); };
  for (const field of ['tool','site','rule','category','scope','decision','origin']) $(field).onchange = () => { if (field === 'tool') toolOptions(); applyFilters(); };
  $('search').oninput = applyFilters;
  $('reset').onclick = () => { for (const field of ['site','rule','category','scope','decision','origin','search']) $(field).value = ''; applyFilters(); };
  $('export').onclick = () => {
    const payload = {schemaVersion:'static-a11y-human-overrides/1', datasetId:data.datasetId, exportedAt:new Date().toISOString(), overrides};
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'axe-wave-selected31-human-review.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    notify(`Exported ${Object.keys(overrides).length} local human annotations; baseline downloads remain separate.`);
  };
  $('import').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.schemaVersion !== 'static-a11y-human-overrides/1' || payload.datasetId !== data.datasetId || !payload.overrides || typeof payload.overrides !== 'object' || Array.isArray(payload.overrides)) throw Error('Wrong dataset or annotation format.');
      const next = {...overrides, ...payload.overrides}; validate(next);
      if (Object.keys(payload.overrides).some(id => overrides[id]) && !confirm('Imported annotations will replace matching local edits. Continue?')) return;
      persist(next); applyFilters(); notify(`Imported ${Object.keys(payload.overrides).length} annotations.`);
    } catch (error) { notify(`Import failed: ${error.message}`); }
    finally { event.target.value = ''; }
  };
  if (byId.has(selected)) $('tool').value = byId.get(selected).engine;
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (byId.has(id)) openCase(id, true);
  });
  toolOptions(); applyFilters();
})();
