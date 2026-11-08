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

// SMT 조립 대상이 아닌 줄: 기구·기판 자체·케이블·하우징 등 (AI 가 smt 를 안 줬을 때만 짐작한다)
const NON_SMT_REF = /^(MECH|PCB|CASE|HOUSING|HW|CBL|CABLE|WIRE|SCREW|LABEL)/i;
const NON_SMT_NAME = /(기구|하우징|케이스|나사|케이블|전선|하네스|라벨|PCB 기판|원판|방열판|어댑터)/;
export const guessSmt = (r) => !(NON_SMT_REF.test(String(r.ref || '').trim()) || NON_SMT_NAME.test(String(r.name || '')));
export const isSmt = (r) => (typeof r.smt === 'boolean' ? r.smt : guessSmt(r));

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
      comment: p.comment ?? (b.part_no || b.name || ''), footprint: p.footprint || b.footprint || '', lcsc: p.lcsc || '', lcsc_type: p.lcsc_type || '',
      smt: typeof p.smt === 'boolean' ? p.smt : typeof b.smt === 'boolean' ? b.smt : guessSmt(b),
    };
  });
}

/** 확정 현황 (SMT 조립 대상만 센다) */
export function pcbSummary(rows = []) {
  const smt = rows.filter(isSmt);
  const s = { total: smt.length, confirmed: 0, invalid: 0, missing: 0, basic: 0, extended: 0, noFootprint: 0, excluded: rows.length - smt.length };
  for (const r of smt) {
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
/** 'R1,R2' · 'SW1~SW3' · 'R1-R4' · 'C1 C2' → ['R1','R2'] / ['SW1','SW2','SW3'] … (범위는 앞글자가 같을 때만 푼다) */
export function expandRefs(ref) {
  const out = [];
  for (const part of String(ref || '').split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z_]+)(\d+)\s*[~\-–]\s*([A-Za-z_]*)(\d+)$/);
    if (m && (!m[3] || m[3] === m[1]) && Number(m[4]) >= Number(m[2]) && Number(m[4]) - Number(m[2]) <= 200) {
      for (let n = Number(m[2]); n <= Number(m[4]); n++) out.push(`${m[1]}${n}`);
    } else out.push(part);
  }
  return out;
}

/**
 * JLCPCB 부품표 (Comment · Designator · Footprint · LCSC Part #). SMT 조립 대상이 아닌 줄은 뺀다.
 * 같은 값·실장 모양·부품번호는 한 줄로 묶고 Designator 를 이어 붙인다 (범위 표기는 풀어서).
 */
export function jlcBomRows(rows = []) {
  const groups = new Map();
  for (const r of rows.filter(isSmt)) {
    const comment = String(r.comment || r.part_no || r.name || '').trim();
    const footprint = String(r.footprint || '').trim();
    const lcsc = isLcsc(r.lcsc) ? r.lcsc : '';
    const k = `${comment}|${footprint}|${lcsc}`;
    const g = groups.get(k) || { Comment: comment, Footprint: footprint, 'LCSC Part #': lcsc, refs: [] };
    g.refs.push(...expandRefs(r.ref));
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
