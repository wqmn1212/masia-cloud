import { base44 } from '@/api/base44Client';

const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id', 'created_by', 'client_published_at', 'ai_status'];

// 견적 내용을 그대로 복사한 새 초안 견적서를 만든다 (이름/가격만 바꿔 재발행용).
export default async function duplicateQuotation(quote) {
  const copy = Object.fromEntries(Object.entries(quote).filter(([k]) => !SYSTEM_FIELDS.includes(k) && !k.startsWith('__')));
  const baseTitle = quote.quote_title || quote.product_name || quote.factory_name || '견적서';
  return base44.entities.Quotation.create({ ...copy, quote_title: `${baseTitle} (복사본)`, status: 'DRAFT' });
}