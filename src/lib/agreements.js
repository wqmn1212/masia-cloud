// 월 계약(ServiceAgreement)·청구(ServiceInvoice)·월간 리포트 화면 공용 값과 계산
export const AGREEMENT_STATUS = {
  DRAFT: { label: '작성 중', cls: 'bg-muted text-muted-foreground' },
  ACTIVE: { label: '진행 중', cls: 'bg-primary/15 text-primary' },
  SUSPENDED: { label: '일시 중지', cls: 'bg-chart-3/15 text-chart-3' },
  ENDED: { label: '종료', cls: 'bg-muted text-muted-foreground' },
  RENEWED: { label: '갱신됨', cls: 'bg-accent/15 text-accent' },
};
export const INVOICE_STATUS = {
  PENDING: { label: '발행 전', cls: 'bg-muted text-muted-foreground' },
  ISSUED: { label: '청구서 발행', cls: 'bg-chart-3/15 text-chart-3' },
  PAID: { label: '입금 완료', cls: 'bg-primary/15 text-primary' },
  OVERDUE: { label: '입금 지연', cls: 'bg-destructive/15 text-destructive' },
};
export const TERM_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const kstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
export const kstMonth = () => kstToday().slice(0, 7);
export const shiftMonth = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
// 시작일 + n개월 - 1일 (예: 2026-11-01 + 3개월 → 2027-01-31)
export const endDateOf = (start, months) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !months) return '';
  const [y, m, d] = start.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1 + Number(months), d) - 86400000);
  return end.toISOString().slice(0, 10);
};
export const daysLeft = (end) => (end ? Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${kstToday()}T00:00:00Z`)) / 86400000) : null);
export const monthsBetween = (startMonth, endMonth) => {
  const out = [];
  for (let m = startMonth; m <= endMonth && out.length < 36; m = shiftMonth(m, 1)) out.push(m);
  return out;
};
export const money = (v, currency = 'KRW') => (v == null || v === '' ? '-' : `${Number(v).toLocaleString('ko-KR')}${currency === 'KRW' ? '원' : ` ${currency}`}`);
export const monthLabel = (month) => { const [y, m] = (month || '').split('-'); return y ? `${y}년 ${Number(m)}월` : ''; };

// 월간 리포트 숫자 표시 순서 (고객 화면·직원 화면 공용)
export const REPORT_METRICS = [
  ['projects', '진행한 프로젝트', '건'],
  ['steps_done', '완료한 단계', '개'],
  ['steps_on_time', '그중 일정 안에 끝낸 단계', '개'],
  ['qc_reports', '검수 리포트', '건'],
  ['qc_items_checked', '검수한 항목', '개'],
  ['site_visits', '공장 현장 방문', '회'],
  ['meetings', '공장 미팅 (전체)', '회'],
  ['staff_replies', '담당자 답변', '건'],
  ['shipments_departed', '출항한 선적', '건'],
];
