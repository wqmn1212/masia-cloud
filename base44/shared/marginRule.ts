// 견적 마진 규칙: 팀 설정(OperationSetting)의 기본·최소 마진과 고객사·카테고리별 규칙으로 이 카드의 기준 마진을 정한다.
// 우선순위: 고객사 규칙 → 카테고리 규칙(카드 문의 카테고리 순서대로) → 팀 기본값 → 앱 기본값. 칸마다 따로 정한다
// (고객사 규칙에 최소만 있으면 기본 마진은 카테고리·팀에서 가져온다).
// 쓰는 곳: quoteApproval(승인 확인의 최소 마진, margin_rule) · importFactoryQuote(공장 견적 초안에 기본 마진). 검산: npm run check:margin-rule
export const BASE_DEFAULT_PCT = 15;
export const BASE_MIN_PCT = 10;
export const MAX_RULES = 100;
export const SCOPES = ['CLIENT', 'CATEGORY'];

const pct = (v: unknown) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 500 ? Math.round(n * 10) / 10 : null;
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

export function resolveMargin(setting: any, card: any) {
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
  return { default_pct: d.value, min_pct: m.value, default_source: d.source, min_source: m.source, default_label: d.label, min_label: m.label };
}

// 견적 항목에 기본 마진 채우기 (이미 적힌 마진은 그대로)
export function fillMargins(options: any[], defaultPct: number) {
  return (options || []).map((o) => (o.margin_percent === '' || o.margin_percent == null ? { ...o, margin_percent: defaultPct } : o));
}
