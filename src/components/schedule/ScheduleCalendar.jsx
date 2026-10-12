import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';
import { todayStr } from '@/lib/gantt';
import { monthGrid, buildEvents, holidayOn } from '@/lib/scheduleCalendar';
import CalendarToolbar from './CalendarToolbar';
import CalendarDayCell from './CalendarDayCell';
import CalendarAgenda from './CalendarAgenda';

const KEY = 'aegis.scheduleCalendar';
const LEGEND = [['bg-primary', '완료'], ['bg-primary/35', '예정'], ['bg-chart-2', '진행 중'], ['bg-destructive', '기한 지남'], ['bg-destructive/10 border', '중국 공휴일']];

export default function ScheduleCalendar({ cards = [], onOpenCard }) {
  const { user } = useAuth();
  const manager = ['master', 'service'].includes(user?.account_tier);
  const [prefs, setPrefs] = useState(() => {
    const base = { month: todayStr().slice(0, 7), owners: [], client: '', mine: !manager };
    try { return { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return base; }
  });
  const set = (p) => setPrefs((s) => { const n = { ...s, ...p }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* 저장 차단 */ } return n; });

  const active = cards.filter((c) => c.milestone_template_id && !['DONE', 'CANCELLED'].includes(c.status));
  const ids = active.map((c) => c.id);
  const grid = useMemo(() => monthGrid(prefs.month), [prefs.month]);
  const from = grid[0].key, to = grid[grid.length - 1].key;

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['card-milestones', 'calendar', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: () => base44.entities.CardMilestone.filter({ card_id: { $in: ids } }, 'seq', 1000),
  });
  const { data: holidays = [] } = useQuery({
    queryKey: ['china-holidays', 'calendar', from, to],
    queryFn: () => base44.entities.ChinaHoliday.filter({ start_date: { $lte: to }, end_date: { $gte: from } }, 'start_date', 50),
  });

  const { data: closures = [] } = useQuery({
    queryKey: ['factory-closures', 'calendar', from, to],
    queryFn: () => base44.entities.FactoryClosure.filter({ start_date: { $lte: to }, end_date: { $gte: from } }, 'start_date', 200),
  });

  const owners = useMemo(() => {
    const map = {};
    milestones.forEach((m) => (m.owner_ids || []).forEach((id, i) => { map[id] = m.owner_names?.[i] || map[id] || id; }));
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [milestones]);
  const clients = [...new Set(active.map((c) => c.client_name).filter(Boolean))];

  const byDate = useMemo(() => {
    const cardsById = Object.fromEntries(active.map((c) => [c.id, c]));
    const ms = milestones.filter((m) => {
      const o = m.owner_ids || [];
      if (prefs.mine && !o.includes(user?.id)) return false;
      if (prefs.owners.length && !prefs.owners.some((id) => o.includes(id))) return false;
      if (prefs.client && cardsById[m.card_id]?.client_name !== prefs.client) return false;
      return true;
    });
    const out = {};
    buildEvents(ms, cardsById, holidays, closures).forEach((e) => (out[e.date] ||= []).push(e));
    return out;
  }, [milestones, holidays, closures, prefs, active, user?.id]);

  const today = todayStr();
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">프로젝트 일정 달력</h2>
        {isLoading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
      </div>
      <CalendarToolbar prefs={prefs} set={set} owners={owners} clients={clients} />
      <div className="hidden sm:block border-l border-t rounded-md overflow-hidden">
        <div className="grid grid-cols-7 text-[11px] text-muted-foreground bg-muted">
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => <div key={d} className={`px-2 py-1 border-b border-r ${d === '일' ? 'text-destructive' : ''}`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((c) => <CalendarDayCell key={c.key} cell={c} events={byDate[c.key] || []} hol={holidayOn(holidays, c.key)} isToday={c.key === today} onOpen={onOpenCard} />)}
        </div>
      </div>
      <div className="sm:hidden"><CalendarAgenda grid={grid} byDate={byDate} holidays={holidays} today={today} onOpen={onOpenCard} /></div>
      <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
        {LEGEND.map(([c, l]) => <span key={l} className="flex items-center gap-1"><i className={`w-3 h-2 rounded ${c}`} />{l}</span>)}
        <span className="flex items-center gap-1"><i className="w-3 h-2 rounded border border-dashed border-muted-foreground/50" />원래 계획일</span>
      </div>
    </Card>
  );
}