import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

// 견적서를 고객 포털에 공개한다. 공개 시점(client_published_at)이 기록된 견적만 고객이 볼 수 있다.
export default function QuotationPublishPanel({ card }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: quotations = [] } = useQuery({
    queryKey: ['card-quotations-publish', card.id],
    queryFn: () => base44.entities.Quotation.filter({ card_id: card.id }, '-created_date', 30),
  });

  const publish = useMutation({
    mutationFn: async ({ id, next }) => {
      await base44.entities.Quotation.update(id, {
        client_published_at: next ? new Date().toISOString() : '',
        client_id: card.client_id || '',
        client_name: card.client_name || '',
      });
      if (next) await base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'quote_published' });
    },
    onSuccess: (_d, { next }) => {
      qc.invalidateQueries({ queryKey: ['card-quotations-publish', card.id] });
      toast({ title: next ? '고객에게 견적서를 공개했습니다' : '견적서 공개를 해제했습니다' });
    },
  });

  if (quotations.length === 0) return null;

  return (
    <section className="mb-4 rounded-xl border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">고객 포털 견적서 공개</h3>
      </div>
      {!card.client_id && (
        <p className="text-[11px] text-muted-foreground">고객사가 연결되지 않았습니다. 문의 접수에서 고객사 팀을 먼저 발급하세요.</p>
      )}
      {quotations.map((q) => (
        <div key={q.id} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{q.quote_title || q.product_name || '견적서'}</p>
            <p className="text-[10px] text-muted-foreground">
              {q.client_published_at ? `공개 ${format(new Date(q.client_published_at), 'yyyy.MM.dd')}` : '미공개'}
            </p>
          </div>
          <Switch
            checked={!!q.client_published_at}
            disabled={!card.client_id || publish.isPending}
            onCheckedChange={(next) => publish.mutate({ id: q.id, next })}
          />
        </div>
      ))}
    </section>
  );
}