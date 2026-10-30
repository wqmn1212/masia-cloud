import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CheckCircle2, Info, Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatMoney } from '@/components/quotation/quoteCurrency';

// 견적 승인·발송 공용 부품: 요약 숫자, 확인 항목, 검토 요청·승인하고 보내기 창, 반려 창.
// 계산과 확인 항목은 서버(quoteApproval → base44/shared/quoteReview.ts)가 하고 여기서는 보여 주기만 한다.
export const APPROVER_TIERS = ['master', 'service'];
const LEVEL = {
  block: { icon: Ban, cls: 'text-destructive' },
  warn: { icon: AlertTriangle, cls: 'text-warning-text' },
  info: { icon: Info, cls: 'text-muted-foreground' },
};
const usd = (v) => (v == null ? '-' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

export function QuoteNumbers({ summary: s }) {
  if (!s) return null;
  const low = s.margin_pct != null && s.margin_pct < 10;
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-label tabular-nums text-muted-foreground">
      <span>고객 금액 <b className="text-foreground">{s.total ? formatMoney(s.total, s.currency) : '-'}</b></span>
      <span>원가 {usd(s.cost_usd)}</span>
      <span>마진 <b className={low ? 'text-warning-text' : 'text-foreground'}>{s.margin_pct == null ? '-' : `${s.margin_pct}%`}</b></span>
      <span>납기 {s.lead_time_business_days ? `${s.lead_time_business_days}영업일` : s.shipping_days ? `${s.shipping_days}일` : '-'}</span>
      <span>유효 {s.validity_days ? `${s.validity_days}일` : '-'}</span>
    </p>
  );
}

export function QuoteChecks({ checks = [], hideInfo = false }) {
  const rows = hideInfo ? checks.filter((c) => c.level !== 'info') : checks;
  if (!rows.length) return null;
  return (
    <ul className="space-y-0.5">
      {rows.map((c) => { const L = LEVEL[c.level] || LEVEL.info; return <li key={c.code} className={`flex items-start gap-1.5 text-label ${L.cls}`}><L.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />{c.text}</li>; })}
    </ul>
  );
}

// 승인 관련 작업 후 다시 불러올 목록
function useRefresh(cardId) {
  const qc = useQueryClient();
  return () => {
    for (const key of [['admin-inbox', 'quotes'], ['quotations-by-card', cardId], ['card-quotations-publish', cardId], ['quotations'], ['quote-preview']]) qc.invalidateQueries({ queryKey: key });
  };
}

