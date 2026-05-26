import { Badge } from '@/components/ui/badge';
import { FileText, FileBox, ListChecks, Calendar, AlertCircle, User } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_META = {
  TODO:        { label: '대기',   color: 'bg-slate-100 text-slate-700 border-slate-200' },
  IN_PROGRESS: { label: '진행중', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  REVIEW:      { label: '검토',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  PRODUCTION:  { label: '생산',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  DONE:        { label: '완료',   color: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED:   { label: '취소',   color: 'bg-red-50 text-red-700 border-red-200' },
};

const PRIORITY_META = {
  URGENT: { label: '긴급', color: 'text-red-600' },
  HIGH:   { label: '높음', color: 'text-orange-600' },
  MEDIUM: { label: '보통', color: 'text-blue-600' },
  LOW:    { label: '낮음', color: 'text-slate-500' },
};

export default function TaskCardSummaryItem({
  card,
  counts,
  onClick,
  secondaryText,
  secondaryIcon: SecIcon = User,
}) {
  const status = STATUS_META[card.status] || STATUS_META.TODO;
  const priority = PRIORITY_META[card.priority];
  const c = counts || { files: 0, quotations: 0, tasks: 0, doneTasks: 0 };
  // 기본값: 고객사 이름. 호출 측에서 명시적으로 다른 값(공장명 등)을 넘길 수 있음
  const display = secondaryText !== undefined ? secondaryText : card.client_name;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border rounded-xl p-4 hover:shadow-md hover:border-primary/40 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm line-clamp-2 flex-1 group-hover:text-primary transition-colors">
          {card.title}
        </h3>
        <Badge variant="outline" className={`${status.color} text-[10px] flex-shrink-0`}>
          {status.label}
        </Badge>
      </div>

      {display && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <SecIcon className="w-3 h-3" />
          <span className="truncate">{display}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground" title="첨부 파일">
          <FileText className="w-3.5 h-3.5" />
          <span>{c.files}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground" title="견적">
          <FileBox className="w-3.5 h-3.5" />
          <span>{c.quotations}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground" title="완료/전체 업무">
          <ListChecks className="w-3.5 h-3.5" />
          <span>{c.doneTasks}/{c.tasks}</span>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-dashed flex items-center justify-between text-[10px] text-muted-foreground">
        {card.due_date ? (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(card.due_date), 'yyyy-MM-dd')}
          </span>
        ) : <span />}
        {priority && (
          <span className={`flex items-center gap-1 font-medium ${priority.color}`}>
            <AlertCircle className="w-3 h-3" />
            {priority.label}
          </span>
        )}
      </div>
    </button>
  );
}