import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// 마스터 또는 팀 관리자의 계정 활성/비활성 관리
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { target_user_id, is_active } = await req.json();
    if (!target_user_id || typeof is_active !== 'boolean') {
      return Response.json({ error: '잘못된 요청' }, { status: 400 });
    }
    const targets = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    const target = targets[0];
    if (!target) return Response.json({ error: '대상 계정을 찾을 수 없습니다' }, { status: 404 });

    const masterCanManage = user.account_tier === 'master' && ['service', 'sub'].includes(target.account_tier);
    const serviceCanManage = user.account_tier === 'service' && target.account_tier === 'sub' && target.tenant_id === user.tenant_id;
    if (!masterCanManage && !serviceCanManage) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await base44.asServiceRole.entities.User.update(target_user_id, { is_active });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}