// mode: 'send' 승인하고 고객에게 보내기 (팀 관리자) · 'review' 검토 요청 (직원)
export function QuoteSendDialog({ quote, cardId, mode, onClose }) {
  const { toast } = useToast();
  const refresh = useRefresh(cardId);
  const [note, setNote] = useState('');
  const preview = useQuery({
    queryKey: ['quote-preview', quote.id],
    queryFn: async () => (await base44.functions.invoke('quoteApproval', { action: 'preview', quotation_id: quote.id })).data,
  });
  const run = useMutation({
    mutationFn: async () => (await base44.functions.invoke('quoteApproval', mode === 'send' ? { action: 'approve_send', quotation_id: quote.id } : { action: 'request_review', quotation_id: quote.id, note })).data,
    onSuccess: (d) => {
      refresh();
      toast({ title: mode === 'send' ? '승인하고 고객에게 보냈습니다' : '견적 승인을 요청했습니다', description: mode === 'send' ? `고객 ${d?.notified ?? 0}명에게 알림·메일을 보냈습니다` : `팀 관리자 ${d?.notified ?? 0}명에게 알렸습니다` });
      onClose();
    },
    onError: (e) => toast({ title: mode === 'send' ? '보내지 못했습니다' : '요청하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  const p = preview.data;
  const blocked = p && !p.can_send;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{mode === 'send' ? '승인하고 고객에게 보내기' : '견적 승인 요청'}</DialogTitle>
          <DialogDescription className="text-label">
            {quote.quote_title || quote.product_name || quote.factory_name || '견적서'} · {mode === 'send' ? '고객 포털에 공개하고 고객에게 알림·메일을 보냅니다' : '팀 관리자가 확인한 뒤 고객에게 보냅니다'}
          </DialogDescription>
        </DialogHeader>
        {preview.isLoading ? <p className="flex items-center gap-2 py-4 text-label text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />확인 중…</p>
          : preview.isError ? <p className="py-4 text-label text-destructive">{preview.error?.response?.data?.error || '확인하지 못했습니다'}</p>
            : (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/40 p-3"><QuoteNumbers summary={p.summary} /></div>
                {p.checks.length ? <QuoteChecks checks={p.checks} /> : <p className="flex items-center gap-1.5 text-label text-primary"><CheckCircle2 className="h-4 w-4" />확인할 것이 없습니다</p>}
                {mode === 'review' && <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="text-label" placeholder="팀 관리자에게 남길 메모 (선택) 예: 마진 20%, 납기 공장 재확인함" />}
                {mode === 'send' && blocked && <p className="text-label text-destructive">빨간 항목을 해결해야 보낼 수 있습니다.</p>}
              </div>
            )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button className="gap-1.5" disabled={!p || run.isPending || (mode === 'send' && blocked)} onClick={() => run.mutate()}>
            {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{mode === 'send' ? '승인하고 보내기' : '검토 요청'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuoteRejectDialog({ quote, cardId, onClose }) {
  const { toast } = useToast();
  const refresh = useRefresh(cardId);
  const [reason, setReason] = useState('');
  const run = useMutation({
    mutationFn: async () => (await base44.functions.invoke('quoteApproval', { action: 'reject', quotation_id: quote.id, reason })).data,
    onSuccess: () => { refresh(); toast({ title: '견적을 돌려보냈습니다' }); onClose(); },
    onError: (e) => toast({ title: '반려하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">견적 반려</DialogTitle>
          <DialogDescription className="text-label">초안으로 돌아가고, 요청한 직원에게 사유가 전달됩니다.</DialogDescription>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="text-label" placeholder="예: 마진 15% 이상으로, 납기 공장에 다시 확인" autoFocus />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="destructive" disabled={!reason.trim() || run.isPending} onClick={() => run.mutate()}>반려</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 견적 한 건의 승인 버튼 묶음 (상태와 역할에 따라)
export function QuoteApprovalActions({ quote, cardId, approver, compact = false }) {
  const [open, setOpen] = useState(null);
  const published = !!quote.client_published_at;
  const size = compact ? 'h-7 px-2 text-label' : 'h-8 text-label';
  if (published || ['ACCEPTED', 'REJECTED'].includes(quote.status)) return null;
  const canRequest = ['DRAFT', 'APPROVED'].includes(quote.status);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {quote.status === 'REVIEW' && !approver && <span className="text-label text-muted-foreground">팀 관리자 확인 대기</span>}
      {canRequest && !approver && <Button size="sm" variant="outline" className={size} onClick={() => setOpen('review')}>검토 요청</Button>}
      {approver && quote.status === 'REVIEW' && <Button size="sm" variant="outline" className={size} onClick={() => setOpen('reject')}>반려</Button>}
      {approver && <Button size="sm" className={`${size} gap-1`} onClick={() => setOpen('send')}><Send className="h-3.5 w-3.5" />{quote.status === 'SENT' ? '고객에게 보내기' : '승인하고 보내기'}</Button>}
      {open === 'send' && <QuoteSendDialog quote={quote} cardId={cardId} mode="send" onClose={() => setOpen(null)} />}
      {open === 'review' && <QuoteSendDialog quote={quote} cardId={cardId} mode="review" onClose={() => setOpen(null)} />}
      {open === 'reject' && <QuoteRejectDialog quote={quote} cardId={cardId} onClose={() => setOpen(null)} />}
    </div>
  );
}
