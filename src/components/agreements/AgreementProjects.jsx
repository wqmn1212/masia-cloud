import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

const STATUS = { TODO: '대기 중', IN_PROGRESS: '소싱 중', REVIEW: '견적 검토', PRODUCTION: '발주 · 제작', DONE: '완료', CANCELLED: '취소' };

// 이 계약에 묶을 프로젝트(카드) 고르기. 다른 계약에 묶인 카드는 옮길 때 한 번 더 묻는다.
export default function AgreementProjects({ agreement }) {
  const qc = useQueryClient();
  const key = ['agreement-cards', agreement.company_id];
  const { data: cards = [], isLoading } = useQuery({ queryKey: key, queryFn: () => base44.entities.TaskCard.filter({ client_id: agreement.company_id }, '-created_date', 200) });
  const link = useMutation({
    mutationFn: ({ card, on }) => base44.entities.TaskCard.update(card.id, { agreement_id: on ? agreement.id : '' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['agreement-card-counts'] }); },
    onError: (e) => toast({ title: '변경하지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  const toggle = (card, on) => {
    if (on && card.agreement_id && card.agreement_id !== agreement.id && !window.confirm('이 카드는 다른 계약에 묶여 있습니다. 이 계약으로 옮길까요?')) return;
    link.mutate({ card, on });
  };
  const active = cards.filter((c) => c.agreement_id === agreement.id && !['DONE', 'CANCELLED'].includes(c.status)).length;

  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>;
  if (!cards.length) return <p className="py-6 text-center text-sm text-muted-foreground">이 고객사의 프로젝트 카드가 없습니다.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">이 계약으로 진행 중인 프로젝트 {active}건. 월간 리포트는 여기 묶인 카드 기준으로 집계합니다 (없으면 계약 없는 공개 카드 전체).</p>
      <ul className="divide-y rounded-lg border">
        {cards.map((c) => {
          const mine = c.agreement_id === agreement.id;
          const other = c.agreement_id && !mine;
          return (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Checkbox checked={mine} disabled={link.isPending} onCheckedChange={(v) => toggle(c, !!v)} aria-label={`${c.title} 계약에 포함`} />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              {other && <Badge variant="outline" className="text-[10px]">다른 계약</Badge>}
              {!c.client_visible && <Badge variant="outline" className="text-[10px]">고객 비공개</Badge>}
              <span className="shrink-0 text-xs text-muted-foreground">{STATUS[c.status] || c.status}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
