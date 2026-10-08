import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, EyeOff, ClipboardCheck } from 'lucide-react';
import { delayDays, todayStr } from '@/lib/milestones';
import { useWorkT } from '@/lib/workI18n';

export default function MilestoneRow({ m, confirmed, onChange, onComplete, canManage, userId, team }) {
  const { tr, label } = useWorkT();
  const delay = delayDays(m);
  const done = m.status === 'done';
  const overdue = !done && m.planned_date && m.planned_date < todayStr();
  const canComplete = canManage || (m.owner_id && m.owner_id === userId);
  return (
    <div className={`border rounded-lg p-2.5 space-y-2 ${done ? 'bg-muted/30' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-5">{m.seq + 1}</span>
        <p className={`text-sm font-medium flex-1 min-w-0 truncate ${done ? 'line-through text-muted-foreground' : ''}`}>{label(m)}</p>
        {!m.client_visible && <EyeOff className="w-3.5 h-3.5 text-muted-foreground" title={tr('고객 비공개')} />}
        {m.needs_qc_report && <ClipboardCheck className="w-3.5 h-3.5 text-muted-foreground" title={tr('QC 보고서 필요')} />}
        {delay > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">+{delay}{tr('일')}</span>}
        {overdue && <span className="text-[10px] px-1.5 py-0.5 rounded bg-chart-3/15 text-chart-3">{tr('기한 지남')}</span>}
        {done
          ? <span className="text-[10px] text-primary">{tr('완료')} {m.actual_date}</span>
          : canComplete && <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onComplete(m)}><Check className="w-3 h-3" />{tr('완료')}</Button>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div><p className="text-muted-foreground">{tr('기준일')}</p><p>{m.baseline_date || tr('미확정')}</p></div>
        <div>
          <p className="text-muted-foreground">{tr('계획일')}</p>
          <Input key={m.planned_date || ''} type="date" disabled={done || !canManage} defaultValue={m.planned_date || ''} onBlur={(e) => e.target.value && e.target.value !== (m.planned_date || '') && onChange(m, { planned_date: e.target.value })} className="h-7 text-[11px] px-1" />
        </div>
        <div>
          <p className="text-muted-foreground">{tr('담당')}</p>
          {canManage ? (
            <select value={m.owner_id || ''} onChange={(e) => onChange(m, { owner_id: e.target.value || null })} className="h-7 w-full rounded-md border border-input bg-transparent text-[11px] px-1">
              <option value="">{tr('미지정')}</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          ) : <p className="h-7 flex items-center">{m.owner_name || tr('미지정')}</p>}
        </div>
      </div>
      {confirmed && delay > 0 && canComplete && (
        <div className="flex items-center gap-2">
          <Input defaultValue={m.delay_reason || ''} onBlur={(e) => e.target.value !== (m.delay_reason || '') && onChange(m, { delay_reason: e.target.value })} className="h-7 text-[11px]" placeholder={tr('지연 사유')} />
          <label className="flex items-center gap-1 text-[10px] whitespace-nowrap">
            <input type="checkbox" checked={!!m.delay_reason_public} onChange={(e) => onChange(m, { delay_reason_public: e.target.checked })} />{tr('고객 공개')}
          </label>
        </div>
      )}
    </div>
  );
}