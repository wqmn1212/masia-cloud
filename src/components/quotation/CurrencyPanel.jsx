import React from 'react';

const money = (value, symbol, digits) => value == null ? '—' : `${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export default function CurrencyPanel({ usd, usdToKrw, usdToCny, legacyCny, legacyCnyToKrw }) {
  const legacy = legacyCny !== undefined;
  const usdAmount = legacy ? (usdToKrw > 0 && legacyCnyToKrw > 0 ? legacyCny * legacyCnyToKrw / usdToKrw : null) : usd;
  const cnyAmount = legacy ? legacyCny : usdToCny > 0 && usdAmount != null ? usdAmount * usdToCny : null;
  const krwAmount = usdAmount != null && usdToKrw > 0 ? usdAmount * usdToKrw : null;
  return <div className="space-y-1">
    <div className="grid grid-cols-3 gap-2 mt-2">
      <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-center"><p className="text-[10px] text-primary">USD {legacy ? '참고' : '거래 기준'}</p><p className="text-sm font-bold text-primary">{money(usdAmount, '$', 2)}</p></div>
      <div className="rounded-lg bg-muted border p-2 text-center"><p className="text-[10px] text-muted-foreground">CNY {legacy ? '기존 기준' : '참고'}</p><p className="text-sm font-semibold">{money(cnyAmount, '¥', 2)}</p></div>
      <div className="rounded-lg bg-muted border p-2 text-center"><p className="text-[10px] text-muted-foreground">KRW 참고</p><p className="text-sm font-semibold">{money(krwAmount, '₩', 0)}</p></div>
    </div>
    {legacy && <p className="text-[10px] text-muted-foreground">기존 CNY 견적입니다. 수정 저장 전까지 기존 금액을 보존합니다.</p>}
  </div>;
}