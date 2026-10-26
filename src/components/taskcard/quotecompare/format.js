import { CURRENCY_SYMBOL, formatMoney } from '@/components/quotation/quoteCurrency';

export const money = (v, cur) => (v == null || Number.isNaN(v) ? '—' : formatMoney(v, cur));
// 개당 금액은 작은 값이 많아 한 자리 더 보여 준다 (원화는 그대로)
export const unitMoney = (v, cur) => {
  if (v == null || Number.isNaN(v)) return '—';
  if (cur === 'KRW') return formatMoney(v, 'KRW');
  const d = v < 10 ? 3 : 2;
  return `${CURRENCY_SYMBOL[cur] || '$'}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d })}`;
};
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' }) : '');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }) : '');
