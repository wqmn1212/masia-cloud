import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// 팀 관리자 전용: 자신의 하위 계정 초대
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['service', 'master'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (user.is_active === false) {
      return Response.json({ error: '비활성 계정입니다' }, { status: 403 });
    }

    const { email, account_label, team_role_id, tenant_id } = await req.json();
    const targetTenantId = user.account_tier === 'master' ? tenant_id : user.tenant_id;
    if (!email || !targetTenantId || !team_role_id) {
      return Response.json({ error: '이메일 또는 소속 팀 정보가 없습니다' }, { status: 400 });
    }
    if (user.account_tier === 'master') {
      const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: targetTenantId });
      if (!tenants[0]) return Response.json({ error: '팀을 찾을 수 없습니다' }, { status: 404 });
    }

    const roles = await base44.asServiceRole.entities.TeamRole.filter({ id: team_role_id, tenant_id: targetTenantId });
    const role = roles[0];
    if (!role) return Response.json({ error: '같은 팀의 역할을 선택하세요' }, { status: 403 });

    const allowed_tabs = role.menu_paths || [];
    const managers = await base44.asServiceRole.entities.User.filter({ tenant_id: targetTenantId, account_tier: 'service' });
    const serviceAdminId = managers[0]?.id || user.id;
    const normalizedEmail = email.trim().toLowerCase();
    const found = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (found.length > 0) {
      await base44.asServiceRole.entities.User.update(found[0].id, {
        account_tier: 'sub', tenant_id: targetTenantId, service_admin_id: serviceAdminId,
        team_role_id: role.id, team_role_name: role.name, allowed_tabs, is_active: true, account_label: account_label || '',
      });
      return Response.json({ ok: true, applied: true });
    }

    await base44.users.inviteUser(normalizedEmail, 'user');
    const pending = await base44.asServiceRole.entities.PendingInvitation.filter({ email: normalizedEmail, tenant_id: targetTenantId, claimed: false });
    const invitationData = {
      email: normalizedEmail, account_tier: 'sub', tenant_id: targetTenantId,
      service_admin_id: serviceAdminId, team_role_id: role.id, team_role_name: role.name,
      allowed_tabs, account_label: account_label || '', claimed: false,
    };
    if (pending[0]) {
      await base44.asServiceRole.entities.PendingInvitation.update(pending[0].id, invitationData);
    } else {
      await base44.asServiceRole.entities.PendingInvitation.create(invitationData);
    }
    return Response.json({ ok: true, pending: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}