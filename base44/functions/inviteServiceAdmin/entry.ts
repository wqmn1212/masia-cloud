import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { findUserByEmail, requestPasswordSetup } from '../../shared/invitationUser.ts';

// 마스터 관리자 전용: 새 서비스 관리자 초대 (Base44 admin 권한으로 초대 + 가입 후 자동 tier 적용)
export default async function(req) {
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

    const { email, team_name, tenant_id, account_label = '', send_password_setup = true } = await req.json();

    // 기존 팀에 팀 관리자(service) 추가 — 팀 마스터 지정은 바꾸지 않는다
    if (tenant_id) {
      if (!email) return Response.json({ error: '초대할 이메일이 필요합니다' }, { status: 400 });
      const normalized = email.trim().toLowerCase();
      const team = (await base44.asServiceRole.entities.Tenant.filter({ id: tenant_id }))[0];
      if (!team) return Response.json({ error: '팀을 찾을 수 없습니다' }, { status: 404 });
      if (team.tenant_type === 'client') return Response.json({ error: '고객사 팀에는 팀 관리자를 추가할 수 없습니다' }, { status: 400 });
      const label = account_label.trim() || team.name;
      const existing = await findUserByEmail(base44, normalized);
      if (existing) {
        if (existing.account_tier === 'master') return Response.json({ error: '마스터 계정은 팀 관리자로 바꿀 수 없습니다' }, { status: 409 });
        await base44.asServiceRole.entities.User.update(existing.id, { account_tier: 'service', tenant_id: team.id, is_active: true, account_label: label });
        return Response.json({ ok: true, applied: true, tenant: team });
      }
      await base44.users.inviteUser(normalized, 'user');
      const invites = await base44.asServiceRole.entities.PendingInvitation.filter({ email: normalized, tenant_id: team.id, claimed: false });
      const inviteData = { email: normalized, account_tier: 'service', tenant_id: team.id, account_label: label, claimed: false };
      if (invites[0]) await base44.asServiceRole.entities.PendingInvitation.update(invites[0].id, inviteData);
      else await base44.asServiceRole.entities.PendingInvitation.create(inviteData);
      return Response.json({ ok: true, pending: true, tenant: team });
    }

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

    const found = await findUserByEmail(base44, normalizedEmail);
    if (found) {
      await base44.asServiceRole.entities.User.update(found.id, {
        account_tier: 'service', tenant_id: tenant.id, is_active: true, account_label: team_name.trim(),
      });
      await base44.asServiceRole.entities.Tenant.update(tenant.id, { master_user_id: found.id });
      const passwordSetup = await requestPasswordSetup(base44, normalizedEmail, send_password_setup);
      return Response.json({ ok: true, applied: true, tenant, password_setup: passwordSetup });
    }

    await base44.users.inviteUser(normalizedEmail, 'user');
    await base44.asServiceRole.entities.PendingInvitation.create({
      email: normalizedEmail,
      account_tier: 'service',
      tenant_id: tenant.id,
      account_label: team_name.trim(),
      claimed: false,
    });
    const passwordSetup = await requestPasswordSetup(base44, normalizedEmail, send_password_setup, false);
    return Response.json({ ok: true, pending: true, tenant, password_setup: passwordSetup });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}