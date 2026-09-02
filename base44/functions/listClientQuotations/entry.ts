import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';

// 고객에게 공개된 견적서 목록. 금액·원가·수수료는 일절 반환하지 않고, 상세는 getQuotationPresentation 이 담당한다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    const { card_id } = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;

    if (card_id) {
      const card = await svc.entities.TaskCard.get(card_id);
      if (!cardVisibleToClient(card, auth.companyId)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const query = { client_id: auth.companyId };
    if (card_id) query.card_id = card_id;
    const list = await svc.entities.Quotation.filter(query, '-created_date', 100);

    return Response.json({
      quotations: list
        .filter((q) => !!q.client_published_at)
        .map((q) => ({
          id: q.id,
          quote_title: q.quote_title || q.product_name || '견적서',
          product_name: q.product_name || '',
          model_name: q.model_name || '',
          final_currency: ['USD', 'CNY', 'KRW'].includes(q.final_currency) ? q.final_currency : 'USD',
          published_at: q.client_published_at,
        })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}