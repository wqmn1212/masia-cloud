import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, PackageCheck, Ship } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { shortDate, kstToday } from './clientFormat';

// 입고 달력: 공개 선적의 도착 예정·실제 도착과 공개된 진행 단계 예정일을 월 달력에, 중국 공장 휴무(예상)는 음영으로.
// 일정은 listClientTodos 의 calendar(지난 60일 ~ 앞으로 180일), 휴무는 listClientHolidays(앞으로 90일)를 쓴다.
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const KIND = {
  ETA: { label: '도착 예정', chip: 'border border-primary/40 bg-primary/5 text-primary', dot: 'bg-primary/60' },
  ARRIVED: { label: '도착', chip: 'bg-primary text-primary-foreground', dot: 'bg-primary' },
  STEP: { label: '진행 단계', chip: 'bg-muted text-foreground', dot: 'bg-muted-foreground/60' },
};
const pad = (n) => String(n).padStart(2, '0');
const MAX_CHIPS = 3;

export default function ClientArrivalCalendar({ events, loading, onOpen }) {
  const today = kstToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { data: holidays = [] } = useQuery({
    queryKey: ['client-holidays'],
    queryFn: async () => (await base44.functions.invoke('listClientHolidays', withClientView())).data?.holidays || [],
  });
  const [y, m] = month.split('-').map(Number);
  const offsetOf = (ym) => { const [yy, mm] = ym.split('-').map(Number); return (yy - y) * 12 + (mm - m); };
  // 일정을 받아 오는 범위(지난 2달 ~ 앞으로 6달) 밖으로는 넘기지 않는다
  const canPrev = offsetOf(today.slice(0, 7)) < 2;
  const canNext = offsetOf(today.slice(0, 7)) > -6;
  const shift = (n) => setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const list = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)];
    while (list.length % 7) list.push(null);
    return list;
  }, [y, m]);
  const byDate = useMemo(() => events.reduce((map, e) => map.set(e.date, [...(map.get(e.date) || []), e]), new Map()), [events]);
  const holidayOf = (d) => holidays.find((h) => d >= h.factory_start && d <= h.factory_end);
  const monthEvents = events.filter((e) => e.date.startsWith(month));

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={!canPrev} onClick={() => shift(-1)} aria-label="이전 달"><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="min-w-[96px] text-center text-body font-semibold tabular-nums">{y}년 {m}월</h3>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={!canNext} onClick={() => shift(1)} aria-label="다음 달"><ChevronRight className="h-4 w-4" /></Button>
        {month !== today.slice(0, 7) && <Button type="button" variant="ghost" size="sm" className="h-8 text-label" onClick={() => setMonth(today.slice(0, 7))}>이번 달</Button>}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <span className="flex items-center gap-1"><Ship className="h-3.5 w-3.5 text-primary" />도착 예정</span>
          <span className="flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5 text-primary" />도착</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" />진행 단계</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-warning/30" />중국 공장 휴무(예상)</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-caption text-muted-foreground">
          {WEEK.map((w, i) => <div key={w} className={cn('py-1.5', i === 0 && 'text-destructive')}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (!d) return <div key={`blank-${i}`} className="min-h-[52px] border-b border-r bg-muted/20 sm:min-h-[92px]" />;
            const list = byDate.get(d) || [];
            const holiday = holidayOf(d);
            return (
              <div key={d} className={cn('min-h-[52px] border-b border-r p-1 sm:min-h-[92px]', holiday && 'bg-warning/10')} title={holiday ? `${holiday.name} (공장 휴무 예상)` : undefined}>
                <div className="flex items-center gap-1">
                  <span className={cn('flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-caption tabular-nums', d === today ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground')}>{Number(d.slice(8))}</span>
                  {holiday && d === holiday.factory_start && <span className="hidden truncate text-micro text-warning-text sm:inline">{holiday.name}</span>}
                </div>
                <div className="mt-0.5 hidden space-y-0.5 sm:block">
                  {list.slice(0, MAX_CHIPS).map((e) => (
                    <button key={e.id} type="button" onClick={() => onOpen(e.card_id, 'overview')} title={`${e.card_title} · ${e.label}`}
                      className={cn('flex w-full items-center gap-1 truncate rounded px-1 py-px text-left text-micro', KIND[e.kind].chip, e.kind === 'STEP' && e.done && 'text-muted-foreground line-through')}>
                      {e.kind === 'ETA' && <Ship className="h-3 w-3 shrink-0" />}{e.kind === 'ARRIVED' && <PackageCheck className="h-3 w-3 shrink-0" />}
                      <span className="truncate">{e.kind === 'STEP' ? `${e.label} · ${e.card_title}` : e.card_title}</span>
                    </button>
                  ))}
                  {list.length > MAX_CHIPS && <p className="px-1 text-micro text-muted-foreground">+{list.length - MAX_CHIPS}건</p>}
                </div>
                {list.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                    {list.slice(0, 4).map((e) => <span key={e.id} className={cn('h-1.5 w-1.5 rounded-full', KIND[e.kind].dot)} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 휴대폰: 칸이 좁아 점만 찍으므로 이 달 일정을 목록으로 */}
      <section className="sm:hidden">
        <h3 className="text-label font-semibold">{m}월 일정 {monthEvents.length}건</h3>
        {monthEvents.length === 0 ? (
          <p className="py-3 text-label text-muted-foreground">이 달에 공개된 도착·진행 일정이 없습니다.</p>
        ) : (
          <ul className="mt-1 divide-y">
            {monthEvents.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onOpen(e.card_id, 'overview')} className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-2 text-left hover:bg-muted/50">
                  <span className={cn('w-20 shrink-0 text-label tabular-nums', e.date === today ? 'font-semibold text-primary' : 'text-muted-foreground')}>{shortDate(e.date)}</span>
                  <Badge className={cn('shrink-0 border-0 text-micro', KIND[e.kind].chip)}>{KIND[e.kind].label}</Badge>
                  <span className={cn('min-w-0 truncate text-label', e.kind === 'STEP' && e.done && 'text-muted-foreground line-through')}>{e.label}</span>
                  <span className="min-w-0 truncate text-caption text-muted-foreground">{e.card_title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
