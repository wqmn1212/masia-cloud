// 사출 가견적 계산 (공장 원가 기준). 서버 전용 — 원가 계수는 브라우저로 내려보내지 않는다.
// 구매품(is_purchased)은 사출 계산에서 제외한다.

export const DEFAULT_COST_MODEL = {
  currency: 'CNY',
  material_price_per_kg: { ABS: 14, 'PC/ABS': 22, PC: 26, PMMA: 20, TPU: 32, '실리콘': 28, LSR: 45, POM: 24, PP: 11, NYLON: 25 },
  default_material_price_per_kg: 18,
  scrap_rate_percent: 6,
  machine_rate_per_hour: { SMALL: 45, MEDIUM: 70, LARGE: 110 },
  finish_cost_per_part: { RAW: 0, PAINT: 1.8, PLATING: 2.6, NCVM: 3.2, PRINT: 0.9, OTHER: 1.0 },
  insert_cost_each: 0.35,
  mold_base_cost: 9000,
  mold_cost_per_cavity: 3500,
  mold_cost_per_cm2: 90,
};

/** 저장된 CostModel 레코드(부분값)와 기본값을 병합한다 */
export function mergeCostModel(record) {
  const r = record || {};
  return {
    ...DEFAULT_COST_MODEL,
    ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined)),
    material_price_per_kg: { ...DEFAULT_COST_MODEL.material_price_per_kg, ...(r.material_price_per_kg || {}) },
    machine_rate_per_hour: { ...DEFAULT_COST_MODEL.machine_rate_per_hour, ...(r.machine_rate_per_hour || {}) },
    finish_cost_per_part: { ...DEFAULT_COST_MODEL.finish_cost_per_part, ...(r.finish_cost_per_part || {}) },
  };
}

const price = (model, material) =>
  model.material_price_per_kg?.[material] ?? model.default_material_price_per_kg;

/** 부품 1개(1EA) 사출 단가 내역 */
export function estimatePart(part, model) {
  if (part.is_purchased) {
    return { material_cost: 0, machine_cost: 0, finish_cost: 0, unit_cost: 0, mold_cost: 0, skipped: true };
  }

  const kg = (part.weight_g || 0) / 1000;
  const material_cost = kg * price(model, part.material) * (1 + (model.scrap_rate_percent || 0) / 100);

  const cavity = Math.max(1, part.cavity_count || 1);
  const rate = model.machine_rate_per_hour?.[part.machine_class] ?? model.machine_rate_per_hour.SMALL;
  const machine_cost = ((part.cycle_time_sec || 0) / cavity / 3600) * rate;

  const finish_cost =
    (model.finish_cost_per_part?.[part.finish || 'RAW'] ?? 0) +
    (part.insert_count || 0) * model.insert_cost_each;

  const mold_cost =
    model.mold_base_cost +
    cavity * model.mold_cost_per_cavity +
    (part.projected_area_cm2 || 0) * model.mold_cost_per_cm2;

  return {
    material_cost,
    machine_cost,
    finish_cost,
    unit_cost: material_cost + machine_cost + finish_cost,
    mold_cost,
    skipped: false,
  };
}

/** BOM 전체 가견적 — 금액만 반환하고 계수는 포함하지 않는다 */
export function estimateBom(parts, orderQty, model) {
  const qty = Math.max(1, Number(orderQty || 1));
  const lines = (parts || []).map((part) => {
    const e = estimatePart(part, model);
    const perSet = e.unit_cost * (part.quantity || 1);
    return {
      part_name: part.display_name || part.part_name,
      skipped: e.skipped,
      material_cost: e.material_cost,
      machine_cost: e.machine_cost,
      finish_cost: e.finish_cost,
      unit_cost: e.unit_cost,
      mold_cost: e.mold_cost,
      per_set_cost: perSet,
      total_cost: perSet * qty,
    };
  });

  const injection = lines.filter((l) => !l.skipped);
  const set_cost = injection.reduce((s, l) => s + l.per_set_cost, 0);
  const mold_total = injection.reduce((s, l) => s + l.mold_cost, 0);
  const production_total = set_cost * qty;

  return {
    lines,
    set_cost,
    mold_total,
    production_total,
    grand_total: production_total + mold_total,
    amortized_set_cost: set_cost + mold_total / qty,
    currency: model.currency,
  };
}