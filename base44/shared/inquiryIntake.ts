// 새 문의 접수: 책임자 자동 배정과 견적 기한. 팀 설정(OperationSetting)의 배정 규칙을 쓴다.
//  - 책임자: 고객사 규칙 → 카테고리 규칙(문의 카테고리 순서) → 팀 기본 담당자. 지금 팀에 없는(퇴사·비활성) 사람은 건너뛴다
//  - 견적 기한: 접수일 + 견적 기한(영업일, 기본 3일). 희망 입고일이 가까우면(기본 30일 안) 급한 문의 → 다음 영업일, 우선순위 높음
// 계산만 여기, 저장·알림은 intakeServer.ts. 검산: npm run check:inquiry-intake
export const BASE_SLA_DAYS = 3;
export const BASE_RUSH_WINDOW_DAYS = 30;
export const MAX_RULES = 100;
const SCOPES = ['CLIENT', 'CATEGORY'];
const DAY = 86400000;
const s = (v: unknown, n = 120) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const int = (v: unknown, min: number, max: number) => {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export function cleanIntakeRules(input: unknown) {
  const out: any[] = [];
  for (const raw of (Array.isArray(input) ? input : []).slice(0, MAX_RULES)) {
    const scope = SCOPES.includes(raw?.scope) ? raw.scope : '';
    const target = scope === 'CLIENT' ? s(raw.client_id, 100) : s(raw.category, 60);
    const owner_id = s(raw?.owner_id, 100);
    if (!scope || !target || !owner_id) continue;
    const row = { scope, client_id: scope === 'CLIENT' ? target : '', client_name: scope === 'CLIENT' ? s(raw.client_name) : '', category: scope === 'CATEGORY' ? target : '', owner_id, owner_name: s(raw.owner_name) };
    const i = out.findIndex((r) => r.scope === scope && (scope === 'CLIENT' ? r.client_id === target : r.category === target));
    if (i >= 0) out[i] = row; else out.push(row);
  }
  return out;
}

export function cleanIntakeSetting(body: any) {
  return {
    intake_default_owner_id: s(body?.intake_default_owner_id, 100),
    intake_default_owner_name: s(body?.intake_default_owner_name),
    quote_sla_days: int(body?.quote_sla_days, 1, 30),
    quote_rush_window_days: int(body?.quote_rush_window_days, 0, 365),
    intake_rules: cleanIntakeRules(body?.intake_rules),
  };
}

/**
 * 책임자 고르기. team: 지금 팀의 활성 직원 (master·service·sub). categories: 문의 카테고리 (카드 inquiry_details 또는 문의 원본)
 * 돌려줌: { owner_id, owner_name, source, label } · 고를 사람이 없으면 null
 */
export function pickOwner(setting: any, card: any, team: any[], categories: string[] = []) {
  const active = new Map((team || []).filter((u) => u?.id && u.is_active !== false).map((u) => [u.id, u]));
  const rules = cleanIntakeRules(setting?.intake_rules);
  const cats = categories.length ? categories : (Array.isArray(card?.inquiry_details?.categories) ? card.inquiry_details.categories : []);
  const name = (u: any) => u.full_name || u.account_label || u.email || '';
  const candidates: { id: string; source: string; label: string }[] = [];
  if (card?.client_id) for (const r of rules.filter((x) => x.scope === 'CLIENT' && x.client_id === card.client_id)) candidates.push({ id: r.owner_id, source: 'CLIENT', label: `${r.client_name || card.client_name || '고객사'} 고객사 규칙` });
  for (const c of cats) for (const r of rules.filter((x) => x.scope === 'CATEGORY' && x.category === c)) candidates.push({ id: r.owner_id, source: 'CATEGORY', label: `${c} 카테고리 규칙` });
  if (setting?.intake_default_owner_id) candidates.push({ id: setting.intake_default_owner_id, source: 'TEAM', label: '팀 기본 담당자' });
  for (const c of candidates) {
    const u = active.get(c.id);
    if (u) return { owner_id: u.id, owner_name: name(u), source: c.source, label: c.label };
  }
  return null;
}

// 'YYYY-MM-DD' 에 영업일(토·일 제외) n일 더하기
export function addBusinessDays(ymd: string, n: number) {
  let t = Date.parse(`${ymd}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    t += DAY;
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return new Date(t).toISOString().slice(0, 10);
}

// 견적 기한: 희망 입고일이 급하면 다음 영업일
export function quoteDeadline(today: string, setting: any, desiredDate = '') {
  const sla = int(setting?.quote_sla_days, 1, 30) ?? BASE_SLA_DAYS;
  const windowDays = int(setting?.quote_rush_window_days, 0, 365) ?? BASE_RUSH_WINDOW_DAYS;
  const desired = /^\d{4}-\d{2}-\d{2}$/.test(desiredDate) ? desiredDate : '';
  const daysToDesired = desired ? Math.round((Date.parse(desired) - Date.parse(today)) / DAY) : null;
  const rush = daysToDesired != null && windowDays > 0 && daysToDesired <= windowDays;
  return { deadline: addBusinessDays(today, rush ? 1 : sla), rush, days_to_desired: daysToDesired, sla_days: rush ? 1 : sla };
}

// 카드에 넣을 값: 이미 있는 책임자·견적 기한은 그대로, 급한 문의면 우선순위를 높음 이상으로
export function intakePatch(card: any, owner: any, deadline: { deadline: string; rush: boolean }) {
  const patch: any = {};
  if (!card.owner_id && owner) { patch.owner_id = owner.owner_id; patch.owner_name = owner.owner_name; }
  if (!card.quote_deadline) patch.quote_deadline = deadline.deadline;
  if (deadline.rush && !['HIGH', 'URGENT'].includes(card.priority)) patch.priority = 'HIGH';
  return patch;
}
