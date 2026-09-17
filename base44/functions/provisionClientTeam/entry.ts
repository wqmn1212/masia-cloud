import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { CLIENT_MENU } from '../../shared/clientAccess.ts';


// 리드 → 고객사 팀 생성 및 담당자 초대. 초대는 어드민만 가능하다 (고객의 자체 초대 없음).
// 최초 호출에서 Tenant · Company · TeamRole 을 만들고, 이후 호출은 기존 팀에 초대만 추가한다.
const slugify = (s) =>
  (s || 'client')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['master', 'service'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (user.is_active === false) return Response.json({ error: '비활성 계정입니다' }, { status: 403 });

    const { lead_id, emails } = await req.json();
    if (!lead_id) return Response.json({ error: 'lead_id 가 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const lead = await svc.entities.ManufacturingLead.get(lead_id);
    if (!lead) return Response.json({ error: '문의를 찾을 수 없습니다' }, { status: 404 });
    if (user.account_tier !== 'master' && lead.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const inviteList = [...new Set(
      (Array.isArray(emails) && emails.length > 0 ? emails : [lead.email])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )];
    if (inviteList.length === 0) return Response.json({ error: '유효한 이메일이 없습니다' }, { status: 400 });

    const hqTenantId = lead.tenant_id;
    if (!hqTenantId) return Response.json({ error: '문의의 소속 팀을 확인하세요.' }, { status: 400 });
    for (const email of inviteList) {
      const users = await svc.entities.User.filter({ email });
      if (users.some(u => u.account_tier && (u.account_tier !== 'client' || !lead.client_id || u.company_id !== lead.client_id))) return Response.json({ error: `${email}: 다른 회사 또는 직원 계정으로 사용 중입니다.` }, { status: 409 });
      const pending = await svc.entities.PendingInvitation.filter({ email, claimed: false });
      if (pending.some(i => i.account_tier !== 'client' || !lead.client_id || i.company_id !== lead.client_id)) return Response.json({ error: `${email}: 다른 팀의 대기 중 초대가 있습니다.` }, { status: 409 });
    }

    // 1. 고객사 팀 (최초 1회)
    let tenant = lead.client_tenant_id ? await svc.entities.Tenant.get(lead.client_tenant_id) : null;
    let company = lead.client_id ? await svc.entities.Company.get(lead.client_id) : null;

    if (!company) {
      company = await svc.entities.Company.create({
        tenant_id: hqTenantId,
        company_type: 'CLIENT',
        company_name: lead.company,
        contact_person: lead.contact_name,
        phone: lead.phone,
        email: lead.email,
        memo: `랜딩 문의 전환 · ${lead.categories?.join(', ') || '-'}`,
      });
    }

    if (!tenant) {
      tenant = await svc.entities.Tenant.create({
        name: lead.company,
        slug: `${slugify(lead.company)}-${Date.now().toString(36)}`,
        master_email: inviteList[0],
        is_active: true,
        is_hq: false,
        tenant_type: 'client',
        hq_tenant_id: hqTenantId,
        company_id: company.id,
        seat_limit: 2,
      });
      await svc.entities.TeamRole.create({
        tenant_id: tenant.id,
        name: '고객사',
        description: '고객 포털 — 대시보드 및 소싱 보드 읽기 전용',
        menu_paths: CLIENT_MENU,
      });
    }

    if (company.tenant_id !== hqTenantId || tenant.company_id !== company.id || tenant.hq_tenant_id !== hqTenantId || tenant.tenant_type !== 'client') return Response.json({ error: '고객사 팀 연결을 확인하세요.' }, { status: 409 });
    // 초대 발송 실패 후에도 동일 팀으로 재시도할 수 있도록 연결부터 보관한다.
    await svc.entities.ManufacturingLead.update(lead.id, { client_id: company.id, client_tenant_id: tenant.id });

    // 2. 좌석 상한 검사 (유료화 대비)
    const seatLimit = Number(tenant.seat_limit) || 2;
    const existingUsers = await svc.entities.User.filter({ tenant_id: tenant.id, account_tier: 'client' });
    const existingInvites = await svc.entities.PendingInvitation.filter({ tenant_id: tenant.id, claimed: false });
    const seatsTaken = new Set([
      ...existingUsers.map((u) => (u.email || '').toLowerCase()),
      ...existingInvites.map((i) => (i.email || '').toLowerCase()),
    ]);
    const newEmails = inviteList.filter((e) => !seatsTaken.has(e));
    if (seatsTaken.size + newEmails.length > seatLimit) {
      return Response.json(
        { error: `담당자 좌석 상한(${seatLimit}명)을 초과합니다. 현재 ${seatsTaken.size}명이 등록되어 있습니다.` },
        { status: 403 }
      );
    }

    // 3. 초대 (기존 계정이면 즉시 적용, 신규면 PendingInvitation)
    const invited = [];
    for (const email of inviteList) {
      const inviteData = {
        email,
        account_tier: 'client',
        tenant_id: tenant.id,
        company_id: company.id,
        allowed_tabs: CLIENT_MENU,
        account_label: lead.company,
        claimed: false,
      };
      const found = await svc.entities.User.filter({ email });
      if (found[0]) {
        await svc.entities.User.update(found[0].id, {
          account_tier: 'client',
          tenant_id: tenant.id,
          company_id: company.id,
          allowed_tabs: CLIENT_MENU,
          account_label: lead.company,
          is_active: true,
        });
        invited.push({ email, applied: true, existing_account: true });
        continue;
      }
      const pending = await svc.entities.PendingInvitation.filter({ email, tenant_id: tenant.id, claimed: false });
      if (pending[0]) {
        await svc.entities.PendingInvitation.update(pending[0].id, inviteData);
      } else {
        await svc.entities.PendingInvitation.create(inviteData);
      }
      await base44.users.inviteUser(email, 'user');
      invited.push({ email, pending: true });
    }

    // 4. 리드 · 카드 연결
    await svc.entities.ManufacturingLead.update(lead.id, {
      status: 'converted',
      client_id: company.id,
      client_tenant_id: tenant.id,
      invitation_sent: true,
    });
    if (lead.task_card_id) {
      await svc.entities.TaskCard.update(lead.task_card_id, {
        client_id: company.id,
        client_name: lead.company,
      });
    }

    return Response.json({ ok: true, tenant_id: tenant.id, company_id: company.id, invited });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}