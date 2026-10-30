import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyUsers, clientUsersOfCompany, internalUsersOfTenant } from '../../shared/notify.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { factoryHolidays, refreshPlan } from '../../shared/productPlan.ts';
import { factoryWait, FACTORY_REPLY_DAYS } from '../../shared/claimTracking.ts';

// 매일 고객 포털 점검 (워크플로 DailyClientChecks, 10:10 KST)
//  1. 재주문 시점: 고객이 적은 재고·월 사용량으로 주문 권장일 2주 전이 되면 고객과 담당 팀에 한 번 알린다
//  2. 공장 회신 기한: 중국어 클레임 문서를 보낸 뒤 3영업일이 지나도 회신 기록이 없으면 담당 팀에 한 번 알린다
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    // 예약 실행(로그인 없음)과 마스터만
    const caller = await base44.auth.me().catch(() => null);
    if (caller && caller.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole;
    const today = kstToday();
    const holidays = await factoryHolidays(svc, today);
    let reorder = 0, overdue = 0;

    // ── 재주문 시점 ──
    const plans = (await svc.entities.ProductPlan.list('-updated_date', 500)).filter((p: any) => Number(p.monthly_usage) > 0 && p.stock_as_of);
    for (const plan of plans) {
      // 주문 권장일·소진일·권장 발주량을 다시 계산해 저장 (직원 목록·일일 요약·고객 할 일이 읽는다)
      const { timing: t, lead } = await refreshPlan(svc, plan, { today, holidays });
      if (!t?.order_by || today < t.alert_on || plan.alerted_for === t.order_by) continue;
      const name = plan.product_name || '상품';
      const body = `${name}: 지금 재고와 월 사용량으로 보면 ${t.runout}쯤 재고가 떨어집니다. 지난 주문은 발주부터 도착까지 평균 ${lead}일이 걸려 ${t.order_by}까지 주문하시길 권합니다.${t.holiday ? `\n${t.holiday.name} 공장 휴무(${t.holiday.factory_start}~${t.holiday.factory_end})가 걸려 휴무만큼 앞당겼습니다.${t.holiday.order_cutoff_date ? ` 휴무 전 발주 마감 ${t.holiday.order_cutoff_date}.` : ''}` : ''}${t.recommended_qty ? `\n권장 발주량은 약 ${t.recommended_qty.toLocaleString('ko-KR')}${plan.unit_label || '개'}입니다${t.moq_months ? ` (MOQ 때문에 약 ${t.moq_months}개월치)` : ''}.` : ''}\n상품 원가 화면의 재주문에서 예상 단가와 도착일을 볼 수 있습니다 (견적이 아니라 예상입니다).`;
      try {
        await notifyUsers(svc, await clientUsersOfCompany(svc, plan.company_id), { type: 'reorder_due', title: `[재주문 시점] ${name} · ${t.order_by}까지 주문 권장`, body, link: '/client/costs' });
        await notifyUsers(svc, await internalUsersOfTenant(svc, plan.tenant_id), { type: 'reorder_due', title: `[고객 재주문 시점] ${name}`, body: `고객사 재고 기준 주문 권장일 ${t.order_by} (예상 소진 ${t.runout}). 권장 발주량 약 ${(t.recommended_qty || 0).toLocaleString('ko-KR')}. 고객에게 재주문 안내가 갔습니다.`, link: '/my-work' }, { email: false });
      } catch (_e) { /* 알림 실패는 다음 날 다시 시도 */ continue; }
      await svc.entities.ProductPlan.update(plan.id, { alerted_for: t.order_by, alerted_at: new Date().toISOString() });
      reorder += 1;
    }

    // ── 공장 회신 기한 ──
    const claims = (await svc.entities.QualityClaim.list('-created_date', 500)).filter((c: any) => !c.factory_overdue_notified_at && factoryWait(c)?.overdue);
    for (const c of claims) {
      const card = await svc.entities.TaskCard.get(c.card_id).catch(() => null);
      if (!card) continue;
      const w = factoryWait(c);
      try {
        await notifyUsers(svc, await internalUsersOfTenant(svc, card.tenant_id), {
          type: 'claim_factory_overdue',
          title: `[공장 회신 지연] ${card.title}`,
          body: `불량 신고 "${c.title}"의 중국어 문서를 보낸 지 ${w.business}영업일이 지났지만 공장 회신 기록이 없습니다 (기한 ${FACTORY_REPLY_DAYS}영업일). 공장에 독촉하고 회신을 기록해 주세요. 고객 화면에는 '공장 회신 대기 ${w.days}일'로 보입니다.`,
          link: `/task-board?card=${card.id}&tab=tasks`,
          task_card_id: card.id,
          card_title: card.title,
        });
      } catch (_e) { continue; }
      await svc.entities.QualityClaim.update(c.id, { factory_overdue_notified_at: new Date().toISOString() });
      overdue += 1;
    }
    return Response.json({ ok: true, reorder_alerts: reorder, factory_overdue: overdue });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
