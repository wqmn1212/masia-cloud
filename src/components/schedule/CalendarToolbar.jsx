import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import OwnerMultiSelect from '@/components/gantt/OwnerMultiSelect';
import { shiftMonth, ds } from '@/lib/scheduleCalendar';

export default function CalendarToolbar({ prefs, set, owners, clients }) {
  const [y, m] = prefs.month.split('-');
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => set({ month: shiftMonth(prefs.month, -1) })}><ChevronLeft /></Button>
      <span className="font-semibold text-sm w-24 text-center">{y}년 {Number(m)}월</span>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => set({ month: shiftMonth(prefs.month, 1) })}><ChevronRight /></Button>
      <Button size="sm" variant="outline" className="h-8" onClick={() => set({ month: ds(new Date()).slice(0, 7) })}>오늘</Button>
      <div className="flex-1" />
      <div className="w-40"><OwnerMultiSelect value={prefs.owners} team={owners} onChange={(v) => set({ owners: v })} placeholder="담당자 전체" /></div>
      <Select value={prefs.client || 'all'} onValueChange={(v) => set({ client: v === 'all' ? '' : v })}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">고객사 전체</SelectItem>
          {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-1.5 text-xs"><Switch checked={prefs.mine} onCheckedChange={(v) => set({ mine: v })} />내 일정만</label>
    </div>
  );
}