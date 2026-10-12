import React from 'react';
import CalendarChip from './CalendarChip';
import { holidayOn } from '@/lib/scheduleCalendar';

// 모바일: 오늘부터 날짜별 목록
export default function CalendarAgenda({ grid, byDate, holidays, today, onOpen }) {
  const days = grid.filter((c) => c.inMonth && c.key >= today && byDate[c.key]?.length);
  if (!days.length) return <p className="text-sm text-muted-foreground text-center py-6">이번 달 남은 일정이 없습니다.</p>;
  return (
    <div className="divide-y">
      {days.map((c) => {
        const hol = holidayOn(holidays, c.key);
        return (
          <div key={c.key} className="py-2 space-y-1">
            <p className={`text-xs font-semibold ${c.key === today ? 'text-primary' : ''}`}>
              {c.key}{c.key === today && ' · 오늘'}{hol.name && <span className="text-destructive"> · {hol.name}</span>}
            </p>
            {byDate[c.key].map((ev) => <CalendarChip key={ev.id} ev={ev} onOpen={onOpen} />)}
          </div>
        );
      })}
    </div>
  );
}