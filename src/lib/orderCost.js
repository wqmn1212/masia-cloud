import { clientLines, isLogisticsLine } from './quoteCompare.js';

// 주문별 '한국 도착 원가' 확정 (부가세 제외, 원화 기준).
// 고객이 실제로 낸 돈만 다룬다: 상품 대금(결제 단계·고객 견적가) + 별도 물류비 + 한국에서 따로 낸 돈(선적별 실제·예상).
// 공장 원가·마진은 넣지 않는다. 화면(직원 확정 창·고객 상품 원가)과 검산 스크립트가 같은 모듈을 쓴다.

export const LINE_KIND = { GOODS: 'GOODS', LOGISTICS: 'LOGISTICS', DEST: 'DEST', OTHER: 'OTHER' };
export const LINE_SOURCE = { PAYMENT: 'PAYMENT', QUOTE: 'QUOTE', SHIPMENT_ACTUAL: 'SHIPMENT_ACTUAL', SHIPMENT_ESTIMATE: 'SHIPMENT_ESTIMATE', MANUAL: 'MANUAL' };
export const CURRENCIES = ['KRW', 'USD', 'CNY'];
const STAGE_LABEL = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };
const STAGE_ORDER = ['DOWN_PAYMENT', 'INTERIM_PAYMENT', 'BALANCE_PAYMENT'];
const DONE_SHIPMENT = ['ARRIVED', 'CUSTOMS', 'CLEARED', 'DELIVERED'];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v) => Math.round(v);
// 개당 금액: 1,000원 미만(소모품·부자재)은 소수 둘째 자리까지 남긴다. 반올림으로 변동이 사라지지 않게.
export const roundUnit = (v) => (Math.abs(v) < 1000 ? Math.round(v * 100) / 100 : Math.round(v));
// 원화 표기: 1,000원 미만의 소수 금액만 소수 둘째 자리까지
export const fmtWon = (v) => {
  const n = num(v);
  const small = Math.abs(n) < 1000 && Math.round(n * 100) % 100 !== 0;
  return `${n.toLocaleString('ko-KR', small ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}원`;
};
let seq = 0;
export const lineKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

// ── 환율 ───────────────────────────────────────────────────────
// ExchangeRate 기록 중 그 날짜 이전(같은 날 포함) 가장 가까운 것. 없으면 가장 오래된 것, 기록이 없으면 null.
export function rateOn(rates = [], date) {
  const list = [...rates].filter((r) => r?.rate_date).sort((a, b) => a.rate_date.localeCompare(b.rate_date));
  if (!list.length) return null;
  if (!date) return list[list.length - 1];
  let hit = null;
  for (const r of list) { if (r.rate_date <= date) hit = r; else break; }
  return hit || list[0];
}

// 1 단위 통화 = ? 원
export function krwPer(currency, rate) {
  if (currency === 'KRW') return 1;
  if (!rate) return null;
  if (currency === 'USD') return num(rate.usd_krw) || null;
  if (currency === 'CNY') return num(rate.cny_krw) || (num(rate.usd_krw) && num(rate.usd_cny) ? num(rate.usd_krw) / num(rate.usd_cny) : null);
  return null;
}

// 견적서에 적힌 환율로 1 단위 = ? 원 (환율 기록이 없을 때 대신 쓴다)
function quoteKrwPer(currency, q) {
  if (currency === 'KRW') return 1;
  const usdKrw = num(q?.exchange_rate_usd); const usdCny = num(q?.exchange_rate_usd_cny);
  if (currency === 'USD') return usdKrw || null;
  if (currency === 'CNY') return num(q?.exchange_rate_krw) || (usdKrw && usdCny ? usdKrw / usdCny : null);
  return null;
}

// ── 수량 ───────────────────────────────────────────────────────
// 고객 견적서에서 금액이 가장 큰 품목 줄(물류비 줄 제외)의 수량. 장비처럼 1대면 1.
export function quoteUnits(q) {
  const c = clientLines(q || {});
  const main = c.lines.filter((l) => !isLogisticsLine(l.name, l.spec)).sort((a, b) => num(b.total) - num(a.total))[0];
  return Math.max(1, num(main?.qty) || 1);
}

