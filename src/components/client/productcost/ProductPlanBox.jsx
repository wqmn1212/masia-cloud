import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { orderTiming } from '@/lib/reorderForecast';

const fmt = (d) => (d ? d.replaceAll('-', '.') : '');

// 재고·월 사용량을 적어 두면 예상 소진일과 주문 권장일을 보여 주고, 권장일 2주 전에 알림을 보낸다 (선택).
export default function ProductPlanBox({ productKey, unit, plan, leadDays, today, holidays, canEdit }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ stock_qty: '', monthly_usage: '', stock_as_of: today });
  useEffect(() => { setV({ stock_qty: plan?.stock_qty ?? '', monthly_usage: plan?.monthly_usage ?? '', stock_as_of: plan?.stock_as_of || today }); }, [plan?.stock_qty, plan?.monthly_usage, plan?.stock_as_of, today]);
  const save = useMutation({
    mutationFn: async (action) => (await base44.functions.invoke('manageProductPlan', { action, product_key: productKey, ...v })).data,
    onSuccess: (_d, action) => { qc.invalidateQueries({ queryKey: ['client-landed-costs'] }); setEditing(false); toast({ title: action === 'clear' ? '재고 정보를 지웠습니다' : '재고 정보를 저장했습니다', description: action === 'clear' ? undefined : '주문 권장일 2주 전에 알림을 보내 드립니다.' }); },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  const has = plan?.monthly_usage > 0;
  const t = has ? orderTiming({ ...plan, lead_days: leadDays, today, holidays }) : null;

  if (editing) {
    return (
      <form className="space-y-2 rounded-lg border border-dashed p-2.5" onSubmit={(e) => { e.preventDefault(); save.mutate('save'); }}>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-caption">현재 재고 ({unit})<Input className="mt-0.5 h-8 text-label" type="number" min={0} required value={v.stock_qty} onChange={(e) => setV((x) => ({ ...x, stock_qty: e.target.value }))} disabled={save.isPending} /></label>
          <label className="text-caption">월 사용량 ({unit})<Input className="mt-0.5 h-8 text-label" type="number" min={1} required value={v.monthly_usage} onChange={(e) => setV((x) => ({ ...x, monthly_usage: e.target.value }))} disabled={save.isPending} /></label>
          <label className="text-caption">센 날<Input className="mt-0.5 h-8 text-label" type="date" max={today} value={v.stock_as_of} onChange={(e) => setV((x) => ({ ...x, stock_as_of: e.target.value }))} disabled={save.isPending} /></label>
        </div>
        <div className="flex justify-end gap-1.5">
          {has && <Button type="button" variant="ghost" size="sm" className="mr-auto h-7 text-label text-muted-foreground" disabled={save.isPending} onClick={() => save.mutate('clear')}>지우기</Button>}
          <Button type="button" variant="ghost" size="sm" className="h-7 text-label" onClick={() => setEditing(false)} disabled={save.isPending}>취소</Button>
          <Button type="submit" size="sm" className="h-7 text-label" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}저장</Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-label">
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        {!has ? <p className="text-muted-foreground">재고와 월 사용량을 적어 두면 주문할 때를 미리 알려 드립니다.</p>
          : t?.no_lead ? <p>재고 {Number(plan.stock_qty).toLocaleString('ko-KR')}{unit} · 예상 소진 <b>{fmt(t.runout)}</b> <span className="text-muted-foreground">(지난 주문의 도착일 기록이 없어 주문 권장일은 계산하지 못했습니다)</span></p>
          : t && (
            <>
              <p>예상 소진 <b className="tabular-nums">{fmt(t.runout)}</b> · 주문 권장 <b className={`tabular-nums ${t.overdue ? 'text-destructive' : 'text-primary'}`}>{fmt(t.order_by)}</b>{t.overdue && <span className="text-destructive"> (지났습니다)</span>}</p>
              <p className="text-caption text-muted-foreground">재고 {Number(plan.stock_qty).toLocaleString('ko-KR')}{unit} ({fmt(plan.stock_as_of)}) · 월 {Number(plan.monthly_usage).toLocaleString('ko-KR')}{unit} · 발주→도착 평균 {leadDays}일</p>
              {t.holiday && <p className="text-caption text-warning-text">{t.holiday.name} 공장 휴무({fmt(t.holiday.factory_start)}~{fmt(t.holiday.factory_end)})만큼 앞당겼습니다.{t.holiday.order_cutoff_date ? ` 휴무 전 발주 마감 ${fmt(t.holiday.order_cutoff_date)}` : ''}</p>}
            </>
          )}
      </div>
      {canEdit && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-label" onClick={() => setEditing(true)}>{has ? '고치기' : '재고 적기'}</Button>}
    </div>
  );
}
