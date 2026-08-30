import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const NumField = ({ label, value, onChange, suffix }) => (
  <div className="space-y-1">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-xs text-right"
      />
      {suffix && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{suffix}</span>}
    </div>
  </div>
);

/** 가견적 계수 수정 패널 */
export default function CostModelEditor({ model, onChange }) {
  const set = (patch) => onChange({ ...model, ...patch });
  const setMachine = (key, v) => set({ machine_rate_per_hour: { ...model.machine_rate_per_hour, [key]: v } });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <NumField label="기본 재료 단가" value={model.default_material_price_per_kg}
        onChange={(v) => set({ default_material_price_per_kg: v })} suffix="CNY/kg" />
      <NumField label="스크랩률" value={model.scrap_rate_percent}
        onChange={(v) => set({ scrap_rate_percent: v })} suffix="%" />
      <NumField label="소형기 시간당" value={model.machine_rate_per_hour.SMALL}
        onChange={(v) => setMachine('SMALL', v)} suffix="CNY/h" />
      <NumField label="중형기 시간당" value={model.machine_rate_per_hour.MEDIUM}
        onChange={(v) => setMachine('MEDIUM', v)} suffix="CNY/h" />
      <NumField label="금형 기본비" value={model.mold_base_cost}
        onChange={(v) => set({ mold_base_cost: v })} suffix="CNY" />
      <NumField label="캐비티당 금형비" value={model.mold_cost_per_cavity}
        onChange={(v) => set({ mold_cost_per_cavity: v })} suffix="CNY" />
      <NumField label="투영면적당 금형비" value={model.mold_cost_per_cm2}
        onChange={(v) => set({ mold_cost_per_cm2: v })} suffix="CNY/cm²" />
      <NumField label="인서트 단가" value={model.insert_cost_each}
        onChange={(v) => set({ insert_cost_each: v })} suffix="CNY/개" />
    </div>
  );
}