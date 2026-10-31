import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { APPROVER_TIERS, QuoteApprovalActions } from '@/components/quotation/QuoteApproval';

// 견적 승인·고객 발송. 직원은 "검토 요청", 팀 관리자(service)·마스터는 "승인하고 보내기"(고객 포털 공개 + 알림·메일)와 반려·공개 해제.
// 공개 시점(client_published_at)이 기록된 견적만 고객이 볼 수 있다. 처리는 서버 함수 quoteApproval 이 한다.
const STEP = { DRAFT: '초안', REVIEW: '승인 대기', APPROVED: '승인됨 · 미발송', SENT: '발송됨 · 고객 공개 빠짐', ACCEPTED: '수주 완료', REJECTED: '고객 거절' };
const ymd = (iso) => (iso ? format(new Date(iso), 'yyyy.MM.dd') : '');

export default function QuotationPublishPanel({ card }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me() });
  const approver = APPROVER_TIERS.includes(user?.account_tier);

  const { data: quotations = [] } = useQuery({
    queryKey: ['card-quotations-publish', card.id],
    queryFn: () => base44.entities.Quotation.filter({ card_id: card.id }, '-created_date', 30),
  });

  const unpublish = useMutation({
    mutationFn: async (id) => (await base44.functions.invoke('quoteApproval', { action: 'unpublish', quotation_id: id })).data,
    onSuccess: () => {
      for (const key of [['card-quotations-publish', card.id], ['quotations-by-card', card.id], ['admin-inbox', 'quotes']]) qc.invalidateQueries({ queryKey: key });
      toast({ title: '고객 공개를 해제했습니다' });
    },
    onError: (e) => toast({ title: '해제하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });

  if (quotations.length === 0) return null;

  return (
    <section className="mb-4 space-y-2 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">견적 승인 · 고객 발송</h3>
      </div>
      <p className="text-label text-muted-foreground">
        {approver ? '"승인하고 보내기"를 누르면 확인 항목을 본 뒤 고객 포털에 공개하고 고객에게 알림·메일을 보냅니다.' : '견적을 다 만들면 "검토 요청"을 누르세요. 팀 관리자가 확인한 뒤 고객에게 보냅니다.'}
      </p>
      {!card.client_id && <p className="text-label text-warning-text">고객사가 연결되지 않았습니다. 문의 접수에서 고객사 팀을 먼저 발급하세요.</p>}
      {card.client_id && !card.client_visible && <p className="text-label text-warning-text">카드가 고객에게 공개되지 않았습니다. 개요 탭에서 카드를 먼저 공개해야 견적을 보낼 수 있습니다.</p>}
      {quotations.map((q) => {
        const published = !!q.client_published_at;
        return (
          <div key={q.id} className="space-y-1 rounded-lg bg-muted/30 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{q.quote_title || q.product_name || '견적서'}</p>
                <p className="text-micro text-muted-foreground">
                  {published
                    ? `고객에게 보냄 ${ymd(q.client_published_at)}${q.approved_by_name ? ` · 승인 ${q.approved_by_name}` : ''}${q.client_accepted_at ? ' · 고객 진행 요청' : ''}`
                    : `${STEP[q.status] || q.status}${q.status === 'REVIEW' && q.review_requested_by_name ? ` · 요청 ${q.review_requested_by_name} ${ymd(q.review_requested_at)}` : ''}`}
                </p>
              </div>
              {published
                ? approver && !q.client_accepted_at && <Button size="sm" variant="ghost" className="h-7 px-2 text-label" disabled={unpublish.isPending} onClick={() => unpublish.mutate(q.id)}>공개 해제</Button>
                : <QuoteApprovalActions quote={q} cardId={card.id} approver={approver} compact />}
            </div>
            {q.status === 'REVIEW' && q.review_note && !published && <p className="text-label text-muted-foreground">요청 메모: {q.review_note}</p>}
            {q.status === 'DRAFT' && q.review_rejected_reason && <p className="text-label text-warning-text">반려: {q.review_rejected_reason}</p>}
          </div>
        );
      })}
    </section>
  );
}
