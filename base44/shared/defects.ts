// 불량 기록: AI 비서에게 보낸 엑셀(불량 시리얼 목록·불량 내역)을 읽어 카드마다 '언제·어떤 작업 중·무슨 불량·몇 건·어떤 시리얼'로 남기고,
// 나중에 QC 검토 때 비슷한 과거 불량을 찾아 알려 준다. 서버(defectLog·productionUnits 함수)와 검산이 같이 쓴다.
import { toDate, serialRange } from './productionUnits.ts';

export const DEFECT_KIND: Record<string, string> = { PRODUCT: '제품 불량', STICKER: '스티커 불량', PACKAGING: '포장 불량', OTHER: '기타' };
const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v: unknown) => clean(v).replace(/\s/g, '').toLowerCase();

// 머리글 칸 찾기. 시리얼 칸은 '불량 시리얼 넘버'처럼 '불량'이 같이 들어가도 시리얼로 본다
const COLS: Record<string, RegExp> = {
  serial: /(시리얼|serial|s\/n|^sn$|序列号|编号)/i,
  date: /(날짜|일자|발생일|검사일|생산일|date|日期)/i,
  stage: /(공정|단계|작업|stage|process|工序|工段)/i,
  qty: /(수량|qty|quantity|数量)/i,
  desc: /(불량\s*(내용|유형|사유|항목|현상)|내용|사유|현상|비고|defect|reason|不良|问题|原因|备注)/i,
};
const SERIAL_LIKE = /^[A-Z]{2,}[A-Z0-9-]*\d{3,}$/;

