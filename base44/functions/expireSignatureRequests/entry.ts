import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { appendEvent } from '../../shared/signatureServer.ts';
import { internalUsersOfTenant, notifyUsers } from '../../shared/notify.ts';

// 매일 09:20 KST: 기한 지난 서명 요청을 EXPIRED 로 닫고, 기한 3일 전·당일에 서명자에게 알린다.
// 같은 기한·단계로는 한 번만 보낸다 (reminders_sent 에 '기한:단계').
const THROTTLE_MS = 5 * 60 * 1000;
let lastAnonRun = 0;
const kstDate = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const daysLeft = (dueIso: string) => Math.round((Date.parse(`${kstDate(Date.parse(dueIso))}T00:00:00Z`) - Date.parse(`${kstDate(Date.now())}T00:00:00Z`)) / 86400000);

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!user) { if (Date.now() - lastAnonRun < THROTTLE_MS) return Response.json({ throttled: true }); lastAnonRun = Date.now(); }
    const svc = base44.asServiceRole, db = svc.entities;
    const open = await db.SignatureRequest.filter({ status: 'OUT' }, 'due_at', 500);
    let expired = 0, reminded = 0;
    for (const r of open) {
      if (!r.due_at) continue;
      if (Date.parse(r.due_at) < Date.now()) {
        await db.SignatureRequest.update(r.id, { status: 'EXPIRED' });
        await appendEvent(svc, r, { type: 'EXPIRED', actor_type: 'SYSTEM', actor_label: '이지스 클라우드', data: { due_at: r.due_at } });
        await db.Contract.update(r.contract_id, { status: 'REVIEW' }).catch(() => null);
        await notifyUsers(svc, await internalUsersOfTenant(svc, r.tenant_id), { type: 'contract_expired', title: `[서명 기한 지남] ${r.document_title}`, body: '고객이 기한 안에 서명하지 않았습니다. 필요하면 계약서를 다시 보내 주세요.', link: `/contracts?contract=${r.contract_id}`, task_card_id: r.card_id || '' }).catch(() => 0);
        expired++;
        continue;
      }
      const left = daysLeft(r.due_at);
      const step = left === 0 ? 'D0' : left <= 3 ? 'D3' : '';
      const key = `${kstDate(Date.parse(r.due_at))}:${step}`;
      if (!step || (r.reminders_sent || []).includes(key) || (r.signers || []).every((s: any) => s.status === 'SIGNED')) continue;
      const signer = await db.User.get((r.signers || [])[0]?.user_id).catch(() => null);
      if (signer && signer.is_active !== false) {
        await notifyUsers(svc, [signer], { type: 'contract_sent', title: `[서명 기한 ${left === 0 ? '오늘' : `${left}일 남음`}] ${r.document_title}`, body: `서명 기한은 ${kstDate(Date.parse(r.due_at))}입니다. 기한이 지나면 담당자가 다시 보내야 합니다.`, link: `/client/dashboard?sign=${r.id}`, task_card_id: r.card_id || '' }, { email: true }).catch(() => 0);
        reminded++;
      }
      await db.SignatureRequest.update(r.id, { reminders_sent: [...(r.reminders_sent || []), key] });
    }
    return Response.json({ ok: true, expired, reminded });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
