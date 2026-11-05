// 불량 기록 저장·조회 (서버 전용). defectLog·productionUnits 함수가 같이 쓴다.
import { groupDefects, findSimilar } from './defects.ts';

const s = (v: unknown, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/**
 * 묶음(groupDefects 결과)을 카드의 DefectLog 로 저장한다. 같은 파일·같은 묶음은 다시 저장하지 않는다(dedupe_key).
 * 돌려줌: { created, skipped }
 */
export async function saveDefectGroups(db: any, card: any, groups: any[], meta: { kind?: string; source?: string; source_file?: string; by?: string; note?: string }) {
  const existing = await db.DefectLog.filter({ card_id: card.id }, '-created_date', 1000);
  const keys = new Set(existing.map((x: any) => x.dedupe_key).filter(Boolean));
  let created = 0, skipped = 0;
  for (const g of groups) {
    const key = [meta.source || 'MANUAL', meta.source_file || '', g.date, g.stage, g.defect_type, g.qty].join('|');
    if (meta.source_file && keys.has(key)) { skipped++; continue; }
    await db.DefectLog.create({
      tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id || '', factory_id: card.factory_id || '', card_title: card.title || '',
      occurred_date: g.date || '', stage: s(g.stage, 60), defect_type: s(g.defect_type, 120) || '(내용 없음)', description: s(meta.note || g.description, 600),
      kind: meta.kind || 'PRODUCT', qty: Number(g.qty) || 0, serials: (g.serials || []).slice(0, 5000), serial_range: s(g.serial_range, 400),
      source: meta.source || 'MANUAL', source_file: s(meta.source_file, 200), created_by_name: meta.by || '', dedupe_key: key,
    });
    keys.add(key);
    created++;
  }
  return { created, skipped };
}

/** 성적서 등록 때 불합격 제품을 '양산 검사' 불량으로 남긴다 (불합격 항목별로 묶음) */
export async function recordInspectionDefects(db: any, card: any, units: any[], fileName: string, by: string) {
  const items: any[] = [];
  for (const u of units) {
    if (u.verdict !== 'FAIL') continue;
    const fails = (u.failed_items || []).length ? u.failed_items : ['불합격'];
    for (const f of fails) items.push({ serial: u.serial, desc: f, date: u.inspected_date || '', stage: '양산 검사', qty: 1 });
  }
  if (!items.length) return { created: 0, skipped: 0 };
  return saveDefectGroups(db, card, groupDefects(items), { kind: 'PRODUCT', source: 'INSPECTION', source_file: fileName, by });
}

/**
 * 비슷한 과거 불량 찾기용 기록: 불량 기록 + QC 사례 + 고객 클레임 (같은 팀만)
 */
export async function similarRecords(db: any, tenantScope: Record<string, string>, query: { text: string; card_id?: string; factory_id?: string }, limit = 8) {
  const [logs, cases, claims] = await Promise.all([
    db.DefectLog.filter(tenantScope, '-created_date', 2000).catch(() => []),
    db.QCKnowledgeLog.filter(tenantScope, '-created_date', 500).catch(() => []),
    db.QualityClaim.filter(tenantScope, '-created_date', 500).catch(() => []),
  ]);
  const titles = new Map<string, string>();
  for (const l of logs) if (l.card_id && l.card_title) titles.set(l.card_id, l.card_title);
  const records = [
    ...logs.map((l: any) => ({ id: l.id, source: 'DEFECT', card_id: l.card_id, factory_id: l.factory_id, date: l.occurred_date || String(l.created_date || '').slice(0, 10), stage: l.stage, title: l.defect_type, detail: [l.description, l.kind === 'STICKER' ? '스티커' : ''].filter(Boolean).join(' '), qty: l.qty, card_title: l.card_title, serial_range: l.serial_range })),
    ...cases.map((k: any) => ({ id: k.id, source: 'CASE', card_id: k.card_id, factory_id: k.factory_id, date: String(k.created_date || '').slice(0, 10), stage: '', title: k.issue_case, detail: [k.root_cause, k.prevention, (k.tags || []).join(' ')].filter(Boolean).join(' '), qty: 0, card_title: titles.get(k.card_id) || '', prevention: k.prevention || '' })),
    ...claims.map((c: any) => ({ id: c.id, source: 'CLAIM', card_id: c.card_id, factory_id: '', date: String(c.submitted_at || c.created_date || '').slice(0, 10), stage: '고객 입고 후', title: c.title, detail: [c.description, c.lot_note].filter(Boolean).join(' '), qty: c.defect_qty || 0, card_title: titles.get(c.card_id) || '' })),
  ].filter((r) => r.title);
  const found = findSimilar(records, query, limit);
  // 카드 제목이 없는 사례·클레임은 카드에서 채운다
  const missing = [...new Set(found.filter((r) => !r.card_title && r.card_id).map((r) => r.card_id))];
  for (const id of missing) {
    const c = await db.TaskCard.get(id).catch(() => null);
    if (c) for (const r of found) if (r.card_id === id) r.card_title = c.title || '';
  }
  return found;
}
