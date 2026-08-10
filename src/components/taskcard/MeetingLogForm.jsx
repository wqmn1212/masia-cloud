import React, { useState, useEffect, useRef } from 'react';
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

export default function MeetingLogForm({ onSubmit, onCancel, saving, initial, autoSave }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...(initial ? {
      meeting_date: initial.meeting_date || EMPTY.meeting_date,
      meeting_type: initial.meeting_type || 'ONLINE',
      title: initial.title || '',
      attendees: initial.attendees || '',
      notes: initial.notes || '',
      decisions: initial.decisions || '',
      next_steps: initial.next_steps || '',
    } : {}),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const dirty = useRef(false);
  useEffect(() => {
    if (!autoSave || !dirty.current || !form.title) return;
    const t = setTimeout(() => onSubmit(form), 1000);
    return () => clearTimeout(t);
  }, [form, autoSave]);

  const handleChange = (k, v) => { dirty.current = true; set(k, v); };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input type="date" value={form.meeting_date} onChange={e => handleChange('meeting_date', e.target.value)} className="sm:w-40" />
        <Select value={form.meeting_type} onValueChange={v => handleChange('meeting_type', v)}>
          <SelectTrigger className="sm:w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="미팅 제목" value={form.title} onChange={e => handleChange('title', e.target.value)} className="flex-1" />
      </div>
      <Input placeholder="참석자" value={form.attendees} onChange={e => handleChange('attendees', e.target.value)} />
      <Textarea placeholder="논의 내용" rows={3} value={form.notes} onChange={e => handleChange('notes', e.target.value)} />
      <Textarea placeholder="결정 사항" rows={2} value={form.decisions} onChange={e => handleChange('decisions', e.target.value)} />
      <Textarea placeholder="다음 액션" rows={2} value={form.next_steps} onChange={e => handleChange('next_steps', e.target.value)} />
      <div className="flex justify-end items-center gap-2">
        {autoSave && (
          <span className="text-[11px] text-muted-foreground mr-auto">
            {saving ? '저장 중...' : '자동저장됩니다'}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>{autoSave ? '닫기' : '취소'}</Button>
        {!autoSave && (
          <Button size="sm" disabled={!form.title || saving} onClick={() => onSubmit(form)}>저장</Button>
        )}
      </div>
    </div>
  );
}