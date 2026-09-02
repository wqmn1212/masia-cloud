import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CLIENT_PRIORITY, CAT_LABEL } from './clientBoardMeta';

export default function ClientCardTile({ card, onClick }) {
  const p = CLIENT_PRIORITY[card.priority] || CLIENT_PRIORITY.MEDIUM;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-card rounded-xl border p-3 space-y-2 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {card.priority && card.priority !== 'MEDIUM' && (
          <Badge className={`${p.className} border-0 text-[9px] h-4 px-1`}>{p.label}</Badge>
        )}
        {card.target_machine_category && (
          <Badge variant="outline" className="text-[9px] h-4 px-1">
            {CAT_LABEL[card.target_machine_category] || card.target_machine_category}
          </Badge>
        )}
      </div>
      <p className="text-sm font-medium leading-snug line-clamp-2">{card.title}</p>
      {card.due_date && (
        <p className="text-[10px] text-primary font-medium flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />{card.due_date}
        </p>
      )}
    </button>
  );
}