// 고객에게 보내는 견적 비교표 스냅샷 정리.
// 스냅샷은 직원 화면이 원가·마진·공장명을 빼고 만들지만, 서버에서도 허용한 키만 다시 골라 담는다
// (실수로 다른 값이 섞여 저장돼도 고객에게 나가지 않게).
const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
const strMap = (o: any) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, String(v).slice(0, 300)]));
const OPTION_KEYS = ['key', 'label', 'factory_name', 'quote_currency', 'quote_total', 'total', 'per_unit', 'units', 'landed_total', 'landed_per_unit', 'landed_status', 'landed_extra', 'one_time', 'incoterms', 'lead', 'payment', 'deposit', 'scope_diff', 'power_warn'];

export const CLIENT_COMPARISON_STATUSES = ['PUBLISHED', 'CHOSEN', 'CONFIRMED'];

export function sanitizeSnapshot(s: any) {
  if (!s) return null;
  return {
    title: String(s.title || ''),
    version: Number(s.version) || 1,
    base_currency: ['KRW', 'USD', 'CNY'].includes(s.base_currency) ? s.base_currency : 'KRW',
    fx: pick(s.fx || {}, ['usd_krw', 'usd_cny', 'date']),
    recommendation: String(s.recommendation || '').slice(0, 300),
    qty_diff: !!s.qty_diff,
    best: pick(s.best || {}, ['landed_per_unit', 'per_unit', 'lead']),
    options: (s.options || []).slice(0, 5).map((o: any) => ({
      ...pick(o, OPTION_KEYS),
      factory_name: String(o.factory_name || ''),
      landed_range: o.landed_range ? pick(o.landed_range, ['low', 'high']) : null,
      conditions: strMap(o.conditions),
      extra: strMap(o.extra),
    })),
    extra_conditions: (s.extra_conditions || []).map((c: any) => pick(c, ['key', 'label'])),
    rows: (s.rows || []).map((r: any) => ({
      ...pick(r, ['key', 'label', 'kind', 'spec_diff']),
      cells: Object.fromEntries(Object.entries(r.cells || {}).map(([k, c]: [string, any]) => [k, {
        ...pick(c, ['state', 'amount', 'qty', 'spec']),
        alternatives: Array.isArray(c.alternatives) ? c.alternatives.map((a: any) => pick(a, ['name', 'amount'])) : null,
      }])),
    })),
  };
}

// 카드의 고객 공개 비교표 (최신 1건)
export async function latestClientComparison(svc: any, cardId: string) {
  const rows = await svc.entities.QuoteComparison.filter({ card_id: cardId }, '-created_date', 10);
  return rows.find((r: any) => CLIENT_COMPARISON_STATUSES.includes(r.status) && r.client_snapshot) || null;
}
