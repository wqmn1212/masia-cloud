import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Crown, Minus, Plus } from 'lucide-react';

const BASE_ACTIVITY_FEE = 50000;

export default function Step3HQShare({ data, onChange, totalMarginRmb }) {
  const adjustment = Number(data.adjustment_rmb) || 0;
  const netMargin = totalMarginRmb - BASE_ACTIVITY_FEE + adjustment;
  const hqShare = netMargin / 2;

  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
        <h3 className="font-semibold text-sm">에이전트 → 본사 50:50 분배 단계</h3>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center py-2 border-b border-border text-sm">
          <span className="text-muted-foreground">총 마진 풀</span>
          <span className="font-mono font-semibold">¥{totalMarginRmb.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Minus className="w-3 h-3 text-destructive" /> 에이전트 고정비 차감
          </span>
          <span className="font-mono font-semibold text-destructive">− ¥{BASE_ACTIVITY_FEE.toLocaleString()}</span>
        </div>

        <div className="space-y-2 py-2 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Plus className="w-3 h-3 text-primary" /> 정산 조율 (±)
            </span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                value={data.adjustment_rmb || ''}
                onChange={(e) => handleChange('adjustment_rmb', Number(e.target.value))}
                placeholder="0"
                className="w-32 h-7 text-xs font-mono text-right"
              />
              <span className="text-xs text-muted-foreground">RMB</span>
            </div>
          </div>
          <div>
            <Input
              value={data.adjustment_note || ''}
              onChange={(e) => handleChange('adjustment_note', e.target.value)}
              placeholder="예: 3월 활동비용 5,000위엔 절감 후 조율"
              className="h-7 text-xs"
            />
          </div>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-border text-sm">
          <span className="text-muted-foreground">순 마진</span>
          <span className={`font-mono font-semibold ${netMargin >= 0 ? '' : 'text-destructive'}`}>
            ¥{netMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5" />
          <span className="text-sm font-bold">본사 최종 수령액 (50%)</span>
        </div>
        <p className={`text-3xl font-extrabold font-mono ${hqShare < 0 ? 'text-red-300' : ''}`}>
          ¥{hqShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-primary-foreground/60 mt-1">= (총마진 − 고정비 ± 조율) ÷ 2</p>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">정산 전달일</Label>
        <Input
          type="date"
          value={data.payout_date || ''}
          onChange={(e) => handleChange('payout_date', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">비고 #1</Label>
          <Textarea
            value={data.note_1 || ''}
            onChange={(e) => handleChange('note_1', e.target.value)}
            rows={2}
            className="text-xs resize-none"
            placeholder="정산 특이사항"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">비고 #2 (이월)</Label>
          <Textarea
            value={data.note_2 || ''}
            onChange={(e) => handleChange('note_2', e.target.value)}
            rows={2}
            className="text-xs resize-none"
            placeholder="이월 정산 내용"
          />
        </div>
      </div>
    </div>
  );
}