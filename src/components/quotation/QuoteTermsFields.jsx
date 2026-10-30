import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

// 견적 조건: 결제(또는 '계약 시 확정'), 납기(영업일 또는 일), 유효기간, 주요 사양표, 내부 메모.
// 결제·납기·유효기간은 PDF '계약 조건'에, 주요 사양은 '주요 사양' 표로 들어간다. 내부 메모는 고객 PDF 에 나오지 않는다.
export default function QuoteTermsFields({ form, setForm }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const specs = form.spec_table || [];
  const setSpec = (i, k, v) => set('spec_table', specs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const pending = !!form.payment_terms_pending;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label className="text-xs">선금 (%)</Label>
          <Input type="number" min="0" max="100" value={form.advance_payment_percent} disabled={pending} onChange={(e) => set('advance_payment_percent', e.target.value)} className="h-8 text-xs" placeholder="예: 30" />
        </div>
        <div>
          <Label className="text-xs">잔금 (%)</Label>
          <Input type="number" min="0" max="100" value={form.balance_payment_percent} disabled={pending} onChange={(e) => set('balance_payment_percent', e.target.value)} className="h-8 text-xs" placeholder="예: 70" />
        </div>
        <div>
          <Label className="text-xs">납기 (선금 후 영업일)</Label>
          <Input type="number" min="0" value={form.lead_time_business_days ?? ''} onChange={(e) => set('lead_time_business_days', e.target.value)} className="h-8 text-xs" placeholder="예: 20" />
        </div>
        <div>
          <Label className="text-xs">견적 유효기간 (일)</Label>
          <Input type="number" min="1" value={form.validity_days ?? ''} onChange={(e) => set('validity_days', e.target.value)} className="h-8 text-xs" placeholder="30" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={pending} onChange={(e) => set('payment_terms_pending', e.target.checked)} />결제 조건은 계약 시 확정 <span className="text-muted-foreground">(PDF 에 선금·잔금 % 대신 표시)</span></label>
        {!Number(form.lead_time_business_days) && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">영업일 대신 출하일 (발주 후 일)
            <Input type="number" min="0" value={form.shipping_days} onChange={(e) => set('shipping_days', e.target.value)} className="h-7 w-20 text-xs" placeholder="예: 45" />
          </label>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">주요 사양 (PDF 에 표로 표시)</Label>
          <Button type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" onClick={() => set('spec_table', [...specs, { label: '', value: '' }])}><Plus className="h-3 w-3" />사양 추가</Button>
        </div>
        {specs.length > 0 && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {specs.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_24px] items-center gap-1.5">
                <Input value={r.label || ''} onChange={(e) => setSpec(i, 'label', e.target.value)} placeholder="항목 (예: 최대 압력)" className="h-7 text-xs" title={r.label_cn || undefined} />
                <Input value={r.value || ''} onChange={(e) => setSpec(i, 'value', e.target.value)} placeholder="값 (예: 60 kN)" className="h-7 text-xs" />
                <button type="button" aria-label="사양 삭제" className="justify-self-center text-muted-foreground hover:text-destructive" onClick={() => set('spec_table', specs.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs">내부 메모 (고객 PDF 에 나오지 않음)</Label>
        <Textarea value={form.internal_notes || ''} onChange={(e) => set('internal_notes', e.target.value)} rows={2} className="text-xs" placeholder="공장 견적 원문 조건, 공장 견적일 등" />
      </div>
    </div>
  );
}
