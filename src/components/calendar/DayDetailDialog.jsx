import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, LayoutGrid, ListTodo } from 'lucide-react';

const PRIORITY_META = {
  URGENT: { label: '긴급',  className: 'bg-destructive text-destructive-foreground' },
  HIGH:   { label: '높음',  className: 'bg-orange-500 text-white' },
  MEDIUM: { label: '보통',  className: 'bg-chart-3/20 text-chart-3' },
  LOW:    { label: '낮음',  className: 'bg-muted text-muted-foreground' },
};

const STATUS_LABEL = {
  TODO: '대기', IN_PROGRESS: '진행 중', REVIEW: '견적 검토',
  PRODUCTION: '발주·제작', DONE: '완료',
};

function formatDateLong(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${y}년 ${Number(m)}월 ${Number(d)}일 (${weekday})`;
}

export default function DayDetailDialog({ open, onClose, dateKey, cards = [], taskItems = [], onSelectCard }) {
  const dayCards = useMemo(
    () => cards.filter(c => c.due_date?.slice(0, 10) === dateKey),
    [cards, dateKey]
  );
  const dayItems = useMemo(
    () => taskItems.filter(i => i.due_date?.slice(0, 10) === dateKey),
    [taskItems, dateKey]
  );

  const handleItemClick = (item) => {
    const parent = cards.find(c => c.id === item.card_id);
    if (parent) onSelectCard?.(parent, 'tasks');
  };

  const total = dayCards.length + dayItems.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            {formatDateLong(dateKey)}
            <Badge variant="outline" className="ml-2 text-[10px]">총 {total}건</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {total === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              이 날 등록된 업무가 없습니다.
            </div>
          )}

          {dayCards.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <LayoutGrid className="w-3.5 h-3.5" /> 카드 ({dayCards.length})
              </div>
              {dayCards.map(card => {
                const p = PRIORITY_META[card.priority];
                return (
                  <button
                    key={card.id}
                    onClick={() => onSelectCard?.(card)}
                    className="w-full text-left rounded-xl border bg-card hover:bg-accent/5 p-3 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {p && <Badge className={`${p.className} border-0 text-[10px] h-4 px-1.5`}>{p.label}</Badge>}
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{STATUS_LABEL[card.status] || card.status}</Badge>
                      {card.client_name && (
                        <span className="text-[11px] text-muted-foreground">🏢 {card.client_name}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug">{card.title}</p>
                  </button>
                );
              })}
            </div>
          )}

          {dayItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <ListTodo className="w-3.5 h-3.5" /> 세부 업무 ({dayItems.length})
              </div>
              {dayItems.map(item => {
                const parent = cards.find(c => c.id === item.card_id);
                const p = PRIORITY_META[item.priority];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    disabled={!parent}
                    className="w-full text-left rounded-xl border bg-muted/20 hover:bg-accent/10 p-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {p && <Badge className={`${p.className} border-0 text-[10px] h-4 px-1.5`}>{p.label}</Badge>}
                      {parent && (
                        <span className="text-[11px] text-muted-foreground">↳ {parent.title}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}