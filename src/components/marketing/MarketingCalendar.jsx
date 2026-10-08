import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STATUS, kstDate } from './marketingMeta';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export default function MarketingCalendar({ posts, loading, onOpen }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const first = new Date(ym.y, ym.m, 1);
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const key = (d) => `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const byDay = {};
  posts.forEach((p) => {
    const at = p.published_at || p.scheduled_at;
    if (at) (byDay[kstDate(at)] ||= []).push(p);
  });
  const unscheduled = posts.filter((p) => !p.published_at && !p.scheduled_at);
  const shift = (n) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)}><ChevronLeft /></Button>
            <h2 className="text-lg font-semibold w-28 text-center">{ym.y}. {ym.m + 1}</h2>
            <Button variant="ghost" size="icon" onClick={() => shift(1)}><ChevronRight /></Button>
          </div>
          <Button size="sm" onClick={() => onOpen(null)}><Plus /> 새 게시물</Button>
        </div>
        <div className="grid grid-cols-7 text-xs text-muted-foreground mb-2">
          {WEEK.map((w, i) => <div key={w} className={cn('px-2', [1, 3, 5].includes(i) && 'text-primary font-medium')}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => (
            <div key={i} className={cn('min-h-24 rounded-lg p-1.5 text-xs', d ? 'bg-muted/40' : '')}>
              {d && <div className="text-muted-foreground mb-1">{d}</div>}
              {d && (byDay[key(d)] || []).map((p) => (
                <button key={p.id} onClick={() => onOpen(p)}
                  className={cn('block w-full truncate text-left rounded px-1.5 py-0.5 mb-1 transition-opacity hover:opacity-80', STATUS[p.status]?.cls)}>
                  {p.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <aside className="rounded-2xl border bg-card p-5">
        <h3 className="font-semibold mb-3 text-sm">일정 미지정</h3>
        {loading && <p className="text-xs text-muted-foreground">불러오는 중...</p>}
        {!loading && !unscheduled.length && <p className="text-xs text-muted-foreground">모든 게시물에 일정이 있습니다.</p>}
        <div className="space-y-2">
          {unscheduled.map((p) => (
            <button key={p.id} onClick={() => onOpen(p)} className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <p className="text-sm font-medium truncate">{p.title}</p>
              <span className={cn('inline-block mt-1 text-[11px] rounded px-1.5 py-0.5', STATUS[p.status]?.cls)}>{STATUS[p.status]?.label}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}