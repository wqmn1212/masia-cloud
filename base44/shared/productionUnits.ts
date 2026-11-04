// 양산 시리얼 관리: 현장의 검사 성적서(엑셀, 날짜별 시트)를 읽어 제품 한 대씩(ProductionUnit) 기록한다.
// 성적서 형식(N30 제조라인 검사성적서): '작성일'·'LOT' 칸, 머리글 줄에 '시리얼' 칸과 검사 항목들, 마지막에 '종합 판정'.
// 종합 판정 칸의 수식 값은 믿지 않고 항목 결과로 다시 계산한다. 빈 항목이 있으면 '미검사'로 본다.
// 스티커 불량으로 버린 번호는 성적서에 줄이 없으므로 따로 관리하지 않는다 (출고된 시리얼만 정확히).

export const VERDICT = { PASS: 'PASS', FAIL: 'FAIL', INCOMPLETE: 'INCOMPLETE' };
export const DISPOSITION = ['REWORK', 'SCRAP'];
const PASS_WORDS = /^(pass|ok|o|합격|양호|通过|合格|y|yes|✓|√)$/i;
const FAIL_WORDS = /^(fail|ng|x|불합격|불량|不合格|不良|n|no|✗)$/i;
const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v: unknown) => clean(v).replace(/\s/g, '');

export function cellResult(v: unknown): 'pass' | 'fail' | '' {
  const s = clean(v);
  if (!s) return '';
  if (PASS_WORDS.test(s)) return 'pass';
  if (FAIL_WORDS.test(s)) return 'fail';
  return 'fail'; // 알 수 없는 값은 합격으로 보지 않는다
}

