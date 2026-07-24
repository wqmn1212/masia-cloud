import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizeMenuPaths } from '../../shared/rbac.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.account_tier !== 'service' || user.is_active === false || !user.tenant_id) {
      return Response.json({ error: '팀 관리자만 역할을 관리할 수 있습니다' }, { status: 403 });
    }
    const { action = 'list', role_id, name, description = '', menu_paths = [] } = await req.json();
    const roles = await base44.asServiceRole.entities.TeamRole.filter({ tenant_id: user.tenant_id });
    if (action === 'list') return Response.json({ roles });
    if (action === 'create') {
      if (!name?.trim()) return Response.json({ error: '역할명을 입력하세요' }, { status: 400 });
      if (roles.some((role) => role.name.trim() === name.trim())) return Response.json({ error: '같은 이름의 역할이 있습니다' }, { status: 409 });
      const role = await base44.asServiceRole.entities.TeamRole.create({ tenant_id: user.tenant_id, name: name.trim(), description: description.trim(), menu_paths: normalizeMenuPaths(menu_paths) });
      return Response.json({ role });
    }
    const role = roles.find((item) => item.id === role_id);
    if (!role) return Response.json({ error: '역할을 찾을 수 없습니다' }, { status: 404 });
    if (action === 'update') {
      if (!name?.trim()) return Response.json({ error: '역할명을 입력하세요' }, { status: 400 });
      const paths = normalizeMenuPaths(menu_paths);
      const updated = await base44.asServiceRole.entities.TeamRole.update(role.id, { name: name.trim(), description: description.trim(), menu_paths: paths });
      const members = await base44.asServiceRole.entities.User.filter({ tenant_id: user.tenant_id, team_role_id: role.id });
      if (members.length) {
        await Promise.all(members.map((member) => base44.asServiceRole.entities.User.update(member.id, {
          team_role_name: name.trim(),
          allowed_tabs: paths,
        })));
      }
      return Response.json({ role: updated });
    }
    if (action === 'delete') {
      const members = await base44.asServiceRole.entities.User.filter({ tenant_id: user.tenant_id, team_role_id: role.id });
      if (members.length) return Response.json({ error: '사용 중인 역할은 삭제할 수 없습니다' }, { status: 409 });
      await base44.asServiceRole.entities.TeamRole.delete(role.id);
      return Response.json({ ok: true });
    }
    return Response.json({ error: '지원하지 않는 작업입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});