import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ManualExchangeRates({ values, onChange, compact = false }) {
  const inputClass = compact ? 'h-7 text-xs' : '';
  return (
    <div className="rounded-xl border bg-background p-3 space-y-2">
      <div>
        <p className="text-xs font-semibold">견적 고정 환율 직접 입력</p>
        <p className="text-[10px] text-muted-foreground">공장 CNY 금액을 직접 USD/CNY 환율로 달러화한 뒤, USD/KRW 환율로 원화 참고가를 계산합니다.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label><Label className="text-[10px]">환율 기준일 *</Label><Input required type="date" value={values.exchange_rate_date || ''} onChange={(e) => onChange('exchange_rate_date', e.target.value)} className={inputClass} /></label>
        <label><Label className="text-[10px]">1 USD = ? CNY (직접환율) *</Label><Input required min="0.000001" type="number" step="any" value={values.exchange_rate_usd_cny || ''} onChange={(e) => onChange('exchange_rate_usd_cny', e.target.value)} placeholder="직접 입력" className={inputClass} /></label>
        <label><Label className="text-[10px]">1 USD = ? KRW *</Label><Input required min="0.000001" type="number" step="any" value={values.exchange_rate_usd || ''} onChange={(e) => onChange('exchange_rate_usd', e.target.value)} placeholder="직접 입력" className={inputClass} /></label>
      </div>
    </div>
  );
}