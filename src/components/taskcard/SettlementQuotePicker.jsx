import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText } from 'lucide-react';

const usd = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// 카드의 '승인됨' 견적서를 여러 개 골라 합산 금액을 정산 기준으로 가져온다
export default function SettlementQuotePicker({ cardId, value = [], onPick }) {
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['card-approved-quotations', cardId],
    queryFn: () => base44.entities.Quotation.filter({ card_id: cardId, status: 'APPROVED' }, '-created_date', 100),
  });
  const toggle = (id) => {
    const ids = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    onPick(ids, quotes.filter((q) => ids.includes(q.id)));
  };
  const picked = quotes.filter((q) => value.includes(q.id));
  const sum = (k) => picked.reduce((s, q) => s + (Number(q[k]) || 0), 0);
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <Label className="text-xs flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />정산 기준 견적서 (승인됨만, 여러 개 선택 가능)</Label>
      {isLoading ? <p className="text-xs text-muted-foreground">불러오는 중...</p> : !quotes.length ? (
        <p className="text-xs text-muted-foreground">이 카드에 승인된 견적서가 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {quotes.map((q) => (
            <label key={q.id} className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={value.includes(q.id)} onCheckedChange={() => toggle(q.id)} />
              <span className="flex-1 truncate">{q.quote_title || q.product_name || q.factory_name} · {q.created_date?.slice(0, 10)}</span>
              <b>{usd(q.final_price_usd)}</b>
            </label>
          ))}
        </div>
      )}
      {picked.length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
          <div><span className="text-muted-foreground">견적 합계 </span><b>{usd(sum('final_price_usd'))}</b></div>
          <div><span className="text-muted-foreground">공장 원가 합계 </span><b>{usd(sum('options_total_usd'))}</b></div>
        </div>
      )}
    </div>
  );
}