import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { latestClientComparison } from '../../shared/clientComparison.ts';

// 고객에게 공개된 견적서 목록. 금액·원가·수수료는 일절 반환하지 않고, 상세는 getQuotationPresentation 이 담당한다.
// 카드를 지정하면 고객 수락 상태와, 견적 비교표가 있어 비교표에서 골라야 하는지(has_comparison)도 알려 준다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
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

    const hasComparison = card_id ? !!(await latestClientComparison(svc, card_id)) : false;
    return Response.json({
      has_comparison: hasComparison,
      quotations: list
        .filter((q) => !!q.client_published_at)
        .map((q) => ({
          id: q.id,
          quote_title: q.quote_title || q.product_name || '견적서',
          product_name: q.product_name || '',
          model_name: q.model_name || '',
          final_currency: ['USD', 'CNY', 'KRW'].includes(q.final_currency) ? q.final_currency : 'USD',
          published_at: q.client_published_at,
          accepted_at: q.client_accepted_at || null,
          accepted_by_name: q.client_accepted_by_name || '',
          accept_note: q.client_accept_note || '',
        })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}