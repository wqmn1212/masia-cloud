import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';

// 랜딩 페이지 상담 위젯 — 비로그인 호출. session_id 는 방문자 브라우저(localStorage)에만 저장되는
// 추측 불가능한 값으로, 이 값을 아는 요청만 해당 스레드에 쓸 수 있다는 전제로 동작한다.
// 정식 견적/발주 접수는 submitInquiry 가 담당하며, 이 함수는 그 전 단계의 가벼운 상담을 위한 것이다.
const clean = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const sessionId = clean(body.session_id, 100);
    const message = clean(body.message, 2000);
    if (!sessionId || !message) return Response.json({ error: 'session_id, message 가 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;

    const hq = await svc.entities.Tenant.filter({ is_hq: true }, 'created_date', 1);
    const tenant = hq[0] || (await svc.entities.Tenant.list('created_date', 1))[0];
    if (!tenant) return Response.json({ error: 'HQ tenant not configured' }, { status: 500 });

    const visitorName = clean(body.visitor_name, 100);
    const visitorContact = clean(body.visitor_contact, 200);
    const productName = clean(body.product_name, 200);

    const existing = await svc.entities.PublicChatThread.filter({ tenant_id: tenant.id, session_id: sessionId }, '-created_date', 1);
    let thread = existing[0];
    if (!thread) {
      thread = await svc.entities.PublicChatThread.create({
        tenant_id: tenant.id,
        session_id: sessionId,
        visitor_name: visitorName,
        visitor_contact: visitorContact,
        product_name: productName,
        status: 'OPEN',
        unread_by_staff: true,
        unread_by_visitor: false,
        last_message_at: new Date().toISOString(),
      });
    } else {
      const update = { status: 'OPEN', unread_by_staff: true, last_message_at: new Date().toISOString() };
      if (visitorName) update.visitor_name = visitorName;
      if (visitorContact) update.visitor_contact = visitorContact;
      await svc.entities.PublicChatThread.update(thread.id, update);
    }

    await svc.entities.PublicChatMessage.create({
      tenant_id: tenant.id,
      thread_id: thread.id,
      sender_role: 'VISITOR',
      sender_name: visitorName || '방문자',
      message_text: message,
    });

    const staff = await internalUsersOfTenant(svc, tenant.id);
    await notifyUsers(svc, staff, {
      type: 'client_inquiry',
      title: `[상담 문의] ${visitorName || '방문자'}${visitorContact ? ` · ${visitorContact}` : ''}`,
      body: message.slice(0, 300),
      link: '/chat-consultations',
    });

    return Response.json({ ok: true, thread_id: thread.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
