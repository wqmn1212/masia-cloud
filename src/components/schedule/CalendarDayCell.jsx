import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CalendarChip from './CalendarChip';

export default function CalendarDayCell({ cell, events, hol, closed = [], isToday, onOpen }) {
  const shown = events.slice(0, 3);
  const more = events.length - shown.length;
  return (
    <div className={`min-h-28 p-1 border-b border-r flex flex-col gap-0.5 ${hol.name ? 'bg-destructive/10' : ''} ${cell.inMonth ? '' : 'opacity-50'} ${isToday ? 'outline outline-2 -outline-offset-2 outline-primary' : ''}`}>
      <div className="flex items-center gap-1 text-[11px]">
        <span className={`font-medium ${isToday ? 'text-primary' : ''}`}>{cell.day}</span>
        {hol.name && <span className="text-destructive truncate">{hol.name}</span>}
        {hol.makeup && <span className="text-[10px] px-1 rounded bg-muted">보강 근무</span>}
        {hol.cutoff && <span className="text-[10px] px-1 rounded bg-chart-3/20 text-foreground">발주 마감</span>}
      </div>
      {closed.map((n) => <span key={n} className="text-[10px] text-chart-3 truncate">{n} 휴무</span>)}
      {shown.map((ev) => <CalendarChip key={ev.id} ev={ev} onOpen={onOpen} />)}
      {more > 0 && (
        <Popover>
          <PopoverTrigger asChild><button className="text-[11px] text-primary text-left hover:underline">+{more}</button></PopoverTrigger>
          <PopoverContent className="w-64 p-2 space-y-1">
            <p className="text-xs font-semibold mb-1">{cell.key}</p>
            {events.map((ev) => <CalendarChip key={ev.id} ev={ev} onOpen={onOpen} />)}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}