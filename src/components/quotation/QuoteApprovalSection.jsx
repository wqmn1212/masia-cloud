import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, FileCheck2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QuoteApprovalActions, QuoteChecks, QuoteNumbers } from '@/components/quotation/QuoteApproval';

// 관리자 할 일 맨 위: 직원이 검토를 요청한 견적(오래된 순)과, 발송됨·승인됨인데 고객 포털 공개가 빠진 견적.
// 목록은 서버 함수 quoteApproval(queue)이 만든다. 여기서 바로 승인하고 보내거나 반려한다.
const ago = (iso) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? '오늘' : `${d}일 전`;
};

function QuoteRow({ row, kind }) {
  const quote = { id: row.id, status: row.status, quote_title: row.quote_title };
  const stale = kind === 'review' && row.requested_at && Date.now() - Date.parse(row.requested_at) > 86400000;
  return (
    <li className="space-y-1.5 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-body font-medium">
            {row.card_title || '(카드 없음)'} · {row.quote_title}
            {kind === 'review'
              ? <Badge variant="outline" className={`whitespace-nowrap text-micro ${stale ? 'border-warning/40 text-warning-text' : ''}`}>승인 요청 {ago(row.requested_at)}</Badge>
              : <Badge variant="outline" className="whitespace-nowrap border-warning/40 text-micro text-warning-text">{row.status === 'SENT' ? '발송됨 · 고객 공개 빠짐' : '승인됨 · 미발송'}</Badge>}
          </div>
          <p className="mt-0.5 text-label text-muted-foreground">
            {[row.client_name, row.factory_name && `공장 ${row.factory_name}`, row.requested_by_name && `요청 ${row.requested_by_name}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {row.card_id && <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-label"><Link to={`/task-board?card=${row.card_id}&tab=quotation`}>카드<ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>}
          <QuoteApprovalActions quote={quote} cardId={row.card_id} approver />
        </div>
      </div>
      <QuoteNumbers summary={row.summary} />
      {row.review_note && <p className="text-label">요청 메모: {row.review_note}</p>}
      <QuoteChecks checks={row.checks} />
    </li>
  );
}

export default function QuoteApprovalSection({ data, loading, error }) {
  const review = data?.review || [];
  const unsent = data?.unsent || [];
  const count = review.length + unsent.length;
  return (
    <Card id="inbox-quotes" className="scroll-mt-20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileCheck2 className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h2 className="text-body font-semibold">견적 승인 · 고객 발송</h2>{!loading && !error && <Badge variant={count ? 'default' : 'secondary'} className="text-micro">{count}</Badge>}</div>
          <p className="mt-0.5 text-label text-muted-foreground">직원이 승인을 요청한 견적과, 상태는 발송됨·승인됨인데 고객 포털에 공개되지 않은 견적입니다. 숫자와 확인 항목을 보고 바로 승인하고 보내거나 반려하세요.</p>
        </div>
      </div>
      <div className="mt-3">
        {loading ? <p className="flex items-center gap-2 py-3 text-label text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />불러오는 중…</p>
          : error ? <p className="py-3 text-label text-destructive">{error}</p>
            : !count ? <p className="flex items-center gap-1.5 py-3 text-label text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />승인을 기다리는 견적이 없습니다.</p>
              : (
                <ul className="divide-y">
                  {review.map((r) => <QuoteRow key={r.id} row={r} kind="review" />)}
                  {unsent.map((r) => <QuoteRow key={r.id} row={r} kind="unsent" />)}
                </ul>
              )}
      </div>
    </Card>
  );
}
