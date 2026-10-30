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
    if (user.is_active === false || !['service', 'sub'].includes(user.account_tier) || !user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const data = await loadOpsData(base44.asServiceRole, user.tenant_id, { staffUser: user });
    const digest = buildOpsDigest({ user, admin: user.account_tier === 'service', today: kstToday(), now: new Date().toISOString(), data });
    return Response.json({ ok: true, digest, receives_email: user.notification_prefs?.daily?.email !== false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
