// PCB 부품 확정: 설계 부품표 → LCSC 부품번호·실장 모양 확정 → JLCPCB(중국 SMT 공장) 양식 부품표
// 화면(PcbTab)과 검산(scripts/check-prototype.mjs)이 같이 쓴다.

export const LCSC_TYPES = [
  { value: '', label: '미정' },
  { value: 'BASIC', label: '기본 부품' },
  { value: 'EXTENDED', label: '확장 부품' },
];

/** LCSC 부품번호 정리: 'c25804', ' C25804 ', '25804' → 'C25804'. 형식이 아니면 원문을 그대로 둔다 */
export function normalizeLcsc(v) {
  const s = String(v ?? '').trim().toUpperCase().replace(/\s/g, '');
  if (!s) return '';
  const m = s.match(/^C?(\d{1,9})$/);
  return m ? `C${m[1]}` : s;
}
export const isLcsc = (v) => /^C\d{1,9}$/.test(String(v || ''));
export const lcscSearchUrl = (v) => `https://www.lcsc.com/search?q=${encodeURIComponent(v)}`;

const key = (r) => `${r.ref || ''}|${r.name || ''}`;

/**
 * 설계 부품표에서 PCB 확정 행을 만든다. 이미 확정한 값(같은 Ref·부품명)은 그대로 이어 쓴다.
 * 돌려줌: [{ ref, name, part_no, manufacturer, qty, comment, footprint, lcsc, lcsc_type }]
 */
export function seedPcbRows(bom = [], previous = []) {
  const prev = new Map((previous || []).map((r) => [key(r), r]));
  return (bom || []).map((b) => {
    const p = prev.get(key(b)) || {};
    return {
      ref: b.ref || '', name: b.name || '', part_no: b.part_no || '', manufacturer: b.manufacturer || '', qty: Number(b.qty) || 0,
      comment: p.comment ?? (b.part_no || b.name || ''), footprint: p.footprint || '', lcsc: p.lcsc || '', lcsc_type: p.lcsc_type || '',
    };
  });
}

/** 확정 현황 */
export function pcbSummary(rows = []) {
  const s = { total: rows.length, confirmed: 0, invalid: 0, missing: 0, basic: 0, extended: 0, noFootprint: 0 };
  for (const r of rows) {
    if (!r.lcsc) s.missing++;
    else if (!isLcsc(r.lcsc)) s.invalid++;
    else s.confirmed++;
    if (r.lcsc_type === 'BASIC') s.basic++;
    if (r.lcsc_type === 'EXTENDED') s.extended++;
    if (!String(r.footprint || '').trim()) s.noFootprint++;
  }
  return s;
}

const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const splitRefs = (ref) => String(ref || '').split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean);

/**
 * JLCPCB 부품표 (Comment · Designator · Footprint · LCSC Part #).
 * 같은 값·실장 모양·부품번호는 한 줄로 묶고 Designator 를 이어 붙인다.
 */
export function jlcBomRows(rows = []) {
  const groups = new Map();
  for (const r of rows) {
    const comment = String(r.comment || r.part_no || r.name || '').trim();
    const footprint = String(r.footprint || '').trim();
    const lcsc = isLcsc(r.lcsc) ? r.lcsc : '';
    const k = `${comment}|${footprint}|${lcsc}`;
    const g = groups.get(k) || { Comment: comment, Footprint: footprint, 'LCSC Part #': lcsc, refs: [] };
    g.refs.push(...splitRefs(r.ref));
    groups.set(k, g);
  }
  return [...groups.values()]
    .map(({ refs, ...g }) => ({ Comment: g.Comment, Designator: [...new Set(refs)].sort(natural).join(','), Footprint: g.Footprint, 'LCSC Part #': g['LCSC Part #'] }))
    .sort((a, b) => natural(a.Designator, b.Designator));
}

export const JLC_HEADERS = ['Comment', 'Designator', 'Footprint', 'LCSC Part #'];

/** CSV (엑셀에서 한글이 깨지지 않게 앞에 BOM 을 붙인다) */
export function toCsv(rows, headers = JLC_HEADERS) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\r\n') + '\r\n';
}
