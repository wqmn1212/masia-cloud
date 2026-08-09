import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPES = [
  { v: 'ONLINE', l: '화상' }, { v: 'OFFLINE', l: '대면' },
  { v: 'CALL', l: '전화' }, { v: 'WECHAT', l: '위챗' },
];

const EMPTY = {
  meeting_date: new Date().toISOString().slice(0, 10),
  meeting_type: 'ONLINE', title: '', attendees: '', notes: '', decisions: '', next_steps: '',
};

export default function MeetingLogForm({ onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input type="date" value={form.meeting_date} onChange={e => set('meeting_date', e.target.value)} className="sm:w-40" />
        <Select value={form.meeting_type} onValueChange={v => set('meeting_type', v)}>
          <SelectTrigger className="sm:w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="미팅 제목" value={form.title} onChange={e => set('title', e.target.value)} className="flex-1" />
      </div>
      <Input placeholder="참석자" value={form.attendees} onChange={e => set('attendees', e.target.value)} />
      <Textarea placeholder="논의 내용" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
      <Textarea placeholder="결정 사항" rows={2} value={form.decisions} onChange={e => set('decisions', e.target.value)} />
      <Textarea placeholder="다음 액션" rows={2} value={form.next_steps} onChange={e => set('next_steps', e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>취소</Button>
        <Button size="sm" disabled={!form.title || saving} onClick={() => onSubmit(form)}>저장</Button>
      </div>
    </div>
  );
}