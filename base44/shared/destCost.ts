// 선적 건별 '한국에서 따로 낼 돈' 사전 확인. 화면 쪽 src/lib/destCost.js 와 같은 상태 규칙을 쓴다 (둘을 함께 고칠 것).
export const DEST_COST_DECISIONS = ['ACKNOWLEDGED', 'QUESTION'];

export function destCostState(s: any) {
  if (!s?.dest_cost_estimate) return 'NONE';
  if (!s.dest_cost_sent_at) return 'DRAFT';
  return s.dest_cost_decision || 'SENT';
}

// 고객에게 보내는 값. 보내기 전(초안)은 보이지 않고, 계산 입력값·내부 메모는 넣지 않는다.
export function clientDestCost(s: any) {
  const state = destCostState(s);
  if (state === 'NONE' || state === 'DRAFT') return null;
  const e = s.dest_cost_estimate || {};
  return {
    state,
    estimate: {
      term_label: e.term_label || '', mode_label: e.mode_label || '', basis_text: e.basis_text || '',
      usd_krw: e.usd_krw || null, units: e.units || 0,
      buyer_ex_vat: Number(e.buyer_ex_vat) || 0, range_low: Number(e.range_low) || 0, range_high: Number(e.range_high) || 0,
      buyer_vat: Number(e.buyer_vat) || 0, per_unit_buyer_extra: Number(e.per_unit_buyer_extra) || 0, per_unit_landed: Number(e.per_unit_landed) || 0,
      included: Array.isArray(e.included) ? e.included : [],
      segments: Array.isArray(e.segments) ? e.segments.map((g: any) => ({ key: g.key, label: g.label, short: g.short || g.label, amount: Number(g.amount) || 0 })) : [],
      lines: Array.isArray(e.lines) ? e.lines.map((l: any) => ({ segment: l.segment, label: l.label, amount: Number(l.amount) || 0 })) : [],
      variables: Array.isArray(e.variables) ? e.variables : [],
      computed_at: e.computed_at || '',
    },
    sent_at: s.dest_cost_sent_at || '',
    decided_at: s.dest_cost_decided_at || '',
    decided_by_name: s.dest_cost_decided_by_name || '',
    client_note: s.dest_cost_client_note || '',
    actual: s.dest_cost_actual ?? null,
    actual_vat: s.dest_cost_actual_vat ?? null,
    actual_note: s.dest_cost_actual_note || '',
  };
}
