import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight } from 'lucide-react';

export default function Step1DirectPayment({ data, onChange }) {
  const clientToFactory = Number(data.client_to_factory_usd) || 0;
  const factoryBase = Number(data.factory_base_cost_usd) || 0;
  const expectedKickback = clientToFactory - factoryBase;

  const handleChange = (field, value) => {
    const num = Number(value);
    const updated = { ...data, [field]: num };
    updated.expected_kickback_usd = (Number(updated.client_to_factory_usd) || 0) - (Number(updated.factory_base_cost_usd) || 0);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-caption font-bold flex items-center justify-center">1</span>
        <h3 className="font-semibold text-body">고객 → 공장 직송금 단계</h3>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-caption text-muted-foreground">고객이 공장에 직접 송금한 금액 (USD)</Label>
          <Input
            type="number"
            step="0.01"
            value={data.client_to_factory_usd || ''}
            onChange={(e) => handleChange('client_to_factory_usd', e.target.value)}
            placeholder="0.00"
            className="font-mono"
          />
        </div>
        <div>
          <Label className="text-caption text-muted-foreground">공장 순수 기계 대금 원가 (USD)</Label>
          <Input
            type="number"
            step="0.01"
            value={data.factory_base_cost_usd || ''}
            onChange={(e) => handleChange('factory_base_cost_usd', e.target.value)}
            placeholder="0.00"
            className="font-mono"
          />
        </div>
      </div>

      <div className="p-3 rounded-xl border-2 border-warning/30 bg-warning/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-warning-text" />
            <span className="text-caption font-semibold text-warning-text">예상 마진 (공장 페이백 요청액)</span>
          </div>
          <span className={`text-xl font-extrabold font-mono ${expectedKickback >= 0 ? 'text-warning-text' : 'text-destructive'}`}>
            ${expectedKickback.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <p className="text-micro text-warning-text mt-1">= 직송금 − 원가</p>
      </div>
    </div>
  );
}