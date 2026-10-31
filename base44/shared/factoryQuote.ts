// 공장 업로드 링크로 받은 견적서 → 견적 초안. 서버 함수 importFactoryQuote 가 쓴다. 검산: npm run check:factory-quote
//  - 읽을 제출물: 견적서(QUOTE) 항목의 파일 중 아직 초안을 만들지 않았고, 실패하지 않았고, 다른 실행이 막 집어 가지 않은 것
//  - 초안은 공장 원가 그대로(수수료 없음, 항목 마진은 importFactoryQuote 가 팀 마진 규칙으로 채움), 상태 DRAFT. 직원이 마진을 넣고 '검토 요청' → 팀 관리자 승인으로 이어진다
export const CLAIM_MINUTES = 10;
const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];
const s = (v: any, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const subKey = (sub: any) => `${sub.item_key}|${sub.submitted_at}|${sub.file_uri}`;
export const sameSub = (a: any, b: any) => subKey(a) === subKey(b);

export function pendingQuoteSubs(req: any, now = new Date(), { retry = false } = {}) {
  const quoteKeys = new Set((req?.items || []).filter((i: any) => i.kind === 'QUOTE').map((i: any) => i.key));
  return (req?.submissions || []).filter((sub: any) => {
    if (!quoteKeys.has(sub.item_key) || !sub.file_uri || sub.quotation_id) return false;
    if (sub.import_error && !retry) return false;
    if (sub.import_started_at && !sub.import_error && now.getTime() - Date.parse(sub.import_started_at) < CLAIM_MINUTES * 60000) return false;
    return true;
  });
}

// 제출물들에 표시를 붙인 새 submissions 배열
export function markSubs(req: any, targets: any[], patch: Record<string, any>) {
  return (req.submissions || []).map((sub: any) => (targets.some((t) => sameSub(t, sub)) ? { ...sub, ...patch } : sub));
}

/**
 * 읽은 결과(normalizeImport) → Quotation 레코드.
 * rates: 최신 ExchangeRate ({ rate_date, usd_krw, usd_cny }) 가 있으면 넣어 바로 마진을 볼 수 있게 한다
 */
export function draftQuotation(normalized: any, { card, request, sub, rates }: { card: any; request: any; sub: any; rates?: any }) {
  const f = normalized?.form || {};
  const options = (f.quote_options || []).slice(0, 100).map((o: any) => ({
    option_name: s(o.option_name), option_name_cn: s(o.option_name_cn), specification: s(o.specification, 500), specification_cn: s(o.specification_cn, 500),
    quantity: num(o.quantity), unit_label: s(o.unit_label, 20), unit_price: num(o.unit_price),
    currency: ['CNY', 'USD', 'KRW'].includes(o.currency) ? o.currency : 'CNY', optional: o.optional === true, lead_time: s(o.lead_time, 100),
  })).filter((o: any) => o.option_name || o.unit_price);
  const factory = s(request?.factory_name) || s(f.factory_name) || s(card?.factory_name) || '공장';
  const checks = (normalized?.checks || []).filter((c: any) => c.level !== 'info').map((c: any) => `· ${c.text}`);
  const record: any = {
    tenant_id: card.tenant_id, card_id: card.id, status: 'DRAFT',
    client_id: card.client_id || '', client_name: card.client_name || '',
    // 카드의 공장과 다른 공장에서 받은 견적이면 카드의 공장 ID 를 붙이지 않는다
    factory_id: request?.factory_id || (factory === card.factory_name ? card.factory_id || '' : ''), factory_name: factory,
    product_name: s(f.product_name), model_name: s(f.model_name),
    quote_title: s(f.quote_title) || s(f.product_name) || `${card.title} (${factory})`,
    quote_options: options,
    factory_request_id: request?.id || '',
    internal_notes: [
      `공장 업로드 링크로 받은 견적서: ${s(sub?.file_name) || '파일'} (${String(sub?.submitted_at || '').slice(0, 10)})`,
      s(sub?.answer, 1000) ? `공장 메모: ${s(sub.answer, 1000)}` : '',
      checks.length ? `읽기 확인:\n${checks.join('\n')}` : '',
      s(f.internal_notes, 2000),
    ].filter(Boolean).join('\n'),
  };
  if (INCOTERMS.includes(s(f.incoterms, 10).toUpperCase())) record.incoterms = s(f.incoterms, 10).toUpperCase();
  if (num(f.logistics_cost) > 0) { record.logistics_cost = num(f.logistics_cost); record.logistics_cost_currency = f.factory_cost_currency || 'CNY'; }
  if ((f.spec_table || []).length) record.spec_table = f.spec_table.slice(0, 40);
  if (s(f.remarks, 3000)) record.remarks = s(f.remarks, 3000);
  if (num(f.lead_time_business_days) > 0) record.lead_time_business_days = Math.round(num(f.lead_time_business_days));
  else if (num(f.shipping_days) > 0) record.shipping_days = Math.round(num(f.shipping_days));
  if (num(f.validity_days) > 0) record.validity_days = Math.round(num(f.validity_days));
  if (f.payment_terms_pending === true) record.payment_terms_pending = true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s(f.factory_quote_date, 10))) record.factory_quote_date = s(f.factory_quote_date, 10);
  const included = options.filter((o: any) => !o.optional);
  const cur = included[0]?.currency || f.factory_cost_currency || 'CNY';
  if (included.length && included.every((o: any) => o.currency === cur)) {
    record.factory_total_cost = Math.round(included.reduce((t: number, o: any) => t + o.quantity * o.unit_price, 0) * 100) / 100;
    record.factory_cost_currency = cur;
  }
  if (num(rates?.usd_cny) > 0 && num(rates?.usd_krw) > 0) {
    record.exchange_rate_usd_cny = num(rates.usd_cny);
    record.exchange_rate_usd = num(rates.usd_krw);
    if (rates.rate_date) record.exchange_rate_date = rates.rate_date;
  }
  return record;
}

// 직원 알림에 넣을 한 줄: 품목 수·공장 원가 합계·납기
export function draftLine(record: any) {
  const sym: Record<string, string> = { CNY: '¥', USD: '$', KRW: '₩' };
  const items = (record.quote_options || []).filter((o: any) => !o.optional).length;
  const extra = (record.quote_options || []).length - items;
  return [
    `품목 ${items}개${extra ? ` (+선택 사양 ${extra}개)` : ''}`,
    record.factory_total_cost ? `공장 원가 ${sym[record.factory_cost_currency] || ''}${Number(record.factory_total_cost).toLocaleString('en-US')}` : '',
    record.lead_time_business_days ? `납기 ${record.lead_time_business_days}영업일` : record.shipping_days ? `납기 ${record.shipping_days}일` : '',
  ].filter(Boolean).join(' · ');
}
