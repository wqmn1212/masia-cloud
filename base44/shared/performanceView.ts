// 성과 리포트를 고객에게 보낼 때의 모양. 담당자가 뺀 숫자·구역은 응답에서 지운다 (화면에서 가리는 것만으로는 부족).
export const SECTION_KEYS = ['section_trends', 'section_products'];

export function clientPerformanceReport(r: any) {
  const hidden = new Set(Array.isArray(r.hidden_metrics) ? r.hidden_metrics : []);
  const metrics = Object.fromEntries(Object.entries(r.metrics || {}).filter(([k]) => !hidden.has(k)));
  return {
    id: r.id, period_start: r.period_start, period_end: r.period_end, period_label: r.period_label || '',
    metrics, trends: hidden.has('section_trends') ? [] : r.trends || [],
    products: hidden.has('section_products') ? [] : (r.products || []).map((p: any) => ({ ...p, card_id: undefined })),
    highlights: r.highlights || '', next_plan: r.next_plan || '', published_at: r.published_at || '',
  };
}
