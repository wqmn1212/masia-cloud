import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// SaaS 마스터 전용: 전체 팀·계정 조회, 팀 중지/활성/삭제, 계정 삭제
const MANAGED_TIERS = ['service', 'sub', 'client'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.account_tier !== 'master' || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: 마스터 관리자만 가능합니다' }, { status: 403 });
    }
    const svc = base44.asServiceRole.entities;
    const { action, tenant_id, is_active, confirm, target_user_id } = await req.json();

    if (action === 'list_all') {
      const [users, tenants] = await Promise.all([svc.User.list('-created_date', 1000), svc.Tenant.list('-created_date', 500)]);
      const accounts = users
        .filter((u) => MANAGED_TIERS.includes(u.account_tier))
        .map((u) => ({ id: u.id, email: u.email, full_name: u.full_name, account_tier: u.account_tier, account_label: u.account_label, tenant_id: u.tenant_id, is_active: u.is_active }));
      return Response.json({ accounts, tenants });
    }

    if (action === 'delete_user') {
      const [target] = await svc.User.filter({ id: target_user_id });
      if (!target) return Response.json({ error: '계정을 찾을 수 없습니다' }, { status: 404 });
      if (!MANAGED_TIERS.includes(target.account_tier)) return Response.json({ error: '마스터 계정은 삭제할 수 없습니다' }, { status: 403 });
      if ((confirm || '').trim().toLowerCase() !== String(target.email).toLowerCase()) {
        return Response.json({ error: '확인용 이메일이 일치하지 않습니다' }, { status: 400 });
      }
      const invites = await svc.PendingInvitation.filter({ email: target.email, claimed: false });
      for (const inv of invites) await svc.PendingInvitation.delete(inv.id);
      await svc.User.delete(target.id);
      return Response.json({ ok: true });
    }

    const [tenant] = await svc.Tenant.filter({ id: tenant_id });
    if (!tenant) return Response.json({ error: '팀을 찾을 수 없습니다' }, { status: 404 });
    if (tenant.id === user.tenant_id) return Response.json({ error: '본인이 속한 팀은 중지·삭제할 수 없습니다' }, { status: 400 });

    if (action === 'set_tenant_active') {
      if (typeof is_active !== 'boolean') return Response.json({ error: '잘못된 요청' }, { status: 400 });
      await svc.Tenant.update(tenant.id, { is_active });
      return Response.json({ ok: true });
    }

    if (action === 'tenant_impact') {
      const [members, invites, cards, quotes] = await Promise.all([
        svc.User.filter({ tenant_id: tenant.id }, '-created_date', 1000),
        svc.PendingInvitation.filter({ tenant_id: tenant.id, claimed: false }),
        svc.TaskCard.filter({ tenant_id: tenant.id }, '-created_date', 1),
        svc.Quotation.filter({ tenant_id: tenant.id }, '-created_date', 1),
      ]);
      return Response.json({ member_count: members.length, invite_count: invites.length, has_data: cards.length > 0 || quotes.length > 0 });
    }

    if (action === 'delete_tenant') {
      if ((confirm || '').trim() !== String(tenant.name).trim()) {
        return Response.json({ error: '확인용 팀 이름이 일치하지 않습니다' }, { status: 400 });
      }
      const members = await svc.User.filter({ tenant_id: tenant.id }, '-created_date', 1000);
      // 내장 User 엔티티는 일괄 수정이 지원되지 않아 개별 수정한다
      for (const m of members.filter((m) => m.account_tier !== 'master' && m.is_active !== false)) {
        await svc.User.update(m.id, { is_active: false });
      }
      const invites = await svc.PendingInvitation.filter({ tenant_id: tenant.id, claimed: false });
      for (const inv of invites) await svc.PendingInvitation.delete(inv.id);
      await svc.Tenant.delete(tenant.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: '지원하지 않는 작업입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}