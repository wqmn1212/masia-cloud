import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { maskEmail } from '../../shared/signature.ts';
import { appendEvent, completeRequest, staffCanAccess } from '../../shared/signatureServer.ts';
import { notifyUsers } from '../../shared/notify.ts';

// 직원: revoke(회수) · remind(다시 알림, 1시간 간격) · extend(기한 연장) · complete(완료본 다시 발급, 서명이 끝난 요청만)
const REMIND_GAP_MS = 60 * 60 * 1000;

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole, db = svc.entities;
    const r = body.request_id ? await db.SignatureRequest.get(body.request_id).catch(() => null) : null;
    if (!staffCanAccess(user, r)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const actor = { actor_type: 'STAFF', actor_id: user.id, actor_label: user.full_name || user.email || '' };

    if (body.action === 'complete') {
      if (r.status === 'COMPLETED') return Response.json({ ok: true, already: true });
      if (r.status !== 'OUT' || !(r.signers || []).every((s: any) => s.status === 'SIGNED')) return Response.json({ error: '모든 서명이 끝난 요청만 완료본을 발급할 수 있습니다' }, { status: 409 });
      await completeRequest(svc, r);
      return Response.json({ ok: true });
    }
    if (r.status !== 'OUT') return Response.json({ error: '서명 대기 중인 요청만 바꿀 수 있습니다' }, { status: 409 });

    if (body.action === 'revoke') {
      await db.SignatureRequest.update(r.id, { status: 'REVOKED', revoked_by_name: actor.actor_label });
      await appendEvent(svc, r, { type: 'REVOKED', ...actor, data: { reason: String(body.reason || '').slice(0, 300) } }, req);
      await db.Contract.update(r.contract_id, { status: 'REVIEW' }).catch(() => null);
      return Response.json({ ok: true });
    }
    const signer = await db.User.get((r.signers || [])[0]?.user_id).catch(() => null);
    if (body.action === 'remind') {
      if (r.last_reminded_at && Date.now() - Date.parse(r.last_reminded_at) < REMIND_GAP_MS) return Response.json({ error: '다시 알림은 1시간에 한 번 보낼 수 있습니다' }, { status: 429 });
      if (!signer) return Response.json({ error: '서명자 계정을 찾을 수 없습니다' }, { status: 404 });
      await notifyUsers(svc, [signer], { type: 'contract_sent', title: `[계약서 서명 요청 · 다시 알림] ${r.document_title}`, body: `서명을 기다리고 있는 계약서가 있습니다. 서명 기한: ${new Date(Date.parse(r.due_at) + 9 * 3600000).toISOString().slice(0, 10)}`, link: `/client/dashboard?sign=${r.id}`, task_card_id: r.card_id || '' }, { email: true });
      await db.SignatureRequest.update(r.id, { last_reminded_at: new Date().toISOString() });
      await appendEvent(svc, r, { type: 'REMINDED', ...actor, data: { email: maskEmail(signer.email) } }, req);
      return Response.json({ ok: true });
    }
    if (body.action === 'extend') {
      const days = Math.min(30, Math.max(1, Number(body.days) || 7));
      const base = Math.max(Date.now(), Date.parse(r.due_at));
      const due = new Date(base + days * 86400000);
      due.setUTCHours(14, 59, 59, 0);
      await db.SignatureRequest.update(r.id, { due_at: due.toISOString(), reminders_sent: [] });
      r.due_at = due.toISOString();
      await appendEvent(svc, r, { type: 'EXTENDED', ...actor, data: { due_at: r.due_at } }, req);
      return Response.json({ ok: true, due_at: r.due_at });
    }
    return Response.json({ error: '지원하지 않는 요청입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
