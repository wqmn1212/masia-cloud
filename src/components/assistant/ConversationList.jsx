import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function ConversationList({ conversations, activeId, onSelect, onNew }) {
  return (
    <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-border bg-card flex md:flex-col items-center md:items-stretch gap-2 md:gap-0 p-2 md:p-0">
      <div className="md:p-3 shrink-0">
        <Button onClick={onNew} size="sm" className="gap-1.5 md:hidden">
          <Plus className="w-4 h-4" /> 새 대화
        </Button>
        <Button onClick={onNew} className="w-full gap-2 hidden md:inline-flex">
          <Plus className="w-4 h-4" /> 새 대화
        </Button>
      </div>
      {/* 모바일: 가로로 넘기는 칩 · 데스크톱: 세로 목록 */}
      <div className="flex md:flex-col flex-1 min-w-0 overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:px-2 md:pb-3 gap-1.5 md:gap-0 md:space-y-1">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              'shrink-0 md:w-full text-left rounded-full md:rounded-lg px-3 py-1.5 md:py-2 text-label md:text-body transition-colors',
              c.id === activeId ? 'bg-primary/10 text-primary' : 'bg-muted md:bg-transparent hover:bg-muted'
            )}
          >
            <span className="flex items-center gap-2 font-medium truncate max-w-[180px] md:max-w-none">
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 hidden md:block" />
              {c.metadata?.name || '대화'}
            </span>
            {c.created_date && (
              <span className="hidden md:block text-caption text-muted-foreground mt-0.5">
                {format(new Date(c.created_date), 'MM/dd HH:mm')}
              </span>
            )}
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="px-3 py-2 text-label text-muted-foreground">대화 기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
