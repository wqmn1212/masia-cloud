// AI 비서용 서버 함수 검산: 팀 범위, 미리보기는 저장 안 함, 덮어쓰기 확인, 비서가 보낸 마진·최종가 버림(마진은 규칙 기준), 초안 중복 방지.
// 실행: npm run check:assistant
import assert from 'node:assert/strict';
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
globalThis.fetch = async () => new Response(new Uint8Array([37, 80, 68, 70, 45, 49]), { headers: { 'content-type': 'application/pdf' } });
globalThis.__user = { id: 'u1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', is_active: true };
globalThis.__db = {
  TaskCard: [{ id: 'c1', tenant_id: 't1', title: '테이블 상판 재주문', client_id: 'co1', client_name: '예시 고객사', status: 'DONE', factory_name: '공장 가' }, { id: 'c9', tenant_id: 't2', title: '남의 카드' }],
  Shipment: [
    { id: 's1', tenant_id: 't1', card_id: 'c1', label: '1차 선적', status: 'DELIVERED', tracking_no: 'SZXICN26100042', dest_cost_estimate: { buyer_ex_vat: 1800000 } },
    { id: 's2', tenant_id: 't1', card_id: 'c1', label: '2차 선적', status: 'DEPARTED' },
    { id: 's9', tenant_id: 't2', card_id: 'c9', label: '남의 선적', status: 'DELIVERED', tracking_no: 'SZXICN26100042' },
  ],
  Quotation: [
    { id: 'q1', tenant_id: 't1', card_id: 'c1', factory_name: '공장 가', status: 'REVIEW', quote_title: '상판 A', settlement_route: 'CLIENT_TO_AEGIS', client_name: '예시 고객사', final_price_usd: 10500, created_date: '2026-10-01' },
    { id: 'q2', tenant_id: 't1', card_id: 'c1', factory_name: '공장 나', status: 'REVIEW', quote_title: '상판 B', created_date: '2026-10-02' },
    { id: 'q3', tenant_id: 't1', card_id: 'c1', factory_name: 'N/A', status: 'REJECTED', created_date: '2026-10-03' },
  ],
  CardAttachment: [], ProjectAuditLog: [], QuoteComparison: [], Contract: [], SignatureRequest: [], LandedCostRecord: [], ServiceAgreement: [],
};
globalThis.__llm = async () => ({ issuer: '예시관세사', bl_no: 'SZXICN-2610-0042', currency: 'KRW', grand_total_krw: 3417600, lines: [
  { label: '관세', amount_krw: 1120000, kind: 'DUTY' }, { label: '수입 부가세', amount_krw: 1512000, kind: 'IMPORT_VAT' }, { label: '통관 수수료', amount_krw: 30000, kind: 'CUSTOMS_FEE' },
  { label: '수수료 부가세', amount_krw: 3000, kind: 'OTHER' }, { label: '해상 운임', amount_krw: 480000, kind: 'FREIGHT' }, { label: 'THC·창고료', amount_krw: 272600, kind: 'LOCAL' } ] });

// ── 도착 비용 ──
let r = await call('assistantDestCost', { action: 'find', card_query: '상판' });
assert.deepEqual(r.data.shipments.map((s) => s.shipment_id), ['s1'], '도착했고 비어 있는 우리 팀 선적만');
r = await call('assistantDestCost', { action: 'parse', file_url: 'https://files.example/invoice.pdf' });
assert.equal(r.data.shipment.shipment_id, 's1', 'B/L 로 우리 팀 선적을 찾는다 (남의 팀 선적은 제외)');
assert.equal(r.data.ex_vat, 1902600); assert.equal(r.data.import_vat, 1512000); assert.deepEqual(r.data.warnings, []);
assert.equal(globalThis.__db.Shipment[0].dest_cost_actual, undefined, 'parse 는 저장하지 않는다');
r = await call('assistantDestCost', { action: 'apply', shipment_id: 's9', actual_ex_vat: 1 });
assert.equal(r.status, 404, '남의 팀 선적 거부');
r = await call('assistantDestCost', { action: 'apply', shipment_id: 's1', actual_ex_vat: -5 });
assert.equal(r.status, 400);
r = await call('assistantDestCost', { action: 'apply', shipment_id: 's1', actual_ex_vat: 1902600, actual_vat: 1512000, file_url: 'https://files.example/invoice.pdf', file_name: '정산서.pdf' });
assert.equal(r.data.ok, true); assert.equal(r.data.file_saved, true);
const s1 = globalThis.__db.Shipment[0];
assert.deepEqual([s1.dest_cost_actual, s1.dest_cost_actual_vat, s1.dest_cost_actual_by_name], [1902600, 1512000, '이호민 (AI 비서)']);
assert.equal(globalThis.__db.CardAttachment[0].document_type, 'LOGISTICS_INVOICE'); assert.equal(globalThis.__db.CardAttachment[0].client_visible, false);
r = await call('assistantDestCost', { action: 'apply', shipment_id: 's1', actual_ex_vat: 1 });
assert.equal(r.data.code, 'ALREADY_RECORDED', '덮어쓰기는 확인 후에만');

