import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, Loader2, UserRoundPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

// 관리자 할 일: 책임자 없는 진행 카드. 배정 규칙상 추천 책임자가 있으면 '규칙대로 배정', 없으면 카드에서 직접 지정.
// 목록·배정은 서버 함수 inquiryIntake(unassigned · apply). 견적 기한이 지난 카드가 위에 온다.
const STATUS = { TODO: '대기', IN_PROGRESS: '소싱 중', REVIEW: '견적 검토', PRODUCTION: '발주·제작' };

function Row({ c }) {
  const qc = useQueryClient();
  const assign = useMutation({
    mutationFn: async () => (await base44.functions.invoke('inquiryIntake', { action: 'apply', card_id: c.id })).data,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['admin-inbox', 'unassigned'] });
      qc.invalidateQueries({ queryKey: ['task-cards'] });
      toast({ title: d?.assigned ? `${d.owner_name} 님을 책임자로 배정했습니다` : '배정할 사람이 없습니다', description: d?.assigned ? `${d.rule}${d.quote_deadline ? ` · 견적 기한 ${d.quote_deadline}` : ''}` : '카드에서 직접 지정하세요', variant: d?.assigned ? undefined : 'destructive' });
    },
    onError: (e) => toast({ title: '배정하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  return (
    <li className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-body font-medium">
          {c.title}
          <Badge variant="outline" className="whitespace-nowrap text-micro">{STATUS[c.status] || c.status}</Badge>
          {c.quote_deadline && <Badge variant="outline" className={`whitespace-nowrap text-micro ${c.quote_overdue ? 'border-warning/40 text-warning-text' : ''}`}>견적 기한 {c.quote_deadline}{c.quote_overdue ? ' 지남' : ''}</Badge>}
          {['HIGH', 'URGENT'].includes(c.priority) && <Badge className="whitespace-nowrap border-0 bg-destructive/10 text-micro text-destructive">급함</Badge>}
        </div>
        <p className="mt-0.5 text-label text-muted-foreground">
          {[c.client_name, `접수 ${String(c.created_date || '').slice(0, 10)}`, c.suggest ? `추천: ${c.suggest.owner_name} (${c.suggest.label})` : '규칙에 맞는 담당자 없음'].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-label"><Link to={`/task-board?card=${c.id}`}>카드에서 지정<ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>
        {c.suggest && <Button size="sm" className="h-8 gap-1 text-label" disabled={assign.isPending} onClick={() => assign.mutate()}>{assign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRoundPlus className="h-3.5 w-3.5" />}규칙대로 배정</Button>}
      </div>
    </li>
  );
}

export default function UnassignedCardsSection({ data, loading, error }) {
  const cards = data?.cards || [];
  return (
    <Card id="inbox-unassigned" className="scroll-mt-20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserRoundPlus className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h2 className="text-body font-semibold">책임자 없는 진행 카드</h2>{!loading && !error && <Badge variant={cards.length ? 'default' : 'secondary'} className="text-micro">{cards.length}</Badge>}</div>
          <p className="mt-0.5 text-label text-muted-foreground">책임자가 없으면 알림·아침 요약이 아무에게도 가지 않습니다. 문의 접수의 배정 규칙으로 추천한 사람이 있으면 바로 배정하세요.</p>
        </div>
      </div>
      <div className="mt-3">
        {loading ? <p className="flex items-center gap-2 py-3 text-label text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />불러오는 중…</p>
          : error ? <p className="py-3 text-label text-destructive">{error}</p>
            : !cards.length ? <p className="flex items-center gap-1.5 py-3 text-label text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />모든 진행 카드에 책임자가 있습니다.</p>
              : <ul className="divide-y">{cards.map((c) => <Row key={c.id} c={c} />)}</ul>}
      </div>
    </Card>
  );
}
