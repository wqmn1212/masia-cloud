import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 서비스 관리자 전용: 자신의 하위 계정 초대
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.account_tier !== 'service') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (user.is_active === false) {
      return Response.json({ error: '비활성 계정입니다' }, { status: 403 });
    }

    const { email, account_label, allowed_tabs = [] } = await req.json();
    if (!email || !user.tenant_id) {
      return Response.json({ error: '이메일 또는 소속 팀 정보가 없습니다' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const found = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (found.length > 0) {
      await base44.asServiceRole.entities.User.update(found[0].id, {
        account_tier: 'sub', tenant_id: user.tenant_id, service_admin_id: user.id,
        allowed_tabs, is_active: true, account_label: account_label || '',
      });
      return Response.json({ ok: true, applied: true });
    }

    await base44.users.inviteUser(normalizedEmail, 'user');
    await base44.asServiceRole.entities.PendingInvitation.create({
      email: normalizedEmail,
      account_tier: 'sub',
      tenant_id: user.tenant_id,
      service_admin_id: user.id,
      allowed_tabs,
      account_label: account_label || '',
      claimed: false,
    });
    return Response.json({ ok: true, pending: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});