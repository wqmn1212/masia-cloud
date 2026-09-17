export const isUsdQuote = (quote) => Number(quote.exchange_rate_usd_cny) > 0;

export function toUSD(value, currency = 'CNY', usdToKrw = 0, usdToCny = 0) {
  const amount = Number(value) || 0;
  if (currency === 'USD') return amount;
  const rate = Number(currency === 'KRW' ? usdToKrw : usdToCny);
  return rate > 0 ? amount / rate : 0;
}

export function fromUSD(value, currency = 'USD', usdToKrw = 0, usdToCny = 0) {
  const amount = Number(value) || 0;
  if (currency === 'USD') return amount;
  return amount * (Number(currency === 'KRW' ? usdToKrw : usdToCny) || 0);
}

export function calculateQuote(form) {
  const usdToKrw = Number(form.exchange_rate_usd) || 0;
  const usdToCny = Number(form.exchange_rate_usd_cny) || 0;
  const options = form.quote_options || [];
  const optionBaseUSD = options.reduce((sum, option) => sum + (Number(option.quantity) || 0) * toUSD(option.unit_price, option.currency || 'CNY', usdToKrw, usdToCny), 0);
  const optionMarginUSD = options.reduce((sum, option) => sum + (Number(option.quantity) || 0) * toUSD(option.unit_price, option.currency || 'CNY', usdToKrw, usdToCny) * (Number(option.margin_percent) || 0) / 100, 0);
  const factoryUSD = options.length ? optionBaseUSD : toUSD(form.factory_total_cost, form.factory_cost_currency || 'CNY', usdToKrw, usdToCny);
  const logisticsUSD = toUSD(form.logistics_cost, form.logistics_cost_currency || 'CNY', usdToKrw, usdToCny);
  const baseUSD = factoryUSD + logisticsUSD;
  const feeUSD = form.masir_fee_type === 'PERCENT' ? baseUSD * (Number(form.masir_fee_value) || 0) / 100 : Number(form.masir_fee_value) || 0;
  const totalUSD = Math.round((baseUSD + optionMarginUSD + feeUSD) * 100) / 100;
  return { optionBaseUSD, optionMarginUSD, factoryUSD, logisticsUSD, baseUSD, feeUSD, totalUSD, factoryCNY: factoryUSD * usdToCny, logisticsCNY: logisticsUSD * usdToCny };
}

export function quotePriceLabel(quote) {
  const symbol = isUsdQuote(quote) ? '$' : '¥';
  return `${symbol}${Number(quote.final_client_price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}