// ── 확정 창 기본값 ─────────────────────────────────────────────
// quotation: 승인된 견적, stages: PaymentStage, shipments: Shipment, rates: ExchangeRate
export function buildPrefill({ card = {}, quotation = null, stages = [], shipments = [], rates = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  const lines = [];
  const warnings = [];
  const client = quotation ? clientLines(quotation) : null;
  const quoteTotal = client?.priced ? client.total : 0;
  const quoteCur = client?.currency || 'USD';
  const fxFor = (cur, date) => {
    const fromTable = krwPer(cur, rateOn(rates, date || today));
    if (fromTable) return { fx: fromTable, basis: date || today };
    const fromQuote = quoteKrwPer(cur, quotation);
    return fromQuote ? { fx: fromQuote, basis: quotation?.exchange_rate_date || '견적서 환율' } : { fx: null, basis: '' };
  };

  // 상품 대금: 결제 단계별로 나눠 각 입금일 환율을 쓴다. 금액이 비어 있으면 견적가 × 비율.
  const sorted = [...stages].sort((a, b) => STAGE_ORDER.indexOf(a.stage_type) - STAGE_ORDER.indexOf(b.stage_type));
  if (sorted.length) {
    for (const s of sorted) {
      const hasAmount = num(s.amount) > 0;
      const amount = hasAmount ? num(s.amount) : quoteTotal * num(s.percentage) / 100;
      const currency = hasAmount ? (s.currency || quoteCur) : quoteCur;
      if (!amount) continue;
      const paid = s.approval_status === 'APPROVED';
      const { fx, basis } = fxFor(currency, paid ? s.paid_date : null);
      lines.push({
        key: lineKey(), kind: LINE_KIND.GOODS, label: `상품 대금 · ${STAGE_LABEL[s.stage_type] || s.stage_type} ${num(s.percentage)}%`,
        amount, currency, fx, fx_basis: basis, source: hasAmount && paid ? LINE_SOURCE.PAYMENT : LINE_SOURCE.QUOTE,
        estimated: !paid, one_time: false, ref_id: s.id,
      });
      if (!paid) warnings.push('UNPAID_STAGE');
      if (!hasAmount) warnings.push('STAGE_NO_AMOUNT');
    }
    const pct = sorted.reduce((t, s) => t + num(s.percentage), 0);
    if (Math.abs(pct - 100) > 0.5) warnings.push('STAGE_PCT');
  } else if (quoteTotal) {
    const { fx, basis } = fxFor(quoteCur, card.advance_paid_date);
    lines.push({ key: lineKey(), kind: LINE_KIND.GOODS, label: '상품 대금 (견적가)', amount: quoteTotal, currency: quoteCur, fx, fx_basis: basis, source: LINE_SOURCE.QUOTE, estimated: false, one_time: false, ref_id: quotation?.id || '' });
    warnings.push('NO_STAGES');
  }

  // 견적 합계 밖의 별도 물류비
  if (client?.separate) {
    const { fx, basis } = fxFor(client.separate.currency, card.advance_paid_date);
    lines.push({ key: lineKey(), kind: LINE_KIND.LOGISTICS, label: '물류비 (견적서 별도)', amount: client.separate.amount, currency: client.separate.currency, fx, fx_basis: basis, source: LINE_SOURCE.QUOTE, estimated: false, one_time: false, ref_id: quotation?.id || '' });
  }

  // 한국에서 따로 낸 돈: 실제 청구액이 있으면 그 값, 없으면 고객에게 보낸 예상액
  let vat = 0;
  for (const s of shipments) {
    const label = s.label || '선적';
    if (s.dest_cost_actual != null && s.dest_cost_actual !== '') {
      lines.push({ key: lineKey(), kind: LINE_KIND.DEST, label: `한국 도착 비용 · ${label}`, amount: num(s.dest_cost_actual), currency: 'KRW', fx: 1, fx_basis: '', source: LINE_SOURCE.SHIPMENT_ACTUAL, estimated: false, one_time: false, ref_id: s.id });
      vat += num(s.dest_cost_actual_vat);
    } else if (s.dest_cost_estimate && s.dest_cost_sent_at) {
      lines.push({ key: lineKey(), kind: LINE_KIND.DEST, label: `한국 도착 비용 · ${label} (예상)`, amount: round(num(s.dest_cost_estimate.buyer_ex_vat)), currency: 'KRW', fx: 1, fx_basis: '', source: LINE_SOURCE.SHIPMENT_ESTIMATE, estimated: true, one_time: false, ref_id: s.id });
      vat += num(s.dest_cost_estimate.buyer_vat);
      warnings.push('DEST_ESTIMATE');
    } else {
      warnings.push('DEST_MISSING');
    }
  }
  if (!shipments.length) warnings.push('NO_SHIPMENT');
  if (client?.separate && lines.some((l) => l.kind === LINE_KIND.DEST)) warnings.push('DOUBLE_FREIGHT');
  if (lines.some((l) => l.fx == null)) warnings.push('NO_FX');

  const paidDates = stages.filter((s) => s.approval_status === 'APPROVED' && s.paid_date).map((s) => s.paid_date).sort();
  return {
    units: quotation ? quoteUnits(quotation) : 1,
    unit_label: '개',
    order_date: paidDates[0] || card.advance_paid_date || today,
    quotation_id: quotation?.id || '',
    vat_krw: round(vat),
    lines,
    warnings: [...new Set(warnings)],
    ready: shipments.length > 0 && shipments.every((s) => DONE_SHIPMENT.includes(s.status)),
  };
}

// ── 합계 ───────────────────────────────────────────────────────
export function lineKrw(l) {
  const fx = l.currency === 'KRW' ? 1 : num(l.fx);
  return fx ? round(num(l.amount) * fx) : null;
}

// 화면에서 고친 줄로 합계를 다시 낸다. 저장할 레코드 필드 그대로 돌려준다.
export function summarize({ lines = [], units = 1 } = {}) {
  const u = Math.max(1, num(units) || 1);
  const out = lines.map((l) => ({ ...l, amount_krw: lineKrw(l) }));
  const missingFx = out.some((l) => l.amount_krw == null);
  const sum = (pred) => out.filter(pred).reduce((t, l) => t + (l.amount_krw || 0), 0);
  const recurring = (l) => !l.one_time;
  const goods = sum((l) => recurring(l) && l.kind === LINE_KIND.GOODS);
  const logistics = sum((l) => recurring(l) && (l.kind === LINE_KIND.LOGISTICS || l.kind === LINE_KIND.DEST));
  const other = sum((l) => recurring(l) && l.kind === LINE_KIND.OTHER);
  const oneTime = sum((l) => l.one_time);
  const total = goods + logistics + other;
  // 상품 대금이 한 통화로만 나갔으면 외화 금액을 남겨 환율 영향을 나눌 수 있게 한다
  const goodsLines = out.filter((l) => recurring(l) && l.kind === LINE_KIND.GOODS);
  const curSet = new Set(goodsLines.map((l) => l.currency));
  const goodsForeign = curSet.size === 1 && !curSet.has('KRW')
    ? { currency: [...curSet][0], amount: goodsLines.reduce((t, l) => t + num(l.amount), 0) } : null;
  return {
    lines: out, units: u, missing_fx: missingFx,
    goods_krw: goods, logistics_krw: logistics, other_krw: other, one_time_krw: oneTime, total_krw: total,
    per_unit_krw: roundUnit(total / u),
    goods_foreign: goodsForeign,
    estimated: out.some((l) => l.estimated && !l.one_time),
  };
}

// ── 고객 화면: 상품별 묶음과 변동 원인 ───────────────────────────
// 같은 통화로 산 두 주문의 개당 원가 차이를 단가·환율·물류·기타로 나눈다. 네 값의 합 = 개당 차이.
export function explainChange(prev, cur) {
  if (!prev || !cur) return null;
  const pu = (r, k) => num(r[k]) / Math.max(1, num(r.units) || 1);
  const diff = Math.round((num(cur.per_unit_krw) - num(prev.per_unit_krw)) * 100) / 100;
  const logistics = pu(cur, 'logistics_krw') - pu(prev, 'logistics_krw');
  const goodsDiff = pu(cur, 'goods_krw') - pu(prev, 'goods_krw');
  let price = goodsDiff; let fx = null;
  const a = prev.goods_foreign; const b = cur.goods_foreign;
  if (a && b && a.currency === b.currency && num(a.amount) > 0 && num(b.amount) > 0) {
    const fxA = num(prev.goods_krw) / num(a.amount); const fxB = num(cur.goods_krw) / num(b.amount);
    const fA = num(a.amount) / Math.max(1, num(prev.units) || 1); const fB = num(b.amount) / Math.max(1, num(cur.units) || 1);
    price = (fB - fA) * fxA;
    fx = fB * (fxB - fxA);
  }
  // 기타 = 기타 비용 변동 + 반올림 차이 (합이 정확히 맞게)
  const r = num(prev.per_unit_krw) < 1000 ? (v) => Math.round(v * 100) / 100 : round;
  const parts = { price: r(price), fx: fx == null ? null : r(fx), logistics: r(logistics) };
  return {
    diff, pct: num(prev.per_unit_krw) ? diff / num(prev.per_unit_krw) : null,
    ...parts, other: r(diff - parts.price - (parts.fx || 0) - parts.logistics),
    currency: b?.currency || null,
    fx_from: a && b && a.currency === b.currency ? num(prev.goods_krw) / num(a.amount) : null,
    fx_to: a && b && a.currency === b.currency ? num(cur.goods_krw) / num(b.amount) : null,
  };
}

// 확정 기록을 상품별로 묶어 주문일 순으로 정렬하고, 최신 주문의 변동 원인을 붙인다.
export function groupByProduct(records = []) {
  const map = new Map();
  for (const r of records) {
    const k = r.product_key || r.card_id;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([key, list]) => {
    const orders = [...list].sort((a, b) => String(a.order_date || '').localeCompare(String(b.order_date || '')) || String(a.confirmed_at || '').localeCompare(String(b.confirmed_at || '')));
    const latest = orders[orders.length - 1];
    const prev = orders.length > 1 ? orders[orders.length - 2] : null;
    const perUnits = orders.map((o) => num(o.per_unit_krw));
    return {
      key, name: latest.product_name || '상품', unit_label: latest.unit_label || '개',
      orders, latest, prev, change: explainChange(prev, latest),
      min: Math.min(...perUnits), max: Math.max(...perUnits),
    };
  }).sort((a, b) => String(b.latest.order_date || '').localeCompare(String(a.latest.order_date || '')));
}

// 재주문 체인의 처음 카드 = 상품 키. cardsById 에 없는 카드에서 멈춘다.
export function rootCardId(card, cardsById = new Map()) {
  let cur = card; const seen = new Set();
  while (cur?.reorder_of && !seen.has(cur.id)) {
    seen.add(cur.id);
    const parent = cardsById.get(cur.reorder_of);
    if (!parent) return cur.reorder_of;
    cur = parent;
  }
  return cur?.id || '';
}

export const WARNING_TEXT = {
  UNPAID_STAGE: '입금 확인 전인 결제 단계가 있어 오늘 환율로 계산했습니다',
  STAGE_NO_AMOUNT: '금액이 비어 있는 결제 단계는 견적가 × 비율로 넣었습니다',
  STAGE_PCT: '결제 단계 비율 합이 100%가 아닙니다',
  NO_STAGES: '결제 단계가 없어 견적가 전체를 상품 대금으로 넣었습니다',
  DEST_ESTIMATE: '실제 청구액이 없는 선적은 고객에게 보낸 예상액을 넣었습니다',
  DEST_MISSING: '한국 도착 비용이 계산되지 않은 선적이 있습니다',
  NO_SHIPMENT: '선적이 없어 한국 도착 비용이 빠졌습니다',
  DOUBLE_FREIGHT: '견적서 별도 물류비와 선적 도착 비용에 같은 운임이 두 번 들어가지 않았는지 확인하세요',
  NO_FX: '환율이 없는 줄이 있습니다. 환율을 넣어야 확정할 수 있습니다',
};