/** 파일 이름에서 날짜 찾기: '261104_불량.xlsx' → 2026-11-04, '20261104' → 2026-11-04 */
export function dateFromName(name = '') {
  const s = String(name);
  const full = toDate(s);
  if (full) return full;
  const m = s.match(/(?:^|[^\d])(2\d)(\d{2})(\d{2})(?:[^\d]|$)/);
  if (!m) return '';
  const [y, mo, d] = [Number(`20${m[1]}`), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${m[2]}-${m[3]}` : '';
}

/**
 * 불량 목록 엑셀 읽기. sheets: [{ name, rows }]
 * 돌려줌: { items: [{ serial, desc, date, stage, qty, sheet }], columns, warnings }
 * 머리글이 없거나 시리얼만 있는 목록도 읽는다 (시리얼처럼 생긴 값을 모은다).
 */
export function parseDefectSheets(sheets: { name: string; rows: unknown[][] }[]) {
  const items: any[] = [];
  const warnings: string[] = [];
  const found = new Set<string>();
  for (const sh of sheets || []) {
    const rows = (sh.rows || []).map((r) => (Array.isArray(r) ? r : []));
    let head = -1;
    let cols: Record<string, number> = {};
    for (let i = 0; i < Math.min(rows.length, 15) && head < 0; i++) {
      const c: Record<string, number> = {};
      rows[i].forEach((cell, j) => {
        const t = clean(cell);
        if (!t || t.length > 30) return;
        if (COLS.serial.test(t) && c.serial == null) { c.serial = j; return; }
        for (const k of ['date', 'stage', 'qty', 'desc']) if (c[k] == null && COLS[k].test(t)) { c[k] = j; return; }
      });
      if (c.serial != null || (c.desc != null && Object.keys(c).length >= 2)) { head = i; cols = c; }
    }
    if (head < 0) {
      // 머리글 없음: 시리얼처럼 생긴 값만 모은다
      let n = 0;
      for (const r of rows) for (const cell of r) { const v = clean(cell).toUpperCase(); if (SERIAL_LIKE.test(v)) { items.push({ serial: v, desc: '', date: '', stage: '', qty: 1, sheet: sh.name }); n++; } }
      if (!n && rows.some((r) => r.some((c) => clean(c)))) warnings.push(`${sh.name}: 시리얼·불량 내용 칸을 찾지 못해 건너뛰었습니다`);
      continue;
    }
    Object.keys(cols).forEach((k) => found.add(k));
    for (const r of rows.slice(head + 1)) {
      const serial = cols.serial != null ? clean(r[cols.serial]).toUpperCase().replace(/\s/g, '') : '';
      const desc = cols.desc != null ? clean(r[cols.desc]) : '';
      if (!serial && !desc) continue;
      if (serial && !/\d/.test(serial)) continue; // 합계·메모 줄
      const qtyRaw = cols.qty != null ? Number(String(r[cols.qty]).replace(/[^\d.]/g, '')) : NaN;
      items.push({
        serial, desc,
        date: cols.date != null ? toDate(r[cols.date]) : '',
        stage: cols.stage != null ? clean(r[cols.stage]) : '',
        qty: serial ? 1 : (qtyRaw > 0 ? qtyRaw : 1),
        sheet: sh.name,
      });
    }
  }
  const dup = items.filter((x, i) => x.serial && items.findIndex((y) => y.serial === x.serial) !== i).map((x) => x.serial);
  if (dup.length) warnings.push(`같은 시리얼이 두 번 이상 있습니다: ${[...new Set(dup)].slice(0, 5).join(', ')}${dup.length > 5 ? ' …' : ''} (한 번만 셉니다)`);
  const seen = new Set<string>();
  const uniq = items.filter((x) => !x.serial || (!seen.has(x.serial) && seen.add(x.serial)));
  return { items: uniq, columns: [...found], warnings };
}

/**
 * 같은 날·같은 작업·같은 불량끼리 묶는다. 빈 값은 기본값(defaults)으로 채운다.
 * 돌려줌: [{ date, stage, defect_type, qty, serials, serial_range }]
 */
export function groupDefects(items: any[], defaults: { date?: string; stage?: string; defect_type?: string } = {}) {
  const m = new Map<string, any>();
  for (const it of items || []) {
    const date = it.date || defaults.date || '';
    const stage = it.stage || defaults.stage || '';
    const type = it.desc || defaults.defect_type || '';
    const k = `${date}|${stage}|${type}`;
    const g = m.get(k) || { date, stage, defect_type: type, qty: 0, serials: [] as string[] };
    g.qty += Number(it.qty) || 1;
    if (it.serial) g.serials.push(it.serial);
    m.set(k, g);
  }
  return [...m.values()].map((g) => ({ ...g, serial_range: g.serials.length > 12 ? serialRange(g.serials).split(', ').slice(0, 6).join(', ') + ' …' : serialRange(g.serials) }))
    .sort((a, b) => b.qty - a.qty);
}

// ── 비슷한 불량 찾기
const STOP = new Set(['불량', '확인', '있음', '없음', '발생', '문제', '제품', '검사', '상태', '부분', '내용', '항목', '진행', '관련', '경우', '1차', '2차', 'the', 'and', 'defect', '不良']);
const PARTICLE = /(이|가|은|는|을|를|에|에서|의|로|으로|와|과|도|만|중|시|때)$/;
/** 비교용 낱말: 한글·영문·숫자 2글자 이상, 흔한 말과 조사는 뺀다 */
export function tokens(text: unknown) {
  const out = new Set<string>();
  for (let w of String(text ?? '').toLowerCase().split(/[^0-9a-z가-힣一-龥]+/)) {
    if (w.length > 2) w = w.replace(PARTICLE, '');
    if (w.length < 2 || STOP.has(w) || /^\d+$/.test(w)) continue;
    out.add(w);
  }
  return out;
}
const overlap = (a: Set<string>, b: Set<string>) => {
  const hit: string[] = [];
  for (const x of a) for (const y of b) if (x === y || (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x)))) { hit.push(x.length <= y.length ? x : y); break; }
  return [...new Set(hit)];
};

/**
 * 과거 기록에서 비슷한 불량 찾기.
 * records: [{ id, source: 'DEFECT'|'CASE'|'CLAIM', card_id, factory_id, date, stage, title, detail, qty, card_title }]
 * query: { text, card_id?, factory_id? }
 * 돌려줌: 점수순 상위 limit 개 + matched(겹친 낱말)
 */
export function findSimilar(records: any[], query: { text?: string; card_id?: string; factory_id?: string }, limit = 8) {
  const q = tokens(query.text);
  if (!q.size) return [];
  return (records || [])
    .map((r) => {
      const matched = overlap(q, tokens(`${r.title} ${r.detail || ''} ${r.stage || ''}`));
      let score = matched.length * 10;
      if (query.factory_id && r.factory_id && r.factory_id === query.factory_id) score += 4;
      if (r.source === 'CLAIM') score += 2; // 고객 클레임은 더 무겁게
      score += Math.min(3, Math.log10((Number(r.qty) || 1) + 1));
      return { ...r, matched, score, same_card: !!query.card_id && r.card_id === query.card_id };
    })
    .filter((r) => r.matched.length)
    .sort((a, b) => b.score - a.score || String(b.date).localeCompare(String(a.date)))
    .slice(0, limit);
}

/** '2026-11-04 · 스티커 부착 중 · 스티커 불량 52건 (N30 박스 패키징)' */
export function defectLine(r: any) {
  return [r.date, r.stage && (/후$/.test(r.stage) ? `${r.stage} 발견` : `${r.stage} 중`), `${r.title}${r.qty ? ` ${r.qty}건` : ''}`].filter(Boolean).join(' · ') + (r.card_title ? ` (${r.card_title})` : '');
}
