import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { CLIENT_ROLES, normalizeMembers, normalizeRoleList, normalizeRules, teamMembers, rolesOf, hasRoleSetup, can, validateTeam } from '../../shared/clientRoles.ts';
import { cleanEmails, inviteConflict, inviteClients, seatsTaken } from '../../shared/clientInvite.ts';

// 고객사 팀: 동료 목록·초대·역할·사용 중지·결재 규칙.
// 호출자: 고객 관리자(자기 회사만) · 직원(master, 같은 본사 팀의 service — 첫 고객 관리자 지정용) · 고객사 다른 계정은 목록만.
// 역할과 결재 규칙은 고객이 직접 고칠 수 없는 Company 레코드에만 쓴다.
//  action: list | invite {emails, roles} | set_roles {email, roles} | set_active {email, active} | set_rules {rules}
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false) return Response.json({ error: '비활성 계정입니다' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'list');
    const svc = base44.asServiceRole;

    const isClient = user.account_tier === 'client';
    const isStaff = ['master', 'service'].includes(user.account_tier);
    if (!isClient && !isStaff) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const companyId = isClient ? user.company_id : (body.company_id || body.view_company_id);
    if (!companyId) return Response.json({ error: '고객사를 선택하세요' }, { status: 400 });
    const company = await svc.entities.Company.get(companyId).catch(() => null);
    if (!company || company.company_type !== 'CLIENT') return Response.json({ error: '고객사를 찾을 수 없습니다' }, { status: 404 });
    if (user.account_tier === 'service' && company.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const [tenant] = await svc.entities.Tenant.filter({ company_id: company.id, tenant_type: 'client' });
    if (isClient && (!tenant || user.tenant_id !== tenant.id)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const me = String(user.email || '').toLowerCase();
    const canManage = isStaff || can(company, me, 'manage');
    const actorName = user.full_name || user.email || '';

    const loadMembers = async () => {
      const users = await svc.entities.User.filter({ account_tier: 'client', company_id: company.id });
      const invites = await svc.entities.PendingInvitation.filter({ company_id: company.id, claimed: false });
      const rows = new Map<string, any>();
      for (const u of users) {
        const email = String(u.email || '').toLowerCase();
        if (email) rows.set(email, { email, name: u.full_name || '', active: u.is_active !== false, pending: false, user_id: u.id });
      }
      for (const i of invites) {
        const email = String(i.email || '').toLowerCase();
        if (email && !rows.has(email)) rows.set(email, { email, name: '', active: true, pending: true, invite_id: i.id });
      }
      return [...rows.values()];
    };
    const save = async (members: any[], rules: any) => {
      const patch = { client_roles: members, approval_rules: rules, client_team_updated_at: new Date().toISOString(), client_team_updated_by_name: actorName };
      await svc.entities.Company.update(company.id, patch);
      Object.assign(company, patch);
    };
    const respond = async (extra = {}) => {
      const people = await loadMembers();
      const taken = tenant ? await seatsTaken(svc, tenant.id) : new Set();
      return Response.json({
        ok: true,
        company_name: company.company_name || '',
        seat_limit: Number(tenant?.seat_limit) || 2,
        seats_used: taken.size,
        has_setup: hasRoleSetup(company),
        can_manage: canManage,
        my_roles: isClient ? rolesOf(company, me) : [],
        rules: normalizeRules(company.approval_rules),
        updated_at: company.client_team_updated_at || null,
        updated_by_name: company.client_team_updated_by_name || '',
        members: people
          .map((p) => ({ ...p, roles: rolesOf(company, p.email), is_me: isClient && p.email === me }))
          .sort((a, b) => Number(b.active) - Number(a.active) || Number(a.pending) - Number(b.pending) || a.email.localeCompare(b.email)),
        ...extra,
      });
    };

    if (action === 'list') return respond();
    if (!canManage) return Response.json({ error: '고객 관리자만 바꿀 수 있습니다' }, { status: 403 });

    if (action === 'invite') {
      if (!tenant) return Response.json({ error: '고객사 팀이 아직 없습니다. 담당자에게 첫 초대를 요청하세요' }, { status: 400 });
      const emails = cleanEmails(body.emails);
      if (!emails.length) return Response.json({ error: '초대할 메일 주소를 적어 주세요' }, { status: 400 });
      const roles = normalizeRoleList(body.roles);
      // 역할을 정한 고객사는 새 동료도 역할을 정해서 초대한다 (안 정하면 실무자로 본다)
      const members = roles.length ? normalizeMembers([...teamMembers(company).filter((m) => !emails.includes(m.email)), ...emails.map((email) => ({ email, roles }))]) : teamMembers(company);
      const invalid = validateTeam(members, company.approval_rules);
      if (invalid) return Response.json({ error: invalid }, { status: 400 });
      const conflict = await inviteConflict(svc, emails, company.id);
      if (conflict) return Response.json({ error: conflict }, { status: 409 });
      const result = await inviteClients(base44, svc, { tenant, company, emails, label: company.company_name || '' });
      if (result.error) return Response.json({ error: result.error }, { status: result.status });
      if (roles.length) await save(members, normalizeRules(company.approval_rules));
      return respond({ invited: result.invited });
    }

    const people = await loadMembers();
    const target = String(body.email || '').trim().toLowerCase();
    const person = people.find((p) => p.email === target);

    if (action === 'set_roles') {
      if (!person) return Response.json({ error: '이 고객사 계정이 아닙니다' }, { status: 404 });
      const roles = normalizeRoleList(body.roles);
      if (Array.isArray(body.roles) && body.roles.some((r: unknown) => !CLIENT_ROLES.includes(String(r)))) return Response.json({ error: '알 수 없는 역할입니다' }, { status: 400 });
      const members = normalizeMembers([...teamMembers(company).filter((m) => m.email !== target), { email: target, roles }]);
      const invalid = validateTeam(members, company.approval_rules);
      if (invalid) return Response.json({ error: invalid }, { status: 400 });
      await save(members, normalizeRules(company.approval_rules));
      return respond();
    }

    if (action === 'set_active') {
      if (!person) return Response.json({ error: '이 고객사 계정이 아닙니다' }, { status: 404 });
      if (isClient && target === me) return Response.json({ error: '자기 계정은 사용 중지할 수 없습니다' }, { status: 400 });
      const active = body.active === true;
      if (!active) {
        // 사용 중지하면 역할도 뺀다 (남은 사람으로 규칙을 지킬 수 있어야 한다)
        const members = teamMembers(company).filter((m) => m.email !== target);
        const invalid = hasRoleSetup(company) ? validateTeam(members, company.approval_rules) : null;
        if (invalid) return Response.json({ error: `${invalid} — 다른 사람에게 역할을 먼저 넘기세요` }, { status: 400 });
        if (person.pending) await svc.entities.PendingInvitation.delete(person.invite_id);
        else await svc.entities.User.update(person.user_id, { is_active: false });
        if (members.length !== teamMembers(company).length) await save(members, normalizeRules(company.approval_rules));
        return respond();
      }
      if (person.pending || person.active) return respond();
      const taken = tenant ? await seatsTaken(svc, tenant.id) : new Set();
      const limit = Number(tenant?.seat_limit) || 2;
      if (taken.size + 1 > limit) return Response.json({ error: `담당자 좌석 상한(${limit}명)을 초과합니다. 현재 ${taken.size}명이 등록되어 있습니다.` }, { status: 403 });
      await svc.entities.User.update(person.user_id, { is_active: true });
      return respond();
    }

    if (action === 'set_rules') {
      const rules = normalizeRules(body.rules);
      const invalid = validateTeam(teamMembers(company), rules);
      if (invalid) return Response.json({ error: invalid }, { status: 400 });
      await save(teamMembers(company), rules);
      return respond();
    }

    return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
