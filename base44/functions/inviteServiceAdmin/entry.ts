import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 마스터 관리자 전용: 새 서비스 관리자 초대 (Base44 admin 권한으로 초대 + 가입 후 자동 tier 적용)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.account_tier !== 'master') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, team_name } = await req.json();
    if (!email || !team_name) {
      return Response.json({ error: '팀 이름과 팀 마스터 이메일이 필요합니다' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingTeams = await base44.asServiceRole.entities.Tenant.filter({ name: team_name.trim() });
    let tenant = existingTeams[0];
    if (tenant?.master_user_id || tenant?.master_email) {
      return Response.json({ error: '이미 팀 마스터가 지정된 팀입니다' }, { status: 409 });
    }
    if (!tenant) {
      tenant = await base44.asServiceRole.entities.Tenant.create({
        name: team_name.trim(),
        slug: `${team_name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-')}-${crypto.randomUUID().slice(0, 8)}`,
        master_email: normalizedEmail,
        is_active: true,
      });
    } else {
      tenant = await base44.asServiceRole.entities.Tenant.update(tenant.id, { master_email: normalizedEmail, is_active: true });
    }

    const found = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (found.length > 0) {
      await base44.asServiceRole.entities.User.update(found[0].id, {
        account_tier: 'service', tenant_id: tenant.id, is_active: true, account_label: team_name.trim(),
      });
      await base44.asServiceRole.entities.Tenant.update(tenant.id, { master_user_id: found[0].id });
      return Response.json({ ok: true, applied: true, tenant });
    }

    await base44.users.inviteUser(normalizedEmail, 'user');
    await base44.asServiceRole.entities.PendingInvitation.create({
      email: normalizedEmail,
      account_tier: 'service',
      tenant_id: tenant.id,
      account_label: team_name.trim(),
      claimed: false,
    });
    return Response.json({ ok: true, pending: true, tenant });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});