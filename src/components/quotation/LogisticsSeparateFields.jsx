import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMoney } from '@/components/quotation/quoteCurrency';

// 물류비를 견적 합계에 넣지 않고 따로 보여 줄 때의 출발지·도착지·금액 표시
export default function LogisticsSeparateFields({ form, setForm, logisticsTotal, currency }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <input type="checkbox" checked={!!form.logistics_separate} onChange={(e) => set('logistics_separate', e.target.checked)} />
        물류비 별도 표시 (견적 합계에 포함하지 않음)
      </label>
      {form.logistics_separate && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">출발지 (직접 입력)</Label>
              <Input className="h-8 text-xs" value={form.logistics_origin || ''} onChange={(e) => set('logistics_origin', e.target.value)} placeholder="예: 광동성 동관 공장" />
            </div>
            <div>
              <Label className="text-[10px]">도착지 (직접 입력)</Label>
              <Input className="h-8 text-xs" value={form.logistics_destination || ''} onChange={(e) => set('logistics_destination', e.target.value)} placeholder="예: 경기도 화성 창고" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            금액은 위 '물류비' 칸에 직접 입력하거나 아래 자동 추정으로 적용하세요. 별도 물류비:{' '}
            <strong className="text-foreground">{logisticsTotal ? formatMoney(logisticsTotal, currency) : '-'}</strong>
          </p>
        </>
      )}
    </div>
  );
}