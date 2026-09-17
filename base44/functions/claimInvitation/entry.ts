import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 가입 직후 호출: 이메일로 저장된 PendingInvitation 을 찾아 본인 계정에 tier/service_admin_id 적용
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 이미 tier 가 있으면 스킵
    if (user.account_tier) {
      return Response.json({ ok: true, alreadyClaimed: true, tier: user.account_tier });
    }

    const invites = await base44.asServiceRole.entities.PendingInvitation.filter({
      email: user.email.trim().toLowerCase(),
      claimed: false,
    }, '-created_date', 100);

    if (invites.length === 0) {
      return Response.json({ ok: true, noInvite: true });
    }

    // 여러 팀의 초대가 있더라도 정렬된 목록의 최신 초대를 결정적으로 적용한다.
    const invite = invites[0];
    const tenant = await base44.asServiceRole.entities.Tenant.get(invite.tenant_id);
    if (!tenant || tenant.is_active === false) return Response.json({ error: '초대받은 팀이 활성 상태가 아닙니다.' }, { status: 403 });

    // 레거시 초대도 실제 팀 유형을 기준으로 보정하여 고객 포털 스코프를 잃지 않게 한다.
    const isClientTenant = tenant.tenant_type === 'client';
    const effectiveTier = isClientTenant ? 'client' : invite.account_tier;
    const companyId = isClientTenant ? tenant.company_id : invite.company_id;
    if (isClientTenant) {
      if (!companyId) return Response.json({ error: '고객사 연결을 관리자에게 확인해주세요.' }, { status: 403 });
      const company = await base44.asServiceRole.entities.Company.get(companyId);
      if (!company || company.company_type !== 'CLIENT' || company.tenant_id !== tenant.hq_tenant_id) return Response.json({ error: '고객사 연결이 올바르지 않습니다.' }, { status: 403 });
    }
    const updateData = {
      account_tier: effectiveTier,
      tenant_id: invite.tenant_id,
      team_role_id: isClientTenant ? '' : (invite.team_role_id || ''),
      team_role_name: isClientTenant ? '' : (invite.team_role_name || ''),
      allowed_tabs: isClientTenant ? ['/client/dashboard', '/client/board'] : (invite.allowed_tabs || []),
      is_active: true,
      account_label: invite.account_label || '',
    };
    if (invite.service_admin_id) updateData.service_admin_id = invite.service_admin_id;
    if (companyId) updateData.company_id = companyId;

    await base44.asServiceRole.entities.User.update(user.id, updateData);
    if (effectiveTier === 'service') {
      await base44.asServiceRole.entities.Tenant.update(invite.tenant_id, { master_user_id: user.id });
    }
    await base44.asServiceRole.entities.PendingInvitation.update(invite.id, { claimed: true });

    return Response.json({ ok: true, claimed: true, tier: effectiveTier });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}