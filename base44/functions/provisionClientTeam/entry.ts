import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { CLIENT_MENU } from '../../shared/clientAccess.ts';
import { cleanEmails, inviteConflict, inviteClients } from '../../shared/clientInvite.ts';


// 리드 → 고객사 팀 생성 및 담당자 초대. 고객사가 생긴 뒤 동료 초대는 고객 관리자도 manageClientTeam 으로 할 수 있다.
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

    const { lead_id, company_id, emails } = await req.json();
    if (!lead_id && !company_id) return Response.json({ error: 'lead_id 또는 company_id 가 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    let lead;
    if (lead_id) {
      lead = await svc.entities.ManufacturingLead.get(lead_id);
    } else {
      // 고객사 카드 기반: Company 를 리드와 같은 형태로 맞춰 동일 흐름을 재사용한다
      const [c] = await svc.entities.Company.filter({ id: company_id, company_type: 'CLIENT' });
      if (!c) return Response.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 });
      const [t] = await svc.entities.Tenant.filter({ company_id: c.id, tenant_type: 'client' });
      if (!c.tenant_id) {
        const headquarters = await svc.entities.Tenant.filter({ is_hq: true }, undefined, 2);
        if (headquarters.length !== 1 || headquarters[0].is_active === false || headquarters[0].tenant_type === 'client') {
          return Response.json({ error: '고객사를 연결할 활성 본사 팀을 하나로 확인할 수 없습니다.' }, { status: 400 });
        }
        const hq = headquarters[0];
        if (user.account_tier !== 'master' && user.tenant_id !== hq.id) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (t && t.hq_tenant_id !== hq.id) {
          return Response.json({ error: '고객사 팀의 본사 연결을 확인하세요.' }, { status: 409 });
        }
        await svc.entities.Company.update(c.id, { tenant_id: hq.id });
        c.tenant_id = hq.id;
      }
      lead = { id: null, tenant_id: c.tenant_id, company: c.company_name, contact_name: c.contact_person, phone: c.phone, email: c.email, client_id: c.id, client_tenant_id: t?.id };
    }
    if (!lead) return Response.json({ error: '문의를 찾을 수 없습니다' }, { status: 404 });
    if (user.account_tier !== 'master' && lead.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const inviteList = cleanEmails(Array.isArray(emails) && emails.length > 0 ? emails : [lead.email]);
    if (inviteList.length === 0) return Response.json({ error: '유효한 이메일이 없습니다' }, { status: 400 });

    const hqTenantId = lead.tenant_id;
    if (!hqTenantId) return Response.json({ error: '문의의 소속 팀을 확인하세요.' }, { status: 400 });
    const conflict = await inviteConflict(svc, inviteList, lead.client_id || null);
    if (conflict) return Response.json({ error: conflict }, { status: 409 });

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
    if (lead.id) await svc.entities.ManufacturingLead.update(lead.id, { client_id: company.id, client_tenant_id: tenant.id });

    // 2·3. 좌석 상한 검사 후 초대 (기존 계정이면 즉시 적용, 신규면 PendingInvitation)
    const result = await inviteClients(base44, svc, { tenant, company, emails: inviteList, label: lead.company });
    if (result.error) return Response.json({ error: result.error }, { status: result.status });
    const invited = result.invited;

    // 4. 리드 · 카드 연결
    if (lead.id) await svc.entities.ManufacturingLead.update(lead.id, {
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