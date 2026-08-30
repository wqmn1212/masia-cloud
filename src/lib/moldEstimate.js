// 캐비티 · 사이클타임 · 기계 등급 초기 추정
// 사이클 계수는 CostModel 과 일원화한다 — 기본 CostModel 이 있으면 그 값을 사용하고,
// 없으면 아래 DEFAULT_CYCLE_COEFFS(=CostModel 기본값과 동일)를 쓴다.
// 모두 초기 추정값이며 사용자가 조정할 수 있다.

export const DEFAULT_CYCLE_COEFFS = {
  cycle_base_sec: 18,
  cycle_per_gram_sec: 0.4,
};

/**
 * 캐비티 수 추정 — 최대 bbox 변 기준
 *   > 100mm  → 1
 *   50~100mm → 2
 *   20~50mm  → 2
 *   < 20mm   → 4
 */
export function estimateCavityCount(maxEdgeMm) {
  const edge = Number(maxEdgeMm || 0);
  if (edge > 100) return 1;
  if (edge >= 20) return 2;
  return 4;
}

/** 사이클타임(초) = cycle_base_sec + cycle_per_gram_sec × weight_g (최소 base) */
export function estimateCycleTimeSec(weightG, coeffs = DEFAULT_CYCLE_COEFFS) {
  const base = Number(coeffs?.cycle_base_sec ?? DEFAULT_CYCLE_COEFFS.cycle_base_sec);
  const perGram = Number(coeffs?.cycle_per_gram_sec ?? DEFAULT_CYCLE_COEFFS.cycle_per_gram_sec);
  return Math.max(base, base + perGram * Number(weightG || 0));
}

/** 기계 등급 — weight_g >= 30 또는 최대변 >= 150mm → MEDIUM, 그 외 SMALL */
export function estimateMachineClass(weightG, maxEdgeMm) {
  return Number(weightG || 0) >= 30 || Number(maxEdgeMm || 0) >= 150 ? 'MEDIUM' : 'SMALL';
}

/** 부품 하나의 초기 금형·사출 추정값 일괄 산출 */
export function estimateMoldParams({ weight_g, bbox_x_mm, bbox_y_mm, bbox_z_mm }, coeffs = DEFAULT_CYCLE_COEFFS) {
  const maxEdge = Math.max(bbox_x_mm || 0, bbox_y_mm || 0, bbox_z_mm || 0);
  return {
    cavity_count: estimateCavityCount(maxEdge),
    cycle_time_sec: Math.round(estimateCycleTimeSec(weight_g, coeffs) * 10) / 10,
    machine_class: estimateMachineClass(weight_g, maxEdge),
  };
}