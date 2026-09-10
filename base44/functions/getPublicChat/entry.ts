import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// 상담 위젯이 재방문 시(또는 폴링 중) 대화 내역을 불러오는 용도. session_id 를 아는 요청만 조회 가능.
const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const sessionId = clean(body.session_id, 100);
    if (!sessionId) return Response.json({ error: 'session_id 가 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const threads = await svc.entities.PublicChatThread.filter({ session_id: sessionId }, '-created_date', 1);
    const thread = threads[0];
    if (!thread) return Response.json({ thread: null, messages: [] });

    const messages = await svc.entities.PublicChatMessage.filter({ thread_id: thread.id }, 'created_date', 200);

    if (thread.unread_by_visitor) {
      await svc.entities.PublicChatThread.update(thread.id, { unread_by_visitor: false });
    }

    return Response.json({
      thread: { id: thread.id, status: thread.status, visitor_name: thread.visitor_name },
      messages: messages.map((m) => ({
        id: m.id,
        sender_role: m.sender_role,
        sender_name: m.sender_name,
        message_text: m.message_text,
        created_date: m.created_date,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
