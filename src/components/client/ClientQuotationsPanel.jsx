import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileBox, Factory, Inbox } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_META = {
  DRAFT:    { label: '초안',   color: 'bg-slate-100 text-slate-700 border-slate-200' },
  REVIEW:   { label: '검토',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  APPROVED: { label: '승인',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  SENT:     { label: '발송',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  ACCEPTED: { label: '수락',   color: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED: { label: '거절',   color: 'bg-red-100 text-red-700 border-red-200' },
};

const CATEGORY_LABEL = {
  DRIP_BAG: '드립백', SLEEVE: '슬리브', DESKTOP_LABELER: '라벨러', TUBE_SEALER: '튜브실링',
};

export default function ClientQuotationsPanel({ quotations, cardsById, onCardClick }) {
  if (quotations.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40" />
        <p className="mt-4 text-lg font-semibold">등록된 견적이 없습니다</p>
        <p className="text-sm text-muted-foreground mt-1">태스크 카드의 견적 탭에서 견적을 등록하면 여기에 모입니다</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y">
      {quotations.map((q) => {
        const status = STATUS_META[q.status] || STATUS_META.DRAFT;
        const card = cardsById[q.card_id];
        return (
          <div key={q.id} className="flex items-start gap-3 p-3 hover:bg-muted/40 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <FileBox className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm flex items-center gap-1">
                  <Factory className="w-3.5 h-3.5" />
                  {q.factory_name || '미지정 공장'}
                </span>
                <Badge variant="outline" className={`${status.color} text-[10px]`}>{status.label}</Badge>
                {q.machine_category && (
                  <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABEL[q.machine_category]}</Badge>
                )}
                {q.incoterms && <Badge variant="outline" className="text-[10px]">{q.incoterms}</Badge>}
              </div>
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
                {Array.isArray(q.line_items) && <span>· 항목 {q.line_items.length}건</span>}
                {q.created_date && <span>· {format(new Date(q.created_date), 'yyyy-MM-dd')}</span>}
              </div>
            </div>
            {q.final_client_price ? (
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold tabular-nums">
                  ¥{Number(q.final_client_price).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">고객 제안가</div>
              </div>
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}