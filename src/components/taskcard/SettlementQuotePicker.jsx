import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText } from 'lucide-react';

const usd = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// 카드에 연결된 견적서 중 하나를 골라 정산 기준 금액으로 가져온다
export default function SettlementQuotePicker({ cardId, value, onPick }) {
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['card-quotations', cardId],
    queryFn: () => base44.entities.Quotation.filter({ card_id: cardId }, '-created_date', 100),
  });
  const selected = quotes.find((q) => q.id === value);
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <Label className="text-xs flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />정산 기준 견적서</Label>
      {isLoading ? <p className="text-xs text-muted-foreground">불러오는 중...</p> : !quotes.length ? (
        <p className="text-xs text-muted-foreground">이 카드에 연결된 견적서가 없습니다. 견적 탭에서 먼저 작성하세요.</p>
      ) : (
        <Select value={value || ''} onValueChange={(id) => onPick(quotes.find((q) => q.id === id))}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="견적서 선택" /></SelectTrigger>
          <SelectContent>
            {quotes.map((q) => (
              <SelectItem key={q.id} value={q.id} className="text-xs">
                {q.quote_title || q.product_name || q.factory_name} · {usd(q.final_price_usd)} · {q.created_date?.slice(0, 10)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {selected && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">견적 금액 </span><b>{usd(selected.final_price_usd)}</b></div>
          <div><span className="text-muted-foreground">공장 원가 </span><b>{usd(selected.options_total_usd)}</b></div>
        </div>
      )}
    </div>
  );
}