import React from 'react';
import { CalendarDays } from 'lucide-react';
import { todayStr } from '@/lib/milestones';
import { useWorkT } from '@/lib/workI18n';

export default function MyWorkCardRow({ card, onOpen }) {
  const { tr, lang } = useWorkT();
  const overdue = card.next_action_due && card.next_action_due < todayStr();
  const title = lang === 'zh' && card.title_cn ? card.title_cn : card.title;
  return (
    <button onClick={() => onOpen(card)} className="w-full text-left border rounded-lg p-3 bg-card hover:border-primary/50 transition-colors space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium flex-1 min-w-0 truncate">{title}</p>
        {card.overdue_steps > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-chart-3/15 text-chart-3">{tr('지금 지연 중')}</span>}
        {card.delay_days > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">+{card.delay_days}{tr('일')}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground truncate">
        {card.client_name && `🏢 ${card.client_name}`}{card.current_milestone_label && ` · ▸ ${(lang === 'zh' && card.current_milestone_label_cn) || card.current_milestone_label}`}
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span className={`flex-1 min-w-0 truncate ${card.next_action ? '' : 'text-muted-foreground'}`}>{card.next_action || tr('다음 할 일 미정')}</span>
        {card.next_action_due && <span className={`flex items-center gap-1 ${overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}><CalendarDays className="w-3 h-3" />{card.next_action_due}</span>}
      </div>
    </button>
  );
}