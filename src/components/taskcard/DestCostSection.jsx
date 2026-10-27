import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, MessageCircleQuestion, Receipt, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import LandedCostForm, { EMPTY_LANDED_INPUT, toEngineInput } from '@/components/landedcost/LandedCostForm';
import LandedCostResult from '@/components/landedcost/LandedCostResult';
import useLogisticsRates from '@/components/landedcost/useLogisticsRates';
import { calcLandedCost, compareModes, fmtWon } from '@/lib/landedCost';
import { DEST_COST_STATE, ENGINE_MODE, destCostDiff, destCostSnapshot, destCostState } from '@/lib/destCost';
import { daysUntil } from '@/lib/shipments';
import useCardAttachments from '@/components/files/useCardAttachments';
import DocChips from '@/components/files/DocChips';

const WARN_DAYS = 14;
const STATE_STYLE = {
  NONE: 'bg-muted text-muted-foreground',
  DRAFT: 'bg-muted text-foreground',
  SENT: 'bg-chart-3/15 text-chart-3',
  ACKNOWLEDGED: 'bg-primary/10 text-primary',
  QUESTION: 'bg-destructive/10 text-destructive',
};
const CLEAR_DECISION = { dest_cost_decision: 'PENDING', dest_cost_decided_at: '', dest_cost_decided_by_name: '', dest_cost_client_note: '' };
const fmtAt = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

// 선적 요약 카드의 '확인할 일'에 넣을 문장 (출항 14일 안인데 고객 확인이 없을 때)
export function destCostWarning(shipment) {
  const toEtd = daysUntil(shipment.etd);
  const state = destCostState(shipment);
  if (!['PREPARING', 'BOOKED'].includes(shipment.status) || toEtd == null || toEtd > WARN_DAYS || state === 'ACKNOWLEDGED') return '';
  if (state === 'NONE' || state === 'DRAFT') return '도착 후 따로 낼 돈을 아직 고객에게 보내지 않았습니다';
  if (state === 'QUESTION') return '도착 후 비용에 고객 문의가 있습니다';
  return '도착 후 따로 낼 돈을 고객이 아직 확인하지 않았습니다';
}

// 계산 창을 열 때의 첫 값: 저장해 둔 입력, 없으면 선적 정보에서 운송 방식·배터리만 가져온다
const initialInput = (s) => (s.dest_cost_input
  ? { ...EMPTY_LANDED_INPUT, ...s.dest_cost_input }
  : { ...EMPTY_LANDED_INPUT, mode: ENGINE_MODE[s.mode] || EMPTY_LANDED_INPUT.mode, battery: s.dangerous_goods ? 'CONTAINED' : 'NONE' });

