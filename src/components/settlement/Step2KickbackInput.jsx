import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp } from 'lucide-react';

export default function Step2KickbackInput({ data, onChange }) {
  const actualKickback = Number(data.actual_kickback_rmb) || 0;
  const rate = Number(data.exchange_rate) || 0;
  const kickbackUsd = rate > 0 ? actualKickback / rate : 0;

  const handleChange = (field, value) => {
    onChange({ ...data, [field]: Number(value) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
        <h3 className="font-semibold text-sm">공장 → 에이전트 커미션 수금 단계</h3>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">실제 수금된 커미션 (RMB ¥)</Label>
          <Input
            type="number"
            step="0.01"
            value={data.actual_kickback_rmb || ''}
            onChange={(e) => handleChange('actual_kickback_rmb', e.target.value)}
            placeholder="0.00"
            className="font-mono"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">당일 환율 (1 USD = ? RMB)</Label>
          <Input
            type="number"
            step="0.0001"
            value={data.exchange_rate || ''}
            onChange={(e) => handleChange('exchange_rate', e.target.value)}
            placeholder="7.2000"
            className="font-mono"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">물류/통관 비용 (USD)</Label>
          <Input
            type="number"
            step="0.01"
            value={data.logistics_cost_usd || ''}
            onChange={(e) => handleChange('logistics_cost_usd', e.target.value)}
            placeholder="0.00"
            className="font-mono"
          />
        </div>
      </div>

      {actualKickback > 0 && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-accent">마진 풀 적립액</span>
          </div>
          <p className="text-lg font-bold font-mono mt-1">¥{actualKickback.toLocaleString()} RMB</p>
          {kickbackUsd > 0 && (
            <p className="text-xs text-muted-foreground">≈ ${kickbackUsd.toFixed(2)} USD</p>
          )}
        </div>
      )}
    </div>
  );
}