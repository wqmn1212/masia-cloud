import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney, CURRENCY_DIGITS, CURRENCY_SYMBOL } from '@/components/quotation/quoteCurrency';

export default function ManualTotalField({ calc, value, reason, onChange }) {
  const cur = calc.currency;
  const step = 1 / 10 ** CURRENCY_DIGITS[cur];
  const active = Number(value) > 0;
  return (
    <div className="rounded-lg border border-dashed p-2.5 space-y-2 bg-background">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-xs font-semibold">최종 금액 직접 입력 (예외용)</Label>
        <span className="text-[11px] text-muted-foreground">자동 계산 {formatMoney(calc.autoTotal, cur)}</span>
      </div>
      <div className="grid sm:grid-cols-[180px_1fr] gap-2">
        <Input type="number" min="0" step={step} value={value ?? ''} onChange={(e) => onChange('manual_total', e.target.value)}
          placeholder={`${CURRENCY_SYMBOL[cur]} 비우면 자동 계산`} className="h-8 text-xs" />
        <Input value={reason || ''} onChange={(e) => onChange('manual_reason', e.target.value)} disabled={!active}
          placeholder={active ? '수정 사유 (필수)' : '금액을 입력하면 사유를 적을 수 있습니다'} className="h-8 text-xs" />
      </div>
      {active && (
        <p className="text-[11px] text-muted-foreground">
          적용 금액 <strong className="text-foreground">{formatMoney(calc.manual, cur)}</strong>
          {calc.impliedMargin != null && <> · 필요한 평균 마진 <strong className="text-accent">{calc.impliedMargin.toFixed(2)}%</strong></>}
          {!String(reason || '').trim() && <span className="text-destructive"> · 사유를 입력해야 저장됩니다</span>}
        </p>
      )}
    </div>
  );
}