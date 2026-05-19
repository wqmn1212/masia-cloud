import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calculator, TrendingUp } from 'lucide-react';

export default function MarginCalculator({
  factoryTotal,
  logisticsCost,
  feeType,
  feeValue,
  onLogisticsChange,
  onFeeTypeChange,
  onFeeValueChange,
  finalPrice,
}) {
  const baseCost = (factoryTotal || 0) + (logisticsCost || 0);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          마진 연산기
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">공장 원가</p>
            <p className="text-lg font-bold">¥{(factoryTotal || 0).toLocaleString()}</p>
          </div>
          <div>
            <Label className="text-xs">물류비 (¥)</Label>
            <Input
              type="number"
              step="0.01"
              value={logisticsCost || ''}
              onChange={(e) => onLogisticsChange(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-secondary">
          <p className="text-xs text-muted-foreground">전체 비용 (원가 + 물류)</p>
          <p className="text-xl font-bold text-primary">¥{baseCost.toLocaleString()}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">마시아 수수료 방식</Label>
          <RadioGroup value={feeType} onValueChange={onFeeTypeChange} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="PERCENT" id="pct" />
              <Label htmlFor="pct" className="text-sm cursor-pointer">정률 (%)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="FIXED" id="fixed" />
              <Label htmlFor="fixed" className="text-sm cursor-pointer">정액 (¥)</Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <Label className="text-xs">수수료 값 {feeType === 'PERCENT' ? '(%)' : '(¥)'}</Label>
          <Input
            type="number"
            step="0.01"
            value={feeValue || ''}
            onChange={(e) => onFeeValueChange(Number(e.target.value))}
            placeholder="0"
          />
        </div>

        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary">최종 고객사 제안가</p>
          </div>
          <p className="text-3xl font-extrabold text-primary">
            ¥{(finalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}