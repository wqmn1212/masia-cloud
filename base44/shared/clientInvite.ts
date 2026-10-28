// 고객사 계정 초대 공용 흐름. 직원의 provisionClientTeam 과 고객 관리자의 manageClientTeam 이 같이 쓴다.
// 기존 계정이면 바로 고객사에 붙이고 안내 메일, 새 계정이면 PendingInvitation + 플랫폼 초대 메일.
import { CLIENT_MENU } from './clientAccess.ts';
import { requestPasswordSetup } from './invitationUser.ts';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanEmails = (list: unknown) => [...new Set((Array.isArray(list) ? list : []).map((e) => String(e || '').trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];

// 다른 회사·직원 계정이나 다른 팀 초대가 있는 메일은 받지 않는다. 문제 없으면 null
export async function inviteConflict(svc: any, emails: string[], companyId: string | null) {
  for (const email of emails) {
    const users = await svc.entities.User.filter({ email });
    if (users.some((u: any) => u.account_tier && (u.account_tier !== 'client' || !companyId || u.company_id !== companyId))) return `${email}: 다른 회사 또는 직원 계정으로 사용 중입니다.`;
    const pending = await svc.entities.PendingInvitation.filter({ email, claimed: false });
    if (pending.some((i: any) => i.account_tier !== 'client' || !companyId || i.company_id !== companyId)) return `${email}: 다른 팀의 대기 중 초대가 있습니다.`;
  }
  return null;
}

// 지금 자리를 차지한 메일 (활성 계정 + 대기 중 초대). 비활성 계정은 자리를 차지하지 않는다
export async function seatsTaken(svc: any, tenantId: string) {
  const users = await svc.entities.User.filter({ tenant_id: tenantId, account_tier: 'client' });
  const invites = await svc.entities.PendingInvitation.filter({ tenant_id: tenantId, claimed: false });
  return new Set([
    ...users.filter((u: any) => u.is_active !== false).map((u: any) => String(u.email || '').toLowerCase()),
    ...invites.map((i: any) => String(i.email || '').toLowerCase()),
  ]);
}

// 좌석 상한 검사 후 초대. { error, status } 또는 { invited }
export async function inviteClients(base44: any, svc: any, { tenant, company, emails, label }: { tenant: any; company: any; emails: string[]; label: string }) {
  const seatLimit = Number(tenant.seat_limit) || 2;
  const taken = await seatsTaken(svc, tenant.id);
  const fresh = emails.filter((e) => !taken.has(e));
  if (taken.size + fresh.length > seatLimit) {
    return { error: `담당자 좌석 상한(${seatLimit}명)을 초과합니다. 현재 ${taken.size}명이 등록되어 있습니다.`, status: 403 };
  }
  const invited = [];
  for (const email of emails) {
    const inviteData = { email, account_tier: 'client', tenant_id: tenant.id, company_id: company.id, allowed_tabs: CLIENT_MENU, account_label: label, claimed: false };
    const found = await svc.entities.User.filter({ email });
    if (found[0]) {
      await svc.entities.User.update(found[0].id, { account_tier: 'client', tenant_id: tenant.id, company_id: company.id, allowed_tabs: CLIENT_MENU, account_label: label, is_active: true });
      const password_setup = await requestPasswordSetup(base44, email, true, true, label);
      invited.push({ email, applied: true, existing_account: true, password_setup });
      continue;
    }
    const pending = await svc.entities.PendingInvitation.filter({ email, tenant_id: tenant.id, claimed: false });
    if (pending[0]) await svc.entities.PendingInvitation.update(pending[0].id, inviteData);
    else await svc.entities.PendingInvitation.create(inviteData);
    await base44.users.inviteUser(email, 'user');
    invited.push({ email, pending: true });
  }
  return { invited };
}
