import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// AI 비서용 새 견적 등록 (엑셀 견적서 미리보기를 사용자가 승인한 뒤에만 부른다).
// 화면의 견적 등록과 같이 서버에서 팀 범위를 고정하고, 원가 줄만 받는다: 마진·수수료·최종 고객가는 받아도 버린다.
// 상태는 항상 DRAFT, 기존 견적은 고치지 않는다.
const STAFF = ['master', 'service', 'sub'];
const CUR = ['CNY', 'USD', 'KRW'];
const s = (v: any, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!STAFF.includes(user.account_tier) || user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    const card = body.card_id ? await db.TaskCard.get(body.card_id).catch(() => null) : null;
    if (!card || (user.account_tier !== 'master' && card.tenant_id !== user.tenant_id)) return Response.json({ error: '연결할 카드를 찾을 수 없습니다' }, { status: 404 });

    const options = (Array.isArray(body.quote_options) ? body.quote_options : []).slice(0, 100).map((o: any) => ({
      option_name: s(o.option_name), specification: s(o.specification, 500), quantity: n(o.quantity), unit_price: n(o.unit_price),
      currency: CUR.includes(String(o.currency || '').toUpperCase()) ? String(o.currency).toUpperCase() : 'CNY',
      unit_label: s(o.unit_label, 20), optional: o.optional === true,
    })).filter((o: any) => o.option_name || o.unit_price);
    if (!options.length) return Response.json({ error: '견적 품목이 없습니다' }, { status: 400 });
    const lineItems = (Array.isArray(body.line_items) ? body.line_items : []).slice(0, 100).map((l: any) => {
      const row: any = { item_name_ko: s(l.item_name_ko || l.option_name), item_name_cn: s(l.item_name_cn), specification: s(l.specification, 500), quantity: n(l.quantity), currency: CUR.includes(String(l.currency || '').toUpperCase()) ? String(l.currency).toUpperCase() : undefined };
      if (l.unit_price_cny != null && l.unit_price_cny !== '') { row.unit_price_cny = n(l.unit_price_cny); row.total_cny = n(l.total_cny) || row.unit_price_cny * row.quantity; }
      return row;
    });
    const allCny = options.every((o: any) => o.currency === 'CNY');
    const record: any = {
      tenant_id: card.tenant_id, card_id: card.id, status: 'DRAFT',
      client_id: card.client_id || '', client_name: card.client_name || '',
      factory_id: card.factory_id || '', factory_name: s(body.factory_name) || card.factory_name || '',
      product_name: s(body.product_name), model_name: s(body.model_name), quote_title: s(body.quote_title) || s(body.product_name),
      incoterms: s(body.incoterms, 30), quote_options: options, line_items: lineItems,
    };
    if (body.logistics_cost != null && body.logistics_cost !== '') record.logistics_cost = n(body.logistics_cost);
    // 견적서 읽기(parseQuotationExcel)가 정리한 조건·사양도 함께 받는다. 선택 사양은 공장 원가 합계에 넣지 않는다
    const specs = (Array.isArray(body.spec_table) ? body.spec_table : []).slice(0, 40).map((r: any) => ({ label: s(r?.label, 120), label_cn: s(r?.label_cn, 120), value: s(r?.value, 200) })).filter((r: any) => r.label && r.value);
    if (specs.length) record.spec_table = specs;
    if (s(body.remarks, 3000)) record.remarks = s(body.remarks, 3000);
    if (s(body.internal_notes, 3000)) record.internal_notes = s(body.internal_notes, 3000);
    if (n(body.lead_time_business_days) > 0) record.lead_time_business_days = Math.round(n(body.lead_time_business_days));
    if (n(body.validity_days) > 0) record.validity_days = Math.round(n(body.validity_days));
    if (body.payment_terms_pending === true) record.payment_terms_pending = true;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s(body.factory_quote_date, 10))) record.factory_quote_date = s(body.factory_quote_date, 10);
    const included = options.filter((o: any) => !o.optional);
    if (allCny) { record.factory_total_cost = included.reduce((t: number, o: any) => t + o.quantity * o.unit_price, 0); record.factory_cost_currency = 'CNY'; }
    const created = await db.Quotation.create(record);
    const totals: Record<string, number> = {};
    for (const o of included) totals[o.currency] = (totals[o.currency] || 0) + o.quantity * o.unit_price;
    return Response.json({ ok: true, quotation_id: created.id, card_title: card.title || '', factory_name: record.factory_name, items: included.length, optional_items: options.length - included.length, cost_totals: totals, next: '견적 화면에서 마진·수수료·최종가를 입력하세요.' });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
