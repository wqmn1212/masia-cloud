// 견적 승인: 고객에게 보내기 전 요약(고객 금액·원가·마진)과 확인 항목, 보낼 수 있는 상태, 관리자 승인함 목록.
// 서버 함수 quoteApproval 이 쓰고, 화면은 그 결과를 그대로 보여 준다. 검산: npm run check:quote-approval
export const MIN_MARGIN_PCT = 10;
// 고객에게 보낼 수 있는 상태 (발송됨인데 고객 공개가 빠진 예전 견적도 다시 보낼 수 있다)
export const SENDABLE = ['DRAFT', 'REVIEW', 'APPROVED', 'SENT'];

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
function toUSD(value: any, currency = 'CNY', usdToKrw = 0, usdToCny = 0): number | null {
  const amount = num(value);
  if (!amount) return 0;
  if (currency === 'USD') return amount;
  const rate = num(currency === 'KRW' ? usdToKrw : usdToCny);
  return rate > 0 ? amount / rate : null;
}
const DAY = 86400000;
const addDays = (ymd: string, d: number) => new Date(Date.parse(ymd) + d * DAY).toISOString().slice(0, 10);

// 저장된 견적의 고객 금액 (견적 통화)
export function clientTotal(q: any) {
  if (q.rounding_version === 2 && q.final_total != null) return { amount: num(q.final_total), currency: q.final_currency || 'USD' };
  return { amount: num(q.final_client_price), currency: num(q.exchange_rate_usd_cny) > 0 ? 'USD' : 'CNY' };
}

// 고객 금액·원가·마진 (수수료 포함 총 마진). 물류비 별도 견적은 양쪽에서 물류비를 뺀다. 선택 사양은 빼고 센다
export function quoteSummary(q: any) {
  const krw = num(q.exchange_rate_usd), cny = num(q.exchange_rate_usd_cny);
  const total = clientTotal(q);
  const totalUSD = toUSD(total.amount, total.currency, krw, cny);
  const options = (q.quote_options || []).filter((o: any) => !o.optional && (o.option_name || num(o.unit_price)));
  let costUSD: number | null = 0;
  const add = (v: number | null) => { costUSD = costUSD == null || v == null ? null : costUSD + v; };
  if (options.length) for (const o of options) { const u = toUSD(o.unit_price, o.currency || 'CNY', krw, cny); add(u == null ? null : u * num(o.quantity)); }
  else add(toUSD(q.factory_total_cost, q.factory_cost_currency || 'CNY', krw, cny));
  if (!q.logistics_separate) add(toUSD(q.logistics_cost, q.logistics_cost_currency || 'CNY', krw, cny));
  const margin = totalUSD && costUSD ? Math.round(((totalUSD - costUSD) / totalUSD) * 1000) / 10 : null;
  return {
    total: total.amount,
    currency: total.currency,
    total_usd: totalUSD == null ? null : Math.round(totalUSD * 100) / 100,
    cost_usd: costUSD == null ? null : Math.round(costUSD * 100) / 100,
    margin_pct: margin,
    lead_time_business_days: num(q.lead_time_business_days) || null,
    shipping_days: num(q.shipping_days) || null,
    validity_days: num(q.validity_days) || null,
    payment_terms_pending: !!q.payment_terms_pending,
    optional_count: (q.quote_options || []).filter((o: any) => o.optional).length,
    manual: num(q.manual_total) > 0,
  };
}

