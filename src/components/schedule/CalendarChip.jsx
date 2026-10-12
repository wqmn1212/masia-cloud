import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function CalendarChip({ ev, onOpen }) {
  const { m, card } = ev;
  const isDark = ['bg-primary', 'bg-destructive', 'bg-chart-2'].includes(ev.tone);
  const cls = ev.ghost
    ? 'border border-dashed border-muted-foreground/50 text-muted-foreground bg-transparent'
    : `${ev.tone} ${isDark ? 'text-primary-foreground' : 'text-foreground'} ${ev.conflict ? 'ring-2 ring-chart-3' : ''}`;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={() => onOpen(card)} className={`w-full flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-left truncate ${cls}`}>
            {m.needs_qc_report && <ShieldCheck className="w-3 h-3 shrink-0" />}
            <span className="truncate"><b className="font-semibold">[{card.title}]</b> {m.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-xs space-y-0.5">
          <p className="font-semibold">{card.title} · {m.label}{ev.ghost ? ' (원래 계획일)' : ''}</p>
          <p>담당자: {(m.owner_names || []).join(', ') || m.owner_name || '미지정'}</p>
          <p>계획일: {m.planned_date || '-'}{m.baseline_date && m.baseline_date !== m.planned_date ? ` (기준 ${m.baseline_date})` : ''}</p>
          <p>완료일: {m.actual_date || '-'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}