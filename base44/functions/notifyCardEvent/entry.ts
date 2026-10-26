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
// 내부 팀(master/service/sub) → 고객: card_moved · card_shared · quote_published · qc_published · spec_sent · shipment_updated · dest_cost_sent · claim_updated · comparison_published · landed_cost_confirmed
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
        card_title: card.title,
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
    if (!['card_moved', 'card_shared', 'chat_message', 'quote_published', 'file_shared', 'qc_published', 'spec_sent', 'shipment_updated', 'dest_cost_sent', 'claim_updated', 'comparison_published', 'landed_cost_confirmed'].includes(type)) {
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
            : type === 'file_shared'
              ? `[파일 공유] ${card.title}`
              : type === 'qc_published'
                ? `[검수 결과] ${card.title}`
                : type === 'spec_sent'
                  ? `[품질 기준서] ${card.title}`
                  : type === 'shipment_updated'
                    ? `[선적] ${card.title}`
                    : type === 'dest_cost_sent'
                      ? `[도착지 비용 확인 요청] ${card.title}`
                      : type === 'claim_updated'
                        ? `[불량 신고 처리] ${card.title}`
                        : type === 'comparison_published'
                          ? `[견적 비교표] ${card.title}`
                          : type === 'landed_cost_confirmed'
                            ? `[도착 원가 확정] ${card.title}`
                            : `[답변] ${card.title}`;
    const body =
      type === 'card_moved'
        ? `프로젝트 단계가 "${STATUS_LABEL[card.status] || card.status}" 로 변경되었습니다.`
        : type === 'card_shared'
          ? '담당자가 프로젝트를 공개했습니다. 고객 포털에서 진행 상황을 확인하실 수 있습니다.'
          : type === 'quote_published'
            ? '견적서가 발행되었습니다. 고객 포털에서 PDF 로 다운로드하실 수 있습니다.'
            : type === 'file_shared'
              ? `담당자가 파일을 공유했습니다: ${String(message || '').slice(0, 200)}`
              : type === 'qc_published'
                ? '검수 결과가 올라왔습니다. 사진과 판정을 확인하고 승인 또는 보류를 선택해 주세요.'
                : type === 'spec_sent'
                  ? '양산 전에 불량 기준을 정리했습니다. 항목별 기준과 예시 사진을 확인하고 승인 또는 수정 요청을 남겨 주세요.'
                  : type === 'shipment_updated'
                    ? `선적 상태가 바뀌었습니다. ${String(message || '').slice(0, 200)}`
                    : type === 'dest_cost_sent'
                      ? `${String(message || '').slice(0, 200)}\n공장 견적과 별도로 한국 도착 후 내실 비용입니다. 출항 전에 진행 정보 탭에서 금액을 확인하고 '확인했습니다' 또는 '문의하기'를 눌러 주세요.`
                      : type === 'claim_updated'
                        ? `${String(message || '').slice(0, 300)}\n검수 탭의 '불량 신고'에서 처리 상황을 확인하실 수 있습니다.`
                        : type === 'comparison_published'
                          ? '공장 견적을 같은 기준(한국 도착 원가)으로 비교한 표가 올라왔습니다. 견적 탭에서 안을 고르거나 질문을 남겨 주세요.'
                          : type === 'landed_cost_confirmed'
                            ? `${String(message || '').slice(0, 200)}\n'상품 원가' 메뉴에서 지난 주문과 비교해 보실 수 있습니다.`
                            : String(message || '').slice(0, 300);

    const sent = await notifyUsers(svc, clients, {
      type,
      title,
      body,
      link: type === 'landed_cost_confirmed' ? '/client/costs' : `/client/board?card=${card.id}${['qc_published', 'spec_sent', 'shipment_updated', 'claim_updated'].includes(type) ? '&tab=qc' : type === 'comparison_published' ? '&tab=quotation' : ''}`,
      task_card_id: card.id,
      card_title: card.title,
    });
    return Response.json({ ok: true, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}