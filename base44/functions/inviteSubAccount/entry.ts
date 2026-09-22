import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { findUserByEmail, requestPasswordSetup } from '../../shared/invitationUser.ts';
import { normalizeMenuPaths } from '../../shared/rbac.ts';

// 팀 관리자 전용: 자신의 하위 계정 초대
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['service', 'master'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (user.is_active === false) return Response.json({ error: '비활성 계정입니다' }, { status: 403 });

    const body = await req.json();
    const { email, account_label, team_role_id, tenant_id, send_password_setup = true } = body;
    const targetTenantId = user.account_tier === 'master' ? tenant_id : user.tenant_id;
    if (!email || !targetTenantId) return Response.json({ error: '이메일 또는 소속 팀 정보가 없습니다' }, { status: 400 });

    const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: targetTenantId });
    const tenant = tenants[0];
    if (!tenant) return Response.json({ error: '팀을 찾을 수 없습니다' }, { status: 404 });
    const isClientTenant = tenant.tenant_type === 'client';
    if (isClientTenant && !tenant.company_id) return Response.json({ error: '고객사 연결 정보가 없습니다' }, { status: 400 });

    let role = null;
    if (!isClientTenant && team_role_id) {
      const roles = await base44.asServiceRole.entities.TeamRole.filter({ id: team_role_id, tenant_id: targetTenantId });
      role = roles[0];
      if (!role) return Response.json({ error: '같은 팀의 역할을 선택하세요' }, { status: 403 });
    }
    const accountTier = isClientTenant ? 'client' : 'sub';
    const hasAdjustedTabs = Array.isArray(body.allowed_tabs) || Array.isArray(body.menu_paths);
    const requestedTabs = body.allowed_tabs || body.menu_paths || [];
    const allowedTabs = isClientTenant
      ? ['/client/dashboard', '/client/board']
      : hasAdjustedTabs ? normalizeMenuPaths(requestedTabs) : normalizeMenuPaths(role?.menu_paths || []);
    if (!isClientTenant && allowedTabs.length === 0) return Response.json({ error: '접근 기능을 한 개 이상 선택하세요' }, { status: 400 });
    const managers = await base44.asServiceRole.entities.User.filter({ tenant_id: targetTenantId, account_tier: 'service' });
    const serviceAdminId = managers[0]?.id || user.id;
    const normalizedEmail = email.trim().toLowerCase();
    const accountData = {
      account_tier: accountTier,
      tenant_id: targetTenantId,
      service_admin_id: serviceAdminId,
      team_role_id: role?.id || '',
      team_role_name: role?.name || '',
      allowed_tabs: allowedTabs,
      is_active: true,
      account_label: account_label || '',
    };
    if (isClientTenant) accountData.company_id = tenant.company_id;

    const found = await findUserByEmail(base44, normalizedEmail);
    if (found) {
      await base44.asServiceRole.entities.User.update(found.id, accountData);
      const passwordSetup = await requestPasswordSetup(base44, normalizedEmail, send_password_setup);
      return Response.json({ ok: true, applied: true, password_setup: passwordSetup });
    }

    await base44.users.inviteUser(normalizedEmail, 'user');
    const pending = await base44.asServiceRole.entities.PendingInvitation.filter({ email: normalizedEmail, tenant_id: targetTenantId, claimed: false });
    const invitationData = {
      email: normalizedEmail,
      account_tier: accountTier,
      tenant_id: targetTenantId,
      service_admin_id: serviceAdminId,
      team_role_id: role?.id || '',
      team_role_name: role?.name || '',
      allowed_tabs: allowedTabs,
      account_label: account_label || '',
      claimed: false,
    };
    if (isClientTenant) invitationData.company_id = tenant.company_id;
    if (pending[0]) await base44.asServiceRole.entities.PendingInvitation.update(pending[0].id, invitationData);
    else await base44.asServiceRole.entities.PendingInvitation.create(invitationData);
    const passwordSetup = await requestPasswordSetup(base44, normalizedEmail, send_password_setup, false);
    return Response.json({ ok: true, pending: true, password_setup: passwordSetup });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}