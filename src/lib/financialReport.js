export const CURRENCIES = {
  CNY: { symbol: '¥', label: 'CNY' },
  USD: { symbol: '$', label: 'USD' },
  KRW: { symbol: '₩', label: 'KRW' },
};

const rates = (quote) => ({ usdKrw: Number(quote.exchange_rate_usd) || 0, usdCny: Number(quote.exchange_rate_usd_cny) || 0, legacyCnyKrw: Number(quote.exchange_rate_krw) || 0 });

export const quoteAmounts = (quote, currency) => {
  const rate = rates(quote);
  const modern = rate.usdCny > 0;
  const revenueUSD = modern ? Number(quote.final_client_price) || Number(quote.final_price_usd) || 0 : rate.usdKrw > 0 && rate.legacyCnyKrw > 0 ? (Number(quote.final_client_price) || 0) * rate.legacyCnyKrw / rate.usdKrw : 0;
  const costUSD = modern ? ((Number(quote.factory_total_cost) || 0) + (Number(quote.logistics_cost) || 0)) / rate.usdCny : rate.usdKrw > 0 && rate.legacyCnyKrw > 0 ? ((Number(quote.factory_total_cost) || 0) + (Number(quote.logistics_cost) || 0)) * rate.legacyCnyKrw / rate.usdKrw : 0;
  const convert = (value) => currency === 'USD' ? value : currency === 'KRW' ? value * rate.usdKrw : value * (modern ? rate.usdCny : rate.usdKrw / rate.legacyCnyKrw);
  return { revenue: convert(revenueUSD), margin: convert(Math.max(0, revenueUSD - costUSD)) };
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