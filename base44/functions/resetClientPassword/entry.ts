import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// 마스터/서비스 관리자가 고객 이메일로 비밀번호 재설정 링크를 발송한다.
// 플랫폼이 관리자의 직접 비밀번호 설정을 지원하지 않으므로 resetPasswordRequest(이메일 발송) 방식만 사용한다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['master', 'service'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (user.is_active === false) return Response.json({ error: '비활성 계정입니다' }, { status: 403 });

    const { email } = await req.json();
    const target = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return Response.json({ error: '유효한 이메일이 아닙니다' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const users = await svc.entities.User.filter({ email: target });
    const client = users.find((item) => item.account_tier === 'client');
    if (!client) return Response.json({ error: '등록된 고객 계정을 찾을 수 없습니다' }, { status: 404 });

    const clientTenant = client.tenant_id ? await svc.entities.Tenant.get(client.tenant_id) : null;
    const canReset = user.account_tier === 'master'
      || (user.account_tier === 'service' && clientTenant?.hq_tenant_id === user.tenant_id);
    if (!canReset) return Response.json({ error: '해당 고객 계정에 대한 권한이 없습니다' }, { status: 403 });

    await base44.auth.resetPasswordRequest(target);
    return Response.json({ ok: true, email: target });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}