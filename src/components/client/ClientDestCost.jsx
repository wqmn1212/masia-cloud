import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageCircleQuestion, Receipt } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { fmtWon } from '@/lib/landedCost';
import { destCostDiff } from '@/lib/destCost';

const fmtAt = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// 선적 건별 '한국 도착 후 따로 내실 비용' 예상액: 출항 전에 확인하고, 도착 후에는 실제 청구와 비교해 본다.
export default function ClientDestCost({ cardId, shipment, onChanged }) {
  const d = shipment.dest_cost;
  const { user } = useAuth();
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  // 확인·문의는 고객사 계정만 (마스터가 고객 화면으로 볼 때는 버튼 대신 안내)
  const isClient = user?.account_tier === 'client';
  const canDecide = isClient && d.state === 'SENT';
  const decide = useMutation({
    mutationFn: (decision) => base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'dest_cost_decision', shipment_id: shipment.id, sent_at: d.sent_at, decision, note }),
    onSuccess: (_r, decision) => {
      toast({ title: decision === 'ACKNOWLEDGED' ? '확인했습니다' : '담당자에게 문의를 보냈습니다' });
      setAsking(false);
      setNote('');
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      onChanged?.();
    },
    onError: (e) => {
      toast({ title: '처리하지 못했습니다', description: e.response?.data?.error || e.message, variant: 'destructive' });
      if (e.response?.status === 409) onChanged?.();
    },
  });
  const e = d.estimate;
  const diff = destCostDiff(e, d.actual);

  return (
    <div className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-1.5">
        <Receipt className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">한국 도착 후 따로 내실 비용 (예상)</p>
      </div>
      <div>
        <p className="text-2xl font-extrabold tabular-nums text-primary">{fmtWon(e.buyer_ex_vat)}</p>
        <p className="text-xs text-muted-foreground">범위 {fmtWon(e.range_low)} ~ {fmtWon(e.range_high)} · 부가세 제외{e.per_unit_buyer_extra ? ` · 개당 ${fmtWon(e.per_unit_buyer_extra)}` : ''}</p>
        {e.buyer_vat > 0 && <p className="text-xs text-muted-foreground">+ 수입 부가세 {fmtWon(e.buyer_vat)} (통관 때 납부, 사업자는 매입세액 공제로 돌려받음)</p>}
        {e.per_unit_landed > 0 && <p className="text-xs text-muted-foreground">물품가를 포함한 개당 도착 원가 약 {fmtWon(e.per_unit_landed)}</p>}
      </div>
      <p className="text-xs">
        <b>{e.term_label}</b> · {e.mode_label} · {e.basis_text}
        <span className="block text-muted-foreground">공장 견적에 포함: {e.included.length ? e.included.join(', ') : '없음 (운송비 전부 별도)'}</span>
      </p>
      {!!e.segments.length && (
        <div className="divide-y rounded-md border bg-background text-xs">
          {e.segments.map((g) => (
            <div key={g.key} className="px-2.5 py-2">
              <p className="flex items-center gap-2 font-semibold"><span className="min-w-0 flex-1">{g.key}. {g.label}</span><span className="shrink-0 tabular-nums">{fmtWon(g.amount)}</span></p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {e.lines.filter((l) => l.segment === g.key).map((l, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{l.label}</span><span className="shrink-0 tabular-nums">{fmtWon(l.amount)}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {!!e.variables.length && <p className="text-[11px] text-muted-foreground">상황에 따라 더 생길 수 있는 비용 (위 금액에 미포함): {e.variables.join(', ')}</p>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">환율 {Number(e.usd_krw || 0).toLocaleString('ko-KR')}원/$ 기준 예상치입니다. 실제 금액은 도착 후 실측 부피, 도착일 환율, 세관 검사, 보관 기간에 따라 달라질 수 있습니다.</p>

      {d.actual != null && (
        <div className="rounded-md border bg-background p-2.5 text-xs">
          <p className="font-semibold">실제 청구 {fmtWon(d.actual)} <span className="font-normal text-muted-foreground">(부가세 제외{d.actual_vat != null ? ` · 수입 부가세 ${fmtWon(d.actual_vat)} 별도` : ''})</span></p>
          {diff && <p className={diff.inRange ? 'text-muted-foreground' : 'text-destructive'}>예상 대비 {diff.diff >= 0 ? '+' : ''}{fmtWon(diff.diff)}{diff.inRange ? ' · 안내드린 범위 안입니다' : ' · 안내드린 범위를 벗어났습니다'}</p>}
          {d.actual_note && <p className="mt-1 whitespace-pre-wrap">{d.actual_note}</p>}
        </div>
      )}

      {d.state === 'ACKNOWLEDGED' && <p className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" />{d.decided_by_name} 님이 {fmtAt(d.decided_at)}에 확인하셨습니다</p>}
      {d.state === 'QUESTION' && (
        <div className="rounded-md bg-background p-2.5 text-xs">
          <p className="flex items-center gap-1 font-semibold"><MessageCircleQuestion className="h-3.5 w-3.5 text-primary" />{fmtAt(d.decided_at)} 문의를 보냈습니다. 담당자가 확인 후 다시 안내드립니다.</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{d.client_note}</p>
        </div>
      )}
      {d.state === 'SENT' && !isClient && <p className="text-[11px] text-muted-foreground">확인·문의는 고객사 계정에서만 선택할 수 있습니다.</p>}
      {canDecide && (asking ? (
        <div className="space-y-2">
          <Textarea rows={2} className="bg-background text-sm" value={note} placeholder="궁금하신 점을 적어 주세요. 예: 할증료가 CIF 운임에 포함된 것 아닌가요?" onChange={(ev) => setNote(ev.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>취소</Button>
            <Button size="sm" disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate('QUESTION')}>문의 보내기</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="w-full text-xs text-muted-foreground sm:mr-auto sm:w-auto">출항 전에 금액을 확인해 주세요.</p>
          <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => setAsking(true)}>문의하기</Button>
          <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate('ACKNOWLEDGED')}>확인했습니다</Button>
        </div>
      ))}
    </div>
  );
}
