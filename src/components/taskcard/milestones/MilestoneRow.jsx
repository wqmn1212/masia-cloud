import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, EyeOff, ClipboardCheck } from 'lucide-react';
import { delayDays } from '@/lib/milestones';

export default function MilestoneRow({ m, confirmed, onChange, onComplete }) {
  const delay = delayDays(m);
  const done = m.status === 'done';
  const overdue = !done && m.planned_date && m.planned_date < new Date().toISOString().slice(0, 10);
  return (
    <div className={`border rounded-lg p-2.5 space-y-2 ${done ? 'bg-muted/30' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-5">{m.seq + 1}</span>
        <p className={`text-sm font-medium flex-1 min-w-0 truncate ${done ? 'line-through text-muted-foreground' : ''}`}>{m.label}</p>
        {!m.client_visible && <EyeOff className="w-3.5 h-3.5 text-muted-foreground" title="고객 비공개" />}
        {m.needs_qc_report && <ClipboardCheck className="w-3.5 h-3.5 text-muted-foreground" title="QC 보고서 필요" />}
        {delay > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">+{delay}일</span>}
        {overdue && <span className="text-[10px] px-1.5 py-0.5 rounded bg-chart-3/15 text-chart-3">기한 지남</span>}
        {done
          ? <span className="text-[10px] text-primary">완료 {m.actual_date}</span>
          : <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onComplete(m)}><Check className="w-3 h-3" />완료</Button>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div><p className="text-muted-foreground">기준일</p><p>{m.baseline_date || '미확정'}</p></div>
        <div>
          <p className="text-muted-foreground">계획일</p>
          <Input key={m.planned_date || ''} type="date" disabled={done} defaultValue={m.planned_date || ''} onBlur={(e) => e.target.value && e.target.value !== (m.planned_date || '') && onChange(m, { planned_date: e.target.value })} className="h-7 text-[11px] px-1" />
        </div>
        <div>
          <p className="text-muted-foreground">담당</p>
          <Input defaultValue={m.owner_name || ''} onBlur={(e) => e.target.value !== (m.owner_name || '') && onChange(m, { owner_name: e.target.value })} className="h-7 text-[11px] px-1" placeholder="이름" />
        </div>
      </div>
      {confirmed && delay > 0 && (
        <div className="flex items-center gap-2">
          <Input defaultValue={m.delay_reason || ''} onBlur={(e) => e.target.value !== (m.delay_reason || '') && onChange(m, { delay_reason: e.target.value })} className="h-7 text-[11px]" placeholder="지연 사유" />
          <label className="flex items-center gap-1 text-[10px] whitespace-nowrap">
            <input type="checkbox" checked={!!m.delay_reason_public} onChange={(e) => onChange(m, { delay_reason_public: e.target.checked })} />고객 공개
          </label>
        </div>
      )}
    </div>
  );
}