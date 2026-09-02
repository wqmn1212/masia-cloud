import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';

// 고객이 수행 가능한 유일한 쓰기 동작: 채팅 작성 · 요구사항(hq_requirements) 수정.
// 그 외 필드는 서버에서 아예 받지 않으므로 프런트 우회로 변경할 수 없다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    const { card_id, action, message, hq_requirements } = await req.json();
    if (!card_id || !action) return Response.json({ error: 'card_id, action 이 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(card_id);
    if (!cardVisibleToClient(card, auth.companyId)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const senderName = auth.user.full_name || auth.user.account_label || auth.user.email;

    if (action === 'chat') {
      const text = String(message || '').trim().slice(0, 3000);
      if (!text) return Response.json({ error: '메시지를 입력하세요' }, { status: 400 });
      await svc.entities.CardChat.create({
        tenant_id: card.tenant_id,
        card_id,
        sender_name: senderName,
        sender_email: auth.user.email,
        sender_role: 'CLIENT',
        is_client_visible: true,
        message_text: text,
      });
      const staff = await internalUsersOfTenant(svc, card.tenant_id);
      await notifyUsers(svc, staff, {
        type: 'chat_message',
        title: `[고객 메시지] ${card.title}`,
        body: `${senderName}: ${text.slice(0, 300)}`,
        link: `/task-board?card=${card.id}`,
        task_card_id: card.id,
      });
      return Response.json({ ok: true });
    }

    if (action === 'update_requirements') {
      await svc.entities.TaskCard.update(card_id, {
        hq_requirements: String(hq_requirements || '').slice(0, 20000),
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}