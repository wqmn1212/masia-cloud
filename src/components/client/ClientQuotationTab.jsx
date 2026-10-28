import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Loader2, CircleCheck, ThumbsUp } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { withClientView, getViewCompanyId } from '@/lib/clientView';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { generateQuotationPDF } from '@/lib/generateQuotationPDF';
import ClientComparisonSection from './ClientComparisonSection';
import { useDecisionGate, decisionToast, financeOnlyText, viaApprovalText } from './approval/ClientDecisionContext';
import ApprovalPendingNote from './approval/ApprovalPendingNote';

// 견적서 한 줄: PDF 내려받기, '이 견적으로 진행'(수락) 또는 수락·결재 상태
function QuoteRow({ q, cardId, canAccept, busy, onDownload, onAccept }) {
  const gate = useDecisionGate('quote_accept', q.id);
  return (
    <div className="space-y-2 rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{q.quote_title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {q.published_at ? format(new Date(q.published_at), 'yyyy.MM.dd') : ''} · {q.final_currency}
            {q.model_name ? ` · ${q.model_name}` : ''}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDownload(q)} className="gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          PDF
        </Button>
        {canAccept && !gate.pending && gate.canDecide && (
          <Button size="sm" className="gap-1.5" onClick={() => onAccept(q, gate.viaApproval)}><ThumbsUp className="h-3.5 w-3.5" />이 견적으로 진행</Button>
        )}
      </div>
      {q.accepted_at && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-label">
          <CircleCheck className="h-4 w-4 text-primary" /><span className="font-semibold text-primary">진행 요청함</span>
          <span className="text-muted-foreground">{q.accepted_by_name} · {format(new Date(q.accepted_at), 'yyyy.MM.dd HH:mm')} · 담당자가 확인한 뒤 계약서를 보내 드립니다</span>
          {q.accept_note && <span className="w-full whitespace-pre-wrap text-caption text-muted-foreground">메모: {q.accept_note}</span>}
        </p>
      )}
      {gate.pending && <ApprovalPendingNote approval={gate.pending} cardId={cardId} />}
      {canAccept && !gate.pending && gate.financeOnly && <p className="text-caption text-muted-foreground">{financeOnlyText}</p>}
    </div>
  );
}

// 고객 전용 견적 탭 — 화면에 금액 내역을 그리지 않고 PDF 다운로드만 제공한다.
// 견적서마다 '이 견적으로 진행'(메모)을 눌러 수락할 수 있다. 견적 비교표가 있는 카드는 비교표에서 고른다.
// (원가·마진·수수료 분기를 어드민 탭에 흩어놓지 않기 위해 별도 컴포넌트로 분리)
export default function ClientQuotationTab({ cardId, cardTitle = '', clientName = '' }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isClient = user?.account_tier === 'client' && !getViewCompanyId();
  const [busyId, setBusyId] = useState(null);
  const [accepting, setAccepting] = useState(null); // { q, viaApproval }
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['client-quotations', cardId],
    queryFn: async () => (await base44.functions.invoke('listClientQuotations', withClientView({ card_id: cardId }))).data || {},
  });
  const quotations = data?.quotations || [];

  const download = async (q) => {
    setBusyId(q.id);
    try {
      await generateQuotationPDF(q.id);
    } finally {
      setBusyId(null);
    }
  };
  const accept = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'quote_accept', quotation_id: accepting.q.id, note });
      decisionToast(res.data, { title: '이 견적으로 진행을 요청했습니다', description: '담당자가 확인한 뒤 계약서를 보내 드립니다.' });
      setAccepting(null);
    } catch (e) {
      toast({ title: '보내지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setSending(false);
      qc.invalidateQueries({ queryKey: ['client-quotations', cardId] });
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['client-todos'] });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const comparison = <ClientComparisonSection cardId={cardId} cardTitle={cardTitle} clientName={clientName} />;
  if (quotations.length === 0) {
    return (
      <div className="space-y-4">
      {comparison}
      <div className="py-10 text-center">
        <FileText className="w-9 h-9 mx-auto text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">아직 발행된 견적서가 없습니다</p>
      </div>
      </div>
    );
  }

  const anyAccepted = quotations.some((q) => q.accepted_at);
  return (
    <div className="space-y-2">
      {comparison}
      {data?.has_comparison && <p className="text-caption text-muted-foreground">이 프로젝트는 위 견적 비교표에서 진행할 안을 골라 주세요. 견적서는 PDF로 내려받아 보실 수 있습니다.</p>}
      {quotations.map((q) => (
        <QuoteRow key={q.id} q={q} cardId={cardId} busy={busyId === q.id} onDownload={download}
          canAccept={isClient && !data?.has_comparison && !anyAccepted} onAccept={(row, viaApproval) => { setNote(''); setAccepting({ q: row, viaApproval }); }} />
      ))}
      <Dialog open={!!accepting} onOpenChange={(v) => !v && !sending && setAccepting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">이 견적으로 진행</DialogTitle>
            <DialogDescription className="text-label">
              {accepting?.q.quote_title} 견적으로 진행을 요청합니다. {accepting?.viaApproval ? viaApprovalText : '담당자가 확인한 뒤 계약서를 보내 드립니다.'} 보낸 뒤에는 바꿀 수 없으니, 바꾸시려면 담당자에게 문의해 주세요.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="남길 말씀 (선택) · 예: 11월 첫 주 발주 예정입니다" className="text-body" disabled={sending} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAccepting(null)} disabled={sending}>취소</Button>
            <Button size="sm" onClick={accept} disabled={sending} className="gap-1">{sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{accepting?.viaApproval ? '결재 요청 보내기' : '진행 요청 보내기'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
