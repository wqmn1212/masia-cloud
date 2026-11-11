// 견적 마진 규칙: 팀 설정(OperationSetting)의 기본·최소 마진과 고객사·카테고리별 규칙으로 이 카드의 기준 마진을 정한다.
// 우선순위: 고객사 규칙 → 카테고리 규칙(카드 문의 카테고리 순서대로) → 팀 기본값 → 앱 기본값. 칸마다 따로 정한다
// (고객사 규칙에 최소만 있으면 기본 마진은 카테고리·팀에서 가져온다).
// 쓰는 곳: quoteApproval(승인 확인의 최소 마진, margin_rule) · importFactoryQuote(공장 견적 초안에 기본 마진). 검산: npm run check:margin-rule
// 마진은 공장 원가에 얹는 비율이다 (원가 100 + 20% = 고객 금액 120).
// 과금 방식: TURNKEY(턴키 납품, 기본) = 원가에 마진을 얹어 납품 · MONTHLY(월정액 제조팀) = 공장 가격 그대로 전달하고 월 관리 비용만 받는다.
export const BASE_DEFAULT_PCT = 20;
export const BASE_MIN_PCT = 10;
export const BASE_MAX_PCT = 100;
export const BILLING_MODES = ['TURNKEY', 'MONTHLY'];
export const billingMode = (v: unknown) => (v === 'MONTHLY' ? 'MONTHLY' : 'TURNKEY');
// 카드의 고객사 과금 방식 (고객사 Company.billing_mode). 고객사가 없으면 턴키. 같은 고객사는 한 번만 읽는다
export function billingModeReader(db: any) {
  const seen = new Map<string, Promise<string>>();
  return (card: any): Promise<string> => {
    const id = card?.client_id;
    if (!id) return Promise.resolve('TURNKEY');
    if (!seen.has(id)) seen.set(id, (async () => billingMode((await db.Company.get(id))?.billing_mode))().catch(() => 'TURNKEY'));
    return seen.get(id)!;
  };
}

export const MAX_RULES = 100;
export const SCOPES = ['CLIENT', 'CATEGORY'];

const pct = (v: unknown) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= BASE_MAX_PCT ? Math.round(n * 10) / 10 : null;
};
const s = (v: unknown, n = 120) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// 저장 전에 규칙 정리: 범위 없는 줄·숫자 둘 다 없는 줄은 버리고, 같은 대상은 마지막 것만
export function cleanRules(input: unknown) {
  const out: any[] = [];
  for (const raw of (Array.isArray(input) ? input : []).slice(0, MAX_RULES)) {
    const scope = SCOPES.includes(raw?.scope) ? raw.scope : '';
    const target = scope === 'CLIENT' ? s(raw.client_id, 100) : s(raw.category, 60);
    const default_pct = pct(raw?.default_pct), min_pct = pct(raw?.min_pct);
    if (!scope || !target || (default_pct == null && min_pct == null)) continue;
    const row = { scope, client_id: scope === 'CLIENT' ? target : '', client_name: scope === 'CLIENT' ? s(raw.client_name) : '', category: scope === 'CATEGORY' ? target : '', default_pct, min_pct, note: s(raw.note, 200) };
    const i = out.findIndex((r) => r.scope === scope && (scope === 'CLIENT' ? r.client_id === target : r.category === target));
    if (i >= 0) out[i] = row; else out.push(row);
  }
  return out;
}

export function resolveMargin(setting: any, card: any, mode: string = 'TURNKEY') {
  if (billingMode(mode) === 'MONTHLY') {
    const label = '월정액 고객 (공장 가격 그대로)';
    return { billing_mode: 'MONTHLY', default_pct: 0, min_pct: 0, max_pct: 0, default_source: 'MONTHLY', min_source: 'MONTHLY', default_label: label, min_label: label };
  }
  const rules = cleanRules(setting?.margin_rules);
  const client = card?.client_id ? rules.find((r) => r.scope === 'CLIENT' && r.client_id === card.client_id) : null;
  const cats: string[] = Array.isArray(card?.inquiry_details?.categories) ? card.inquiry_details.categories : [];
  const category = cats.map((c) => rules.find((r) => r.scope === 'CATEGORY' && r.category === c)).find(Boolean) || null;
  const team = { default_pct: pct(setting?.margin_default_pct), min_pct: pct(setting?.margin_min_pct) };
  const pick = (field: 'default_pct' | 'min_pct', base: number) => {
    if (client && client[field] != null) return { value: client[field], source: 'CLIENT', label: `${client.client_name || card?.client_name || '고객사'} 고객사 규칙` };
    if (category && category[field] != null) return { value: category[field], source: 'CATEGORY', label: `${category.category} 카테고리 규칙` };
    if (team[field] != null) return { value: team[field], source: 'TEAM', label: '팀 기본값' };
    return { value: base, source: 'BASE', label: '앱 기본값' };
  };
  const d = pick('default_pct', BASE_DEFAULT_PCT), m = pick('min_pct', BASE_MIN_PCT);
  return { billing_mode: 'TURNKEY', default_pct: d.value, min_pct: m.value, max_pct: Math.max(BASE_MAX_PCT, d.value), default_source: d.source, min_source: m.source, default_label: d.label, min_label: m.label };
}

// 견적 항목에 기본 마진 채우기 (이미 적힌 마진은 그대로)
export function fillMargins(options: any[], defaultPct: number) {
  return (options || []).map((o) => (o.margin_percent === '' || o.margin_percent == null ? { ...o, margin_percent: defaultPct } : o));
}
