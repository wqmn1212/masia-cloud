import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Columns3, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { quotePriceLabel } from '@/components/quotation/quoteCurrency';
import { MAX_OPTIONS, defaultSelection } from '@/lib/quoteCompare';
import useQuoteComparison from './useQuoteComparison';
import QuoteComparisonDialog from './QuoteComparisonDialog';
import ConfirmComparisonDialog from './ConfirmComparisonDialog';
import { fmtDateTime } from './format';
import { Checkbox } from '@/components/ui/checkbox';

// 견적 탭 맨 위: 견적이 2건 이상이면 비교표를 만들고, 있으면 상태 한 줄과 열기 버튼을 보여 준다.
export default function QuoteComparisonPanel({ card, user }) {
  const { t } = useLanguage();
  const cmp = useQuoteComparison(card);
  const { record, quotations, computed, stale } = cmp;
  const [picking, setPicking] = useState(null); // null | 'create' | 'edit'
  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const by = user?.full_name || user?.email || '';
  if (cmp.loading || (!record && quotations.length < 2)) return null;

  const startPick = (mode) => {
    setSelected(mode === 'edit' ? record.options.map((o) => o.quotation_id).filter((id) => quotations.some((q) => q.id === id)) : defaultSelection(quotations));
    setPicking(mode);
  };
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_OPTIONS ? s : [...s, id]));
  const submit = async () => {
    setBusy(true);
    try {
      // 견적 목록 순서(최신 먼저)대로 안 이름을 붙인다
      const ids = quotations.map((q) => q.id).filter((id) => selected.includes(id));
      if (picking === 'create') await cmp.create(ids, by); else await cmp.changeOptions(ids);
      setPicking(null);
      setOpen(true);
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };

  const choiceKey = record?.client_choice?.option_key;
  const choiceLabel = choiceKey ? (record.options.find((o) => o.key === choiceKey)?.label || choiceKey) : '';

  return (
    <section id="quote-compare" className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-body font-semibold"><Columns3 className="h-4 w-4 text-primary" />{t('cmp.title')}
            {record && <Badge variant="outline" className="text-micro">{t(`cmp.status.${record.status}`)}{record.version ? ` · v${record.version}` : ''}</Badge>}
          </div>
          <p className="text-caption text-muted-foreground">
            {record
              ? `${record.options.length}${t('cmp.optionsCount')}${record.published_at ? ` · ${t('cmp.lastPublished')} ${fmtDateTime(record.published_at)}` : ` · ${t('cmp.notPublished')}`}`
              : t('cmp.panelDesc').replace('{n}', quotations.length)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!record && !picking && <Button size="sm" className="h-7 text-label" onClick={() => startPick('create')}>{t('cmp.start')}</Button>}
          {record && !picking && <Button size="sm" variant="outline" className="h-7 text-label" onClick={() => setOpen(true)}>{t('cmp.open')}</Button>}
          {record && ['PUBLISHED', 'CHOSEN'].includes(record.status) && !picking && <Button size="sm" variant={record.status === 'CHOSEN' ? 'default' : 'outline'} className="h-7 text-label" onClick={() => setConfirming(true)}>{t('cmp.confirm')}</Button>}
        </div>
      </div>

      {record && choiceKey && (
        <p className="flex items-center gap-1 text-label"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          {record.status === 'CONFIRMED' ? t('cmp.confirmedLine').replace('{label}', record.options.find((o) => o.key === record.confirmed_option_key)?.label || '') : t('cmp.clientChose').replace('{label}', choiceLabel)}
          {record.client_choice.note && <span className="text-muted-foreground">— “{record.client_choice.note}”</span>}
        </p>
      )}
      {record?.status === 'CONFIRMED' && !choiceKey && <p className="text-label">{t('cmp.confirmedLine').replace('{label}', record.options.find((o) => o.key === record.confirmed_option_key)?.label || '')}</p>}
      {stale && <p className="flex items-center gap-1 text-label"><AlertTriangle className="h-3.5 w-3.5 text-warning" />{t('cmp.staleNotice')}</p>}

      {picking && (
        <div className="space-y-2 rounded-lg bg-muted/30 p-2">
          <p className="text-caption text-muted-foreground">{t('cmp.pickHint').replace('{max}', MAX_OPTIONS)}</p>
          <div className="space-y-1">
            {quotations.map((q) => (
              <label key={q.id} className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-label hover:bg-background ${q.status === 'REJECTED' ? 'opacity-60' : ''}`}>
                <Checkbox checked={selected.includes(q.id)} onCheckedChange={() => toggle(q.id)} disabled={!selected.includes(q.id) && selected.length >= MAX_OPTIONS} />
                <span className="font-medium">{q.factory_name || '—'}</span>
                <span className="truncate text-muted-foreground">{q.quote_title || q.product_name || ''}</span>
                <span className="ml-auto whitespace-nowrap text-muted-foreground">{q.incoterms || ''} · {quotePriceLabel(q)} · {t(`cmp.qstatus.${q.status}`, q.status)}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 text-label" onClick={() => setPicking(null)}>{t('cmp.cancel')}</Button>
            <Button size="sm" className="h-7 gap-1 text-label" disabled={busy || selected.length < 1} onClick={submit}>
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}{picking === 'create' ? t('cmp.create') : t('cmp.applyOptions')} ({selected.length})
            </Button>
          </div>
        </div>
      )}

      {record && computed && (
        <QuoteComparisonDialog open={open} onOpenChange={setOpen} cmp={cmp} card={card} user={user} onEditOptions={() => { setOpen(false); startPick('edit'); }} />
      )}
      {record && computed && confirming && <ConfirmComparisonDialog open={confirming} onOpenChange={setConfirming} cmp={cmp} card={card} user={user} />}
    </section>
  );
}
