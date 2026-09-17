import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export default function ScheduleFields({ form, setForm, disabled }) {
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const calculated = () => {
    if (!form.advance_paid_date || form.delivery_business_days === '' || form.delivery_business_days == null) return '';
    const days = Number(form.delivery_business_days), date = new Date(form.advance_paid_date + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || !Number.isInteger(days) || days < 0 || days > 3650) return '';
    for (let n = days; n > 0;) { date.setUTCDate(date.getUTCDate() + 1); if (date.getUTCDay() !== 0) n--; }
    return date.toISOString().slice(0, 10);
  };
  return <fieldset disabled={disabled} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div><Label htmlFor="quote-deadline">견적 발송 기한</Label><Input id="quote-deadline" type="date" value={form.quote_deadline} onChange={e => set('quote_deadline', e.target.value)} /></div>
    <div><Label htmlFor="advance-paid">선금 입금 기준일</Label><Input id="advance-paid" type="date" value={form.advance_paid_date} onChange={e => set('advance_paid_date', e.target.value)} /></div>
    <div><Label htmlFor="delivery-days">납품 소요일 (일요일 제외)</Label><Input id="delivery-days" type="number" required min="0" max="3650" step="1" value={form.delivery_business_days} onChange={e => set('delivery_business_days', e.target.value)} /></div>
    <div><Label htmlFor="delivery-date">예정 납품일</Label><Input id="delivery-date" type="date" readOnly={form.delivery_date_mode !== 'MANUAL'} value={form.delivery_date_mode === 'MANUAL' ? form.delivery_date : calculated()} onChange={e => set('delivery_date', e.target.value)} /></div>
    <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.delivery_date_mode === 'MANUAL'} onChange={e => setForm(f => ({ ...f, delivery_date_mode: e.target.checked ? 'MANUAL' : 'AUTO', delivery_date: e.target.checked ? calculated() : f.delivery_date }))} />납품일 직접 조정 (공휴일·협의 일정 반영)</label>
    <p className="sm:col-span-2 text-xs text-muted-foreground">입금일 다음 날부터 계산하며 토요일은 포함합니다. 예: 2026-06-17 + 5일 = 2026-06-23. 기준일을 수정해도 입금 확인 상태는 바뀌지 않습니다.</p>
  </fieldset>;
}