// ── 초안 ──
r = await call('assistantDraft', { kind: 'comparison', card_id: 'c1' });
assert.equal(r.data.ok, true);
assert.deepEqual(r.data.options.map((o) => o.label), ['A안', 'B안'], '거절·이름 없는 공장 견적은 빼고');
assert.deepEqual(globalThis.__db.QuoteComparison[0].rows, []); assert.equal(globalThis.__db.QuoteComparison[0].status, 'DRAFT');
r = await call('assistantDraft', { kind: 'comparison', card_id: 'c1' });
assert.equal(r.data.existing, true, '두 번 만들지 않는다');
r = await call('assistantDraft', { kind: 'comparison', card_id: 'c9' });
assert.equal(r.status, 404);
r = await call('assistantDraft', { kind: 'contract', quotation_id: 'q1' });
const ct = globalThis.__db.Contract[0];
assert.deepEqual([ct.contract_type, ct.status, ct.client_id, ct.card_id, ct.body, ct.amount_usd], ['SUPPLY', 'DRAFT', 'co1', 'c1', '', 10500]);
assert.ok(r.data.link.endsWith(`/contracts?contract=${ct.id}`));

// ── 견적 등록 ──
r = await call('assistantCreateQuotation', { card_id: 'c1', factory_name: '공장 다', product_name: '상판', quote_options: [{ option_name: '상판', quantity: 500, unit_price: 140, currency: 'cny', margin_percent: 30 }], final_client_price: 99999, status: 'ACCEPTED', tenant_id: 't2' });
const q = globalThis.__db.Quotation.at(-1);
assert.deepEqual([q.status, q.tenant_id, q.factory_total_cost, q.final_client_price, q.quote_options[0].margin_percent, q.quote_options[0].currency], ['DRAFT', 't1', 70000, undefined, 15, 'CNY'], '상태·팀 고정, 비서가 보낸 마진(30)·최종가는 버리고 마진 규칙 기준(앱 기본 15%)');
assert.match(q.internal_notes || '', /기준 마진 15% 채움 \(앱 기본값\) · AI 비서 등록/);
assert.equal(r.data.margin_rule.default_pct, 15);
r = await call('assistantCreateQuotation', { card_id: 'c9', quote_options: [{ option_name: 'x', unit_price: 1 }] });
assert.equal(r.status, 404);

// ── 현황 ──
globalThis.__db.SignatureRequest.push({ id: 'r1', tenant_id: 't1', contract_id: ct.id, document_no: 'SG-2026-0001', document_title: '공급 계약서', version: 1, status: 'OUT', due_at: new Date(Date.now() + 5 * 864e5).toISOString(), created_date: new Date(Date.now() - 3 * 864e5).toISOString(), signers: [{ name: '김담당', status: 'VIEWED' }] });
r = await call('assistantStatus', { topic: 'all' });
assert.equal(r.data.signatures.waiting[0].sent_days_ago, 3); assert.equal(r.data.signatures.waiting[0].signer_viewed, true);
assert.equal(r.data.comparisons.drafts.length, 1);
assert.deepEqual(r.data.costs.cards_to_confirm, [], '2차 선적이 아직 도착 전');
globalThis.__db.Shipment[1].status = 'ARRIVED';
r = await call('assistantStatus', { topic: 'costs' });
assert.equal(r.data.costs.cards_to_confirm[0].card_id, 'c1'); assert.equal(r.data.costs.cards_to_confirm[0].actual_missing, true);
assert.equal(r.data.costs.shipments_missing_actual[0].shipment_id, 's2');
globalThis.__user = { id: 'cl', account_tier: 'client', is_active: true };
r = await call('assistantStatus', {}); assert.equal(r.status, 403, '고객 계정 거부');
console.log('assistant functions: 모두 통과');
