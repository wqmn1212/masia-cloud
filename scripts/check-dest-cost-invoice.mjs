// 정산서 읽기 정리 검산: 부가세 분리, 총액 대조, 선적 찾기.
// 실행: npm run check:dest-cost-invoice
import assert from 'node:assert/strict';
import { summarizeInvoice, normalizeKind, matchShipment } from '../base44/shared/destCostInvoice.ts';

// 흔한 관세사 정산서: 관세·수입 부가세·통관 수수료(+부가세)·운임·창고료
const parsed = {
  currency: 'KRW', bl_no: 'SZXICN-2610-0042', grand_total_krw: '3,417,600',
  lines: [
    { label: '관세 (8%)', amount_krw: '1,120,000', kind: 'DUTY' },
    { label: '수입 부가세', amount_krw: 1512000, kind: 'IMPORT_VAT' },
    { label: '통관 수수료', amount_krw: 30000, kind: 'CUSTOMS_FEE' },
    { label: '수수료 부가세', amount_krw: 3000, kind: 'OTHER' }, // AI 가 종류를 틀려도 이름으로 바로잡는다
    { label: '해상 운임 (LCL)', amount_krw: 480000, kind: 'FREIGHT' },
    { label: 'THC·CFS·창고료', amount_krw: 210000, kind: 'LOCAL' },
    { label: '내륙 운송', amount_krw: 62600, kind: 'LOCAL' },
    { label: '', amount_krw: 999 }, // 이름 없는 줄은 버린다
  ],
};
const s = summarizeInvoice(parsed, { estimateExVat: 1800000 });
assert.equal(s.lines.length, 7);
assert.equal(s.lines[3].kind, 'SERVICE_VAT');
assert.equal(s.ex_vat, 1120000 + 30000 + 480000 + 210000 + 62600); // 1,902,600
assert.equal(s.import_vat, 1512000);
assert.equal(s.service_vat, 3000);
assert.equal(s.total, 3417600);
assert.equal(s.grand_total_read, 3417600);
assert.deepEqual(s.warnings, []);
assert.equal(s.diff_vs_estimate, 102600);

// 총액이 안 맞으면 경고 (줄이 빠짐)
assert.deepEqual(summarizeInvoice({ ...parsed, lines: parsed.lines.slice(0, 5) }).warnings, ['TOTAL_MISMATCH']);
// 예상액과 크게 다르면 다른 선적 의심
assert.ok(summarizeInvoice(parsed, { estimateExVat: 600000 }).warnings.includes('FAR_FROM_ESTIMATE'));
assert.ok(summarizeInvoice({ currency: 'USD', lines: [{ label: 'Freight', amount: 100 }] }).warnings.includes('NOT_KRW'));
assert.deepEqual(summarizeInvoice({}).warnings, ['NO_LINES']);

// 종류 바로잡기
assert.equal(normalizeKind('OTHER', '부가가치세'), 'IMPORT_VAT');
assert.equal(normalizeKind('DUTY', '통관수수료 VAT'), 'SERVICE_VAT');
assert.equal(normalizeKind('IMPORT_VAT', '관세'), 'DUTY', '관세를 부가세로 잘못 읽은 경우');
assert.equal(normalizeKind('CUSTOMS_FEE', '관세사 수수료'), 'CUSTOMS_FEE', '관세사는 관세가 아니다');
assert.equal(normalizeKind('XYZ', '보험료'), 'OTHER');

// 선적 찾기 (B/L 번호의 기호·대소문자 무시)
const ships = [{ id: 'a', tracking_no: 'COSU 6312345670' }, { id: 'b', tracking_no: 'szxicn26100042' }];
assert.equal(matchShipment(parsed, ships).shipment.id, 'b');
assert.equal(matchShipment({ bl_no: '123' }, ships).shipment, null, '너무 짧은 번호로는 고르지 않는다');

console.log('dest-cost-invoice: 정산서 정리 검산 통과');
