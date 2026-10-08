import React from 'react';

const n = (v, d = 2) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: d });

// 선택한 견적서들의 항목(수량·단가·통화·마진·환율) 스냅샷 표
export default function SettlementQuoteLines({ lines = [] }) {
  if (!lines.length) return null;
  return (
    <div className="overflow-x-auto border-t pt-2">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="text-left">
            <th className="py-1 pr-2">항목</th><th className="pr-2 text-right">수량</th><th className="pr-2 text-right">단가</th>
            <th className="pr-2">통화</th><th className="pr-2 text-right">마진</th><th className="pr-2 text-right">환율(USD/CNY)</th><th className="text-right">원가 USD</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t">
              <td className="py-1 pr-2 truncate max-w-[160px]">{l.option_name}</td>
              <td className="pr-2 text-right">{n(l.quantity, 0)}</td>
              <td className="pr-2 text-right">{n(l.unit_price)}</td>
              <td className="pr-2">{l.currency}</td>
              <td className="pr-2 text-right">{n(l.margin_percent, 1)}%</td>
              <td className="pr-2 text-right">{n(l.exchange_rate, 4)}</td>
              <td className="text-right">${n(l.total_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}