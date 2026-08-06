import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 마스터 관리자 초기 셋업: 시스템에 마스터가 없고 현재 사용자가 Base44 admin 이면 본인을 master로 지정
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 보안 주의: 이 이메일은 기본값(fallback)일 뿐입니다.
    // `base44 secrets set MASTER_ADMIN_EMAIL=your@email.com` 으로 시크릿을 설정해 두면
    // 코드에 실제 대표 이메일이 노출되지 않고 그 값이 우선 사용됩니다.
    const masterEmail = (Deno.env.get('MASTER_ADMIN_EMAIL') || 'makeforyou7@gmail.com').toLowerCase();
    if (user.email.toLowerCase() !== masterEmail || user.role !== 'admin') {
      return Response.json({ status: 'not_eligible' });
    }

    const masters = await base44.asServiceRole.entities.User.filter({ account_tier: 'master' });
    if (masters.length > 0 && masters[0].id !== user.id) {
      return Response.json({ status: 'master_exists' });
    }
    if (user.account_tier === 'master') {
      return Response.json({ status: 'is_master' });
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