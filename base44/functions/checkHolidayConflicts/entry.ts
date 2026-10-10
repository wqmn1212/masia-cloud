import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { holidayRange, overlaps, shiftDate, kstToday } from '../../shared/chinaHoliday.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';

// 매일 08:00 KST 워크플로(ChinaHolidayCheck)가 로그인 없이 호출한다.
// 모든 단계가 기록 기반으로 중복을 막으므로(겹침 source_id, notice_sent) 재호출해도 알림이 다시 나가지 않는다.
const active = (users) => users.filter((u) => u.is_active !== false);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const db = base44.asServiceRole.entities;
    const today = kstToday(), now = new Date().toISOString();
    const holidays = await db.ChinaHoliday.list('start_date', 500);
    const closures = (await db.FactoryClosure.list('start_date', 2000)).filter((c) => c.end_date >= today);
    const masters = active(await db.User.filter({ account_tier: 'master' }));
    const staffOf = async (tenantId) => {
      const all = [...masters, ...await internalUsersOfTenant(base44.asServiceRole, tenantId)];
      return all.filter((u, i) => all.findIndex((x) => x.id === u.id) === i);
    };

    // 1) 진행 중 카드의 생산 기간과 휴무 겹침
    const cards = [...await db.TaskCard.filter({ status: 'IN_PROGRESS' }), ...await db.TaskCard.filter({ status: 'PRODUCTION' })];
    let conflictCards = 0;
    for (const card of cards.filter((c) => c.delivery_date)) {
      const start = card.advance_paid_date || today, existing = card.holiday_conflicts || [];
      const found = [];
      for (const h of holidays) {
        const r = holidayRange(h);
        if (overlaps(start, card.delivery_date, r.start, r.end) && !existing.some((e) => e.source_id === h.id)) found.push({ source_id: h.id, kind: 'holiday', name: h.name, start: r.start, end: r.end, notified_at: now });
      }
      for (const c of closures.filter((x) => card.factory_id && x.factory_id === card.factory_id)) {
        if (overlaps(start, card.delivery_date, c.start_date, c.end_date) && !existing.some((e) => e.source_id === c.id)) found.push({ source_id: c.id, kind: 'closure', name: c.note || '공장 휴무', start: c.start_date, end: c.end_date, notified_at: now });
      }
      if (!found.length) continue;
      await db.TaskCard.update(card.id, { holiday_conflicts: [...existing, ...found] });
      await notifyUsers(base44.asServiceRole, await staffOf(card.tenant_id), {
        type: 'holiday_conflict', title: `${card.title} 생산 기간 휴무 겹침`,
        body: `${found.map((f) => `${f.name}(${f.start}~${f.end})`).join(', ')}과 생산 기간(${start}~${card.delivery_date})이 겹칩니다. 납기를 확인한 뒤 카드 오버뷰 탭의 견적·납품 일정 관리에서 고객에게 안내해 주세요.`,
        link: '/task-board', task_card_id: card.id, card_title: card.title,
      });
      conflictCards++;
    }

    // 2) 발주 마감 30일·7일 전 고객 전원 안내 (휴일당 최대 2회)
    let notices = 0;
    const clients = active(await db.User.filter({ account_tier: 'client' }));
    for (const h of holidays.filter((x) => x.announce && x.order_cutoff_date && today <= x.order_cutoff_date)) {
      const sent = h.notice_sent || [];
      const due = ['7', '30'].find((d) => today >= shiftDate(h.order_cutoff_date, -Number(d)) && !sent.includes(d));
      if (!due) continue;
      const r = holidayRange(h);
      await notifyUsers(base44.asServiceRole, clients, {
        type: 'holiday_notice', title: `[AEGIS] ${h.name} 전 출고 발주 마감 안내`,
        body: `${h.name} 전에 출고하려면 ${h.order_cutoff_date}까지 발주가 필요합니다.\n공장 휴무 기간: ${r.start} ~ ${r.end}`,
        link: '/client/dashboard',
      });
      // 7일 전 안내가 나가면 30일 전 안내는 더 이상 보내지 않는다
      await db.ChinaHoliday.update(h.id, { notice_sent: due === '7' ? ['30', '7'] : [...sent, due] });
      notices++;
    }

    // 3) 12월 1일, 다음 해 휴무 미등록이면 입력 요청
    const nextYear = Number(today.slice(0, 4)) + 1;
    let reminder = false;
    if (today.slice(5) === '12-01' && !holidays.some((h) => Number(h.year) === nextYear)) {
      const services = active(await db.User.filter({ account_tier: 'service' }));
      await notifyUsers(base44.asServiceRole, [...masters, ...services], { type: 'holiday_notice', title: `${nextYear}년 중국 휴무 입력 요청`, body: `${nextYear}년 중국 공휴일이 아직 등록되지 않았습니다. 중국 휴무 메뉴에서 입력해 주세요.`, link: '/china-holidays' });
      reminder = true;
    }
    return Response.json({ conflictCards, notices, reminder });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}