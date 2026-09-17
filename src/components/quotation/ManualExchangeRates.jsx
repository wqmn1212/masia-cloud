import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ManualExchangeRates({ values, onChange, compact = false }) {
  const usdKrw = Number(values.exchange_rate_usd) || 0;
  const cnyKrw = Number(values.exchange_rate_krw) || 0;
  const inputClass = compact ? 'h-7 text-xs' : '';
  return <div className="rounded-xl border bg-background p-3 space-y-2"><div><p className="text-xs font-semibold">견적 고정 환율 직접 입력</p><p className="text-[10px] text-muted-foreground">외부 환율 조회 없이 견적서마다 직접 입력하며, 저장된 환율은 해당 견적에 고정됩니다.</p></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><label><Label className="text-[10px]">환율 기준일 *</Label><Input required type="date" value={values.exchange_rate_date || ''} onChange={e => onChange('exchange_rate_date', e.target.value)} className={inputClass} /></label><label><Label className="text-[10px]">1 USD = ? KRW *</Label><Input required min="0.01" type="number" step="0.01" value={values.exchange_rate_usd || ''} onChange={e => onChange('exchange_rate_usd', e.target.value)} placeholder="직접 입력" className={inputClass} /></label><label><Label className="text-[10px]">1 CNY(RMB) = ? KRW *</Label><Input required min="0.01" type="number" step="0.01" value={values.exchange_rate_krw || ''} onChange={e => onChange('exchange_rate_krw', e.target.value)} placeholder="직접 입력" className={inputClass} /></label></div><p className="text-[10px] text-muted-foreground">입력 환율 기준 1 USD = {usdKrw > 0 && cnyKrw > 0 ? `${(usdKrw / cnyKrw).toFixed(4)} CNY` : '—'}</p></div>;
}