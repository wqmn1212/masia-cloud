import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { CURRENCIES, LINE_KIND, LINE_SOURCE, WARNING_TEXT, fmtWon, lineKey, summarize } from '@/lib/orderCost';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KINDS = [LINE_KIND.GOODS, LINE_KIND.LOGISTICS, LINE_KIND.DEST, LINE_KIND.OTHER];
const won = (v) => (v == null ? '—' : fmtWon(v));
const NEW_PRODUCT = '__new__';

// 주문 도착 원가 확정 창. 결제 단계·선적에서 채운 줄을 직원이 확인·수정하고 확정하면 고객 '상품 원가'에 보인다.
export default function LandedCostDialog({ open, onOpenChange, card, user, lc }) {
  const { t } = useLanguage();
  const [d, setD] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const rec = lc.record;

  const fromPrefill = () => {
    const p = lc.prefill();
    setWarnings(p.warnings);
    return p;
  };

  useEffect(() => {
    if (!open) return;
    setReason('');
    if (rec) {
      setWarnings([]);
      setD({
        product_key: rec.product_key || lc.defaultProduct.key, product_name: rec.product_name || '', quotation_id: rec.quotation_id || '',
        order_date: rec.order_date || '', units: rec.units || 1, unit_label: rec.unit_label || '개', vat_krw: rec.vat_krw || 0,
        lines: (rec.lines || []).map((l) => ({ ...l, key: l.key || lineKey() })), client_note: rec.client_note || '', staff_note: rec.staff_note || '',
      });
    } else {
      const p = fromPrefill();
      setD({ product_key: lc.defaultProduct.key, product_name: lc.defaultProduct.name, quotation_id: p.quotation_id, order_date: p.order_date, units: p.units, unit_label: p.unit_label, vat_krw: p.vat_krw, lines: p.lines, client_note: '', staff_note: '' });
    }
  }, [open]);

  const sum = useMemo(() => (d ? summarize({ lines: d.lines, units: d.units }) : null), [d]);
  if (!d) return null;

  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setLine = (key, patch) => setD((x) => ({ ...x, lines: x.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const removeLine = (key) => setD((x) => ({ ...x, lines: x.lines.filter((l) => l.key !== key) }));
  const addLine = () => setD((x) => ({ ...x, lines: [...x.lines, { key: lineKey(), kind: LINE_KIND.OTHER, label: '', amount: '', currency: 'KRW', fx: 1, fx_basis: '', source: LINE_SOURCE.MANUAL, estimated: false, one_time: false }] }));
  const reload = () => {
    const p = fromPrefill();
    setD((x) => ({ ...x, lines: p.lines, units: p.units, order_date: p.order_date, vat_krw: p.vat_krw, quotation_id: p.quotation_id }));
  };
  const pickProduct = (key) => {
    if (key === NEW_PRODUCT) { set('product_key', card.id); return; }
    const p = lc.products.find((x) => x.key === key);
    setD((x) => ({ ...x, product_key: key, product_name: p?.name || x.product_name }));
  };

  const blank = d.lines.some((l) => !String(l.label || '').trim());
  const canSave = !busy && sum && !sum.missing_fx && sum.total_krw > 0 && !blank && d.product_name.trim() && (!rec || reason.trim());

  const submit = async () => {
    setBusy(true);
    try {
      await lc.save(d, { by: user?.full_name || user?.email || '', reason: reason.trim() });
      toast({ title: rec ? t('lc.savedRevision') : t('lc.saved'), description: card.client_visible ? t('lc.savedDesc') : t('lc.savedHidden') });
      onOpenChange(false);
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const productOptions = [{ key: lc.defaultProduct.key, name: lc.defaultProduct.name }, ...lc.products.filter((p) => p.key !== lc.defaultProduct.key)];
  const selectedKey = productOptions.some((p) => p.key === d.product_key) ? d.product_key : NEW_PRODUCT;

  const lineRow = (l) => (
    <tr key={l.key} className="border-t align-top">
      <td className="p-1.5">
        <Select value={l.kind} onValueChange={(v) => setLine(l.key, { kind: v })}>
          <SelectTrigger className="h-8 gap-1 px-2.5 text-label"><SelectValue /></SelectTrigger>
          <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k} className="text-label">{t(`lc.kind.${k}`)}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="p-1.5">
        <Input className="h-8 text-label" value={l.label} onChange={(e) => setLine(l.key, { label: e.target.value })} placeholder={t('lc.labelPh')} />
        <div className="mt-0.5 flex flex-wrap gap-1">
          {l.estimated && <Badge variant="outline" className="h-4 px-1 text-micro text-warning-text">{t('lc.estimated')}</Badge>}
          <span className="text-micro text-muted-foreground">{t(`lc.src.${l.source || 'MANUAL'}`)}{l.fx_basis ? ` · ${l.fx_basis}` : ''}</span>
        </div>
      </td>
      <td className="p-1.5"><Input className="h-8 w-28 text-right text-label" inputMode="decimal" value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value })} /></td>
      <td className="p-1.5">
        <Select value={l.currency} onValueChange={(v) => setLine(l.key, { currency: v, fx: v === 'KRW' ? 1 : l.fx })}>
          <SelectTrigger className="h-8 w-[76px] text-label"><SelectValue /></SelectTrigger>
          <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c} className="text-label">{c}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="p-1.5">{l.currency === 'KRW' ? <span className="block pt-2 text-center text-label text-muted-foreground">—</span> : <Input className="h-8 w-20 text-right text-label" inputMode="decimal" value={l.fx ?? ''} onChange={(e) => setLine(l.key, { fx: e.target.value, fx_basis: l.source === LINE_SOURCE.MANUAL ? '' : t('lc.fxManual') })} />}</td>
      <td className="p-1.5 pt-3 text-right text-label tabular-nums">{won(sum.lines.find((x) => x.key === l.key)?.amount_krw)}</td>
      <td className="p-1.5 pt-2.5 text-center"><Switch checked={!!l.one_time} onCheckedChange={(v) => setLine(l.key, { one_time: v })} /></td>
      <td className="p-1.5"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(l.key)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
    </tr>
  );

  const field = (label, node, hint) => (
    <label className="block space-y-1">
      <span className="text-label font-medium text-muted-foreground">{label}</span>
      {node}
      {hint && <span className="block text-caption text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('lc.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('lc.dialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {field(t('lc.product'), (
            <Select value={selectedKey} onValueChange={pickProduct}>
              <SelectTrigger className="h-9 text-body"><SelectValue /></SelectTrigger>
              <SelectContent>
                {productOptions.map((p) => <SelectItem key={p.key} value={p.key} className="text-body">{p.name || p.key}{p.key === lc.defaultProduct.key ? ` (${t('lc.sameChain')})` : ''}</SelectItem>)}
                <SelectItem value={NEW_PRODUCT} className="text-body">{t('lc.newProduct')}</SelectItem>
              </SelectContent>
            </Select>
          ), t('lc.productHint'))}
          {field(t('lc.productName'), <Input value={d.product_name} onChange={(e) => set('product_name', e.target.value)} />, t('lc.productNameHint'))}
          <div className="grid grid-cols-[1fr_80px] gap-2">
            {field(t('lc.units'), <Input inputMode="numeric" value={d.units} onChange={(e) => set('units', e.target.value)} />, lc.quotation ? `${t('lc.fromQuote')}: ${lc.quotation.quote_title || lc.quotation.product_name || ''}` : t('lc.noQuote'))}
            {field(t('lc.unitLabel'), <Input value={d.unit_label} onChange={(e) => set('unit_label', e.target.value)} />)}
          </div>
          {field(t('lc.orderDate'), <Input type="date" value={d.order_date} onChange={(e) => set('order_date', e.target.value)} />, t('lc.orderDateHint'))}
        </div>

        {warnings.length > 0 && (
          <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
            {warnings.map((w) => <p key={w} className="flex items-start gap-1.5 text-label"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />{t(`lc.w.${w}`, WARNING_TEXT[w])}</p>)}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-body">
            <thead className="bg-muted/50 text-caption text-muted-foreground">
              <tr>
                <th className="w-36 p-1.5 text-left font-medium">{t('lc.col.kind')}</th>
                <th className="p-1.5 text-left font-medium">{t('lc.col.label')}</th>
                <th className="p-1.5 text-right font-medium">{t('lc.col.amount')}</th>
                <th className="p-1.5 text-left font-medium">{t('lc.col.currency')}</th>
                <th className="p-1.5 text-right font-medium">{t('lc.col.fx')}</th>
                <th className="p-1.5 text-right font-medium">{t('lc.col.krw')}</th>
                <th className="p-1.5 text-center font-medium">{t('lc.col.oneTime')}</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>{d.lines.map(lineRow)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 gap-1 text-label" onClick={addLine}><Plus className="h-3 w-3" />{t('lc.addLine')}</Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-label" onClick={reload}><RotateCcw className="h-3 w-3" />{t('lc.reload')}</Button>
        </div>

        <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-body sm:grid-cols-4">
          <div><p className="text-caption text-muted-foreground">{t('lc.sum.goods')}</p><p className="tabular-nums">{won(sum.goods_krw)}</p></div>
          <div><p className="text-caption text-muted-foreground">{t('lc.sum.logistics')}</p><p className="tabular-nums">{won(sum.logistics_krw)}</p></div>
          <div><p className="text-caption text-muted-foreground">{t('lc.sum.total')}</p><p className="font-semibold tabular-nums">{won(sum.total_krw)}</p></div>
          <div><p className="text-caption text-muted-foreground">{t('lc.sum.perUnit').replace('{unit}', d.unit_label || '개')}</p><p className="text-lg font-bold tabular-nums text-primary">{won(sum.per_unit_krw)}</p></div>
          <p className="text-caption text-muted-foreground sm:col-span-4">
            {sum.other_krw > 0 && `${t('lc.sum.other')} ${won(sum.other_krw)} · `}
            {sum.one_time_krw > 0 && `${t('lc.sum.oneTime')} ${won(sum.one_time_krw)} · `}
            {t('lc.sum.vat')} {won(Number(d.vat_krw) || 0)}
            {sum.estimated && ` · ${t('lc.sum.estimated')}`}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {field(t('lc.clientNote'), <Textarea rows={2} value={d.client_note} onChange={(e) => set('client_note', e.target.value)} placeholder={t('lc.clientNotePh')} />)}
          {field(t('lc.staffNote'), <Textarea rows={2} value={d.staff_note} onChange={(e) => set('staff_note', e.target.value)} />)}
        </div>
        {rec && field(t('lc.reason'), <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('lc.reasonPh')} />)}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!card.client_visible && <span className="mr-auto text-caption text-muted-foreground">{t('lc.notShared')}</span>}
          {sum.missing_fx && <span className="text-caption text-destructive">{t('lc.w.NO_FX', WARNING_TEXT.NO_FX)}</span>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('cmp.cancel')}</Button>
          <Button disabled={!canSave} onClick={submit} className="gap-1">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{rec ? t('lc.confirmRevision') : t('lc.confirm')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
