import React from 'react';
import { Check } from 'lucide-react';
import GanttChart from '@/components/gantt/GanttChart';

export default function ClientMilestonePanel({ milestones = [] }) {
  if (!milestones.length) return null;
  const currentIdx = milestones.findIndex((m) => m.status !== 'done' && m.status !== 'skipped');
  return (
    <div className="border rounded-lg p-3 mb-4">
      <p className="text-body font-semibold mb-3">진행 단계</p>
      <div className="mb-4 overflow-x-auto"><div className="min-w-[480px]"><GanttChart milestones={milestones.map((m, i) => ({ ...m, seq: m.seq ?? i }))} showOwners={false} /></div></div>
      <ol className="space-y-2">
        {milestones.map((m, i) => {
          const done = m.status === 'done';
          const current = i === currentIdx;
          return (
            <li key={m.id} className="flex gap-2.5">
              <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-micro ${done ? 'bg-primary text-primary-foreground' : current ? 'border-2 border-primary text-primary' : 'border text-muted-foreground'}`}>
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-body ${current ? 'font-semibold' : done ? 'text-muted-foreground' : ''}`}>{m.label}</p>
                </div>
                <p className="text-micro text-muted-foreground">{done ? `완료 ${m.actual_date}` : `예정 ${m.planned_date || '-'}`}</p>
                {m.delay_reason && <p className="text-micro text-muted-foreground mt-0.5">사유: {m.delay_reason}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}