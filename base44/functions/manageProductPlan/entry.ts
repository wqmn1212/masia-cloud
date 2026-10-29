import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';

// 고객 상품 원가 카드의 재고·월 사용량 (재주문 시점 알림용). 고객 계정만 저장하고, 상품은 우리 고객사의 확정 원가가 있는 것만.
//  action 'save' {product_key, stock_qty, monthly_usage, stock_as_of} · 'clear' {product_key}
const num = (v: unknown) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : NaN);

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const key = typeof body.product_key === 'string' ? body.product_key : '';
    if (!key) return Response.json({ error: '상품을 고르세요' }, { status: 400 });

    const records = (await svc.entities.LandedCostRecord.filter({ client_id: auth.companyId, product_key: key, status: 'CONFIRMED' }, '-order_date', 20)).filter((r: any) => r.client_id === auth.companyId);
    const cards = await Promise.all(records.map((r: any) => svc.entities.TaskCard.get(r.card_id).catch(() => null)));
    const visible = records.filter((_r: any, i: number) => cardVisibleToClient(cards[i], auth.companyId));
    if (!visible.length) return Response.json({ error: '확정된 원가가 있는 상품만 재고를 적을 수 있습니다' }, { status: 404 });
    const latest = visible[0];
    const [plan] = (await svc.entities.ProductPlan.filter({ company_id: auth.companyId, product_key: key }, '-updated_date', 1)).filter((p: any) => p.company_id === auth.companyId);

    if (body.action === 'clear') {
      if (plan) await svc.entities.ProductPlan.update(plan.id, { stock_qty: null, monthly_usage: null, stock_as_of: '', alerted_for: '' });
      return Response.json({ ok: true });
    }
    if (body.action !== 'save') return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
    const stock = num(body.stock_qty), usage = num(body.monthly_usage);
    if (Number.isNaN(stock) || Number.isNaN(usage) || stock == null || usage == null || stock < 0 || usage <= 0) return Response.json({ error: '재고(0 이상)와 월 사용량(0보다 큼)을 숫자로 적어 주세요' }, { status: 400 });
    const today = kstToday();
    const asOf = typeof body.stock_as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.stock_as_of) && body.stock_as_of <= today ? body.stock_as_of : today;
    const patch = {
      stock_qty: Math.round(stock), monthly_usage: Math.round(usage * 100) / 100, stock_as_of: asOf,
      product_name: latest.product_name || '', unit_label: latest.unit_label || '개',
      updated_by_name: auth.user.full_name || auth.user.email || '',
      // 숫자가 바뀌면 권장일이 바뀌므로 알림을 다시 보낼 수 있게 한다
      alerted_for: '',
    };
    if (plan) await svc.entities.ProductPlan.update(plan.id, patch);
    else await svc.entities.ProductPlan.create({ tenant_id: latest.tenant_id, company_id: auth.companyId, product_key: key, ...patch });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
