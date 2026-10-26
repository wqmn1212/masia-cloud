import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { latestClientComparison, sanitizeSnapshot } from '../../shared/clientComparison.ts';

// 고객에게 공개된 견적 비교표. 공개할 때 저장한 스냅샷만 돌려준다 — 원가·마진·견적 ID·내부 메모는 없다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;

    const { card_id } = await req.json().catch(() => ({}));
    if (!card_id) return Response.json({ error: 'card_id 가 필요합니다' }, { status: 400 });
    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(card_id);
    if (!cardVisibleToClient(card, auth.companyId)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const rec = await latestClientComparison(svc, card.id);
    if (!rec) return Response.json({ comparison: null });
    const choice = rec.client_choice?.option_key ? { option_key: rec.client_choice.option_key, note: rec.client_choice.note || '', by_name: rec.client_choice.by_name || '', at: rec.client_choice.at || '' } : null;
    return Response.json({
      comparison: {
        status: rec.status,
        version: Number(rec.version) || 1,
        published_at: rec.published_at || '',
        snapshot: sanitizeSnapshot(rec.client_snapshot),
        client_choice: choice,
        confirmed_option_key: rec.status === 'CONFIRMED' ? rec.confirmed_option_key || '' : '',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
