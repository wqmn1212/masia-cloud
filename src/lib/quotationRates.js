export const getKstDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

export const findDailyQuotationRates = (quotations = [], date = getKstDate()) => {
  const quote = quotations
    .filter((item) => item.exchange_rate_date === date
      && Number(item.exchange_rate_usd_cny) > 0
      && Number(item.exchange_rate_usd) > 0)
    .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))[0];
  return quote ? {
    exchange_rate_date: date,
    exchange_rate_usd_cny: quote.exchange_rate_usd_cny,
    exchange_rate_usd: quote.exchange_rate_usd,
  } : null;
};