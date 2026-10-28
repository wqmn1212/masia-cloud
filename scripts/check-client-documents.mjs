// 고객 서류함 서버 함수 검산: 우리 고객사의 공개 카드·공개 파일만, 체결된 계약서는 카드별·카드 없는 것 따로, 선적 단계별로 빠진 서류.
// 실행: npm run check:client-documents
import assert from 'node:assert/strict';
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
globalThis.__user = { id: 'cu1', account_tier: 'client', company_id: 'co1', is_active: true };
globalThis.__db = {
  TaskCard: [
    { id: 'c1', tenant_id: 't1', title: '테이블 상판', client_id: 'co1', client_visible: true, status: 'PRODUCTION', updated_date: '2026-10-27' },
    { id: 'c2', tenant_id: 't1', title: '비공개 카드', client_id: 'co1', client_visible: false, status: 'PRODUCTION' },
    { id: 'c3', tenant_id: 't1', title: '남의 카드', client_id: 'co9', client_visible: true, status: 'PRODUCTION' },
  ],
  CardAttachment: [
    { id: 'a1', tenant_id: 't1', card_id: 'c1', file_name: 'CI.pdf', file_url: 'private://ci', document_type: 'INVOICE_CI', client_visible: true, created_date: '2026-10-20' },
    { id: 'a2', tenant_id: 't1', card_id: 'c1', file_name: '내부원가.xlsx', file_url: 'private://cost', document_type: 'GENERAL', client_visible: false },
    { id: 'a3', tenant_id: 't1', card_id: 'c2', file_name: '비공개카드.pdf', file_url: 'private://x', document_type: 'GENERAL', client_visible: true },
  ],
  Shipment: [
    { id: 's1', tenant_id: 't1', card_id: 'c1', label: '1차 선적', status: 'DEPARTED', client_visible: true, docs: [{ key: 'CERT_ORIGIN', status: 'NA' }] },
    { id: 's2', tenant_id: 't1', card_id: 'c1', label: '내부 선적', status: 'DEPARTED', client_visible: false },
  ],
  SignatureRequest: [
    { id: 'r1', client_id: 'co1', card_id: 'c1', status: 'COMPLETED', completed_file_uri: 'private://r1', document_title: '공급 계약서', document_no: 'AEG-1', completed_at: '2026-09-11' },
    { id: 'r2', client_id: 'co1', card_id: '', status: 'COMPLETED', completed_file_uri: 'private://r2', document_title: '월 계약서', completed_at: '2026-07-01' },
    { id: 'r3', client_id: 'co1', card_id: 'c1', status: 'OUT', document_title: '서명 대기' },
    { id: 'r4', client_id: 'co9', card_id: 'c3', status: 'COMPLETED', completed_file_uri: 'private://r4', document_title: '남의 계약서' },
  ],
  Company: [], FactoryDocument: [],
};
const r = await call('listClientDocuments', {});
assert.equal(r.status, 200);
assert.deepEqual(r.data.orders.map((o) => o.id), ['c1'], '우리 고객사의 공개 카드만');
const o = r.data.orders[0];
assert.deepEqual(o.documents.map((d) => d.file_name), ['CI.pdf'], '공개 파일만');
assert.equal(JSON.stringify(r.data).includes('private://'), false, '파일 주소는 보내지 않는다');
assert.deepEqual(o.contracts.map((k) => k.request_id), ['r1'], '체결된 이 카드 계약서');
assert.deepEqual(r.data.contracts.map((k) => k.request_id), ['r2'], '카드 없는 계약서는 따로');
// 1차 선적(출항): CI 는 공유됨, 원산지증명서는 해당 없음 → PL·B/L 이 빠짐. 비공개 선적은 따지지 않는다
assert.deepEqual(o.missing.map((m) => `${m.shipment_label}:${m.key}`), ['1차 선적:PACKING_LIST', '1차 선적:BILL_OF_LADING']);
globalThis.__user = { id: 'u1', account_tier: 'service', tenant_id: 't1', is_active: true };
assert.equal((await call('listClientDocuments', {})).status, 403, '직원 계정은 고객 서류함을 직접 부르지 않는다');
console.log('client-documents: 서류함 서버 함수 검산 통과');
