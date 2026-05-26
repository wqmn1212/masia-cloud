import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 마스터 관리자 전용: 전체 서비스 관리자 + 대기 중인 초대 목록 조회
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.account_tier !== 'master') {
      return Response.json({ error: 'Forbidden: 마스터 관리자만 접근 가능' }, { status: 403 });
    }

    const serviceAdmins = await base44.asServiceRole.entities.User.filter({ account_tier: 'service' });
    const pending = await base44.asServiceRole.entities.PendingInvitation.filter({
      account_tier: 'service',
      claimed: false,
    });

    return Response.json({ serviceAdmins, pending });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});