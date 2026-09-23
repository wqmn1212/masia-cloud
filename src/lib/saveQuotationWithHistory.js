import { base44 } from '@/api/base44Client';

// 견적 수정은 항상 이력 서버 함수를 거쳐 저장한다 — 변경 전 스냅샷이 수정 이력으로 남는다.
export default async function saveQuotationWithHistory(quote, data, reason) {
  const res = await base44.functions.invoke('quotationHistory', {
    action: 'update',
    quotation_id: quote.id,
    expected_updated_date: quote.updated_date,
    data,
    reason,
  });
  return res.data;
}