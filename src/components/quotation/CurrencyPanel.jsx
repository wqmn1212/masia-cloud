import React from 'react';

const money = (value, symbol, digits) => value == null ? '—' : `${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const ON = 'rounded-lg bg-primary/10 border border-primary/20 p-2 text-center';
const OFF = 'rounded-lg bg-muted border p-2 text-center';

export default function CurrencyPanel({ usd, usdToKrw, usdToCny, legacyCny, legacyCnyToKrw, selected }) {
  const legacy = legacyCny !== undefined;
  const pick = selected || (legacy ? 'CNY' : 'USD');
  const usdAmount = legacy ? (usdToKrw > 0 && legacyCnyToKrw > 0 ? legacyCny * legacyCnyToKrw / usdToKrw : null) : usd;
  const cnyAmount = legacy ? legacyCny : usdToCny > 0 && usdAmount != null ? usdAmount * usdToCny : null;
  const krwAmount = usdAmount != null && usdToKrw > 0 ? usdAmount * usdToKrw : null;
  const cells = [
    ['USD', usdAmount, '$', 2],
    ['CNY', cnyAmount, '¥', 2],
    ['KRW', krwAmount, '₩', 0],
  ];
  return <div className="space-y-1">
    <div className="grid grid-cols-3 gap-2 mt-2">
      {cells.map(([cur, v, sym, d]) => (
        <div key={cur} className={pick === cur ? ON : OFF}>
          <p className={`text-[10px] ${pick === cur ? 'text-primary' : 'text-muted-foreground'}`}>{cur} {pick === cur ? '최종 표기' : '참고'}</p>
          <p className={`text-sm ${pick === cur ? 'font-bold text-primary' : 'font-semibold'}`}>{money(v, sym, d)}</p>
        </div>
      ))}
    </div>
    {legacy && <p className="text-[10px] text-muted-foreground">기존 CNY 견적입니다. 수정 저장 전까지 기존 금액을 보존합니다.</p>}
  </div>;
}