// 프로젝트 그룹 이슈: 엑셀(문제점 관리표·작업지도서 검토표) 읽기, 값 맞추기, 변경 이력, 집계.
// 화면(src/lib/cardGroup.js)도 같은 이름표를 쓴다.

export const SEVERITY: Record<string, string> = { HIGH: '높음', MID: '중간', LOW: '낮음' };
export const ISSUE_STATUS: Record<string, string> = { OPEN: '미조치', CHECK: '확인 필요', DOING: '조치 중', TEMP: '임시 조치', DONE: '완료' };
export const ISSUE_SOURCE: Record<string, string> = { ASSEMBLY: '조립 문제점', WORK_INSTRUCTION: '작업지도서 검토', SPEC: '사양서 확인', MEETING: '회의', MANUAL: '직접 입력' };

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v)).replace(/\r/g, '').trim();
const norm = (v: unknown) => str(v).toLowerCase().replace(/[\s·.,:;()\[\]'"“”‘’\-_/]+/g, '');

export function severityOf(v: unknown): string {
  const t = norm(v);
  if (!t) return '';
  if (['높음', '상', 'high', 'h', '긴급', '중대'].some((k) => t === k || t.startsWith(k))) return 'HIGH';
  if (['낮음', '하', 'low', 'l'].some((k) => t === k || t.startsWith(k))) return 'LOW';
  if (['중간', '중', 'mid', 'medium', 'm', '보통'].some((k) => t === k || t.startsWith(k))) return 'MID';
  return '';
}

export function statusOf(v: unknown): string {
  const t = norm(v);
  if (!t) return '';
  if (t.includes('완료') || t === 'done' || t.includes('해결')) return 'DONE';
  if (t.includes('임시')) return 'TEMP';
  if (t.includes('확인')) return 'CHECK';
  if (t.includes('조치중') || t.includes('진행') || t.includes('요청함') || t === 'doing') return 'DOING';
  if (t.includes('미조치') || t.includes('미완') || t === 'open' || t.includes('대기')) return 'OPEN';
  return '';
}

// 2026-11-24 / 2026.11.24 / 26.11.24 / 11/24/26(엑셀 표시형) / 엑셀 날짜 숫자
export function dateOf(v: unknown): string {
  const t = str(v);
  if (!t) return '';
  let m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{2})[.](\d{1,2})[.](\d{1,2})$/);
  if (m) return `20${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return '';
}

// 머리글 → 필드. 제목 칸('문제점' 또는 '문제')이 있는 줄만 머리글로 본다 (다른 표를 이슈로 잘못 읽지 않게)
const COLS: [string, (h: string) => boolean][] = [
  ['title', (h) => h === '문제점' || h === '문제' || h.startsWith('문제점')],
  ['area', (h) => h === '부위' || h === '공정' || h === '공정명' || h.startsWith('부위')],
  ['place', (h) => h === '위치'],
  ['detail', (h) => h.includes('세부') || h.includes('현장메모') || h === '현재내용'],
  ['cause', (h) => h.startsWith('원인')],
  ['vendor', (h) => h.includes('업체')],
  ['impact', (h) => h === '영향'],
  ['action_plan', (h) => h.startsWith('개선') || h.startsWith('수정요청') || h === '조치' || h.startsWith('조치방안')],
  ['severity', (h) => h === '중요도' || h === '심각도'],
  ['status', (h) => h === '상태' || h === '진행상태'],
  ['assignee_name', (h) => h === '담당' || h === '담당자'],
  ['due_date', (h) => h === '목표일' || h === '기한' || h === '마감일'],
  ['done_date', (h) => h === '완료일'],
  ['related_doc', (h) => h.startsWith('관련문서') || h === '관련'],
  ['no', (h) => h === 'no' || h === '번호' || h === '연번'],
];

function headerOf(row: unknown[]) {
  const map: Record<string, number> = {};
  row.forEach((cell, i) => {
    const h = norm(cell);
    if (!h) return;
    for (const [field, test] of COLS) if (!(field in map) && test(h)) { map[field] = i; break; }
  });
  return 'title' in map && Object.keys(map).length >= 3 ? map : null;
}

const sourceOf = (sheet: string, fileName: string) => {
  const t = `${sheet} ${fileName}`;
  if (t.includes('지시서')) return 'WORK_INSTRUCTION';
  if (t.includes('사양') || t.includes('확인 필요')) return 'SPEC';
  if (t.includes('문제점') || t.includes('조립')) return 'ASSEMBLY';
  return 'MANUAL';
};

export function importKey(it: { area?: string; title?: string; source?: string }) {
  return `${it.source || ''}|${norm(it.area)}|${norm(it.title)}`.slice(0, 300);
}

export function parseIssueSheets(sheets: { name: string; rows: unknown[][] }[], fileName = '') {
  const items: any[] = [];
  const found: any[] = [];
  const warnings: string[] = [];
  for (const sh of sheets) {
    const rows = sh.rows || [];
    let h: Record<string, number> | null = null, hr = -1;
    for (let r = 0; r < Math.min(rows.length, 15) && !h; r++) { h = headerOf(rows[r] || []); if (h) hr = r; }
    if (!h) continue;
    const source = sourceOf(sh.name, fileName);
    let n = 0;
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const get = (f: string) => (f in h! ? str(row[h![f]]) : '');
      // 문제 칸이 비었으면 세부(현재 내용) 칸을 문제점으로 쓴다 (작업지도서 검토표의 '빈칸' 같은 줄)
      const title = get('title') || get('detail');
      if (!title) continue;
      const place = get('place');
      const area = [get('area'), place].filter(Boolean).join(' · ');
      const sevRaw = get('severity'), stRaw = get('status');
      const it: any = {
        area, title: title.slice(0, 500), detail: get('detail').slice(0, 2000), cause: get('cause').slice(0, 200), vendor: get('vendor').slice(0, 200),
        impact: get('impact').slice(0, 300), action_plan: get('action_plan').slice(0, 1000),
        severity: severityOf(sevRaw) || 'MID', status: statusOf(stRaw) || 'OPEN',
        assignee_name: get('assignee_name').slice(0, 60), due_date: dateOf(get('due_date')), done_date: dateOf(get('done_date')),
        related_doc: get('related_doc').slice(0, 300), source, sheet: sh.name, row: r + 1,
      };
      if (sevRaw && !severityOf(sevRaw)) warnings.push(`${sh.name} ${r + 1}행: 중요도 '${sevRaw}'를 몰라 '중간'으로 넣습니다`);
      if (stRaw && !statusOf(stRaw)) warnings.push(`${sh.name} ${r + 1}행: 상태 '${stRaw}'를 몰라 '미조치'로 넣습니다`);
      if (it.status === 'DONE' && !it.done_date) it.done_date = '';
      it.import_key = importKey(it);
      items.push(it); n++;
    }
    found.push({ name: sh.name, source, header_row: hr + 1, count: n });
  }
  // 같은 파일 안의 같은 줄은 한 번만
  const seen = new Set<string>();
  const uniq = items.filter((it) => { if (seen.has(it.import_key)) { warnings.push(`${it.sheet} ${it.row}행: 같은 문제점이 이미 있어 뺍니다`); return false; } seen.add(it.import_key); return true; });
  if (!found.length) warnings.push('문제점(또는 문제) 칸이 있는 표를 찾지 못했습니다');
  return { sheets: found, items: uniq, warnings };
}

// 바뀐 칸을 사람이 읽는 이력 한 줄로 (값이 긴 칸은 '고침'만 적는다)
const LABEL: Record<string, string> = { status: '상태', severity: '중요도', assignee_name: '담당', due_date: '목표일', done_date: '완료일', title: '문제점', area: '부위', detail: '세부 내용', cause: '원인', vendor: '업체', impact: '영향', action_plan: '개선 방안', related_doc: '관련 문서', card_id: '관련 카드', photos: '사진' };
const SHOW = (f: string, v: any) => (f === 'status' ? ISSUE_STATUS[v] || v : f === 'severity' ? SEVERITY[v] || v : f === 'photos' ? `${(v || []).length}장` : v);
export function changeText(before: any, after: any) {
  const parts: string[] = [];
  for (const f of Object.keys(LABEL)) {
    if (!(f in after)) continue;
    const a = JSON.stringify(before?.[f] ?? ''), b = JSON.stringify(after[f] ?? '');
    if (a === b) continue;
    if (['detail', 'action_plan', 'impact', 'title'].includes(f)) parts.push(`${LABEL[f]} 고침`);
    else parts.push(`${LABEL[f]} ${SHOW(f, before?.[f]) || '없음'} → ${SHOW(f, after[f]) || '없음'}`);
  }
  return parts.join(', ');
}

export function issueSummary(issues: any[], today: string) {
  const open = issues.filter((i) => i.status !== 'DONE');
  const by = (k: string, list = issues) => list.reduce((m: Record<string, number>, i: any) => { const v = i[k] || ''; m[v] = (m[v] || 0) + 1; return m; }, {});
  return {
    total: issues.length, open: open.length, done: issues.length - open.length,
    high_open: open.filter((i) => i.severity === 'HIGH').length,
    overdue: open.filter((i) => i.due_date && i.due_date < today).length,
    by_status: by('status'), by_severity_open: by('severity', open),
    by_vendor_open: by('vendor', open),
  };
}
