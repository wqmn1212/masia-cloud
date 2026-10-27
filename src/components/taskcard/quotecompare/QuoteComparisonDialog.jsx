import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, Download, Eye, Loader2, MoreHorizontal, Plus, RefreshCw, Send, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { CELL_STATE, CONDITION_KEYS, MAX_OPTIONS, ROW_KIND, clientView, factoryNameLeaks, factoryQuestions, moveCell, setCellState } from '@/lib/quoteCompare';
import { generateComparisonPDF } from '@/lib/generateComparisonPDF';
import ClientComparisonView from './ClientComparisonView';
import { fmtDateTime, money, unitMoney } from './format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATE_KEYS = { INCLUDED: 'cmp.state.included', NOT_INCLUDED: 'cmp.state.notIncluded', UNKNOWN: 'cmp.state.unknown' };
const LEVEL_STYLE = { error: 'text-destructive', warn: 'text-foreground', info: 'text-muted-foreground' };

// 셀 메뉴: 상태 바꾸기, 다른 줄로 옮기기
function CellMenu({ row, optKey, rows, onState, onMove }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const cell = row.cells[optKey];
  const others = rows.filter((r) => r.key !== row.key && r.kind === row.kind && !r.cells[optKey]?.lines?.length);
  const pick = (fn) => { setOpen(false); fn(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t('cmp.cellMenu')} className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"><MoreHorizontal className="h-3.5 w-3.5" /></button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-1 p-2 text-label">
        {cell?.lines?.length > 0 && cell.state !== CELL_STATE.PRICED && <button type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={() => pick(() => onState(CELL_STATE.PRICED))}>{t('cmp.state.priced')}</button>}
        {Object.keys(STATE_KEYS).filter((s) => s !== cell?.state).map((s) => (
          <button key={s} type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-muted" onClick={() => pick(() => onState(s))}>{t(STATE_KEYS[s])}</button>
        ))}
        {cell?.lines?.length > 0 && (
          <div className="border-t pt-1">
            <p className="px-2 py-1 text-micro text-muted-foreground">{t('cmp.moveTo')}</p>
            {others.map((r) => <button key={r.key} type="button" className="block w-full truncate rounded px-2 py-1 text-left hover:bg-muted" onClick={() => pick(() => onMove(r.key))}>{r.label}</button>)}
            <button type="button" className="block w-full rounded px-2 py-1 text-left text-primary hover:bg-muted" onClick={() => pick(() => onMove(null))}>{t('cmp.moveNew')}</button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// 입력칸: 포커스를 잃을 때 저장
function BlurInput({ value, onSave, className = '', ...rest }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  return <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (String(v) !== String(value ?? '')) onSave(v); }} className={`h-7 text-label ${className}`} {...rest} />;
}

export default function QuoteComparisonDialog({ open, onOpenChange, cmp, card, user, onEditOptions }) {
  const { t, lang } = useLanguage();
  const { record, computed, warnings, stale, latestFx, save, publish, refreshFx } = cmp;
  const [mode, setMode] = useState('client');
  const [busy, setBusy] = useState(false);
  const by = user?.full_name || user?.email || '';
  const snapshot = useMemo(() => (record && computed ? clientView(computed, record, { version: (record.version || 0) + 1 }) : null), [record, computed]);
  if (!record || !computed) return null;
  const cur = computed.base;
  const opts = computed.options;
  const live = opts.filter((o) => !o.missing);
  const best = computed.best;
  const isCost = mode === 'cost';
  const optRaw = (key) => record.options.find((o) => o.key === key) || {};
  const saveOption = (key, patch) => save({ options: record.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  const saveCondition = (key, ck, value) => saveOption(key, { conditions: { ...(optRaw(key).conditions || {}), [ck]: value } });
  const questions = factoryQuestions(computed);
  const wText = (w) => t(`cmp.w.${w.code}`, w.text).replace('{label}', opts.find((o) => o.key === w.option)?.label || '');
  const pending = warnings.filter((w) => w.level !== 'info');

  const copyQuestions = async () => {
    const text = questions.map((q) => `【${q.label}${q.factory_name ? ` · ${q.factory_name}` : ''}】\n${q.text}`).join('\n\n');
    try { await navigator.clipboard.writeText(text); toast({ title: t('cmp.copied') }); } catch { toast({ title: text.slice(0, 120) }); }
  };

  const doPublish = async () => {
    const leaks = factoryNameLeaks(snapshot, computed);
    if (leaks.length && !window.confirm(t('cmp.leakConfirm').replace('{names}', leaks.join(', ')))) return;
    if (pending.length && !window.confirm(t('cmp.publishConfirm').replace('{n}', pending.length))) return;
    setBusy(true);
    try { await publish(by); toast({ title: t('cmp.published') }); } catch (e) { toast({ title: e.message, variant: 'destructive' }); } finally { setBusy(false); }
  };

  const val = (o, client, cost) => (isCost ? cost : client);
  const bestMark = (show) => show && <span className="ml-1 rounded bg-primary/10 px-1 text-micro font-semibold text-primary">{t('cmp.best')}</span>;
  const landedText = (o) => {
    const v = val(o, o.landedClient, o.landedCost);
    if (v != null) return money(v, cur);
    const key = { NO_CARGO: 'cmp.landed.noCargo', SCOPE_ASK: 'cmp.landed.scopeAsk', NO_FX: 'cmp.landed.noFx' }[o.landedStatus];
    return <span className="text-caption text-warning-text">{t(key || 'cmp.landed.noCargo')}</span>;
  };
  const landedBest = (o) => (isCost ? computed.allLanded && best.perUnitCost === o.key : best.landedPerUnit === o.key);
  const quoteBest = (o) => (isCost ? !computed.allLanded && best.perUnitCost === o.key : !computed.allLanded && best.perUnit === o.key);

  // 표 조각은 컴포넌트가 아니라 함수로 그린다 (다시 그릴 때 입력칸이 새로 만들어지지 않도록)
  const th = (children) => <th className="sticky left-0 z-10 w-40 min-w-[10rem] bg-background p-2 text-left align-top text-caption font-medium text-muted-foreground">{children}</th>;
  const section = (children) => <tr className="bg-muted/40"><td colSpan={live.length + 1} className="sticky left-0 px-2 py-1 text-caption font-semibold text-muted-foreground">{children}</td></tr>;
  const row = (key, label, render, className = '') => (
    <tr key={key} className={`border-t ${className}`}>{th(label)}{live.map((o) => <td key={o.key} className="min-w-[11rem] p-2 align-top text-label">{render(o)}</td>)}</tr>
  );

  // 모든 안이 1대·1세트면 개당 줄은 합계와 같아 숨긴다
  const allSingle = live.every((o) => o.units === 1);
  const leadText = (txt) => (lang === 'zh' ? txt.replace('영업일', '个工作日').replace('일', '天') : txt);
  const itemRows = computed.rows.filter((r) => r.kind !== ROW_KIND.LOGISTICS);
  const hasLogistics = live.some((o) => o.logiClient || o.separateBase);
  const extraConds = record.extra_conditions || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(1100px,96vw)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {t('cmp.title')}
            <BlurInput value={record.title} onSave={(v) => save({ title: v })} className="h-7 w-56 text-body font-semibold" aria-label={t('cmp.sheetTitle')} />
            <Badge variant="outline" className="text-micro">{t(`cmp.status.${record.status}`)}{record.version ? ` · v${record.version}` : ''}</Badge>
          </DialogTitle>
          <DialogDescription className="text-label">
            {t('cmp.dialogDesc')}{record.published_at ? ` · ${t('cmp.lastPublished')} ${fmtDateTime(record.published_at)} ${record.published_by_name || ''}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 text-label">
            {['cost', 'client', 'preview'].map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`rounded px-2.5 py-1 ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                {m === 'preview' && <Eye className="mr-1 inline h-3 w-3" />}{t(`cmp.mode.${m}`)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-label text-muted-foreground">{t('cmp.baseCurrency')}
            <Select value={record.base_currency || 'KRW'} onValueChange={(v) => save({ base_currency: v })}>
              <SelectTrigger className="h-8 w-[84px] text-label"><SelectValue /></SelectTrigger>
              <SelectContent>{['KRW', 'USD', 'CNY'].map((c) => <SelectItem key={c} value={c} className="text-label">{c}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-1 text-label text-muted-foreground">{t('cmp.dutyRate')}
            <BlurInput type="number" step="0.1" value={record.duty_rate ?? 8} onSave={(v) => save({ duty_rate: Number(v) || 0 })} className="w-16" />%
          </label>
          <span className="text-caption text-muted-foreground">
            {t('cmp.fx')} {computed.fx.usd_krw ? `$1=₩${Number(computed.fx.usd_krw).toLocaleString()}` : '—'}{computed.fx.usd_cny ? ` · $1=¥${computed.fx.usd_cny}` : ''}{computed.fx.date ? ` (${computed.fx.date})` : ''}
          </span>
          {latestFx.date && latestFx.date !== computed.fx.date && <Button variant="ghost" size="sm" className="h-7 gap-1 text-label" onClick={refreshFx}><RefreshCw className="h-3 w-3" />{t('cmp.refreshFx')}</Button>}
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-label" onClick={onEditOptions}>{t('cmp.editOptions')}</Button>
            {questions.length > 0 && <Button variant="outline" size="sm" className="h-7 gap-1 text-label" onClick={copyQuestions}><Copy className="h-3 w-3" />{t('cmp.copyQuestions')} ({questions.length})</Button>}
            <Button variant="outline" size="sm" className="h-7 gap-1 text-label" disabled={!snapshot?.options?.length} onClick={() => generateComparisonPDF(record.client_snapshot && record.status !== 'DRAFT' && !stale ? record.client_snapshot : snapshot, { cardTitle: card?.title || '', clientName: card?.client_name || '', choice: record.client_choice }).catch((e) => toast({ title: e.message, variant: 'destructive' }))}><Download className="h-3 w-3" />PDF</Button>
          </div>
        </div>

        {stale && <p className="rounded-md bg-warning/10 px-3 py-2 text-label"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-warning" />{t('cmp.staleNotice')}</p>}

        {mode === 'preview' ? (
          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-2 text-caption text-muted-foreground">{t('cmp.previewNote')}</p>
            <ClientComparisonView snapshot={snapshot} />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-label">
              <thead className="bg-muted/50">
                <tr>
                  <th className="sticky left-0 z-20 bg-muted/50 p-2 text-left text-caption font-medium text-muted-foreground">{t('cmp.item')}</th>
                  {live.map((o) => (
                    <th key={o.key} className="min-w-[11rem] p-2 text-left align-top font-normal">
                      <BlurInput value={o.label} onSave={(v) => saveOption(o.key, { label: v.trim() || o.label })} className="h-7 w-32 font-semibold" aria-label={t('cmp.optionName')} />
                      <p className="mt-1 truncate text-caption text-muted-foreground" title={o.factory_name}>{o.factory_name || '—'} · {t(`cmp.qstatus.${o.status}`, o.status)}</p>
                      <label className="mt-1 flex items-center gap-1.5 text-micro text-muted-foreground">
                        <Switch checked={!!o.show_factory_name} onCheckedChange={(v) => saveOption(o.key, { show_factory_name: v })} className="scale-75" />{t('cmp.showFactory')}
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section(t('cmp.sec.summary'))}
                {row('r1', t('cmp.landedTotal'), (o) => <span className="font-semibold">{landedText(o)}{bestMark(landedBest(o))}</span>, "bg-primary/[0.03]")}
                {!allSingle && row('r2', t('cmp.landedUnit'), (o) => unitMoney(val(o, o.landedPerUnitClient, o.landedPerUnitCost), cur))}
                {row('r3', isCost ? t('cmp.costTotal') : t('cmp.quoteTotal'), (o) => (
                  <div>
                    <span className="font-semibold">{money(val(o, o.totalClient, o.totalCost), cur)}</span>{bestMark(quoteBest(o))}
                    {!isCost && o.pdfTotal != null && o.currency !== cur && <p className="text-micro text-muted-foreground">{t('cmp.pdf')} {money(o.pdfTotal, o.currency)}</p>}
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {!o.priced && <Badge variant="outline" className="h-4 border-destructive px-1 text-micro text-destructive">{t('cmp.noPrice')}</Badge>}
                      {o.scopeDiff && <Badge variant="outline" className="h-4 border-warning px-1 text-micro">{t('cmp.scopeDiff')}</Badge>}
                      {computed.qtyDiff && <Badge variant="outline" className="h-4 px-1 text-micro">{t('cmp.qtyDiff')}</Badge>}
                      {o.optionalExcluded && <Badge variant="outline" className="h-4 px-1 text-micro">{t('cmp.optionalExcluded')}</Badge>}
                    </div>
                  </div>
                ))}
                {!allSingle && row('r4', t('cmp.perUnit'), (o) => <>{unitMoney(val(o, o.perUnitClient, o.perUnitCost), cur)} <span className="text-muted-foreground">× {o.units.toLocaleString()}</span></>)}
                {row('r5', t('cmp.lead'), (o) => (o.lead ? <>{leadText(o.lead.text)}{o.lead.source === 'REMARKS' && <span className="ml-1 text-micro text-muted-foreground">({t('cmp.fromRemarks')})</span>}{bestMark(best.lead === o.key)}</> : <span className="text-warning-text">{t('cmp.missing')}</span>))}
                {row('r6', t('cmp.payment'), (o) => (o.advance != null ? <>{o.advance} / {100 - o.advance}<p className="text-micro text-muted-foreground">{t('cmp.deposit')} {money(o.deposit, cur)}</p></> : <span className="text-warning-text">{t('cmp.missing')}</span>))}
                {isCost && row('r7', t('cmp.margin'), (o) => (o.margin == null ? '—' : <span className={o.margin <= 0 ? 'text-destructive' : ''}>{o.margin.toFixed(1)}%</span>))}

                {section(t('cmp.sec.items'))}
                {itemRows.map((r) => (
                  <tr key={r.key} className="border-t">
                    {th(<>
                      <span className="text-foreground">{r.label}</span>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.kind !== ROW_KIND.ITEM && <Badge variant="secondary" className="h-4 px-1 text-micro">{t(`cmp.kind.${r.kind}`)}</Badge>}
                        {r.specDiff && <Badge variant="outline" className="h-4 border-warning px-1 text-micro">{t('cmp.specDiff')}</Badge>}
                      </div>
                    </>)}
                    {live.map((o) => {
                      const c = r.cells[o.key];
                      const rawRow = record.rows.find((x) => x.key === r.key);
                      const unknown = c?.state === CELL_STATE.UNKNOWN;
                      const isBest = r.best === o.key;
                      return (
                        <td key={o.key} className={`min-w-[11rem] p-2 align-top ${unknown ? 'bg-warning/10' : isBest ? 'bg-primary/5' : ''}`}>
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              {!c || c.missing ? <span className="text-muted-foreground">{t('cmp.state.notIncluded')}</span>
                                : c.state !== CELL_STATE.PRICED ? <span className={unknown ? 'font-semibold' : 'text-muted-foreground'}>{t(STATE_KEYS[c.state])}</span>
                                  : r.kind === ROW_KIND.OPTIONAL ? (
                                    <div className="space-y-0.5">
                                      {c.lines.map((l) => (
                                        <label key={l.idx} className="flex items-center gap-1">
                                          <input type="radio" className="h-4 w-4 accent-primary" name={`ch-${r.key}-${o.key}`} checked={optRaw(o.key).choice?.[r.key] === l.idx} onChange={() => saveOption(o.key, { choice: { ...(optRaw(o.key).choice || {}), [r.key]: l.idx } })} />
                                          <span className="truncate" title={l.name}>{money(isCost ? l.costBase : l.clientBase, cur)}</span>
                                        </label>
                                      ))}
                                      <label className="flex items-center gap-1 text-muted-foreground">
                                        <input type="radio" className="h-4 w-4 accent-primary" name={`ch-${r.key}-${o.key}`} checked={optRaw(o.key).choice?.[r.key] == null} onChange={() => { const ch = { ...(optRaw(o.key).choice || {}) }; delete ch[r.key]; saveOption(o.key, { choice: ch }); }} />{t('cmp.excludeFromTotal')}
                                      </label>
                                    </div>
                                  ) : (
                                    <>
                                      <p>{money(val(o, c.clientBase, c.costBase), cur)}{c.qty > 1 && <span className="ml-1 text-micro text-muted-foreground">({unitMoney(val(o, c.clientBase, c.costBase) / c.qty, cur)} × {c.qty.toLocaleString()})</span>}</p>
                                      {c.lines.length > 0 && <p className="truncate text-micro text-muted-foreground" title={c.lines.map((l) => l.name).join(' / ')}>{c.lines.map((l) => l.name).join(' / ')}</p>}
                                      {c.spec && <p className="line-clamp-2 text-micro leading-snug text-muted-foreground" title={c.spec}>{c.spec}</p>}
                                      {r.kind === ROW_KIND.ONE_TIME && <p className="text-micro text-muted-foreground">{t('cmp.perUnitBurden')} {unitMoney(val(o, c.clientBase, c.costBase) / o.units, cur)}</p>}
                                    </>
                                  )}
                              {c?.auto && <span className="mt-0.5 inline-block rounded bg-muted px-1 text-micro text-muted-foreground">{t('cmp.auto')}</span>}
                            </div>
                            {rawRow && <CellMenu row={rawRow} optKey={o.key} rows={record.rows} onState={(s) => save({ rows: setCellState(record, r.key, o.key, s).rows })} onMove={(to) => save({ rows: moveCell(record, o.key, r.key, to).rows })} />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {section(t('cmp.sec.logistics'))}
                {row('r8', t('cmp.incoterms'), (o) => <>{o.incoterms || '—'}{o.term.approx && <span className="ml-1 text-micro text-muted-foreground">≈ {o.term.term}</span>}</>)}
                {hasLogistics && row('r9', t('cmp.includedLogistics'), (o) => (o.logiClient || o.separateBase ? (
                  <div className="space-y-1">
                    <p>{money(val(o, (o.logiClient || 0) + (o.separateBase || 0), (o.logiCost || 0) + (o.separateBase || 0)), cur)}</p>
                    {['EXW', 'FCA', 'FOB'].includes(o.term.term) && (
                      <Select value={optRaw(o.key).logistics_scope || o.scope || 'ASK'} onValueChange={(v) => saveOption(o.key, { logistics_scope: v === 'ASK' ? null : v })}>
                        <SelectTrigger className={`h-8 w-full text-caption ${o.scopeAsk ? 'border-warning' : ''}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ASK" className="text-label">{t('cmp.scope.ask')}</SelectItem>
                          <SelectItem value="PORT" className="text-label">{t('cmp.scope.port')}</SelectItem>
                          <SelectItem value="DOOR" className="text-label">{t('cmp.scope.door')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ) : '—'))}
                {row('r10', t('cmp.cargo'), (o) => (
                  <div className="flex items-center gap-1">
                    <BlurInput type="number" step="any" placeholder="CBM" value={optRaw(o.key).cargo?.cbm ?? (o.cargo.source === 'QUOTE' ? o.cargo.cbm : '')} onSave={(v) => saveOption(o.key, { cargo: { ...(optRaw(o.key).cargo || {}), cbm: Number(v) || 0 } })} className={`w-20 ${o.landedStatus === 'NO_CARGO' ? 'border-warning' : ''}`} />
                    <BlurInput type="number" step="any" placeholder="kg" value={optRaw(o.key).cargo?.kg ?? (o.cargo.source === 'QUOTE' ? o.cargo.kg : '')} onSave={(v) => saveOption(o.key, { cargo: { ...(optRaw(o.key).cargo || {}), kg: Number(v) || 0 } })} className="w-20" />
                  </div>
                ))}
                {live.length > 1 && <tr className="border-t">{th(null)}<td colSpan={live.length} className="p-2"><Button variant="ghost" size="sm" className="h-6 text-caption" onClick={() => { const c0 = optRaw(live[0].key).cargo || {}; save({ options: record.options.map((x) => ({ ...x, cargo: { ...c0 } })) }); }}>{t('cmp.cargoSameAll')}</Button></td></tr>}
                {row('r11', t('cmp.afterArrival'), (o) => (o.landedExtra != null ? <span title={o.landedRange ? `${money(o.landedRange.low, cur)} ~ ${money(o.landedRange.high, cur)}` : ''}>{t('cmp.approx')} {money(o.landedExtra, cur)}</span> : '—'))}

                {section(t('cmp.sec.conditions'))}
                {CONDITION_KEYS.filter((k) => !['lead', 'payment'].includes(k)).map((k) => (
                  row(k, t(`cmp.cond.${k}`), (o) => (
                    <div>
                      <BlurInput value={o.conditions[k] || ''} onSave={(v) => saveCondition(o.key, k, v)} className={k === 'power' && o.power?.warn ? 'border-warning' : ''} placeholder="—" />
                      {o.conditions[k] && o.condition_source[k] === 'REMARKS' && <p className="text-micro text-muted-foreground">{t('cmp.fromRemarksCheck')}</p>}
                      {k === 'power' && o.power?.warn && <p className="text-micro text-warning-text">{t('cmp.power60')}</p>}
                    </div>
                  ))
                ))}
                {extraConds.map((c) => (
                  <tr key={c.key} className="border-t">
                    {th(<>
                      <div className="flex items-center gap-1">
                        <BlurInput value={c.label} onSave={(v) => save({ extra_conditions: extraConds.map((x) => (x.key === c.key ? { ...x, label: v } : x)) })} className="h-6" />
                        <button type="button" aria-label={t('cmp.removeRow')} onClick={() => save({ extra_conditions: extraConds.filter((x) => x.key !== c.key) })} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                      </div>
                    </>)}
                    {live.map((o) => <td key={o.key} className="p-2"><BlurInput value={optRaw(o.key).extra?.[c.key] || ''} onSave={(v) => saveOption(o.key, { extra: { ...(optRaw(o.key).extra || {}), [c.key]: v } })} placeholder="—" /></td>)}
                  </tr>
                ))}
                <tr className="border-t">{th(null)}<td colSpan={live.length} className="p-2">
                  <Button variant="ghost" size="sm" className="h-6 gap-1 text-caption" onClick={() => save({ extra_conditions: [...extraConds, { key: `x${Date.now().toString(36)}`, label: t('cmp.newCondition') }] })}><Plus className="h-3 w-3" />{t('cmp.addCondition')}</Button>
                </td></tr>
              </tbody>
            </table>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-label font-semibold"><AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-warning" />{t('cmp.warningsTitle')} ({warnings.length})</p>
            <ul className="space-y-0.5 text-label">{warnings.map((w, i) => <li key={i} className={LEVEL_STYLE[w.level]}>· {wText(w)}</li>)}</ul>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-caption text-muted-foreground">{t('cmp.recommendation')}
            <BlurInput value={record.recommendation || ''} onSave={(v) => save({ recommendation: v })} placeholder={t('cmp.recommendationPh')} className="h-8" />
          </label>
          <label className="space-y-1 text-caption text-muted-foreground">{t('cmp.staffNote')}
            <BlurInput value={record.staff_note || ''} onSave={(v) => save({ staff_note: v })} className="h-8" />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-caption text-muted-foreground">{record.client_choice?.option_key ? t('cmp.clientChose').replace('{label}', opts.find((o) => o.key === record.client_choice.option_key)?.label || record.client_choice.option_key) : t('cmp.publishHint')}</p>
          <div className="flex gap-2">
            {record.status === 'DRAFT' && <Button variant="ghost" size="sm" className="h-8 gap-1 text-label text-muted-foreground" onClick={() => { if (window.confirm(t('cmp.closeConfirm'))) { cmp.close(); onOpenChange(false); } }}><Trash2 className="h-3.5 w-3.5" />{t('cmp.closeSheet')}</Button>}
            <Button size="sm" className="h-8 gap-1 text-label" disabled={busy || !snapshot?.options?.length || live.length < 1} onClick={doPublish}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{record.status === 'DRAFT' ? t('cmp.publish') : t('cmp.republish')}
            </Button>
          </div>
        </div>
        {live.length >= MAX_OPTIONS && <p className="text-micro text-muted-foreground">{t('cmp.maxOptions')}</p>}
      </DialogContent>
    </Dialog>
  );
}
