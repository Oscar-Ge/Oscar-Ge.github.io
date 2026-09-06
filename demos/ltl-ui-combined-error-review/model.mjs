export const SCHEMA = 'ltl-ui-combined-error-review/1';
export const LABELS = {correct: 'TP', 'false-positive': 'FP', unsure: 'unsure', duplicate: 'Duplicate'};
export const PAGE_SIZE = 40;

export function countDecisions(rows) {
  const counts = {correct: 0, 'false-positive': 0, unsure: 0, duplicate: 0};
  for (const row of rows) counts[row.decision]++;
  return counts;
}

export function validateDataset(data) {
  if (data.schemaVersion !== SCHEMA || data.cases.length !== 2772) throw new Error('联合数据版本或记录数不匹配。');
  const byId = new Map(data.cases.map(row => [row.id, row]));
  if (byId.size !== data.cases.length) throw new Error('存在重复的 scoped ID。');
  for (const row of data.cases) {
    if (row.id !== `${row.dataset}:${row.errorId}` || !Object.hasOwn(LABELS, row.decision)) throw new Error(`无效案例：${row.id}`);
    if (row.dataset === 'R' && !row.note.trim()) throw new Error(`缺少 AI note：${row.id}`);
    if (row.dataset === 'R' && row.decision === 'duplicate') {
      const representative = byId.get(row.canonicalId);
      if (!representative || representative.dataset !== 'R' || representative.decision === 'duplicate' || representative.decision !== row.baseDecision) throw new Error(`Duplicate 代表不匹配：${row.id}`);
    }
  }
  return byId;
}

export function makeSearchIndex(rows) {
  return new Map(rows.map(row => [row.id, [row.id, row.website, row.property, row.route, row.identity, row.note, row.supplement?.finding, row.supplement?.categoryLabel].filter(Boolean).join(' ').toLocaleLowerCase()]));
}

export function filterCases(rows, filters, searchIndex) {
  const query = (filters.search || '').trim().toLocaleLowerCase();
  return rows.filter(row => (!filters.dataset || row.dataset === filters.dataset)
    && (!filters.decision || row.decision === filters.decision)
    && (!filters.website || row.website === filters.website)
    && (!filters.property || row.property === filters.property)
    && (!filters.hideDuplicates || row.decision !== 'duplicate')
    && (!query || searchIndex.get(row.id).includes(query)));
}
