import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { buildOpsDigest } from '../../shared/opsDigest.ts';
import { loadOpsData } from '../../shared/opsDigestData.ts';

// '내 업무' 화면 맨 위의 오늘 요약 — 아침 메일과 같은 계산. 직원 본인 몫만 (관리자는 팀 숫자 포함).
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    // card_id: 업무 카드 한 장의 '지금' 신호 (책임자와 상관없이). 마스터도 볼 수 있다
    if (body.card_id) {
      if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const card = await base44.asServiceRole.entities.TaskCard.get(String(body.card_id)).catch(() => null);
      if (!card || (user.account_tier !== 'master' && card.tenant_id !== user.tenant_id)) return Response.json({ error: 'Not found' }, { status: 404 });
      const data = await loadOpsData(base44.asServiceRole, card.tenant_id, { staffUser: user });
      const digest = buildOpsDigest({ user, admin: user.account_tier !== 'sub', today: kstToday(), now: new Date().toISOString(), data, focus: card.id });
      return Response.json({ ok: true, digest }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (user.is_active === false || !['service', 'sub'].includes(user.account_tier) || !user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const data = await loadOpsData(base44.asServiceRole, user.tenant_id, { staffUser: user });
    const digest = buildOpsDigest({ user, admin: user.account_tier === 'service', today: kstToday(), now: new Date().toISOString(), data });
    return Response.json({ ok: true, digest, receives_email: user.notification_prefs?.daily?.email !== false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
