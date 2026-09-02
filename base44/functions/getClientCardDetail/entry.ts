import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';

// 고객 포털 카드 상세: 오버뷰 · 공개 채팅 · 정산 단계(읽기 전용).
// 내부 전용 데이터(견적 원가, BOM, 결정, 내부 채팅)는 응답에 포함하지 않는다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    const { card_id } = await req.json();
    if (!card_id) return Response.json({ error: 'card_id 가 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(card_id);
    if (!cardVisibleToClient(card, auth.companyId)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const chats = await svc.entities.CardChat.filter({ card_id }, 'created_date', 200);
    const stages = await svc.entities.PaymentStage.filter({ card_id }, 'created_date', 20);

    return Response.json({
      card: {
        id: card.id,
        title: card.title,
        status: card.status,
        priority: card.priority || 'MEDIUM',
        due_date: card.due_date || '',
        hq_requirements: card.hq_requirements || '',
        target_machine_category: card.target_machine_category || '',
      },
      chats: chats
        .filter((c) => c.is_client_visible === true || c.sender_role === 'CLIENT')
        .map((c) => ({
          id: c.id,
          sender_name: c.sender_name,
          sender_role: c.sender_role || 'HQ',
          message_text: c.message_text,
          file_url: c.file_url || '',
          file_name: c.file_name || '',
          created_date: c.created_date,
        })),
      payment_stages: stages.map((s) => ({
        id: s.id,
        stage_type: s.stage_type,
        percentage: Number(s.percentage) || 0,
        approval_status: s.approval_status,
        approved_at: s.approved_at || '',
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}