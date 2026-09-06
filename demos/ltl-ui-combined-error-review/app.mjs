import {LABELS, PAGE_SIZE, countDecisions, filterCases, makeSearchIndex, validateDataset} from './model.mjs';

const $ = selector => document.querySelector(selector);
const number = value => value.toLocaleString('en-US');
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function badge(decision) { return element('span', LABELS[decision], `badge ${decision}`); }
function section(title) {
  const node = element('section', undefined, 'detail-section');
  node.append(element('h3', title));
  return node;
}
function pre(value) { return element('pre', typeof value === 'string' ? value : JSON.stringify(value, null, 2)); }
function disclosure(title, value) {
  const node = element('details', undefined, 'technical');
  node.append(element('summary', title), pre(value));
  return node;
}

async function start() {
  const response = await fetch('cases.json');
  if (!response.ok) throw new Error(`数据加载失败（HTTP ${response.status}）。`);
  const data = await response.json();
  const byId = validateDataset(data);
  const rows = data.cases;
  const searchIndex = makeSearchIndex(rows);
  let filtered = rows;
  let page = 0;
  let selectedId = byId.has(decodeURIComponent(location.hash.slice(1))) ? decodeURIComponent(location.hash.slice(1)) : 'R:X0001';

  for (const field of ['website', 'property']) {
    for (const value of [...new Set(rows.map(row => row[field]))].sort()) {
      const option = element('option', value); option.value = value; $(`#${field}`).append(option);
    }
  }

  function selectCase(id, moveFocus = false) {
    selectedId = id;
    history.replaceState(null, '', `#${encodeURIComponent(id)}`);
    renderList(); renderDetail();
    if (moveFocus) $('#detail').focus();
  }

  function openRepresentative(id) {
    resetFilters();
    page = Math.floor(filtered.findIndex(row => row.id === id) / PAGE_SIZE);
    selectCase(id, true);
  }

  function renderList() {
    const list = $('#case-list'); list.replaceChildren();
    for (const row of filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
      const button = element('button', undefined, `case-row${row.id === selectedId ? ' selected' : ''}`);
      button.type = 'button'; button.dataset.id = row.id;
      if (row.id === selectedId) button.setAttribute('aria-current', 'true');
      const top = element('span', undefined, 'row-top');
      top.append(element('span', row.id, 'mono'), badge(row.decision));
      const middle = element('span', undefined, 'row-middle');
      middle.append(element('strong', row.website), element('span', row.property, 'mono'));
      button.append(top, middle, element('span', row.route, 'route'), element('span', row.replays.map(value => value.replace('replay-', 'R')).join(' · '), 'replay-hint'), element('span', row.dataset === 'R' ? 'AI note' : row.supplement ? 'AI 机制复核 · 原 note 空' : '历史标签 · 未附注', 'note-hint'));
      button.addEventListener('click', () => selectCase(row.id, true)); list.append(button);
    }
    if (!filtered.length) list.append(element('p', '没有符合筛选条件的案例。', 'empty'));
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    $('#page-count').textContent = `${page + 1} / ${pages}`;
    $('#previous').disabled = page === 0;
    $('#next').disabled = page + 1 >= pages;
  }

  function renderDetail() {
    const detail = $('#detail'); detail.replaceChildren();
    const row = byId.get(selectedId);
    if (!row) { detail.append(element('p', '请选择一个案例。', 'empty')); return; }
    const top = element('div', undefined, 'detail-top');
    top.append(element('span', row.dataset === 'R' ? 'LATEST30 · FP-FIX RERUN' : 'HISTORICAL · CROSS-REPLAY', 'eyebrow'), badge(row.decision));
    const title = element('div', undefined, 'detail-title');
    title.append(element('h2', `${row.id} · ${row.website}`));
    const permalink = element('a', '案例链接 ↗'); permalink.href = `#${encodeURIComponent(row.id)}`; title.append(permalink);
    detail.append(top, title, element('p', `${row.property}   ${row.route}`, 'case-subtitle'));
    const meta = element('dl', undefined, 'metadata');
    const facts = [['原始 ID', row.errorId], ['来源', row.dataset === 'R' ? '修改后 latest30 · 2,288 条' : '历史 cross-replay · 484 条'], ['Replay', row.replays.join(', ')], ['标注来源', row.dataset === 'R' ? `${row.reviewer} · 未经人工确认` : '历史文件未编码 reviewer/origin'], ['更新时间', row.updatedAt || '未记录']];
    for (const [key, value] of facts) meta.append(element('dt', key), element('dd', value));
    detail.append(meta);

    if (row.decision === 'duplicate') {
      const duplicate = section('Duplicate 分组');
      if (row.canonicalId) {
        duplicate.append(element('p', `此行保留 Duplicate 标签；直接代表的裁决是 ${LABELS[row.baseDecision]}。`));
        const link = element('button', `查看代表 ${row.canonicalId} →`, 'representative-link'); link.type = 'button';
        link.addEventListener('click', () => openRepresentative(row.canonicalId)); duplicate.append(link);
      } else duplicate.append(element('p', '历史文件只记录 Duplicate 标签，没有 canonicalId；本站不猜测它指向哪条代表。'));
      detail.append(duplicate);
    }

    const notes = section(row.dataset === 'R' ? 'AI 标注 notes' : '历史标注 notes');
    notes.classList.add('annotation');
    notes.append(element('p', row.note || '原始 note 为空；未附 AI 标注说明。', row.note ? 'note-text' : 'muted'));
    if (row.dataset === 'R') notes.append(element('p', `来源方式：${row.annotationOrigin}。这是已发布的 agent 标注，不是新的人工作证。`, 'muted small'));
    detail.append(notes);

    if (row.supplement) {
      const extra = section('AI 补充机制复核 · 不改变原标签');
      extra.classList.add('supplement');
      extra.append(element('p', row.supplement.categoryLabel, 'category-label'), element('p', row.supplement.finding, 'note-text'), element('p', '该说明检查触发机制与证据局限，不等于最终 BLV 影响重裁决，也不构成零 TP 回归证明。', 'muted small'));
      if (row.supplement.sourceReferences?.length) extra.append(disclosure('复核源码证据', row.supplement.sourceReferences));
      detail.append(extra);
    }

    const evidenceSection = section('观察证据');
    if (row.evidence?.length) {
      for (const evidence of row.evidence) {
        const evidenceBlock = element('div', undefined, 'evidence-block');
        evidenceBlock.append(element('h4', `${evidence.replay} · ${evidence.actionLabel}${evidence.actionIndex !== undefined ? ` · action ${evidence.actionIndex}` : ''}`));
        if (row.dataset === 'R') evidenceBlock.append(element('p', '最新 rerun 的动作前后截图；视觉截图不等于读屏反馈证据。', 'muted small'));
        const images = element('div', undefined, 'evidence-images');
        for (const [key, caption] of [['beforeImage', '动作前'], ['afterImage', row.dataset === 'R' ? '触发点 · 动作后' : '动作后']]) {
          if (!evidence[key]) continue;
          const figure = element('figure'); const anchor = element('a'); anchor.href = evidence[key]; anchor.target = '_blank'; anchor.rel = 'noopener';
          const img = element('img'); img.src = evidence[key]; img.alt = `${row.id} ${evidence.replay} ${caption}`; img.loading = 'lazy';
          img.addEventListener('error', () => { img.replaceWith(element('p', '截图加载失败，可稍后打开图片链接重试。', 'muted')); });
          anchor.append(img); figure.append(anchor, element('figcaption', caption)); images.append(figure);
        }
        evidenceBlock.append(images);
        if (evidence.propertySnapshots?.length) evidenceBlock.append(disclosure('LTL property 触发快照', evidence.propertySnapshots));
        if (evidence.beforeFocus || evidence.afterFocus) evidenceBlock.append(disclosure('DOM focus 记录（不等于读屏阅读位置）', {before: evidence.beforeFocus, after: evidence.afterFocus}));
        evidenceSection.append(evidenceBlock);
      }
    } else evidenceSection.append(element('p', row.dataset === 'R' && row.canonicalId ? '为控制页面体积，Duplicate 行保留本行 notes 和触发定位，不重复打包截图。可通过上方按钮查看代表案例；代表截图不等于本行动作证据。' : '本站未打包该行截图。', 'muted'));
    detail.append(evidenceSection, disclosure('元素 identity 与触发定位', {identity: row.identity, identityQuality: row.identityQuality, triggerReferences: row.triggerReferences || [], comparisonCategory: row.comparisonCategory, priorErrorId: row.priorErrorId}));
    if (row.source) detail.append(disclosure('AI 标注的源码依据', row.source));
    detail.dataset.caseId = row.id;
  }

  function update() {
    const filters = {search: $('#search').value, dataset: $('#dataset').value, replay: $('#replay').value, decision: $('#decision').value, website: $('#website').value, property: $('#property').value, hideDuplicates: $('#hide-duplicates').checked};
    filtered = filterCases(rows, filters, searchIndex); page = 0;
    const count = countDecisions(filtered);
    $('#result-count').textContent = `显示 ${number(filtered.length)} / 2,772 条 · ${count.correct} TP · ${count['false-positive']} FP · ${count.unsure} unsure · ${number(count.duplicate)} Duplicate`;
    $('#result-count').dataset.count = String(filtered.length);
    if (!filtered.some(row => row.id === selectedId)) selectedId = filtered[0]?.id || null;
    if (selectedId) history.replaceState(null, '', `#${encodeURIComponent(selectedId)}`);
    renderList(); renderDetail();
  }

  function resetFilters() {
    for (const id of ['search', 'dataset', 'replay', 'decision', 'website', 'property']) $(`#${id}`).value = '';
    $('#hide-duplicates').checked = false; update();
  }

  let searchTimer;
  $('#search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(update, 120); });
  for (const id of ['dataset', 'replay', 'decision', 'website', 'property', 'hide-duplicates']) $(`#${id}`).addEventListener('change', update);
  $('#reset').addEventListener('click', resetFilters);
  $('#previous').addEventListener('click', () => { page--; renderList(); });
  $('#next').addEventListener('click', () => { page++; renderList(); });
  addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (byId.has(id)) openRepresentative(id);
  });
  update();
  page = Math.floor(filtered.findIndex(row => row.id === selectedId) / PAGE_SIZE); renderList();
  document.body.dataset.ready = 'true';
}

start().catch(error => {
  $('#result-count').textContent = error.message;
  $('#detail').replaceChildren(element('p', '无法读取联合标注。请刷新页面；若仍失败，请检查 cases.json 是否已经随页面部署。', 'empty'));
  document.body.dataset.error = 'true';
});