// 보내기 전 확인 항목. block 이 하나라도 있으면 보낼 수 없다
// rule: 마진 규칙(marginRule.ts resolveMargin). 없으면 앱 기본 최소 마진
export function reviewChecks(q: any, card: any, today: string, rule: any = null) {
  const minPct = rule?.min_pct ?? MIN_MARGIN_PCT;
  const minLabel = rule?.min_label && rule.min_source !== 'BASE' ? `${rule.min_label} ${minPct}%` : `${minPct}%`;
  const s = quoteSummary(q);
  const out: { level: 'block' | 'warn' | 'info'; code: string; text: string }[] = [];
  const push = (level: 'block' | 'warn' | 'info', code: string, text: string) => out.push({ level, code, text });
  if (!SENDABLE.includes(q.status)) push('block', 'status', q.status === 'ACCEPTED' ? '이미 수주 완료된 견적입니다' : '고객이 거절한 견적입니다. 복사해 새 견적으로 보내세요');
  if (!(s.total > 0)) push('block', 'no_total', '고객 금액이 없습니다');
  if (!card) push('block', 'no_card', '업무 카드에 연결되지 않은 견적입니다');
  else if (!card.client_id) push('block', 'no_client', '카드에 고객사가 연결되지 않았습니다. 문의 접수에서 고객사 팀을 먼저 발급하세요');
  else if (!card.client_visible) push('block', 'card_hidden', '카드가 고객에게 공개되지 않았습니다. 카드를 먼저 고객에게 공개하세요');
  if (s.total > 0 && s.total_usd == null) push('warn', 'no_rate', '환율이 없어 원가·마진을 계산하지 못했습니다');
  else if (!s.cost_usd) push('warn', 'no_cost', '공장 원가가 비어 있어 마진을 확인할 수 없습니다');
  else if (s.margin_pct != null && s.margin_pct < 0) push('warn', 'loss', `고객 금액이 원가보다 낮습니다 (마진 ${s.margin_pct}%)`);
  else if (s.margin_pct != null && s.margin_pct < minPct) push('warn', 'low_margin', `마진이 ${s.margin_pct}%로 기준(${minLabel})보다 낮습니다`);
  if (!s.lead_time_business_days && !s.shipping_days) push('warn', 'no_lead', '납기가 비어 있습니다');
  if (!s.validity_days) push('warn', 'no_validity', '견적 유효기간이 비어 있습니다');
  else if (q.factory_quote_date && addDays(q.factory_quote_date, s.validity_days) < today) push('warn', 'factory_expired', `공장 견적일(${q.factory_quote_date}) 기준 유효기간이 지났습니다. 공장에 가격을 다시 확인하세요`);
  if (s.payment_terms_pending) push('info', 'payment_pending', '결제 조건: 계약 시 확정으로 보냅니다');
  if (s.manual) push('info', 'manual', `금액 직접 수정${q.manual_reason ? `: ${q.manual_reason}` : ''}`);
  if (s.optional_count) push('info', 'optional', `선택 사양 ${s.optional_count}개는 합계에 넣지 않고 따로 표시합니다`);
  return out;
}

export const canSend = (checks: { level: string }[]) => !checks.some((c) => c.level === 'block');
export const isPublished = (q: any) => !!q.client_published_at;

// 끝난 카드: 그 견적은 승인함에 올리지 않는다 (예전에는 '검토 중'을 진행 표시로도 썼다)
export const CLOSED_CARD = ['DONE', 'CANCELLED'];

// 관리자 승인함: 검토 요청된 견적(오래된 순)과, 발송됨인데 고객 공개가 빠진 견적.
// 카드가 없거나(지워짐) 완료·취소된 카드의 견적은 뺀다
// ruleFor(card): 카드의 마진 규칙 (없으면 앱 기본 최소 마진)
export function approvalQueue(quotes: any[], cards: Record<string, any>, today: string, ruleFor: (card: any) => any = () => null) {
  quotes = quotes.filter((q) => cards[q.card_id] && !CLOSED_CARD.includes(cards[q.card_id].status));
  const row = (q: any) => {
    const card = cards[q.card_id] || null;
    const checks = reviewChecks(q, card, today, card ? ruleFor(card) : null);
    return {
      id: q.id, card_id: q.card_id || '', card_title: card?.title || '', client_name: card?.client_name || q.client_name || '',
      quote_title: q.quote_title || q.product_name || q.factory_name || '견적서', factory_name: q.factory_name || '', status: q.status,
      requested_at: q.review_requested_at || '', requested_by_name: q.review_requested_by_name || '', review_note: q.review_note || '',
      updated_date: q.updated_date || '', summary: quoteSummary(q), checks, can_send: canSend(checks),
    };
  };
  const review = quotes.filter((q) => q.status === 'REVIEW' && !isPublished(q))
    .sort((a, b) => String(a.review_requested_at || a.updated_date || '').localeCompare(String(b.review_requested_at || b.updated_date || ''))).map(row);
  const unsent = quotes.filter((q) => ['SENT', 'APPROVED'].includes(q.status) && !isPublished(q)).map(row);
  return { review, unsent };
}
