// 고객 재고 계획(ProductPlan)의 주문 시점 계산과 저장 (manageProductPlan 저장 때·dailyClientChecks 매일).
// 계산한 주문 권장일·소진일·권장 발주량을 저장해 두어 직원 목록·일일 요약·고객 할 일이 같은 값을 읽는다.
import { holidayRange, shiftDate } from './chinaHoliday.ts';
import { leadDays, orderTiming } from './reorderForecast.ts';

export async function factoryHolidays(svc: any, today: string) {
  return (await svc.entities.ChinaHoliday.list('start_date', 500)).map((h: any) => ({ h, r: holidayRange(h) }))
    .filter(({ r }: any) => r.end >= shiftDate(today, -30) && r.start <= shiftDate(today, 365))
    .map(({ h, r }: any) => ({ name: h.name, factory_start: r.start, factory_end: r.end, order_cutoff_date: h.order_cutoff_date || '' }));
}

// 같은 상품의 확정 원가 기록(최근 10건)으로 발주→도착 평균 일수
export async function planLeadDays(svc: any, plan: any) {
  const records = (await svc.entities.LandedCostRecord.filter({ client_id: plan.company_id, product_key: plan.product_key, status: 'CONFIRMED' }, '-order_date', 10)).filter((r: any) => r.client_id === plan.company_id);
  const leads: number[] = [];
  for (const r of records) {
    const card = await svc.entities.TaskCard.get(r.card_id).catch(() => null);
    const ships = (await svc.entities.Shipment.filter({ card_id: r.card_id }, 'created_date', 20)).filter((s: any) => s.card_id === r.card_id);
    const d = leadDays(card, ships, r.order_date || '');
    if (d) leads.push(d);
  }
  return leads.length ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : 0;
}

// 계산해서 바뀐 값만 저장하고 계산 결과를 돌려준다
export async function refreshPlan(svc: any, plan: any, { today, holidays }: { today: string; holidays: any[] }) {
  if (!(Number(plan.monthly_usage) > 0) || !plan.stock_as_of) return { timing: null, lead: 0 };
  const lead = await planLeadDays(svc, plan);
  const timing = orderTiming({ ...plan, lead_days: lead, today, holidays });
  const patch = { order_by: timing?.order_by || '', runout: timing?.runout || '', lead_days: lead, recommended_qty: timing?.recommended_qty ?? null, computed_on: today };
  if (Object.entries(patch).some(([k, v]) => (plan[k] ?? '') !== (v ?? ''))) await svc.entities.ProductPlan.update(plan.id, patch);
  return { timing, lead };
}
