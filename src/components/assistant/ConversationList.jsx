import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function ConversationList({ conversations, activeId, onSelect, onNew }) {
  return (
    <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col">
      <div className="p-3">
        <Button onClick={onNew} className="w-full gap-2">
          <Plus className="w-4 h-4" /> 새 대화
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1 max-h-48 md:max-h-none">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              'w-full text-left rounded-lg px-3 py-2 text-sm transition-colors',
              c.id === activeId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            )}
          >
            <span className="flex items-center gap-2 font-medium truncate">
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              {c.metadata?.name || '대화'}
            </span>
            {c.created_date && (
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                {format(new Date(c.created_date), 'MM/dd HH:mm')}
              </span>
            )}
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">대화 기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
}