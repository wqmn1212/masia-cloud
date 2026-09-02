import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyUsers, clientUsersOfCompany, internalUsersOfTenant } from '../../shared/notify.ts';
import { cardVisibleToClient } from '../../shared/clientAccess.ts';

const STATUS_LABEL = {
  TODO: '대기 중',
  IN_PROGRESS: '소싱 중',
  REVIEW: '견적 검토',
  PRODUCTION: '발주 · 제작',
  DONE: '완료',
  CANCELLED: '취소',
};

// 카드 이벤트 알림 라우터.
// 내부 팀(master/service/sub) → 고객: card_moved · card_shared · quote_published
// 고객(client) → 내부 팀: chat_message
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { card_id, type, message } = await req.json();
    if (!card_id || !type) return Response.json({ error: 'card_id, type 이 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(card_id);
    if (!card) return Response.json({ error: '카드를 찾을 수 없습니다' }, { status: 404 });

    // 고객 → 내부 팀
    if (user.account_tier === 'client') {
      if (type !== 'chat_message') return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (!cardVisibleToClient(card, user.company_id)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const staff = await internalUsersOfTenant(svc, card.tenant_id);
      const sent = await notifyUsers(svc, staff, {
        type: 'chat_message',
        title: `[고객 메시지] ${card.title}`,
        body: `${user.account_label || user.full_name || user.email}: ${String(message || '').slice(0, 300)}`,
        link: `/task-board?card=${card.id}`,
        task_card_id: card.id,
      });
      return Response.json({ ok: true, sent });
    }

    // 내부 팀 → 고객
    if (!['master', 'service', 'sub'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (user.account_tier !== 'master' && card.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['card_moved', 'card_shared', 'chat_message', 'quote_published'].includes(type)) {
      return Response.json({ error: '지원하지 않는 알림 유형입니다' }, { status: 400 });
    }
    // 공개되지 않은 카드는 고객에게 알리지 않는다
    if (!card.client_visible || !card.client_id) return Response.json({ ok: true, sent: 0, skipped: 'not_shared' });

    const clients = await clientUsersOfCompany(svc, card.client_id);
    const title =
      type === 'card_moved'
        ? `[진행 상황] ${card.title} → ${STATUS_LABEL[card.status] || card.status}`
        : type === 'card_shared'
          ? `[신규 프로젝트] ${card.title}`
          : type === 'quote_published'
            ? `[견적서 발행] ${card.title}`
            : `[메시지] ${card.title}`;
    const body =
      type === 'card_moved'
        ? `프로젝트 단계가 "${STATUS_LABEL[card.status] || card.status}" 로 변경되었습니다.`
        : type === 'card_shared'
          ? '담당자가 프로젝트를 공개했습니다. 고객 포털에서 진행 상황을 확인하실 수 있습니다.'
          : type === 'quote_published'
            ? '견적서가 발행되었습니다. 고객 포털에서 PDF 로 다운로드하실 수 있습니다.'
            : String(message || '').slice(0, 300);

    const sent = await notifyUsers(svc, clients, {
      type,
      title,
      body,
      link: `/client/board?card=${card.id}`,
      task_card_id: card.id,
    });
    return Response.json({ ok: true, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}