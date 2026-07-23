import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.account_tier !== 'service' || user.is_active === false) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { target_user_id, team_role_id } = await req.json();
    if (!target_user_id || !team_role_id) return Response.json({ error: '팀원과 역할을 선택하세요' }, { status: 400 });
    const targets = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    const target = targets[0];
    if (!target || target.account_tier !== 'sub' || target.tenant_id !== user.tenant_id) {
      return Response.json({ error: '같은 팀의 팀원만 변경할 수 있습니다' }, { status: 403 });
    }
    const roles = await base44.asServiceRole.entities.TeamRole.filter({ id: team_role_id, tenant_id: user.tenant_id });
    const role = roles[0];
    if (!role) return Response.json({ error: '같은 팀의 역할만 배정할 수 있습니다' }, { status: 403 });
    const allowed_tabs = role.menu_paths || [];
    await base44.asServiceRole.entities.User.update(target.id, { team_role_id: role.id, team_role_name: role.name, allowed_tabs });
    return Response.json({ ok: true, team_role_id: role.id, team_role_name: role.name, allowed_tabs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});