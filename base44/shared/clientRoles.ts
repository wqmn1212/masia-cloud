// 고객사 역할과 사내 결재 공용 규칙 (2단계 C).
// 역할·결재 규칙은 고객이 직접 쓸 수 없는 Company 레코드(client_roles · approval_rules)에 서버만 쓴다.
// User 레코드는 본인이 고칠 수 있으므로 역할을 두지 않는다.
// 역할을 하나도 정하지 않은 고객사는 지금과 똑같이 동작한다: 누구나 결정, 결재 없음, 알림은 전원.
// 화면 src/lib/clientRoles.js 가 같은 규칙을 쓴다. 검산: npm run check:client-roles
import { bundleOf } from './notificationPrefs.ts';

export const CLIENT_ROLES = ['ADMIN', 'APPROVER', 'MEMBER', 'FINANCE'];
export const ROLE_LABEL: Record<string, string> = { ADMIN: '고객 관리자', APPROVER: '결재권자', MEMBER: '실무자', FINANCE: '재무' };

// 결재를 걸 수 있는 결정. 보류·수정 요청 같은 되돌림은 결재 없이 바로 전달한다
export const APPROVAL_KINDS = ['comparison_choice', 'quote_accept', 'qc_decision', 'spec_decision', 'file_review'];
export const APPROVAL_KIND_LABEL: Record<string, string> = {
  comparison_choice: '비교표 선택', quote_accept: '견적 수락', qc_decision: '출고 승인', spec_decision: '기준서 승인', file_review: '디자인 승인',
};
// 금액 기준을 둘 수 있는 결정 (금액이 있는 것만)
export const AMOUNT_KINDS = ['comparison_choice', 'quote_accept'];

const DECIDER_ROLES = ['ADMIN', 'APPROVER', 'MEMBER'];
const emailKey = (e: unknown) => String(e || '').trim().toLowerCase();

export function normalizeRoleList(list: unknown): string[] {
  const set = new Set(Array.isArray(list) ? list.map((r) => String(r || '').toUpperCase()) : []);
  return CLIENT_ROLES.filter((r) => set.has(r));
}

// [{ email, roles }] — 역할이 빈 사람은 뺀다
export function normalizeMembers(list: unknown): { email: string; roles: string[] }[] {
  const out = new Map<string, string[]>();
  for (const m of Array.isArray(list) ? list : []) {
    const email = emailKey(m?.email);
    const roles = normalizeRoleList(m?.roles);
    if (email && roles.length) out.set(email, roles);
  }
  return [...out].map(([email, roles]) => ({ email, roles }));
}

export const teamMembers = (company: any) => normalizeMembers(company?.client_roles);
export const hasRoleSetup = (company: any) => teamMembers(company).length > 0;
export const rolesOf = (company: any, email: unknown) => teamMembers(company).find((m) => m.email === emailKey(email))?.roles || [];
// 역할을 정한 고객사에서 역할이 없는 계정(나중에 초대 등)은 실무자로 본다
export function effectiveRoles(company: any, email: unknown): string[] {
  if (!hasRoleSetup(company)) return [];
  const roles = rolesOf(company, email);
  return roles.length ? roles : ['MEMBER'];
}

export function normalizeRules(input: any) {
  const kinds: Record<string, { on: boolean; min_amount_krw: number | null }> = {};
  for (const k of APPROVAL_KINDS) {
    const r = input?.kinds?.[k] || {};
    const min = Number(r.min_amount_krw);
    kinds[k] = { on: r.on === true, min_amount_krw: AMOUNT_KINDS.includes(k) && Number.isFinite(min) && min > 0 ? Math.round(min) : null };
  }
  return { kinds, block_self_approval: input?.block_self_approval === true };
}
export const anyRuleOn = (rules: any) => APPROVAL_KINDS.some((k) => normalizeRules(rules).kinds[k].on);

// 할 수 있는 일: manage(동료·역할·결재 규칙) · decide(승인·선택 같은 결정) · approve(결재)
export function can(company: any, email: unknown, what: 'manage' | 'decide' | 'approve') {
  if (!hasRoleSetup(company)) return what === 'decide';
  const roles = effectiveRoles(company, email);
  if (what === 'manage') return roles.includes('ADMIN');
  if (what === 'approve') return roles.includes('APPROVER');
  return roles.some((r) => DECIDER_ROLES.includes(r));
}

export const approversOf = (company: any) => teamMembers(company).filter((m) => m.roles.includes('APPROVER')).map((m) => m.email);

