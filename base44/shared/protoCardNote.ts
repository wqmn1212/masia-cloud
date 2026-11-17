// 시제품 개발 기록을 연결된 업무 카드 소통 탭에 남긴다 (직원만 보는 내부 메시지, 고객 비공개).
// 카드가 연결되지 않았거나 기록에 실패해도 본래 작업은 그대로 끝낸다.
export const PROTO_SENDER = '개발 워크벤치';

export function protoNoteText(project: any, text: string) {
  return `[시제품 · ${String(project?.title || '').slice(0, 60)}] ${String(text || '').slice(0, 900)}`;
}

export async function noteProtoToCard(svc: any, project: any, text: string) {
  if (!project?.card_id || !text) return false;
  try {
    await svc.entities.CardChat.create({
      tenant_id: project.tenant_id, card_id: project.card_id, sender_name: PROTO_SENDER, sender_email: '', sender_role: 'HQ',
      is_client_visible: false, message_text: protoNoteText(project, text),
    });
    return true;
  } catch { return false; }
}
