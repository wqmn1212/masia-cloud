import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Calendar, User, AlertCircle, Inbox } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_META = {
  TODO:        { label: '대기',   color: 'bg-slate-100 text-slate-700 border-slate-200' },
  IN_PROGRESS: { label: '진행중', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  DONE:        { label: '완료',   color: 'bg-green-100 text-green-700 border-green-200' },
};

const PRIORITY_META = {
  URGENT: { label: '긴급', color: 'text-red-600' },
  HIGH:   { label: '높음', color: 'text-orange-600' },
  MEDIUM: { label: '보통', color: 'text-blue-600' },
  LOW:    { label: '낮음', color: 'text-slate-500' },
};

export default function ClientTasksPanel({ taskItems, cardsById, onCardClick }) {
  if (taskItems.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40" />
        <p className="mt-4 text-lg font-semibold">등록된 세부 업무가 없습니다</p>
        <p className="text-sm text-muted-foreground mt-1">태스크 카드의 업무 탭에서 항목을 추가하면 여기에 모입니다</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y">
      {taskItems.map((t) => {
        const status = STATUS_META[t.status] || STATUS_META.TODO;
        const priority = PRIORITY_META[t.priority];
        const card = cardsById[t.card_id];
        return (
          <div key={t.id} className="flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
              <ListChecks className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{t.title}</span>
                <Badge variant="outline" className={`${status.color} text-[10px]`}>{status.label}</Badge>
                {priority && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-medium ${priority.color}`}>
                    <AlertCircle className="w-3 h-3" />{priority.label}
                  </span>
                )}
              </div>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                {card && (
                  <button
                    onClick={() => onCardClick(card)}
                    className="hover:text-primary hover:underline truncate max-w-[220px]"
                    title={card.title}
                  >
                    📋 {card.title}
                  </button>
                )}
                {t.assignee_name && (
                  <span className="flex items-center gap-0.5">
                    · <User className="w-3 h-3" />{t.assignee_name}
                  </span>
                )}
                {t.due_date && (
                  <span className="flex items-center gap-0.5">
                    · <Calendar className="w-3 h-3" />{format(new Date(t.due_date), 'yyyy-MM-dd')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}