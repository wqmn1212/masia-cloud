import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 마스터 관리자 초기 셋업: 시스템에 마스터가 없고 현재 사용자가 Base44 admin 이면 본인을 master로 지정
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const masters = await base44.asServiceRole.entities.User.filter({ account_tier: 'master' });

    if (masters.length > 0) {
      if (masters[0].id === user.id) {
        return Response.json({ status: 'is_master' });
      }
      return Response.json({ status: 'master_exists' });
    }

    if (user.role !== 'admin') {
      return Response.json({ status: 'not_eligible' });
    }

    await base44.asServiceRole.entities.User.update(user.id, {
      account_tier: 'master',
      is_active: true,
    });
    return Response.json({ status: 'became_master' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});