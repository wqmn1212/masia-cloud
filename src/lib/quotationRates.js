const kstFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const getKstDate = () => kstFormatter.format(new Date());

// 저장 시각(UTC)을 한국 날짜로 변환
const kstDateOf = (value) => {
  if (!value) return '';
  const text = String(value);
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? '' : kstFormatter.format(date);
};

const savedAt = (q) => q.updated_date || q.created_date;

// 한국시간 오늘(00시 이후) 환율을 입력·저장한 가장 최근 견적의 환율
export const findDailyQuotationRates = (quotations = [], date = getKstDate()) => {
  const quote = quotations
    .filter((item) => kstDateOf(savedAt(item)) === date
      && Number(item.exchange_rate_usd_cny) > 0
      && Number(item.exchange_rate_usd) > 0)
    .sort((a, b) => new Date(savedAt(b)) - new Date(savedAt(a)))[0];
  return quote ? {
    exchange_rate_date: date,
    exchange_rate_usd_cny: quote.exchange_rate_usd_cny,
    exchange_rate_usd: quote.exchange_rate_usd,
  } : null;
};