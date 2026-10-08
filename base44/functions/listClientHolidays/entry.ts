import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { holidayRange, shiftDate, kstToday } from '../../shared/chinaHoliday.ts';

// 고객 대시보드 "중국 휴무 안내" — 앞으로 90일 안의 공휴일만. 공장별 휴무(FactoryClosure)는 내리지 않는다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    const today = kstToday(), until = shiftDate(today, 90);
    const holidays = await base44.asServiceRole.entities.ChinaHoliday.list('start_date', 500);
    return Response.json({
      holidays: holidays
        .map((h) => ({ h, r: holidayRange(h) }))
        .filter(({ r }) => r.end >= today && r.start <= until)
        .map(({ h, r }) => ({ id: h.id, name: h.name, start_date: h.start_date, end_date: h.end_date, factory_start: r.start, factory_end: r.end, order_cutoff_date: h.order_cutoff_date || '' })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}