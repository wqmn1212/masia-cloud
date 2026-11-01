// 고객 성과 리포트 표시 규칙 — 화면(직원 미리보기·고객 포털)과 PDF가 같은 정의를 쓴다.
// 숫자 계산은 서버(base44/shared/performanceReport.ts)에서 하고, 여기서는 이름·단위·묶음만 정한다.

const won = (n) => `₩${Math.round(n).toLocaleString('ko-KR')}`;
const money = (n, cur) => (cur === 'KRW' ? won(n) : `${cur === 'CNY' ? '¥' : '$'}${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

// core: 0이어도 보여 줄 숫자. 나머지는 값이 없거나 0이면 감춘다 (빈 칸으로 성과가 없어 보이지 않게)
export const PERF_SECTIONS = [
  { key: 'progress', title: '진행', metrics: [
    { key: 'projects_active', label: '진행한 품목', unit: '개', core: true },
    { key: 'projects_done', label: '마무리한 품목', unit: '개', core: true },
    { key: 'projects_ordered', label: '발주·제작까지 간 품목', unit: '개' },
  ] },
  { key: 'sourcing', title: '견적', metrics: [
    { key: 'quotes_sent', label: '보내 드린 견적', unit: '건', core: true },
    { key: 'first_quote_days_avg', label: '요청부터 첫 견적까지', unit: '일', prefix: '평균 ' },
    { key: 'factories_per_product', label: '품목당 검토한 공장', unit: '곳', prefix: '평균 ', note: (m) => (m.factories_reviewed ? `모두 ${m.factories_reviewed}곳` : '') },
    { key: 'savings_pct_avg', label: '최고 견적 대비 절감', unit: '%', prefix: '평균 ', note: (m) => (m.savings_products ? `비교 견적 ${m.savings_products}개 품목` : ''), hideAlso: ['savings_products'] },
    { key: 'comparisons_published', label: '견적 비교표', unit: '건' },
  ] },
  { key: 'schedule', title: '일정', metrics: [
    { key: 'steps_on_time_pct', label: '기한 안에 끝낸 단계', unit: '%', note: (m) => (m.steps_done ? `끝낸 단계 ${m.steps_done}개` : '') },
    { key: 'arrival_on_time_pct', label: '예정일 안에 도착한 선적', unit: '%', note: (m) => (m.shipments_arrived ? `도착 ${m.shipments_arrived}건` : '') },
    { key: 'shipments_departed', label: '출항한 선적', unit: '건' },
  ] },
  { key: 'quality', title: '품질', metrics: [
    { key: 'qc_reports', label: '현지 검수', unit: '회', core: true, note: (m) => (m.qc_items_checked ? `${m.qc_items_checked}개 항목 확인` : '') },
    { key: 'qc_issues_caught', label: '출고 전에 잡아낸 문제', unit: '건' },
    { key: 'claims', label: '불량 신고', unit: '건', note: (m) => (m.claims ? `처리 ${m.claims_resolved || 0}건` : '') },
    { key: 'defect_rate_pct', label: '신고된 불량률', unit: '%' },
    { key: 'compensation', label: '받아 낸 보상', format: (v) => Object.entries(v || {}).map(([c, n]) => money(n, c)).join(' · ') },
  ] },
  { key: 'cost', title: '비용', metrics: [
    { key: 'landed_confirmed', label: '확정한 도착 원가', unit: '건' },
    { key: 'dest_cost_accuracy_pct', label: '도착 비용 예상 정확도', unit: '%' },
  ] },
  { key: 'contact', title: '소통', metrics: [
    { key: 'meetings', label: '미팅', unit: '회' },
    { key: 'site_visits', label: '공장 방문', unit: '회' },
  ] },
];

export const SECTION_TOGGLES = [
  { key: 'section_trends', label: '재주문 개당 원가 변화' },
  { key: 'section_products', label: '품목별 요약' },
];

const hasValue = (v) => (v && typeof v === 'object' ? Object.keys(v).length > 0 : v != null && v !== 0);

// 보여 줄 숫자: { section, items: [{ key, label, value, note, hidden }] }. includeHidden 이면 담당자 편집용으로 뺀 것도 넣는다
export function perfSections(metrics = {}, hidden = [], { includeHidden = false } = {}) {
  const off = new Set(hidden);
  return PERF_SECTIONS.map((s) => ({
    ...s,
    items: s.metrics
      .filter((d) => d.key in metrics && (d.core || hasValue(metrics[d.key])))
      .map((d) => ({
        key: d.key, label: d.label, hideAlso: d.hideAlso || [],
        value: d.format ? d.format(metrics[d.key]) : `${d.prefix || ''}${metrics[d.key] ?? 0}${d.unit || ''}`,
        note: d.note ? d.note(metrics) : '',
        hidden: off.has(d.key),
      }))
      .filter((it) => includeHidden || !it.hidden),
  })).filter((s) => s.items.length);
}

export const wonText = won;

// 기간 고르기: 한국 날짜 기준
const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export function periodPresets(today = kstToday()) {
  const [y, mo] = today.split('-').map(Number);
  const q = Math.floor((mo - 1) / 3);
  const lq = q === 0 ? { y: y - 1, q: 3 } : { y, q: q - 1 };
  const quarter = (yy, qq) => [ymd(yy, qq * 3 + 1, 1), ymd(yy, qq * 3 + 3, lastDay(yy, qq * 3 + 3))];
  const half = mo <= 6 ? { label: `${y - 1}년 하반기`, range: [ymd(y - 1, 7, 1), ymd(y - 1, 12, 31)] } : { label: `${y}년 상반기`, range: [ymd(y, 1, 1), ymd(y, 6, 30)] };
  return [
    { key: 'last_quarter', label: `지난 분기 (${lq.y}년 ${lq.q + 1}분기)`, range: quarter(lq.y, lq.q) },
    { key: 'this_quarter', label: `이번 분기 (${y}년 ${q + 1}분기)`, range: quarter(y, q) },
    { key: 'last_half', label: `지난 반기 (${half.label})`, range: half.range },
    { key: 'this_year', label: `올해 (${y}년)`, range: [ymd(y, 1, 1), ymd(y, 12, 31)] },
    { key: 'last_year', label: `작년 (${y - 1}년)`, range: [ymd(y - 1, 1, 1), ymd(y - 1, 12, 31)] },
  ];
}
