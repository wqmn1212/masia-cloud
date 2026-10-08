import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const EMPTY = { year: new Date().getFullYear() + 1, name: '', start_date: '', end_date: '', makeup_workdays: [], order_cutoff_date: '', factory_extra_days: 0, announce: false };

export default function HolidayForm({ initial, onSubmit, onCancel, busy }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [makeup, setMakeup] = useState((initial?.makeup_workdays || []).join(', '));
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    onSubmit({ ...f, year: Number(f.year), factory_extra_days: Number(f.factory_extra_days) || 0, makeup_workdays: makeup.split(/[,\s]+/).filter(Boolean) });
  };
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-4 gap-3 rounded-xl border bg-muted/20 p-4">
      <div><Label>연도</Label><Input type="number" required value={f.year} onChange={set('year')} /></div>
      <div className="sm:col-span-3"><Label>휴일명</Label><Input required value={f.name} onChange={set('name')} placeholder="춘절" /></div>
      <div><Label>공식 시작일</Label><Input type="date" required value={f.start_date} onChange={set('start_date')} /></div>
      <div><Label>공식 종료일</Label><Input type="date" required value={f.end_date} onChange={set('end_date')} /></div>
      <div><Label>공장 앞뒤 추가 휴무(일)</Label><Input type="number" min="0" value={f.factory_extra_days} onChange={set('factory_extra_days')} /></div>
      <div><Label>발주 마감일</Label><Input type="date" value={f.order_cutoff_date || ''} onChange={set('order_cutoff_date')} /></div>
      <div className="sm:col-span-3"><Label>조휴 근무일 (쉼표로 구분)</Label><Input value={makeup} onChange={(e) => setMakeup(e.target.value)} placeholder="2027-01-31, 2027-02-20" /></div>
      <label className="flex items-end gap-2 text-sm pb-2"><input type="checkbox" checked={!!f.announce} onChange={set('announce')} />고객 발주 마감 안내</label>
      <div className="sm:col-span-4 flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>취소</Button>}
        <Button type="submit" disabled={busy}>{busy ? '저장 중...' : '저장'}</Button>
      </div>
    </form>
  );
}