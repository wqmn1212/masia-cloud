export const isUsdQuote = (quote) => Number(quote.exchange_rate_usd_cny) > 0;

// 통화별 표기 단위: USD $0.01 · CNY ¥0.1 · KRW ₩1
export const CURRENCY_DIGITS = { USD: 2, CNY: 1, KRW: 0 };
export const CURRENCY_SYMBOL = { USD: '$', CNY: '¥', KRW: '₩' };
const factorOf = (cur) => 10 ** (CURRENCY_DIGITS[cur] ?? 2);

// 표기 단위로 올림. 1.1 × 100 같은 부동소수 오차는 1e-9 만큼 빼고 올린다.
export function ceilToUnit(value, cur = 'USD') {
  const f = factorOf(cur);
  return Math.ceil((Number(value) || 0) * f - 1e-9) / f;
}
// 단위 값끼리 곱·합할 때 생기는 오차만 정리 (이미 단위에 맞는 값 전용)
const tidy = (value, cur) => Math.round(value * factorOf(cur)) / factorOf(cur);

export const formatMoney = (value, cur = 'USD') => {
  const d = CURRENCY_DIGITS[cur] ?? 2;
  return `${CURRENCY_SYMBOL[cur] || '$'}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
};

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

// 견적 통화 금액을 다른 통화 참고 금액으로: 환산 후 그 통화 단위로 올림
export function convertAmount(value, from, to, usdToKrw = 0, usdToCny = 0) {
  if (from === to) return Number(value) || 0;
  const usd = toUSD(value, from, usdToKrw, usdToCny);
  if (to !== 'USD' && !(Number(to === 'KRW' ? usdToKrw : usdToCny) > 0)) return null;
  return ceilToUnit(fromUSD(usd, to, usdToKrw, usdToCny), to);
}

export function quoteCurrencyOf(form) {
  const cur = form.final_currency || 'USD';
  const rate = cur === 'KRW' ? Number(form.exchange_rate_usd) : cur === 'CNY' ? Number(form.exchange_rate_usd_cny) : 1;
  return rate > 0 ? cur : 'USD';
}

export function calculateQuote(form) {
  const usdToKrw = Number(form.exchange_rate_usd) || 0;
  const usdToCny = Number(form.exchange_rate_usd_cny) || 0;
  const cur = quoteCurrencyOf(form);
  const inCur = (v, c) => fromUSD(toUSD(v, c || 'CNY', usdToKrw, usdToCny), cur, usdToKrw, usdToCny);
  const options = (form.quote_options || []).filter((o) => o.option_name || Number(o.unit_price));

  const optionBaseUSD = options.reduce((s, o) => s + (Number(o.quantity) || 0) * toUSD(o.unit_price, o.currency || 'CNY', usdToKrw, usdToCny), 0);
  const optionMarginUSD = options.reduce((s, o) => s + (Number(o.quantity) || 0) * toUSD(o.unit_price, o.currency || 'CNY', usdToKrw, usdToCny) * (Number(o.margin_percent) || 0) / 100, 0);
  const factoryUSD = options.length ? optionBaseUSD : toUSD(form.factory_total_cost, form.factory_cost_currency || 'CNY', usdToKrw, usdToCny);
  const rawLogisticsUSD = toUSD(form.logistics_cost, form.logistics_cost_currency || 'CNY', usdToKrw, usdToCny);
  // 물류비 별도 표시: 제품 금액·수수료 계산에서 빼고 따로 보여 준다
  const separate = !!form.logistics_separate;
  const logisticsUSD = separate ? 0 : rawLogisticsUSD;
  const logisticsTotal = separate && rawLogisticsUSD > 0 ? ceilToUnit(fromUSD(rawLogisticsUSD, cur, usdToKrw, usdToCny), cur) : null;
  const baseUSD = factoryUSD + logisticsUSD;
  const feeUSD = form.masir_fee_type === 'PERCENT' ? baseUSD * (Number(form.masir_fee_value) || 0) / 100 : Number(form.masir_fee_value) || 0;

  // 수수료는 각 품목 단가에 비율로 녹여 넣은 뒤 올린다 (고객 화면에 수수료 줄을 따로 두지 않음)
  const preFeeUSD = factoryUSD + optionMarginUSD + logisticsUSD;
  const feeFactor = preFeeUSD > 0 ? 1 + feeUSD / preFeeUSD : 1;
  const lines = [];
  if (options.length) {
    options.forEach((o) => {
      const qty = Number(o.quantity) || 0;
      const unit = ceilToUnit(inCur(o.unit_price, o.currency) * (1 + (Number(o.margin_percent) || 0) / 100) * feeFactor, cur);
      lines.push({ option_name: o.option_name || '', specification: o.specification || '', quantity: qty, unit_price: unit, total: tidy(unit * qty, cur) });
    });
  } else if (factoryUSD > 0) {
    const unit = ceilToUnit(fromUSD(factoryUSD, cur, usdToKrw, usdToCny) * feeFactor, cur);
    lines.push({ option_name: form.product_name || '장비 본체 일체', specification: form.model_name || '-', quantity: 1, unit_price: unit, total: unit });
  }
  if (logisticsUSD > 0) {
    const unit = ceilToUnit(fromUSD(logisticsUSD, cur, usdToKrw, usdToCny) * feeFactor, cur);
    lines.push({ option_name: '물류비 (Logistics & Shipping)', specification: form.incoterms || '-', quantity: 1, unit_price: unit, total: unit });
  }
  if (!lines.length && feeUSD > 0) {
    const unit = ceilToUnit(fromUSD(feeUSD, cur, usdToKrw, usdToCny), cur);
    lines.push({ option_name: form.product_name || '서비스 수수료', specification: '-', quantity: 1, unit_price: unit, total: unit });
  }
  const autoTotal = tidy(lines.reduce((s, l) => s + l.total, 0), cur);

  const manual = Number(form.manual_total) > 0 ? ceilToUnit(form.manual_total, cur) : null;
  const total = manual ?? autoTotal;
  // 직접 입력 시: 옵션 원가 대비 필요한 평균 마진% 역산 (물류·수수료 제외)
  const optionBaseCur = fromUSD(factoryUSD, cur, usdToKrw, usdToCny);
  const restCur = fromUSD(logisticsUSD + feeUSD, cur, usdToKrw, usdToCny);
  const impliedMargin = manual != null && optionBaseCur > 0 ? ((manual - restCur) / optionBaseCur - 1) * 100 : null;
  const totalUSD = toUSD(total, cur, usdToKrw, usdToCny);

  return {
    currency: cur, lines, autoTotal, total, manual, impliedMargin,
    optionBaseUSD, optionMarginUSD, factoryUSD, logisticsUSD, baseUSD, feeUSD, totalUSD,
    factoryCNY: factoryUSD * usdToCny, logisticsCNY: rawLogisticsUSD * usdToCny, logisticsTotal,
  };
}

// 저장된 견적의 최종 금액(견적 통화 기준)
export function quoteTotal(quote) {
  if (quote.rounding_version === 2 && quote.final_total != null) return { amount: Number(quote.final_total), currency: quote.final_currency || 'USD' };
  return { amount: Number(quote.final_client_price || 0), currency: isUsdQuote(quote) ? 'USD' : 'CNY', legacy: true };
}

export function quotePriceLabel(quote) {
  const t = quoteTotal(quote);
  if (!t.legacy) return formatMoney(t.amount, t.currency);
  return `${CURRENCY_SYMBOL[t.currency]}${t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}