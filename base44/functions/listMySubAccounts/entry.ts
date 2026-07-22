import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 서비스 관리자 전용: 자신이 초대한 하위 계정 + 대기 초대 조회
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.account_tier !== 'service') {
      return Response.json({ error: 'Forbidden: 서비스 관리자만 접근 가능' }, { status: 403 });
    }

    const subs = await base44.asServiceRole.entities.User.filter({
      tenant_id: user.tenant_id,
      account_tier: 'sub',
    });
    const pending = await base44.asServiceRole.entities.PendingInvitation.filter({
      tenant_id: user.tenant_id,
      account_tier: 'sub',
      claimed: false,
    });

    return Response.json({ subs, pending });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});