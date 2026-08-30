// 사출 가견적 계산 (공장 원가 기준, CNY)
// 구매품(is_purchased)은 사출 계산에서 제외한다.

export const DEFAULT_COST_MODEL = {
  currency: 'CNY',
  material_price_per_kg: { ABS: 14, 'PC/ABS': 22, PC: 26, PMMA: 20, TPU: 32, 실리콘: 28, LSR: 45, POM: 24, PP: 11, NYLON: 25 },
  default_material_price_per_kg: 18,
  scrap_rate_percent: 6,
  machine_rate_per_hour: { SMALL: 45, MEDIUM: 70, LARGE: 110 },
  finish_cost_per_part: { RAW: 0, PAINT: 1.8, PLATING: 2.6, NCVM: 3.2, PRINT: 0.9, OTHER: 1.0 },
  insert_cost_each: 0.35,
  mold_base_cost: 9000,
  mold_cost_per_cavity: 3500,
  mold_cost_per_cm2: 90,
};

const price = (model, material) =>
  model.material_price_per_kg?.[material] ?? model.default_material_price_per_kg;

/** 부품 1개(1EA) 사출 단가 내역 */
export function estimatePart(part, model = DEFAULT_COST_MODEL) {
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

/**
 * BOM 전체 가견적
 * @param {Array} parts
 * @param {number} orderQty - 완제품 생산 수량(세트)
 */
export function estimateBom(parts, orderQty = 1000, model = DEFAULT_COST_MODEL) {
  const lines = parts.map((part) => {
    const e = estimatePart(part, model);
    const perSet = e.unit_cost * (part.quantity || 1);
    return { part, ...e, per_set_cost: perSet, total_cost: perSet * orderQty };
  });

  const injection = lines.filter((l) => !l.skipped);
  const set_cost = injection.reduce((s, l) => s + l.per_set_cost, 0);
  const mold_total = injection.reduce((s, l) => s + l.mold_cost, 0);
  const production_total = set_cost * orderQty;

  return {
    lines,
    set_cost,
    mold_total,
    production_total,
    grand_total: production_total + mold_total,
    amortized_set_cost: orderQty > 0 ? set_cost + mold_total / orderQty : set_cost,
    currency: model.currency,
  };
}