// '2026.11.04' · '2026-11-04' · 엑셀 날짜 숫자 · 시트 이름 '검사성적서_20261105' → 'YYYY-MM-DD'
export function toDate(v: unknown): string {
  if (typeof v === 'number' && v > 30000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = clean(v);
  let m = s.match(/(20\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/(20\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

const OPTIONAL = { pallet: /^(파레트|팔레트|pallet|托盘|栈板)/i, note: /^(불량내용|불량사유|비고|메모|note|不良内容|备注)/i, inspector: /^(검사자|검사원|inspector|检验员)/i, box: /^(박스|카톤|box|carton|箱号)/i };

/**
 * sheets: [{ name, rows: 셀 값 2차원 배열 }]
 * 돌려줌: { sheets: [{ name, date, lot, units, warnings }], units, warnings }
 */
export function parseInspectionSheets(sheets: { name: string; rows: any[][] }[]) {
  const out: any[] = [];
  const warnings: string[] = [];
  for (const sh of sheets) {
    const rows = sh.rows || [];
    const w: string[] = [];
    const head = rows.findIndex((r) => (r || []).some((c) => /시리얼|serial|序列号/i.test(norm(c))));
    if (head < 0) { out.push({ name: sh.name, date: '', lot: '', items: [], units: [], warnings: ['시리얼 칸을 찾지 못해 건너뜀'] }); warnings.push(`${sh.name}: 시리얼 칸을 찾지 못해 건너뜀`); continue; }
    const hr = rows[head].map(norm);
    const serialCol = hr.findIndex((c) => /시리얼|serial|序列号/i.test(c));
    let verdictCol = hr.findIndex((c, i) => i > serialCol && /종합판정|판정|결과|verdict|result|判定/i.test(c));
    if (verdictCol < 0) verdictCol = hr.length;
    const optCols: Record<string, number> = {};
    hr.forEach((c, i) => { for (const [k, re] of Object.entries(OPTIONAL)) if (optCols[k] == null && re.test(c)) optCols[k] = i; });
    const optIdx = new Set(Object.values(optCols));
    const checkCols = [];
    for (let i = serialCol + 1; i < verdictCol; i++) if (hr[i] && !optIdx.has(i)) checkCols.push({ i, label: clean(rows[head][i]) });
    if (!checkCols.length) w.push('검사 항목 칸이 없습니다');

    // 작성일·LOT: 머리글 위 줄에서 '작성일' 오른쪽 칸, 'LOT' 오른쪽 칸
    const near = (re: RegExp) => { for (let r = 0; r < head; r++) { const row = rows[r] || []; for (let c = 0; c < row.length; c++) if (re.test(norm(row[c]))) { for (let k = c + 1; k < row.length; k++) if (clean(row[k])) return row[k]; } } return ''; };
    const sheetDate = toDate(sh.name);
    const cellDate = toDate(near(/^(작성일|검사일|일자|date|日期)$/i));
    const date = sheetDate || cellDate;
    if (sheetDate && cellDate && sheetDate !== cellDate) w.push(`작성일(${cellDate})이 시트 이름 날짜(${sheetDate})와 다릅니다. 시트 이름 날짜로 기록합니다`);
    if (!date) w.push('검사 날짜를 찾지 못했습니다');
    const lot = clean(near(/^(lot|로트|차수|批次)$/i));

    const units: any[] = [];
    const seen = new Set<string>();
    for (let r = head + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const serial = norm(row[serialCol]).toUpperCase();
      if (!serial) continue;
      if (seen.has(serial)) { w.push(`${serial} 이 같은 시트에 두 번 있습니다 (뒤의 줄은 건너뜀)`); continue; }
      seen.add(serial);
      const checks: Record<string, string> = {};
      for (const c of checkCols) checks[c.label] = cellResult(row[c.i]);
      const vals = Object.values(checks);
      const verdict = vals.some((v) => v === 'fail') ? VERDICT.FAIL : vals.some((v) => !v) || !vals.length ? VERDICT.INCOMPLETE : VERDICT.PASS;
      units.push({
        serial, inspected_date: date, lot, sheet: sh.name, checks, verdict,
        failed_items: checkCols.filter((c) => checks[c.label] === 'fail').map((c) => c.label),
        ...(optCols.pallet != null ? { pallet: clean(row[optCols.pallet]) } : {}),
        ...(optCols.box != null ? { box: clean(row[optCols.box]) } : {}),
        ...(optCols.note != null ? { fail_note: clean(row[optCols.note]) } : {}),
        ...(optCols.inspector != null ? { inspector: clean(row[optCols.inspector]) } : {}),
      });
    }
    if (!units.length) w.push('시리얼이 적힌 줄이 없습니다 (빈 시트)');
    out.push({ name: sh.name, date, lot, items: checkCols.map((c) => c.label), units, warnings: w });
    warnings.push(...w.map((x) => `${sh.name}: ${x}`));
  }
  // 여러 시트에 같은 시리얼: 뒤 시트(재검사)를 남긴다
  const bySerial = new Map<string, any>();
  for (const s of out) for (const u of s.units) {
    if (bySerial.has(u.serial)) warnings.push(`${u.serial}: ${bySerial.get(u.serial).sheet} 와 ${u.sheet} 에 모두 있어 뒤 시트(${u.sheet}) 결과로 기록합니다`);
    bySerial.set(u.serial, u);
  }
  return { sheets: out.map(({ units, ...s }) => ({ ...s, count: units.length, pass: units.filter((u: any) => u.verdict === VERDICT.PASS).length, fail: units.filter((u: any) => u.verdict === VERDICT.FAIL).length, incomplete: units.filter((u: any) => u.verdict === VERDICT.INCOMPLETE).length, range: serialRange(units.map((u: any) => u.serial)) })), units: [...bySerial.values()], warnings };
}

// 시리얼을 '앞부분 + 숫자' 로 나눠 연속 구간으로 묶는다: ['A0001','A0002','A0004'] → 'A0001~A0002, A0004'
export function splitSerial(s: string) { const m = String(s).match(/^(.*?)(\d+)$/); return m ? { prefix: m[1], num: Number(m[2]), width: m[2].length } : { prefix: s, num: NaN, width: 0 }; }
export function serialRange(serials: string[]) {
  const list = [...new Set(serials)].map((s) => ({ s, ...splitSerial(s) })).sort((a, b) => (a.prefix === b.prefix ? a.num - b.num : a.prefix.localeCompare(b.prefix)));
  const parts: string[] = [];
  for (let i = 0; i < list.length;) {
    let j = i;
    while (j + 1 < list.length && list[j + 1].prefix === list[i].prefix && list[j + 1].num === list[j].num + 1) j++;
    parts.push(i === j ? list[i].s : `${list[i].s}~${list[j].s}`);
    i = j + 1;
  }
  return parts.join(', ');
}

// 'MHAFS1AA3982~MHAFS1AA4100' 또는 '3982-4100' (앞부분은 기준 시리얼에서) → 시리얼 목록. 최대 20,000개
export function expandRange(text: string, sample = '') {
  const out: string[] = [];
  const base = splitSerial(sample);
  for (const part of String(text || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean)) {
    const [a, b] = part.split(/\s*[~\-–]\s*/);
    const pa = splitSerial(/^\d+$/.test(a) && base.width ? base.prefix + a.padStart(base.width, '0') : a.toUpperCase());
    if (!b) { out.push(pa.width ? pa.prefix + String(pa.num).padStart(pa.width, '0') : a.toUpperCase()); continue; }
    const pb = splitSerial(/^\d+$/.test(b) && pa.width ? pa.prefix + b.padStart(pa.width, '0') : b.toUpperCase());
    if (pa.prefix !== pb.prefix || Number.isNaN(pa.num) || Number.isNaN(pb.num)) continue;
    const [lo, hi] = pa.num <= pb.num ? [pa.num, pb.num] : [pb.num, pa.num];
    for (let n = lo; n <= hi && out.length < 20000; n++) out.push(pa.prefix + String(n).padStart(pa.width, '0'));
  }
  return [...new Set(out)];
}

// 한 대의 현재 상태 (화면·집계 공용)
export function unitStatus(u: any) {
  if (u.shipped_date) return 'SHIPPED';
  if (u.disposition === 'SCRAP') return 'SCRAPPED';
  if (u.verdict === VERDICT.PASS) return 'READY';
  if (u.disposition === 'REWORK') return 'REWORK';
  return u.verdict === VERDICT.INCOMPLETE ? 'INCOMPLETE' : 'FAILED';
}
export const STATUS_LABEL: Record<string, string> = { READY: '출하 대기', SHIPPED: '출하됨', FAILED: '불량', REWORK: '수리 중', SCRAPPED: '폐기', INCOMPLETE: '미검사 항목 있음' };

// 카드 전체 집계: 상태별 수, 날짜별·파레트별·출하별 묶음
export function productionSummary(units: any[]) {
  const by = (key: (u: any) => string) => {
    const m = new Map<string, any[]>();
    for (const u of units) { const k = key(u) || ''; m.set(k, [...(m.get(k) || []), u]); }
    return m;
  };
  const counts: Record<string, number> = { total: units.length };
  for (const u of units) { const s = unitStatus(u); counts[s] = (counts[s] || 0) + 1; }
  const row = (k: string, list: any[]) => ({
    key: k, count: list.length,
    pass: list.filter((u) => u.verdict === VERDICT.PASS).length,
    fail: list.filter((u) => u.verdict !== VERDICT.PASS).length,
    shipped: list.filter((u) => u.shipped_date).length,
    range: serialRange(list.map((u) => u.serial)),
  });
  const days = [...by((u) => u.inspected_date)].map(([k, l]) => row(k, l)).sort((a, b) => b.key.localeCompare(a.key));
  const pallets = [...by((u) => u.pallet)].filter(([k]) => k).map(([k, l]) => row(k, l)).sort((a, b) => a.key.localeCompare(b.key));
  const shipments = [...by((u) => (u.shipped_date ? `${u.shipped_date}|${u.shipment_label || ''}` : ''))].filter(([k]) => k)
    .map(([k, l]) => ({ ...row(k, l), date: k.split('|')[0], label: k.split('|')[1] })).sort((a, b) => b.key.localeCompare(a.key));
  return { counts, days, pallets, shipments, no_pallet_ready: units.filter((u) => unitStatus(u) === 'READY' && !u.pallet).length };
}
