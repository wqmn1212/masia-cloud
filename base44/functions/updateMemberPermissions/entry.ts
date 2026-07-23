import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.account_tier !== 'service' || user.is_active === false) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { target_user_id, allowed_tabs, team_role = 'member' } = await req.json();
    if (!target_user_id || !Array.isArray(allowed_tabs) || !['manager', 'member', 'viewer'].includes(team_role)) {
      return Response.json({ error: '잘못된 요청입니다' }, { status: 400 });
    }
    const targets = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    const target = targets[0];
    if (!target || target.account_tier !== 'sub' || target.tenant_id !== user.tenant_id) {
      return Response.json({ error: '같은 팀의 팀원만 변경할 수 있습니다' }, { status: 403 });
    }
    await base44.asServiceRole.entities.User.update(target.id, { allowed_tabs, team_role });
    return Response.json({ ok: true, allowed_tabs, team_role });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});