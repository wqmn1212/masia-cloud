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

    const { email, account_label } = await req.json();
    if (!email) {
      return Response.json({ error: '이메일이 필요합니다' }, { status: 400 });
    }

    // Base44 초대 발송 (admin role)
    await base44.users.inviteUser(email, 'admin');

    // 이미 가입된 사용자인지 확인 후 즉시 tier 적용
    const found = await base44.asServiceRole.entities.User.filter({ email });
    if (found.length > 0) {
      await base44.asServiceRole.entities.User.update(found[0].id, {
        account_tier: 'service',
        is_active: true,
        account_label: account_label || '',
      });
      return Response.json({ ok: true, applied: true });
    }

    // 아직 가입 전이면 대기 초대로 저장 -> 가입 후 claimInvitation 으로 적용됨
    await base44.asServiceRole.entities.PendingInvitation.create({
      email,
      account_tier: 'service',
      account_label: account_label || '',
      claimed: false,
    });
    return Response.json({ ok: true, pending: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});