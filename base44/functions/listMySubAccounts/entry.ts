import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// 팀 관리자 또는 마스터: 선택한 팀의 팀원 + 대기 초대 조회
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['service', 'master'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const tenantId = user.account_tier === 'master' ? body.tenant_id : user.tenant_id;
    if (!tenantId) return Response.json({ error: '팀을 선택하세요' }, { status: 400 });
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenantId });
    if (!tenants[0]) return Response.json({ error: '팀을 찾을 수 없습니다' }, { status: 404 });

    const tenant = tenants[0];
    const accountTier = tenant.tenant_type === 'client' ? 'client' : 'sub';
    const members = await base44.asServiceRole.entities.User.filter({ tenant_id: tenantId, account_tier: accountTier });
    const pending = await base44.asServiceRole.entities.PendingInvitation.filter({ tenant_id: tenantId, account_tier: accountTier, claimed: false });
    return Response.json({ members, subs: members, pending, tenant_type: tenant.tenant_type || 'internal' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}