import React, { useMemo, useState } from 'react';
import { Ship, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEST_AREAS, MODES, REGIONS, TERMS, calcLandedCost, fmtWon } from '@/lib/landedCost';
import useLogisticsRates from '@/components/landedcost/useLogisticsRates';
import LandedCostResult from '@/components/landedcost/LandedCostResult';

// 견적(Quotation)에 저장된 운송 방식 값 ↔ 계산 엔진 값
const MODE_FROM_QUOTE = { SEA_FCL_20: 'SEA_FCL20', SEA_FCL_40: 'SEA_FCL40' };
const MODE_TO_QUOTE = { SEA_FCL20: 'SEA_FCL_20', SEA_FCL40: 'SEA_FCL_40' };
const QUOTE_TERMS = TERMS.filter((t) => t.value !== 'FCA'); // 견적 엔티티 enum 에 FCA 가 없다

const Pick = ({ value, onChange, options }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
    <SelectContent className="max-w-[420px]">{options.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
  </Select>
);

// 견적 작성 중 물류비 추정. 공장과의 거래 조건 기준으로 "구매자(이지스·고객사)가 따로 내는 물류비"를 계산해 적용한다.
export default function LogisticsEstimator({ cargo, onCargoChange, cargoValueUsd = 0, onApply }) {
  const [includeDutyVat, setIncludeDutyVat] = useState(false);
  const [region, setRegion] = useState('SOUTH');
  const [destArea, setDestArea] = useState('CAPITAL');
  const [open, setOpen] = useState(false);
  const { rates, usdKrw } = useLogisticsRates();
  const fx = Number(usdKrw) || 1400;
  const set = (k, v) => onCargoChange({ ...cargo, [k]: v });
  const mode = MODE_FROM_QUOTE[cargo.shipping_mode] || cargo.shipping_mode || 'SEA_LCL';

  const result = useMemo(() => calcLandedCost({
    mode, term: cargo.shipping_term || 'FOB', region, destArea,
    cartons: cargo.cargo_quantity || 1, lengthCm: cargo.cargo_length_cm, widthCm: cargo.cargo_width_cm, heightCm: cargo.cargo_height_cm, kgPerCarton: cargo.cargo_weight_kg,
    goodsValue: cargoValueUsd, goodsCurrency: 'USD', usdKrw: fx,
  }, rates), [cargo, mode, region, destArea, cargoValueUsd, fx, rates]);

  const applied = result.lines.filter((l) => l.payer === 'BUYER' && (includeDutyVat || !['DUTY', 'VAT'].includes(l.code)));
  const appliedKrw = applied.reduce((s, l) => s + l.amount, 0);
  const usdTotal = Math.round(appliedKrw / fx);

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Ship className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold">물류비 자동 추정 (중국 → 한국)</p>
        <a href="/logistics-rates" className="ml-auto text-[10px] text-primary hover:underline">요율 관리</a>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><Label className="text-[10px]">운송 방식</Label><Pick value={mode} onChange={(v) => set('shipping_mode', MODE_TO_QUOTE[v] || v)} options={MODES} /></div>
        <div><Label className="text-[10px]">공장과의 거래 조건</Label><Pick value={cargo.shipping_term || 'FOB'} onChange={(v) => set('shipping_term', v)} options={QUOTE_TERMS} /></div>
        <div><Label className="text-[10px]">출발 지역</Label><Pick value={region} onChange={setRegion} options={REGIONS} /></div>
        <div><Label className="text-[10px]">도착 지역</Label><Pick value={destArea} onChange={setDestArea} options={DEST_AREAS} /></div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[['cargo_length_cm', '가로(cm)'], ['cargo_width_cm', '세로(cm)'], ['cargo_height_cm', '높이(cm)'], ['cargo_weight_kg', '박스당 kg'], ['cargo_quantity', '박스 수']].map(([k, label]) => (
          <div key={k}><Label className="text-[10px]">{label}</Label><Input type="number" className="h-8 text-xs" value={cargo[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></div>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[11px]">
        <input type="checkbox" checked={includeDutyVat} onChange={(e) => setIncludeDutyVat(e.target.checked)} />
        관세(8%)·부가세(10%)까지 물류비에 포함
      </label>

      <div className="rounded-lg border bg-background p-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">{result.basis.text}</span>
          <span className="text-base font-extrabold text-primary">${usdTotal.toLocaleString()} <span className="text-xs font-semibold text-muted-foreground">({fmtWon(appliedKrw)})</span></span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {result.input.term} 조건에서 구매자가 따로 내는 물류비{includeDutyVat ? '·세금' : ''} · 환율 {fx.toLocaleString('ko-KR')}원/$ · 실제 청구서 기준 요율 {Math.round(result.totals.verifiedShare * 100)}%
        </p>
        <button type="button" className="mt-1 text-[11px] font-semibold text-primary" onClick={() => setOpen((o) => !o)}>{open ? '자세히 닫기' : '구간별 내역·안내 문구 보기'}</button>
        {open && <div className="mt-3"><LandedCostResult result={result} /></div>}
      </div>

      {onApply && (
        <div className="flex justify-end">
          <Button type="button" size="sm" className="h-7 gap-1 text-xs" onClick={() => onApply(usdTotal, {
            ...result,
            cbm: result.cbm,
            chargeableKg: Math.round(result.basis.kg ?? result.kg),
            lines: applied.map((l) => ({ label: `${l.segment}. ${l.label}`, amount: Math.round(l.amount / fx) })),
          })}>
            <Sparkles className="h-3 w-3" />물류비에 적용
          </Button>
        </div>
      )}
    </div>
  );
}
