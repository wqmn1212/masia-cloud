import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { ChevronDown, GanttChartSquare } from 'lucide-react';
import GanttChart from './GanttChart';
import { buildBars, rangeOf } from '@/lib/gantt';

// 어드민 대시보드: 진행 중 프로젝트별 간트를 한 눈에
export default function GanttOverview({ cards = [], onOpenCard }) {
  const [open, setOpen] = useState({});
  const active = cards.filter((c) => c.milestone_template_id && !['DONE', 'CANCELLED'].includes(c.status));
  const ids = active.map((c) => c.id);
  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['card-milestones', 'overview', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => (await base44.entities.CardMilestone.filter({ card_id: { $in: ids } }, { sort: 'seq', limit: 1000 })).items,
  });
  const byCard = active.map((c) => ({ c, ms: milestones.filter((m) => m.card_id === c.id) })).filter((x) => x.ms.length);
  const range = rangeOf(byCard.map(({ c, ms }) => buildBars(ms, c.created_date)));

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <GanttChartSquare className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">프로젝트 일정 간트</h2>
        <span className="text-xs text-muted-foreground">{byCard.length}개 프로젝트</span>
        <div className="flex-1" />
        <div className="hidden md:flex gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><i className="w-3 h-2 rounded bg-primary" />완료</span>
          <span className="flex items-center gap-1"><i className="w-3 h-2 rounded bg-primary/35" />예정</span>
          <span className="flex items-center gap-1"><i className="w-3 h-2 rounded bg-destructive" />기한 지남</span>
        </div>
      </div>
      {isLoading && <div className="h-20 flex items-center justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
      {!isLoading && !byCard.length && <p className="text-sm text-muted-foreground text-center py-6">마일스톤 계획이 있는 진행 중 프로젝트가 없습니다.</p>}
      <div className="divide-y">
        {byCard.map(({ c, ms }) => (
          <div key={c.id} className="py-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))} className="flex items-center gap-1.5 text-sm font-medium hover:text-primary">
                <ChevronDown className={`w-4 h-4 transition-transform ${open[c.id] ? '' : '-rotate-90'}`} />{c.title}
              </button>
              <span className="text-xs text-muted-foreground truncate">{c.client_name}</span>
              <span className="text-xs text-muted-foreground">{ms.filter((m) => m.status === 'done').length}/{ms.length}</span>
              <div className="flex-1" />
              <button onClick={() => onOpenCard?.(c)} className="text-xs text-primary hover:underline">카드 열기</button>
            </div>
            {open[c.id] && <div className="mt-2"><GanttChart milestones={ms} start={c.created_date} range={range} /></div>}
          </div>
        ))}
      </div>
    </Card>
  );
}