import React from 'react';
import { convertAmount, formatMoney, ceilToUnit } from '@/components/quotation/quoteCurrency';

const money = (value, symbol, digits) => value == null ? '—' : `${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const ON = 'rounded-lg bg-primary/10 border border-primary/20 p-2 text-center';
const OFF = 'rounded-lg bg-muted border p-2 text-center';
const CURS = ['USD', 'CNY', 'KRW'];

// total + currency: 새 규칙 견적 (견적 통화 금액 그대로, 나머지는 환산 후 올림)
export default function CurrencyPanel({ usd, usdToKrw, usdToCny, legacyCny, legacyCnyToKrw, selected, total, currency }) {
  const legacy = legacyCny !== undefined;
  const modern = total !== undefined;
  const pick = modern ? currency : selected || (legacy ? 'CNY' : 'USD');
  let cells;
  if (modern) {
    cells = CURS.map((cur) => [cur, cur === currency ? Number(total) : convertAmount(total, currency, cur, usdToKrw, usdToCny)]);
  } else {
    const usdAmount = legacy ? (usdToKrw > 0 && legacyCnyToKrw > 0 ? legacyCny * legacyCnyToKrw / usdToKrw : null) : usd;
    const cnyAmount = legacy ? legacyCny : usdToCny > 0 && usdAmount != null ? usdAmount * usdToCny : null;
    const krwAmount = usdAmount != null && usdToKrw > 0 ? usdAmount * usdToKrw : null;
    cells = [['USD', usdAmount], ['CNY', cnyAmount], ['KRW', krwAmount]];
  }
  return <div className="space-y-1">
    <div className="grid grid-cols-3 gap-2 mt-2">
      {cells.map(([cur, v]) => (
        <div key={cur} className={pick === cur ? ON : OFF}>
          <p className={`text-[10px] ${pick === cur ? 'text-primary' : 'text-muted-foreground'}`}>{cur} {pick === cur ? '최종 표기' : '참고'}</p>
          <p className={`text-sm ${pick === cur ? 'font-bold text-primary' : 'font-semibold'}`}>
            {modern ? (v == null ? '—' : formatMoney(v, cur)) : money(v == null ? null : cur === 'KRW' ? ceilToUnit(v, 'KRW') : v, cur === 'USD' ? '$' : cur === 'CNY' ? '¥' : '₩', cur === 'KRW' ? 0 : 2)}
          </p>
        </div>
      ))}
    </div>
    {legacy && <p className="text-[10px] text-muted-foreground">기존 CNY 견적입니다. 수정 저장 전까지 기존 금액을 보존합니다.</p>}
  </div>;
}