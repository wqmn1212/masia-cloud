import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { notifyUsers } from '../../shared/notify.ts';
import { missingBeforeDeparture } from '../../shared/shipments.ts';

// 매일 08:20 KST: 출항 30일·7일 전인데 출항 전 서류(CI·PL, 위험물이면 UN38.3·MSDS 등)가 빠진 선적을 담당자에게 알린다.
// 같은 출항일·단계로는 한 번만 (docs_warned_for). 수신: 카드 책임자 → 없으면 그 팀 service.
const THROTTLE_MS = 5 * 60 * 1000;
const STEPS = [7, 30];
let lastAnonRun = 0;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!user) { if (Date.now() - lastAnonRun < THROTTLE_MS) return Response.json({ throttled: true }); lastAnonRun = Date.now(); }
    const svc = base44.asServiceRole, db = svc.entities;
    const today = kstToday();
    const list = await db.Shipment.filter({ status: { $in: ['PREPARING', 'BOOKED'] } }, 'etd', 500);
    let sent = 0;
    for (const s of list) {
      if (!s.etd) continue;
      const left = daysBetween(today, s.etd);
      if (left < 0) continue;
      const step = STEPS.find((n) => left <= n);
      if (step == null) continue;
      const key = `${s.etd}:${step}`;
      if (s.docs_warned_for === key) continue;
      const types = (await db.CardAttachment.filter({ card_id: s.card_id }, '-created_date', 500)).map((a) => a.document_type).filter(Boolean);
      const missing = missingBeforeDeparture(s, types);
      if (!missing.length) continue;
      const card = await db.TaskCard.get(s.card_id).catch(() => null);
      if (!card) continue;
      const owner = card.owner_id ? await db.User.get(card.owner_id).catch(() => null) : null;
      const recipients = owner && owner.is_active !== false
        ? [owner]
        : (await db.User.filter({ tenant_id: card.tenant_id, account_tier: 'service' })).filter((u) => u.is_active !== false);
      if (recipients.length) {
        await notifyUsers(svc, recipients, {
          type: 'shipment_docs_missing',
          title: `[서류 미비 · 출항 D-${left}] ${card.title}`,
          body: `${s.label || '선적'}${s.dangerous_goods ? ' (위험물 포함)' : ''}: ${missing.map((d) => d.label).join(', ')}\n출항 예정 ${s.etd}. 무역서류 탭에서 서류를 올리거나 '해당 없음'으로 표시해 주세요.`,
          link: `/task-board?card=${card.id}`,
          task_card_id: card.id,
          card_title: card.title,
        });
      }
      await db.Shipment.update(s.id, { docs_warned_for: key });
      sent++;
    }
    return Response.json({ checked: list.length, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
