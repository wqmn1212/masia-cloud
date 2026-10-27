import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import saveQuotationWithHistory from '@/lib/saveQuotationWithHistory';
import { isPlaceholderFactory } from '@/lib/quoteCompare';
import { money } from './format';
import { Checkbox } from '@/components/ui/checkbox';

// 선택안 확정: 견적 상태·카드 공장·결정 기록을 한 번에 바꾼다. 무엇이 바뀌는지 체크박스로 보여 주고 고를 수 있게 한다.
export default function ConfirmComparisonDialog({ open, onOpenChange, cmp, card, user }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { record, computed, byId, save } = cmp;
  const live = computed.options.filter((o) => !o.missing && o.priced);
  const [key, setKey] = useState(record.client_choice?.option_key || live[0]?.key);
  const [acceptIt, setAcceptIt] = useState(true);
  const [rejectOthers, setRejectOthers] = useState(true);
  const [setFactory, setSetFactory] = useState(true);
  const [reason, setReason] = useState(record.recommendation || '');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [makeContract, setMakeContract] = useState(true);
  const navigate = useNavigate();
  const chosen = computed.options.find((o) => o.key === key);
  const others = live.filter((o) => o.key !== key);
  const changed = chosen && record.source_hashes?.[key] && record.source_hashes[key] !== chosen.hash;
  const factoryOk = chosen && chosen.factory_name && !isPlaceholderFactory(chosen.factory_name);
  const by = user?.full_name || user?.email || '';

  const run = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const q = byId[chosen.quotation_id];
      if (acceptIt && q && q.status !== 'ACCEPTED') await saveQuotationWithHistory(q, { status: 'ACCEPTED' }, t('cmp.historyReason'));
      if (rejectOthers) {
        for (const o of others) {
          const oq = byId[o.quotation_id];
          if (oq && !['ACCEPTED', 'REJECTED'].includes(oq.status)) await saveQuotationWithHistory(oq, { status: 'REJECTED' }, t('cmp.historyReason'));
        }
      }
      if (setFactory && factoryOk) await base44.entities.TaskCard.update(card.id, { factory_name: chosen.factory_name.trim(), ...(q?.factory_id ? { factory_id: q.factory_id } : {}) });
      const note = record.client_choice?.note ? `고객 의견: ${record.client_choice.note}` : '';
      await base44.entities.DecisionLog.create({
        tenant_id: card.tenant_id, card_id: card.id, quotation_id: chosen.quotation_id, category: 'SUPPLIER', status: 'CONFIRMED',
        topic: `공장 선정 — ${record.title || card.title || ''}`.trim(),
        decision: `${chosen.label}${chosen.factory_name ? ` (${chosen.factory_name})` : ''} 확정`,
        rationale: [reason, note].filter(Boolean).join('\n'),
        alternatives: others.map((o) => ({ option: `${o.label}${o.factory_name ? ` (${o.factory_name})` : ''}`, reject_reason: '' })),
        decided_by: by, decided_at: new Date().toISOString().slice(0, 10), source_ref: `QuoteComparison:${record.id}`,
      });
      await save({ status: 'CONFIRMED', confirmed_option_key: key, confirmed_at: new Date().toISOString(), confirmed_by_name: by });
      qc.invalidateQueries({ queryKey: ['quotations-by-card', card.id] });
      qc.invalidateQueries({ queryKey: ['decision-logs'] });
      toast({ title: t('cmp.confirmed') });
      onOpenChange(false);
      // 확정한 견적으로 계약서 초안을 만들러 간다 (계약서 화면이 카드·고객사·금액을 채운다)
      if (makeContract && q) navigate(`/contracts?quotation=${q.id}`);
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const box = (checked, set, label, disabled = false) => (
    <label className={`flex items-start gap-2 text-label ${disabled ? 'opacity-50' : ''}`}>
      <Checkbox className="mt-0.5" checked={checked && !disabled} disabled={disabled} onCheckedChange={(v) => set(v === true)} /><span>{label}</span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{t('cmp.confirmTitle')}</DialogTitle>
          <DialogDescription className="text-label">{t('cmp.confirmDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            {live.map((o) => (
              <label key={o.key} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-label ${key === o.key ? 'border-primary bg-primary/5' : ''}`}>
                <input type="radio" className="h-4 w-4 accent-primary" checked={key === o.key} onChange={() => setKey(o.key)} />
                <span className="font-semibold">{o.label}</span>
                <span className="text-muted-foreground">{o.factory_name}</span>
                {record.client_choice?.option_key === o.key && <span className="rounded bg-primary/10 px-1 text-micro text-primary">{t('cmp.clientPick')}</span>}
                <span className="ml-auto">{money(o.landedClient ?? o.totalClient, computed.base)}</span>
              </label>
            ))}
          </div>
          <div className="space-y-1.5 rounded-lg bg-muted/30 p-3">
            {box(acceptIt, setAcceptIt, t('cmp.cfAccept'))}
            {box(rejectOthers, setRejectOthers, t('cmp.cfReject').replace('{n}', others.length), others.length === 0)}
            {box(setFactory, setSetFactory, factoryOk ? t('cmp.cfFactory').replace('{name}', chosen.factory_name) : t('cmp.cfFactoryNone'), !factoryOk)}
            {box(makeContract, setMakeContract, t('cmp.cfContract'))}
            <p className="text-caption text-muted-foreground">· {t('cmp.cfDecision')}</p>
          </div>
          <label className="block space-y-1 text-caption text-muted-foreground">{t('cmp.cfReason')}
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="text-label" />
          </label>
          {changed && (
            <div className="space-y-1 rounded-md bg-warning/10 p-2 text-label">
              <p><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-warning" />{t('cmp.cfChanged')}</p>
              {box(ack, setAck, t('cmp.cfAck'))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-label" onClick={() => onOpenChange(false)}>{t('cmp.cancel')}</Button>
          <Button size="sm" className="h-8 gap-1 text-label" disabled={busy || !chosen || (changed && !ack)} onClick={run}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{t('cmp.confirmDo')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
