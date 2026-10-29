import React from 'react';
import { TrendingUp } from 'lucide-react';
import { reorderForecast } from '@/lib/reorderForecast';
import { fmtWon } from '@/lib/orderCost';

const fmt = (d) => (d ? d.replaceAll('-', '.') : '');
// '5,000개 (지난번 3,000개)' 같은 글에서 첫 숫자를 수량으로 읽는다
export const parseQty = (text) => { const m = String(text || '').replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };

// 재주문 창의 예상치: 지난 확정 도착 원가와 지금 환율로 만든 개당·합계 범위, 지난 발주→도착 일수로 만든 도착 예정.
// 견적이 아니라 예상이라는 문구를 항상 붙인다.
export default function ReorderForecastPanel({ input, quantityText }) {
  const qty = parseQty(quantityText);
  if (!input || !qty) return null;
  const f = reorderForecast({ ...input, quantity: qty });
  if (!f) return null;
  const unit = input.unit || '개';
  return (
    <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-label">
      <p className="flex items-center gap-1.5 font-semibold"><TrendingUp className="h-4 w-4 text-primary" />예상치 · {qty.toLocaleString('ko-KR')}{unit}</p>
      <p>{unit}당 한국 도착 원가 <b className="tabular-nums">{fmtWon(f.per_unit.low)} ~ {fmtWon(f.per_unit.high)}</b></p>
      <p className="text-muted-foreground">합계 약 <span className="tabular-nums">{fmtWon(f.total.low)} ~ {fmtWon(f.total.high)}</span> (부가세 제외)</p>
      {f.eta && <p>도착 예상 <b className="tabular-nums">{fmt(f.eta.low)} ~ {fmt(f.eta.high)}</b> <span className="text-caption text-muted-foreground">(오늘 발주 기준, 지난 {f.lead.orders}건 평균 {f.lead.days}일)</span></p>}
      {f.holiday && <p className="text-caption text-warning-text">{f.holiday.name} 공장 휴무({fmt(f.holiday.factory_start)}~{fmt(f.holiday.factory_end)})가 걸려 도착이 늦어질 수 있습니다.{f.holiday.order_cutoff_date ? ` 휴무 전 발주 마감 ${fmt(f.holiday.order_cutoff_date)}.` : ''}</p>}
      <ul className="list-disc pl-4 text-caption text-muted-foreground">
        <li>{fmt(f.basis.order_date)} 주문({f.basis.units.toLocaleString('ko-KR')}{unit}, {unit}당 {fmtWon(f.basis.per_unit_krw)})을 기준으로{f.fx ? ` 상품 대금을 지금 환율(1${f.fx.currency} ${f.fx.then.toLocaleString('ko-KR')}원 → ${f.fx.now.toLocaleString('ko-KR')}원)로 다시 계산했습니다` : ' 계산했습니다'}.</li>
        {f.reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      <p className="text-caption font-medium">견적이 아니라 예상입니다. 정확한 단가와 납기는 접수 후 담당자가 새 견적으로 안내드립니다.</p>
    </div>
  );
}
