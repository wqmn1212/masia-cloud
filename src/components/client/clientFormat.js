// 고객 화면 날짜·금액 표기. 날짜는 한국 날짜 문자열(YYYY-MM-DD) 기준
const DAY = ['일', '월', '화', '수', '목', '금', '토'];

export const shortDate = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${m}/${d} (${DAY[new Date(y, m - 1, d).getDay()]})`;
};

// 남은 날: 오늘 · D-3 · 2일 지남
export const dday = (n) => (n == null ? '' : n === 0 ? '오늘' : n > 0 ? `D-${n}` : `${-n}일 지남`);

export const money = (amount, currency) => (amount == null || amount === '' ? '' : `${currency || ''} ${Number(amount).toLocaleString('ko-KR')}`.trim());

export const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
