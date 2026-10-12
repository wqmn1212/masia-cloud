import React from 'react';
import { buildBars, rangeOf, pct, todayPct, monthTicks, barTone } from '@/lib/gantt';

// 단일 프로젝트 간트. showOwners=false 면 담당자(내부 정보)를 숨긴다.
export default function GanttChart({ milestones = [], start, range: forced, showOwners = true, labelOf = (m) => m.label }) {
  const bars = buildBars(milestones, start);
  if (!bars.length) return <p className="text-xs text-muted-foreground py-4 text-center">표시할 일정이 없습니다.</p>;
  const range = forced || rangeOf([bars]);
  const today = todayPct(range);
  return (
    <div className="text-[11px]">
      <div className="flex">
        <div className="w-40 shrink-0" />
        <div className="relative flex-1 h-5 border-b">
          {monthTicks(range).map((t) => <span key={t.left} className="absolute top-0 text-muted-foreground" style={{ left: `${t.left}%` }}>{t.label}</span>)}
        </div>
      </div>
      {bars.map(({ m, start: s, end }) => {
        const owners = (m.owner_names?.length ? m.owner_names : m.owner_name ? [m.owner_name] : []);
        const left = end ? pct(s, range) : 0;
        const width = end ? Math.max(pct(end, range) - left, 0.8) : 0;
        return (
          <div key={m.id} className="flex items-center group hover:bg-muted/40 rounded">
            <div className="w-40 shrink-0 pr-2 py-1.5 min-w-0">
              <p className="truncate font-medium">{m.seq + 1}. {labelOf(m)}</p>
              {showOwners && <p className="truncate text-muted-foreground">{owners.join(', ') || '미지정'}</p>}
            </div>
            <div className="relative flex-1 h-8">
              {today >= 0 && today <= 100 && <div className="absolute inset-y-0 w-px bg-destructive/50" style={{ left: `${today}%` }} />}
              {end
                ? <div title={`${s} → ${end}`} className={`absolute top-2 h-4 rounded-full transition-all duration-500 ${barTone(m)}`} style={{ left: `${left}%`, width: `${width}%` }} />
                : <span className="absolute top-2 text-muted-foreground">날짜 미정</span>}
              {end && <span className="absolute top-2 text-[10px] text-muted-foreground whitespace-nowrap pl-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${left + width}%` }}>{end.slice(5)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}