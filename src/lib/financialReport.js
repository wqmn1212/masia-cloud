export const CURRENCIES = {
  CNY: { symbol: '¥', label: 'CNY' },
  USD: { symbol: '$', label: 'USD' },
  KRW: { symbol: '₩', label: 'KRW' },
};

const rates = (quote) => ({ usd: Number(quote.exchange_rate_usd) || 1380, cny: Number(quote.exchange_rate_krw) || 190 });

export const quoteAmounts = (quote, currency) => {
  const rate = rates(quote);
  const revenueCny = Number(quote.final_client_price) || ((Number(quote.final_price_usd) || 0) * rate.usd / rate.cny);
  const costCny = (Number(quote.factory_total_cost) || 0) + (Number(quote.logistics_cost) || 0);
  const convert = (value) => currency === 'USD' ? value * rate.cny / rate.usd : currency === 'KRW' ? value * rate.cny : value;
  return { revenue: convert(revenueCny), margin: convert(Math.max(0, revenueCny - costCny)) };
};

export const buildMonthlyTrend = (quotes, currency) => {
  const months = {};
  quotes.forEach((quote) => {
    const month = (quote.created_date || '').slice(0, 7) || '미지정';
    const amount = quoteAmounts(quote, currency);
    months[month] = { month, revenue: (months[month]?.revenue || 0) + amount.revenue, margin: (months[month]?.margin || 0) + amount.margin };
  });
  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
};

export const formatMoney = (value, currency) => `${CURRENCIES[currency].symbol}${Math.round(value || 0).toLocaleString()}`;