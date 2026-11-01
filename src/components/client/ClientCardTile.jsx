import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CLIENT_PRIORITY } from './clientBoardMeta';

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
          <Badge className={`${p.className} border-0 text-micro h-4 px-1`}>{p.label}</Badge>
        )}
      </div>
      <p className="text-body font-medium leading-snug line-clamp-2">{card.title}</p>
      {(card.holiday_badges || []).map((h) => (
        <Badge key={h.name + h.start} className="bg-warning/15 text-warning-text border-0 text-micro">{h.name} 휴무 겹침 · {h.start}~{h.end}</Badge>
      ))}
      {card.due_date && (
        <p className="text-micro text-primary font-medium flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />{card.due_date}
        </p>
      )}
    </button>
  );
}