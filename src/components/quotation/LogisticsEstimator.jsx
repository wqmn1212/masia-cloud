import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ship, Sparkles } from 'lucide-react';
import { SHIP_MODES, SHIP_TERMS, estimateLogistics } from '@/lib/logisticsEstimator';
import LogisticsBreakdown from './LogisticsBreakdown';

// 과거 견적 데이터로 LCL 실측 CBM 단가 평균 산출 (USD/CBM)
function useHistoricalPerCbm() {
  const { data } = useQuery({
    queryKey: ['logistics-history-per-cbm'],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const rows = await base44.entities.Quotation.list('-created_date', 100);
      const samples = rows
        .filter(q => (q.cargo_cbm || 0) > 0 && (q.logistics_cost || 0) > 0 && q.exchange_rate_usd > 0 && q.exchange_rate_krw > 0)
        .map(q => (q.logistics_cost * q.exchange_rate_krw / q.exchange_rate_usd) / q.cargo_cbm);
      if (samples.length === 0) return { avg: null, count: 0 };
      return { avg: Math.round(samples.reduce((s, v) => s + v, 0) / samples.length), count: samples.length };
    },
  });
  return data || { avg: null, count: 0 };
}

export default function LogisticsEstimator({ cargo, onCargoChange, cargoValueUsd = 0, onApply }) {
  const [includeDutyVat, setIncludeDutyVat] = useState(false);
  const history = useHistoricalPerCbm();

  const set = (k, v) => onCargoChange({ ...cargo, [k]: v });

  const result = useMemo(() => estimateLogistics({
    mode: cargo.shipping_mode || 'SEA_LCL',
    term: cargo.shipping_term || 'FOB',
    lengthCm: cargo.cargo_length_cm,
    widthCm: cargo.cargo_width_cm,
    heightCm: cargo.cargo_height_cm,
    weightKg: cargo.cargo_weight_kg,
    quantity: cargo.cargo_quantity || 1,
    cargoValueUsd,
    includeDutyVat,
    historicalPerCbm: history.avg,
  }), [cargo, cargoValueUsd, includeDutyVat, history.avg]);

  return (
    <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Ship className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold">물류비 자동 추정 (중국 → 한국)</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">운송 방식</Label>
          <Select value={cargo.shipping_mode || 'SEA_LCL'} onValueChange={v => set('shipping_mode', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SHIP_MODES.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px]">운송 조건 (FOB · CIF · DDP/D2D 등)</Label>
          <Select value={cargo.shipping_term || 'FOB'} onValueChange={v => set('shipping_term', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-w-[420px]">
              {SHIP_TERMS.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div>
          <Label className="text-[10px]">가로(cm)</Label>
          <Input type="number" className="h-8 text-xs" value={cargo.cargo_length_cm ?? ''} onChange={e => set('cargo_length_cm', e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px]">세로(cm)</Label>
          <Input type="number" className="h-8 text-xs" value={cargo.cargo_width_cm ?? ''} onChange={e => set('cargo_width_cm', e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px]">높이(cm)</Label>
          <Input type="number" className="h-8 text-xs" value={cargo.cargo_height_cm ?? ''} onChange={e => set('cargo_height_cm', e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px]">중량(kg)</Label>
          <Input type="number" className="h-8 text-xs" value={cargo.cargo_weight_kg ?? ''} onChange={e => set('cargo_weight_kg', e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px]">수량</Label>
          <Input type="number" className="h-8 text-xs" value={cargo.cargo_quantity ?? 1} onChange={e => set('cargo_quantity', e.target.value)} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">포장(팔레트 포함) 기준 사이즈를 입력하세요 — 항공/특송은 실중량과 부피중량 중 큰 값으로 과금됩니다.</p>

      <label className="flex items-center gap-2 text-[11px] cursor-pointer">
        <input type="checkbox" checked={includeDutyVat} onChange={e => setIncludeDutyVat(e.target.checked)} />
        관세(8% 가정)·부가세(10%) 포함해서 계산 (DDP/D2D 조건에서만 반영)
      </label>

      <LogisticsBreakdown result={result} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">
          {history.count > 0
            ? `과거 견적 ${history.count}건 실측 평균 $${history.avg?.toLocaleString()}/CBM 반영`
            : '시장 평균 단가 기준 근사치 — 실제 포워더 견적으로 보정하세요'}
        </p>
        {onApply && (
          <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={() => onApply(result.total, result)}>
            <Sparkles className="w-3 h-3" />물류비에 적용
          </Button>
        )}
      </div>
    </div>
  );
}