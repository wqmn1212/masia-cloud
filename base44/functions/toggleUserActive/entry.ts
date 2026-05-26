import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 계정 활성/비활성 토글
// - 마스터: service 계정만 토글 가능
// - 서비스 관리자: 자신의 sub 계정만 토글 가능
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { target_user_id, is_active } = await req.json();
    if (!target_user_id || typeof is_active !== 'boolean') {
      return Response.json({ error: '잘못된 요청' }, { status: 400 });
    }

    const targets = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    if (targets.length === 0) {
      return Response.json({ error: '대상 계정을 찾을 수 없습니다' }, { status: 404 });
    }
    const target = targets[0];

    const isMasterTogglingService =
      user.account_tier === 'master' && target.account_tier === 'service';
    const isServiceTogglingOwnSub =
      user.account_tier === 'service' &&
      target.account_tier === 'sub' &&
      target.service_admin_id === user.id;

    if (!isMasterTogglingService && !isServiceTogglingOwnSub) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.asServiceRole.entities.User.update(target_user_id, { is_active });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});