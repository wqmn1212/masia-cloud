import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import { DEFAULT_COST_MODEL, estimateBom } from '@/lib/bomEstimate';
import CostModelEditor from '@/components/bom/CostModelEditor';

const cny = (v) => `¥${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function BomEstimatePanel({ parts, unconfirmedCount }) {
  const [model, setModel] = useState(DEFAULT_COST_MODEL);
  const [orderQty, setOrderQty] = useState(1000);
  const [showCoeffs, setShowCoeffs] = useState(false);

  const result = useMemo(() => estimateBom(parts, orderQty, model), [parts, orderQty, model]);

  return (
    <div className="border rounded-xl bg-card">
      <div className="p-4 flex flex-wrap items-end gap-4 border-b">
        <div className="flex items-center gap-2 mr-auto">
          <Calculator className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">사출 가견적 (공장 원가 기준 · CNY)</h2>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">생산 수량 (세트)</Label>
          <Input
            type="number"
            min={1}
            value={orderQty}
            onChange={(e) => setOrderQty(Number(e.target.value))}
            className="h-8 text-xs w-[110px] text-right"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCoeffs((v) => !v)}>
          계수 수정 {showCoeffs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {showCoeffs && (
        <div className="p-4 border-b bg-muted/30">
          <CostModelEditor model={model} onChange={setModel} />
        </div>
      )}

      {unconfirmedCount > 0 && (
        <div className="px-4 py-2.5 border-b bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          재질 미확정 {unconfirmedCount}개 — 아래 금액은 추정 재질 기준 참고값입니다
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0">
        {[
          { label: '세트당 사출 원가', value: cny(result.set_cost) },
          { label: '금형비 합계 (1회성)', value: cny(result.mold_total) },
          { label: `양산 원가 (${orderQty.toLocaleString()}세트)`, value: cny(result.production_total) },
          { label: '금형 상각 포함 세트당', value: cny(result.amortized_set_cost) },
        ].map((s) => (
          <div key={s.label} className="p-4">
            <p className="text-[11px] text-muted-foreground mb-1">{s.label}</p>
            <p className="text-base font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto border-t">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="p-2 text-left font-semibold">부품</th>
              <th className="p-2 text-right font-semibold">재료비</th>
              <th className="p-2 text-right font-semibold">가공비</th>
              <th className="p-2 text-right font-semibold">후처리</th>
              <th className="p-2 text-right font-semibold">1EA 단가</th>
              <th className="p-2 text-right font-semibold">세트당</th>
              <th className="p-2 text-right font-semibold">금형비</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2 truncate max-w-[200px]">
                  {l.part.display_name || l.part.part_name}
                  {l.skipped && <span className="ml-1.5 text-[10px] text-muted-foreground">구매품</span>}
                </td>
                <td className="p-2 text-right tabular-nums">{l.skipped ? '-' : cny(l.material_cost)}</td>
                <td className="p-2 text-right tabular-nums">{l.skipped ? '-' : cny(l.machine_cost)}</td>
                <td className="p-2 text-right tabular-nums">{l.skipped ? '-' : cny(l.finish_cost)}</td>
                <td className="p-2 text-right tabular-nums font-medium">{l.skipped ? '-' : cny(l.unit_cost)}</td>
                <td className="p-2 text-right tabular-nums">{l.skipped ? '-' : cny(l.per_set_cost)}</td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">{l.skipped ? '-' : cny(l.mold_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}