// 저장 전에 팀 구성이 규칙을 지킬 수 있는지 본다. 문제 없으면 null
export function validateTeam(members: { email: string; roles: string[] }[], rules: any): string | null {
  if (!members.length) return anyRuleOn(rules) ? '결재 규칙을 켜려면 결재권자를 먼저 정하세요' : null;
  if (!members.some((m) => m.roles.includes('ADMIN'))) return '고객 관리자가 한 명 이상 있어야 합니다';
  const approvers = members.filter((m) => m.roles.includes('APPROVER')).length;
  const r = normalizeRules(rules);
  if (anyRuleOn(r) && approvers === 0) return '결재 규칙을 켜려면 결재권자가 한 명 이상 있어야 합니다';
  if (anyRuleOn(r) && r.block_self_approval && approvers < 2) return '자기 요청 결재를 막으려면 결재권자가 두 명 이상 있어야 합니다';
  return null;
}

// 금액을 원화로 (환율이 없으면 null). fx: { usd_krw, usd_cny }
export function toKrw(amount: unknown, currency: unknown, fx: any): number | null {
  const n = Number(amount);
  if (amount == null || amount === '' || !Number.isFinite(n)) return null;
  const cur = String(currency || 'KRW').toUpperCase();
  if (cur === 'KRW') return Math.round(n);
  const usdKrw = Number(fx?.usd_krw);
  if (!(usdKrw > 0)) return null;
  if (cur === 'USD') return Math.round(n * usdKrw);
  const usdCny = Number(fx?.usd_cny);
  if (cur === 'CNY' && usdCny > 0) return Math.round((n / usdCny) * usdKrw);
  return null;
}

/**
 * 이 결정을 바로 실행할지, 결재 요청으로 돌릴지.
 * positive = 승인·선택·수락처럼 확정하는 결정 (보류·수정 요청은 false → 바로 전달)
 * amountKrw = 금액 기준을 볼 금액 (모르면 null → 기준 이상으로 본다)
 * 결재할 사람이 없으면(결재권자 없음, 또는 자기 결재를 막았는데 다른 결재권자 없음) 바로 실행한다.
 */
export function approvalNeeded({ company, kind, email, positive, amountKrw }: { company: any; kind: string; email: unknown; positive: boolean; amountKrw?: number | null }) {
  if (!positive || !hasRoleSetup(company) || !APPROVAL_KINDS.includes(kind)) return false;
  const rules = normalizeRules(company?.approval_rules);
  const rule = rules.kinds[kind];
  if (!rule.on) return false;
  if (rule.min_amount_krw && amountKrw != null && amountKrw < rule.min_amount_krw) return false;
  const me = emailKey(email);
  const approvers = approversOf(company);
  const isApprover = approvers.includes(me);
  if (isApprover && !rules.block_self_approval) return false;
  return approvers.some((a) => a !== me);
}

export function canApprove(company: any, email: unknown, approval: any) {
  if (!can(company, email, 'approve')) return false;
  const rules = normalizeRules(company?.approval_rules);
  return !(rules.block_self_approval && emailKey(approval?.requested_by_email) === emailKey(email));
}

// 역할별 알림 받는 사람 (공통 기반 표). 결재 요청은 결재권자에게만
export const ROLE_BUNDLES: Record<string, string[]> = {
  decision: ['MEMBER', 'APPROVER'],
  approval: ['APPROVER'],
  progress: ['MEMBER'],
  payment: ['FINANCE', 'MEMBER'],
  shipment: ['MEMBER', 'FINANCE'],
  quality: ['MEMBER'],
};
export const APPROVAL_NOTICE_TYPES = ['client_approval_requested'];

// 같은 고객사 계정 목록을 역할로 좁힌다. 역할을 정하지 않았거나, 좁혀서 아무도 안 남으면 그대로 보낸다
export function notificationAudience(company: any, users: any[], type: string) {
  if (!hasRoleSetup(company)) return users;
  const bundle = APPROVAL_NOTICE_TYPES.includes(type) ? 'approval' : bundleOf(type);
  if (!bundle || !ROLE_BUNDLES[bundle]) return users;
  const picked = users.filter((u) => effectiveRoles(company, u.email).some((r) => ROLE_BUNDLES[bundle].includes(r)));
  return picked.length ? picked : users;
}

// 견적서 총액과 통화 (결재 금액 기준용 근사값 — 고객 화면 금액은 getQuotationPresentation 이 계산)
export function quoteAmount(q: any): { amount: number | null; currency: string; fx: any } {
  const fx = { usd_krw: Number(q?.exchange_rate_krw) || null, usd_cny: Number(q?.exchange_rate_usd_cny) || null };
  if (q?.rounding_version === 2 && q?.final_total != null) return { amount: Number(q.final_total), currency: ['CNY', 'KRW'].includes(q.final_currency) ? q.final_currency : 'USD', fx };
  const usd = Number(q?.final_client_price) || Number(q?.final_price_usd) || 0;
  return { amount: usd > 0 ? usd : null, currency: 'USD', fx };
}
