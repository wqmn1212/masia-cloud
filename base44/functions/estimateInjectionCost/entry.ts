import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { mergeCostModel, estimateBom } from '../../shared/bomCost.ts';

const COEFF_FIELDS = [
  'currency', 'material_price_per_kg', 'default_material_price_per_kg', 'scrap_rate_percent',
  'machine_rate_per_hour', 'finish_cost_per_part', 'insert_cost_each',
  'mold_base_cost', 'mold_cost_per_cavity', 'mold_cost_per_cm2',
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const tier = user.account_tier;
    if (tier !== 'master' && tier !== 'service') {
      return Response.json({ error: '원가 산정 권한이 없습니다.' }, { status: 403 });
    }
    if (!user.tenant_id) return Response.json({ error: '소속 팀이 없습니다.' }, { status: 400 });

    const body = await req.json();
    const { parts = [], order_qty = 1000, model_patch = null, save_model = false } = body;

    const existing = await base44.asServiceRole.entities.CostModel.filter({ tenant_id: user.tenant_id }, '-created_date', 1);
    let record = existing[0] || null;

    const patch = {};
    if (model_patch) {
      for (const key of COEFF_FIELDS) {
        if (model_patch[key] !== undefined) patch[key] = model_patch[key];
      }
    }

    if (save_model && Object.keys(patch).length > 0) {
      record = record
        ? await base44.asServiceRole.entities.CostModel.update(record.id, patch)
        : await base44.asServiceRole.entities.CostModel.create({ ...mergeCostModel(patch), tenant_id: user.tenant_id });
    }

    const model = mergeCostModel({ ...(record || {}), ...patch });
    const result = estimateBom(parts, order_qty, model);

    // 계수는 master/service 만 도달하는 경로이므로 편집용으로 함께 반환한다
    const coefficients = {};
    for (const key of COEFF_FIELDS) coefficients[key] = model[key];

    return Response.json({ result, coefficients, saved: !!save_model });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}