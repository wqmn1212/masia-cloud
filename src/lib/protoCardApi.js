// 시제품 ↔ 업무 카드: 연결·풀기와 카드 소통 탭 기록 (직원만, 고객 비공개 메모)
import { base44 } from '@/api/base44Client';
import { protoNoteText } from '@/lib/protoCard';

export const PROTO_SENDER = '개발 워크벤치';

/** 카드 소통 탭에 내부 메모를 남긴다. 실패해도 본 작업은 막지 않는다 */
export async function noteProtoToCard(project, text, cardId = project?.card_id) {
  if (!cardId || !text) return false;
  try {
    await base44.entities.CardChat.create({ tenant_id: project.tenant_id, card_id: cardId, sender_name: PROTO_SENDER, sender_email: '', sender_role: 'HQ', is_client_visible: false, message_text: protoNoteText(project, text) });
    return true;
  } catch { return false; }
}

/** 시제품을 카드에 연결(또는 cardId 없으면 풀기)하고 양쪽 카드에 기록 */
export async function linkProtoCard(project, cardId, by) {
  const prev = project.card_id || null;
  if (prev === (cardId || null)) return project;
  const saved = await base44.entities.ProtoProject.update(project.id, { card_id: cardId || null });
  if (prev) await noteProtoToCard(project, `이 카드와의 연결을 풀었습니다 · ${by}`, prev);
  if (cardId) await noteProtoToCard(project, `이 카드에 시제품 개발을 연결했습니다 · ${by}`, cardId);
  return saved;
}