function CalcDialog({ shipment, open, onClose, onSave }) {
  const { rates, usdKrw, rateDate, fxStale } = useLogisticsRates();
  const [form, setForm] = useState(() => initialInput(shipment));
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initialInput(shipment)); }, [open]);
  const engineInput = useMemo(() => toEngineInput(form, usdKrw), [form, usdKrw]);
  const result = useMemo(() => calcLandedCost(engineInput, rates), [engineInput, rates]);
  const compare = useMemo(() => compareModes(engineInput, rates), [engineInput, rates]);
  const resend = !!shipment.dest_cost_sent_at;

  const save = async () => {
    setSaving(true);
    const ok = await onSave(form, result);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-5xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">{shipment.label || '선적'} · 한국 도착 후 따로 낼 돈 계산</DialogTitle></DialogHeader>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <LandedCostForm value={form} onChange={setForm} defaultUsdKrw={usdKrw} />
          <div className="min-w-0 space-y-3">
            <LandedCostResult result={result} compare={compare} showNotice={false} />
            {fxStale && <p className="rounded-md bg-chart-3/10 px-3 py-2 text-xs text-chart-3">환율이 {rateDate} 기준입니다. 받은 견적의 환율이 있으면 직접 넣어 주세요.</p>}
          </div>
        </div>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">{resend ? '이미 고객에게 보낸 금액입니다. 저장하면 고객 확인이 취소되고, 새 금액을 다시 보내야 합니다.' : '저장한 금액은 \'고객에게 확인 요청\'을 눌러야 고객에게 보입니다.'}</p>
          <Button disabled={saving || result.needsCargo} onClick={save}>{saving ? '저장 중…' : '이 금액으로 저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 선적 건별 '한국에서 따로 낼 돈': 출항 전에 예상액을 계산해 고객 확인을 받고, 도착 후 실제 청구와 비교한다.
export default function DestCostSection({ shipment, card, onSaved }) {
  const { user } = useAuth();
  const state = destCostState(shipment);
  const est = shipment.dest_cost_estimate;
  const [calcOpen, setCalcOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actual, setActual] = useState({ amount: '', vat: '', note: '' });
  useEffect(() => {
    setActual({ amount: shipment.dest_cost_actual ?? '', vat: shipment.dest_cost_actual_vat ?? '', note: shipment.dest_cost_actual_note || '' });
  }, [shipment.id, shipment.dest_cost_actual, shipment.dest_cost_actual_vat, shipment.dest_cost_actual_note]);
  // 입력하는 동안 바로 예상과 비교해 보여 준다
  const diff = destCostDiff(est, actual.amount === '' ? null : actual.amount);
  const { data: attachments = [] } = useCardAttachments(card.id);
  const invoices = attachments.filter((a) => a.document_type === 'LOGISTICS_INVOICE');
  // 실제 청구는 배가 떠난 뒤(또는 이미 넣었을 때)만 입력칸을 연다
  const [actualOpen, setActualOpen] = useState(false);
  const showActual = actualOpen || shipment.dest_cost_actual != null || !['PREPARING', 'BOOKED'].includes(shipment.status);
  const me = user?.full_name || user?.email || '';

  const update = async (data, done) => {
    setBusy(true);
    try {
      await base44.entities.Shipment.update(shipment.id, data);
      if (done) toast({ title: done });
      onSaved();
      return true;
    } catch (e) {
      toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveEstimate = (form, result) => update({
    dest_cost_input: form,
    dest_cost_estimate: destCostSnapshot(result, { computedBy: me }),
    // 금액이 바뀌면 예전 확인은 무효 — 다시 보내야 고객에게 보인다
    ...(shipment.dest_cost_sent_at ? { dest_cost_sent_at: '', dest_cost_sent_by_name: '', ...CLEAR_DECISION } : {}),
  }, '도착지 비용 예상액을 저장했습니다');

  const send = async () => {
    if (!(await update({ dest_cost_sent_at: new Date().toISOString(), dest_cost_sent_by_name: me, ...CLEAR_DECISION }))) return;
    const sent = await base44.functions.invoke('notifyCardEvent', {
      card_id: card.id, type: 'dest_cost_sent',
      message: `${shipment.label || '선적'}: 한국 도착 후 따로 내실 비용 약 ${fmtWon(est.buyer_ex_vat)} (부가세 제외)`,
    }).then((r) => r.data?.sent).catch(() => null);
    toast({ title: '고객에게 확인을 요청했습니다', description: sent ? `고객 ${sent}명에게 알림을 보냈습니다.` : '고객 포털에서 확인할 수 있습니다.' });
  };

  const saveActual = () => update({
    dest_cost_actual: actual.amount === '' ? null : Number(actual.amount),
    dest_cost_actual_vat: actual.vat === '' ? null : Number(actual.vat),
    dest_cost_actual_note: actual.note.trim(),
    dest_cost_actual_by_name: me, dest_cost_actual_at: new Date().toISOString(), dest_cost_actual_source: '직접 입력',
  }, '실제 청구 금액을 저장했습니다');
  const actualDirty = String(actual.amount) !== String(shipment.dest_cost_actual ?? '') || String(actual.vat) !== String(shipment.dest_cost_actual_vat ?? '') || actual.note !== (shipment.dest_cost_actual_note || '');

  const canSend = shipment.client_visible && card.client_visible;
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Receipt className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold">도착 후 따로 낼 돈</p>
        <Badge className={`border-0 text-[10px] ${STATE_STYLE[state]}`}>{DEST_COST_STATE[state]}</Badge>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCalcOpen(true)}><Calculator className="h-3 w-3" />{est ? '다시 계산' : '계산하기'}</Button>
          {est && state !== 'ACKNOWLEDGED' && (
            <Button size="sm" className="h-7 gap-1 text-xs" disabled={busy || !canSend} title={canSend ? '' : (!card.client_visible ? '고객에게 공개된 카드에서만 보낼 수 있습니다' : "'고객 포털에 보이기'를 켜고 저장한 뒤 보낼 수 있습니다")} onClick={send}>
              <Send className="h-3 w-3" />{state === 'DRAFT' ? '고객에게 확인 요청' : '다시 보내기'}
            </Button>
          )}
        </div>
      </div>

      {!est ? (
        <p className="text-xs text-muted-foreground">거래 조건(CIF·FOB·EXW 등)과 화물로 고객이 한국에서 따로 낼 돈을 계산해 출항 전에 확인받습니다.</p>
      ) : (
        <>
          <p className="text-xs"><b className="text-sm tabular-nums">{fmtWon(est.buyer_ex_vat)}</b> <span className="text-muted-foreground">부가세 제외 · 범위 {fmtWon(est.range_low)} ~ {fmtWon(est.range_high)}{est.buyer_vat > 0 ? ` · 수입 부가세 ${fmtWon(est.buyer_vat)} 별도` : ''}</span></p>
          {!!est.segments?.length && <p className="text-xs text-muted-foreground">{est.segments.map((g) => `${g.short || g.label} ${fmtWon(g.amount)}`).join(' · ')}</p>}
          <p className="text-[11px] text-muted-foreground">
            {est.term_label} · {est.mode_label} · 환율 {Number(est.usd_krw).toLocaleString('ko-KR')}원 · {fmtAt(est.computed_at)} 계산
            {state === 'SENT' && ` · ${fmtAt(shipment.dest_cost_sent_at)} 고객에게 보냄`}
            {!canSend && state === 'DRAFT' && ` · ${!card.client_visible ? '카드를 고객에게 공개해야 보낼 수 있습니다' : "'고객 포털에 보이기'를 켜야 보낼 수 있습니다"}`}
          </p>
          {state === 'ACKNOWLEDGED' && <p className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" />{shipment.dest_cost_decided_by_name} 님이 {fmtAt(shipment.dest_cost_decided_at)}에 확인</p>}
          {state === 'QUESTION' && (
            <div className="rounded-md bg-muted/50 p-2 text-xs">
              <p className="flex items-center gap-1 font-semibold"><MessageCircleQuestion className="h-3.5 w-3.5 text-destructive" />{shipment.dest_cost_decided_by_name} 님 문의 · {fmtAt(shipment.dest_cost_decided_at)}</p>
              <p className="mt-1 whitespace-pre-wrap">{shipment.dest_cost_client_note}</p>
              <p className="mt-1 text-muted-foreground">답변은 문의 탭에 남기고, 금액을 고쳤다면 다시 계산해서 보내 주세요.</p>
            </div>
          )}

          {!showActual ? (
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setActualOpen(true)}>실제 청구 금액 입력</button>
          ) : (
            <div className="space-y-2 rounded-md bg-muted/40 p-2.5">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr]">
                <label className="space-y-1 text-[11px]"><span>실제 청구 (부가세 제외, 원)</span><Input type="number" min="0" className="h-8 bg-background text-xs" value={actual.amount} onChange={(e) => setActual((a) => ({ ...a, amount: e.target.value }))} /></label>
                <label className="space-y-1 text-[11px]"><span>실제 수입 부가세 (원)</span><Input type="number" min="0" className="h-8 bg-background text-xs" value={actual.vat} onChange={(e) => setActual((a) => ({ ...a, vat: e.target.value }))} /></label>
                <label className="space-y-1 text-[11px]"><span>예상과 다른 이유 (고객에게 보임)</span><Input className="h-8 bg-background text-xs" value={actual.note} placeholder="예: 실측 부피 10.2CBM, 세관 검사 지정" onChange={(e) => setActual((a) => ({ ...a, note: e.target.value }))} /></label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {diff && (
                  <span className={`text-xs ${diff.inRange ? 'text-muted-foreground' : 'font-semibold text-destructive'}`}>
                    예상 대비 {diff.diff >= 0 ? '+' : ''}{fmtWon(diff.diff)}{diff.pct != null ? ` (${pct(diff.pct)})` : ''}{diff.inRange ? ' · 안내한 범위 안' : ' · 안내한 범위 밖, 이유를 적어 주세요'}
                  </span>
                )}
                {invoices.length ? <DocChips docs={invoices} max={2} /> : <span className="text-[11px] text-muted-foreground">청구서는 무역서류에 &lsquo;물류비 청구서&rsquo;로 올려 주세요</span>}
                <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" disabled={busy || !actualDirty} onClick={saveActual}>실제 금액 저장</Button>
              </div>
              {shipment.dest_cost_actual_by_name && <p className="text-[11px] text-muted-foreground">기록: {shipment.dest_cost_actual_by_name}{shipment.dest_cost_actual_at ? ` · ${new Date(shipment.dest_cost_actual_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}{shipment.dest_cost_actual_source && shipment.dest_cost_actual_source !== '직접 입력' ? ` · 근거 ${shipment.dest_cost_actual_source}` : ''}</p>}
            </div>
          )}
        </>
      )}
      <CalcDialog shipment={shipment} open={calcOpen} onClose={() => setCalcOpen(false)} onSave={saveEstimate} />
    </div>
  );
}
