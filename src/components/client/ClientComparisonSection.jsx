import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getViewCompanyId, withClientView } from '@/lib/clientView';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { generateComparisonPDF } from '@/lib/generateComparisonPDF';
import ClientComparisonView from '@/components/taskcard/quotecompare/ClientComparisonView';

// 고객 견적 탭 맨 위: 담당자가 공개한 견적 비교표. 안을 고르거나(진행 요청) 안별로 질문을 남긴다.
export default function ClientComparisonSection({ cardId, cardTitle = '', clientName = '' }) {
  const qc = useQueryClient();
  const readOnly = !!getViewCompanyId(); // 마스터 관리자가 고객 포털을 열람할 때는 보기만
  const [dialog, setDialog] = useState(null); // { mode: 'choose' | 'ask', option }
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['client-comparison', cardId],
    queryFn: async () => (await base44.functions.invoke('getClientComparison', withClientView({ card_id: cardId }))).data?.comparison || null,
  });
  if (isLoading || !data?.snapshot?.options?.length) return null;
  const confirmed = data.status === 'CONFIRMED';
  const confirmedLabel = confirmed ? data.snapshot.options.find((o) => o.key === data.confirmed_option_key)?.label : '';

  const open = (mode, option) => { setText(''); setDialog({ mode, option }); };
  const submit = async () => {
    setBusy(true);
    try {
      if (dialog.mode === 'choose') {
        await base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'comparison_choice', option_key: dialog.option.key, version: data.version, note: text });
        toast({ title: `${dialog.option.label}으로 진행을 요청했습니다`, description: '담당자가 확정하면 계약서를 보내 드립니다.' });
      } else {
        if (!text.trim()) { setBusy(false); return; }
        await base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'chat', message: `[견적 비교표 ${dialog.option.label}] ${text.trim()}` });
        toast({ title: '질문을 보냈습니다', description: '문의 탭에서 답변을 확인하실 수 있습니다.' });
        qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      }
      qc.invalidateQueries({ queryKey: ['client-comparison', cardId] });
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      setDialog(null);
    } catch (e) {
      toast({ title: e?.response?.data?.error || e.message, variant: 'destructive' });
      qc.invalidateQueries({ queryKey: ['client-comparison', cardId] });
    } finally { setBusy(false); }
  };

  const pdf = async () => {
    try { await generateComparisonPDF(data.snapshot, { cardTitle, clientName, choice: data.client_choice }); }
    catch (e) { toast({ title: 'PDF를 만들지 못했습니다', description: e.message, variant: 'destructive' }); }
  };

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Columns3 className="h-4 w-4 text-primary" />견적 비교표</h3>
          <p className="text-xs text-muted-foreground">
            {confirmed ? `${confirmedLabel}으로 확정되었습니다` : data.client_choice ? '진행 요청을 보냈습니다. 확정 전까지는 다른 안으로 바꿀 수 있습니다' : '공장 견적을 같은 기준으로 맞춰 비교했습니다. 진행할 안을 골라 주세요'}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={pdf}><Download className="h-3.5 w-3.5" />품의용 PDF</Button>
      </div>
      <ClientComparisonView
        snapshot={data.snapshot}
        choice={confirmed ? { option_key: data.confirmed_option_key } : data.client_choice}
        onChoose={readOnly || confirmed ? null : (o) => open('choose', o)}
        onAsk={readOnly ? null : (o) => open('ask', o)}
        busy={busy}
      />
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{dialog?.mode === 'choose' ? `${dialog?.option.label}으로 진행` : `${dialog?.option.label}에 대해 질문`}</DialogTitle>
            <DialogDescription className="text-xs">{dialog?.mode === 'choose' ? '진행 요청을 보내면 담당자가 확인하고 확정합니다. 남길 말씀이 있으면 적어 주세요 (선택).' : '담당자에게 보낼 질문을 적어 주세요. 문의 탭에서 답변을 받습니다.'}</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={dialog?.mode === 'choose' ? '예: 납기를 우선해 이 안으로 진행합니다' : '예: 보증 기간을 2년으로 늘릴 수 있나요?'} className="text-sm" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>취소</Button>
            <Button size="sm" disabled={busy || (dialog?.mode === 'ask' && !text.trim())} onClick={submit} className="gap-1">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{dialog?.mode === 'choose' ? '진행 요청 보내기' : '질문 보내기'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
