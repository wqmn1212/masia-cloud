import React from 'react';

export default function LogisticsBreakdown({ result }) {
  if (!result) return null;
  return (
    <div className="rounded-lg border bg-background p-2.5 space-y-1.5">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-muted/50 p-1.5">
          <p className="text-[10px] text-muted-foreground">부피 (CBM)</p>
          <p className="text-sm font-bold">{result.cbm.toLocaleString()}</p>
        </div>
        <div className="rounded-md bg-muted/50 p-1.5">
          <p className="text-[10px] text-muted-foreground">실중량 / 부피중량</p>
          <p className="text-sm font-bold">{result.actualKg.toLocaleString()} / {result.volumetricKg.toLocaleString()}kg</p>
        </div>
        <div className="rounded-md bg-muted/50 p-1.5">
          <p className="text-[10px] text-muted-foreground">과금중량</p>
          <p className="text-sm font-bold">{result.chargeableKg.toLocaleString()}kg</p>
        </div>
      </div>

      <div className="divide-y">
        {result.lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between py-1 text-[11px]">
            <span className="text-muted-foreground">{l.label}{l.note ? ` · ${l.note}` : ''}</span>
            <span className="font-semibold">${l.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-xs font-semibold text-primary">예상 물류비 합계</span>
        <span className="text-base font-extrabold text-primary">${result.total.toLocaleString()}</span>
      </div>
      {result.cbm > 0 && (
        <p className="text-[10px] text-muted-foreground">CBM 단가 환산 ≈ ${result.perCbm.toLocaleString()}/CBM{result.usedHistorical ? ' · 과거 데이터 평균 반영됨' : ''}</p>
      )}
    </div>
  );
}