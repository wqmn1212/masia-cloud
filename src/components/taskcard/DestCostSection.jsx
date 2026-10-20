import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, MessageCircleQuestion, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  const toEtd = daysUntil(shipment.etd);
  const beforeDeparture = ['PREPARING', 'BOOKED'].includes(shipment.status);
  const warn = beforeDeparture && toEtd != null && toEtd <= WARN_DAYS && state !== 'ACKNOWLEDGED';
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
  }, '실제 청구 금액을 저장했습니다');
  const actualDirty = String(actual.amount) !== String(shipment.dest_cost_actual ?? '') || String(actual.vat) !== String(shipment.dest_cost_actual_vat ?? '') || actual.note !== (shipment.dest_cost_actual_note || '');

  return (
    <div className="space-y-2.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold">한국 도착 후 따로 낼 돈 · 고객 사전 확인</p>
        <Badge className={`border-0 ${STATE_STYLE[state]}`}>{DEST_COST_STATE[state]}</Badge>
        <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={() => setCalcOpen(true)}><Calculator className="h-3 w-3" />{est ? '다시 계산' : '계산하기'}</Button>
      </div>

      {warn && (
        <p className="flex gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />출항 {toEtd >= 0 ? `${toEtd}일 전` : `예정일이 ${-toEtd}일 지났`}인데 고객이 도착지 비용을 확인하지 않았습니다.{state === 'NONE' || state === 'DRAFT' ? ' 계산해서 고객에게 보내 주세요.' : ''}
        </p>
      )}

      {!est ? (
        <p className="text-xs text-muted-foreground">공장과의 거래 조건(CIF·FOB·EXW 등)과 화물을 넣어 고객이 한국에서 따로 낼 돈을 계산하고, 출항 전에 고객 확인을 받으세요.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-lg font-bold tabular-nums text-primary">{fmtWon(est.buyer_ex_vat)}</p>
            <p className="text-xs text-muted-foreground">범위 {fmtWon(est.range_low)} ~ {fmtWon(est.range_high)} · 부가세 제외{est.buyer_vat > 0 ? ` · 수입 부가세 ${fmtWon(est.buyer_vat)} 별도` : ''}</p>
          </div>
          {!!est.segments?.length && <p className="text-xs">{est.segments.map((g) => `${g.short || g.label} ${fmtWon(g.amount)}`).join(' · ')}</p>}
          <p className="text-[11px] text-muted-foreground">{est.term_label} · {est.mode_label} · {est.basis_text} · 환율 {Number(est.usd_krw).toLocaleString('ko-KR')}원 · 계산 {fmtAt(est.computed_at)}{est.computed_by_name ? ` ${est.computed_by_name}` : ''}</p>
          {state === 'SENT' && <p className="text-[11px] text-muted-foreground">{fmtAt(shipment.dest_cost_sent_at)} {shipment.dest_cost_sent_by_name} 님이 보냄 · 고객 확인을 기다리는 중</p>}
          {state === 'ACKNOWLEDGED' && <p className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" />{shipment.dest_cost_decided_by_name} 님이 {fmtAt(shipment.dest_cost_decided_at)}에 확인했습니다</p>}
          {state === 'QUESTION' && (
            <div className="rounded-md bg-destructive/5 p-2 text-xs">
              <p className="flex items-center gap-1 font-semibold text-destructive"><MessageCircleQuestion className="h-3.5 w-3.5" />{shipment.dest_cost_decided_by_name} 님 문의 · {fmtAt(shipment.dest_cost_decided_at)}</p>
              <p className="mt-1 whitespace-pre-wrap">{shipment.dest_cost_client_note}</p>
              <p className="mt-1 text-muted-foreground">답변은 문의 탭에 남기고, 금액을 고쳤다면 다시 계산해서 보내 주세요.</p>
            </div>
          )}
          {state !== 'ACKNOWLEDGED' && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="h-7 gap-1 text-xs" disabled={busy || !shipment.client_visible || !card.client_visible} onClick={send}>
                <Send className="h-3 w-3" />{state === 'DRAFT' ? '고객에게 확인 요청' : '다시 보내기'}
              </Button>
              {(!shipment.client_visible || !card.client_visible) && <span className="text-[11px] text-muted-foreground">{!card.client_visible ? '고객에게 공개된 카드에서만 보낼 수 있습니다.' : '\'고객 포털에 보이기\'를 켜고 저장한 뒤 보낼 수 있습니다.'}</span>}
            </div>
          )}

          <div className="grid gap-2 border-t pt-2.5 sm:grid-cols-[1fr_1fr_2fr]">
            <label className="space-y-1 text-[11px]"><span>실제 청구 (부가세 제외, 원)</span><Input type="number" min="0" className="h-8 text-xs" value={actual.amount} onChange={(e) => setActual((a) => ({ ...a, amount: e.target.value }))} /></label>
            <label className="space-y-1 text-[11px]"><span>실제 수입 부가세 (원)</span><Input type="number" min="0" className="h-8 text-xs" value={actual.vat} onChange={(e) => setActual((a) => ({ ...a, vat: e.target.value }))} /></label>
            <label className="space-y-1 text-[11px]"><span>예상과 다른 이유 (고객에게 보임)</span><Textarea rows={1} className="min-h-8 text-xs" value={actual.note} placeholder="예: 실측 부피 10.2CBM, 세관 검사 지정" onChange={(e) => setActual((a) => ({ ...a, note: e.target.value }))} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {diff && (
              <span className={`text-xs ${diff.inRange ? 'text-muted-foreground' : 'font-semibold text-destructive'}`}>
                예상 대비 {diff.diff >= 0 ? '+' : ''}{fmtWon(diff.diff)}{diff.pct != null ? ` (${pct(diff.pct)})` : ''}{diff.inRange ? ' · 안내한 범위 안' : ' · 안내한 범위 밖 — 이유를 적어 주세요'}
              </span>
            )}
            {invoices.length ? <DocChips docs={invoices} max={2} /> : <span className="text-[11px] text-muted-foreground">청구서는 무역서류에 &lsquo;물류비 청구서&rsquo;로 올려 주세요</span>}
            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" disabled={busy || !actualDirty} onClick={saveActual}>실제 금액 저장</Button>
          </div>
        </>
      )}
      <CalcDialog shipment={shipment} open={calcOpen} onClose={() => setCalcOpen(false)} onSave={saveEstimate} />
    </div>
  );
}
