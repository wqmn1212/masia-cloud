import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { holidayRange } from '@/lib/chinaHolidays';
import HolidayForm from './HolidayForm';

export default function HolidayManager({ canEdit }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | record
  const [busy, setBusy] = useState(false);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['china-holidays'], queryFn: () => base44.entities.ChinaHoliday.list('-start_date', 500) });

  const save = async (data) => {
    setBusy(true);
    const { id, notice_sent, created_date, updated_date, created_by_id, ...rest } = data;
    if (editing === 'new') await base44.entities.ChinaHoliday.create(rest); else await base44.entities.ChinaHoliday.update(editing.id, rest);
    await qc.invalidateQueries({ queryKey: ['china-holidays'] });
    setBusy(false); setEditing(null);
  };
  const remove = async (h) => {
    if (!window.confirm(`${h.year} ${h.name}을(를) 삭제할까요?`)) return;
    await base44.entities.ChinaHoliday.delete(h.id);
    qc.invalidateQueries({ queryKey: ['china-holidays'] });
  };

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">중국 공휴일</h2>
        {canEdit && !editing && <Button size="sm" onClick={() => setEditing('new')}><Plus />휴일 추가</Button>}
      </div>
      {editing === 'new' && <HolidayForm onSubmit={save} onCancel={() => setEditing(null)} busy={busy} />}
      {isLoading ? <p className="text-sm text-muted-foreground">불러오는 중...</p> : !rows.length ? <p className="text-sm text-muted-foreground py-6 text-center">등록된 휴일이 없습니다.</p> : (
        <div className="divide-y">
          {rows.map((h) => editing?.id === h.id ? <HolidayForm key={h.id} initial={h} onSubmit={save} onCancel={() => setEditing(null)} busy={busy} /> : (
            <div key={h.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium w-28">{h.year} {h.name}</span>
              <span>{h.start_date} ~ {h.end_date}</span>
              {Number(h.factory_extra_days) > 0 && <span className="text-muted-foreground">공장 휴무 {holidayRange(h).start} ~ {holidayRange(h).end}</span>}
              <span className="text-muted-foreground">발주 마감 {h.order_cutoff_date || '미입력'}</span>
              {h.announce && <Badge variant="secondary">고객 안내</Badge>}
              {canEdit && <div className="ml-auto flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(h)}><Pencil /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(h)}><Trash2 /></Button>
              </div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}