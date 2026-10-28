import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePayeeAccounts } from '@/components/payments/PayeeAccountsPanel';

// 직원 → 고객 결제 요청: 금액·기한·받는 곳을 정해 보낸다. 받는 곳은 마스터가 등록한 이지스 계좌나 이지스가 확인한 공장 계좌만.
// 고객에게 메일·앱 알림이 가고, 계좌 번호는 메일에 넣지 않고 포털 결제 탭에서만 보여 준다.
const LABELS = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };
const kstDate = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);

export default function PaymentRequestDialog({ card, stage, onClose, onSaved }) {
  const open = !!stage;
  const { data: accounts = [] } = usePayeeAccounts(card.tenant_id, open);
  const usable = accounts.filter((a) => a.active !== false);
  // 금액 제안: 이 카드의 수주 견적(없으면 고객에게 공개한 최신 견적) 총액 × 단계 비율
  const { data: quote } = useQuery({
    queryKey: ['payment-request-quote', card.id],
    enabled: open,
    queryFn: async () => {
      const rows = await base44.entities.Quotation.filter({ card_id: card.id }, '-created_date', 20);
      return rows.find((q) => q.status === 'ACCEPTED' && q.final_total) || rows.find((q) => q.client_published_at && q.final_total) || null;
    },
  });
  const [f, setF] = useState(null);
  useEffect(() => {
    if (!stage) { setF(null); return; }
    const suggested = quote?.final_total ? Math.round(Number(quote.final_total) * (Number(stage.percentage) || 0)) / 100 : '';
    const currency = stage.requested_at ? stage.currency : stage.currency || quote?.final_currency || 'USD';
    setF({
      amount: stage.requested_at ? stage.amount : stage.amount || suggested,
      currency,
      due_date: stage.requested_at ? stage.due_date : kstDate(Date.now() + 7 * 86400000),
      payee: stage.requested_at ? stage.payee : card.client_pays_factory ? 'FACTORY' : 'AEGIS',
      payee_account_id: stage.payee_account_id || '',
      note: stage.request_note || '',
    });
  }, [stage?.id, stage?.updated_date, quote?.id]);
  // 통화에 맞는 계좌를 자동으로 고른다
  useEffect(() => {
    if (!f || f.payee !== 'AEGIS') return;
    const current = usable.find((a) => a.id === f.payee_account_id && a.currency === f.currency);
    if (!current) setF((x) => ({ ...x, payee_account_id: usable.find((a) => a.currency === x.currency)?.id || '' }));
  }, [f?.currency, f?.payee, usable.length]);

  const send = useMutation({
    mutationFn: async (action) => (await base44.functions.invoke('manageCardCollaboration', { action, card_id: card.id, stage_id: stage.id, expected_updated_date: stage.updated_date, ...(action === 'payment_request' ? f : {}) })).data,
    onSuccess: (data, action) => { onSaved(action, data); onClose(); },
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const matching = usable.filter((a) => a.currency === f?.currency);
  const label = LABELS[stage?.stage_type] || '대금';
  const pending = send.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{label} 결제 요청{stage?.requested_at ? ' 고치기' : ''}</DialogTitle></DialogHeader>
        {f && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); send.mutate('payment_request'); }}>
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
              <label className="block text-label">청구 금액
                <Input className="mt-1 text-label tabular-nums" type="number" min="0" step="0.01" required value={f.amount} onChange={set('amount')} disabled={pending} />
              </label>
              <label className="block text-label">통화
                <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-label" value={f.currency} onChange={set('currency')} disabled={pending}>
                  {['USD', 'CNY', 'KRW'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            {quote?.final_total && <p className="text-caption text-muted-foreground">견적 총액 {quote.final_currency} {Number(quote.final_total).toLocaleString('ko-KR')}의 {stage.percentage}% = {quote.final_currency} {(Math.round(Number(quote.final_total) * Number(stage.percentage)) / 100).toLocaleString('ko-KR')}</p>}
            <label className="block text-label">결제 기한
              <Input className="mt-1 text-label" type="date" required min={kstDate(Date.now())} value={f.due_date} onChange={set('due_date')} disabled={pending} />
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-label">받는 곳</legend>
              <label className="flex items-center gap-2 text-label"><input type="radio" name="payee" value="AEGIS" checked={f.payee === 'AEGIS'} onChange={set('payee')} disabled={pending} />이지스 계좌</label>
              {card.client_pays_factory && <label className="flex items-center gap-2 text-label"><input type="radio" name="payee" value="FACTORY" checked={f.payee === 'FACTORY'} onChange={set('payee')} disabled={pending} />이지스가 확인한 공장 계좌 (고객이 공장에 직접 송금)</label>}
            </fieldset>
            {f.payee === 'AEGIS' && (matching.length ? (
              <label className="block text-label">받는 계좌
                <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-label" required value={f.payee_account_id} onChange={set('payee_account_id')} disabled={pending}>
                  {matching.map((a) => <option key={a.id} value={a.id}>{a.label || a.bank_name} · {a.bank_name} {a.account_no}</option>)}
                </select>
              </label>
            ) : (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-label text-warning-text">
                {f.currency} 받는 계좌가 없습니다. 마스터 계정이 <Link to="/admin-inbox#payee-accounts" className="font-medium underline">관리자 할 일 → 이지스 받는 계좌</Link>에서 등록해야 보낼 수 있습니다.
              </p>
            ))}
            <label className="block text-label">고객에게 보일 메모 (선택)
              <Input className="mt-1 text-label" maxLength={500} value={f.note} onChange={set('note')} placeholder="예: 송금 메모에 프로젝트명을 적어 주세요" disabled={pending} />
            </label>
            <p className="flex gap-1.5 text-caption text-muted-foreground"><Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />고객에게 메일과 앱 알림이 갑니다. 메일에는 계좌 번호를 넣지 않고 포털 결제 탭에서만 보여 줍니다.{!card.client_visible && ' 지금은 고객에게 공개되지 않은 카드라 알림이 가지 않습니다.'}</p>
            {send.error && <p role="alert" className="text-label text-destructive">{send.error?.response?.data?.error || '보내지 못했습니다.'}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {stage.requested_at && <Button type="button" variant="ghost" className="mr-auto text-destructive" disabled={pending} onClick={() => send.mutate('payment_request_cancel')}>요청 취소</Button>}
              <Button type="button" variant="outline" disabled={pending} onClick={onClose}>닫기</Button>
              <Button type="submit" disabled={pending || (f.payee === 'AEGIS' && !f.payee_account_id)}>{pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{stage.requested_at ? '고쳐서 다시 보내기' : '결제 요청 보내기'}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
