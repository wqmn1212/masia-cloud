import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import BilingualField from '@/components/language/BilingualField';
import { editBilingual } from '@/lib/saveBilingual';
import useDeferredBilingualSave from '@/components/language/useDeferredBilingualSave';
import DeferredSaveStatus from '@/components/language/DeferredSaveStatus';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPES = [
  { v: 'ONLINE', l: '화상' }, { v: 'OFFLINE', l: '대면' },
  { v: 'CALL', l: '전화' }, { v: 'WECHAT', l: '위챗' }, { v: 'KAKAO', l: '카톡' },
];

// 녹음이 없는 기록만 메신저 대화를 붙여 넣을 수 있다 (녹음 전사와 섞이지 않게)
const canPasteChat = (log) => !log || (!log.recording_uris?.length && !log.transcript_uri && !log.audio_parts?.length);

const EMPTY = {
  meeting_date: new Date().toISOString().slice(0, 10),
  meeting_type: 'ONLINE', title: '', attendees: '', notes: '', decisions: '', next_steps: '',
};

export default function MeetingLogForm({ onSubmit, onCancel, saving, initial, autoSave, onAutoSaved }) {
  const [form, setForm] = useState({
    ...EMPTY, __bilingualDirty: {},
    ...(initial ? {
      meeting_date: initial.meeting_date || EMPTY.meeting_date,
      meeting_type: initial.meeting_type || 'ONLINE',
      title: initial.title || '',
      ...Object.fromEntries(['title', 'attendees', 'notes', 'decisions', 'next_steps'].map(key => [`${key}_cn`, initial[`${key}_cn`] || ''])),
      attendees: initial.attendees || '',
      notes: initial.notes || '',
      decisions: initial.decisions || '',
      next_steps: initial.next_steps || '',
      // 녹음에서 나온 전사는 녹음 기록에서만 고친다
      ...(canPasteChat(initial) ? { transcript: initial.transcript || '' } : {}),
    } : { transcript: '' }),
  });
  const chatOk = canPasteChat(initial);
  const [chatOpen, setChatOpen] = useState(false);
  const showChat = chatOpen || !!form.transcript || ['KAKAO', 'WECHAT'].includes(form.meeting_type);
  const set = (k, v) => setForm(f => editBilingual(f, k, v));

  const { status } = useDeferredBilingualSave({
    entity: 'MeetingLog', id: initial?.id, form, setForm,
    enabled: !!autoSave, onSaved: onAutoSaved,
  });
  const handleChange = set;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input type="date" value={form.meeting_date} onChange={e => handleChange('meeting_date', e.target.value)} className="sm:w-40" />
        <Select value={form.meeting_type} onValueChange={v => handleChange('meeting_type', v)}>
          <SelectTrigger className="sm:w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
        </Select>
        <BilingualField record={form} field="title" placeholder="미팅 제목 / 会议标题" onChange={handleChange} disabled={saving && !autoSave} />
      </div>
      <BilingualField record={form} field="attendees" placeholder="참석자 / 参与者" onChange={handleChange} />
      <BilingualField record={form} field="notes" multiline rows={3} placeholder="논의 내용 / 讨论内容" onChange={handleChange} />
      {chatOk && (showChat ? (
        <div className="space-y-1">
          <label htmlFor="meeting-chat" className="text-caption font-semibold text-muted-foreground">메신저 대화 (카톡·위챗) — 그대로 붙여 넣으면 저장 후 ‘AI 분석’이 결정·할 일을 뽑아 줍니다</label>
          <Textarea id="meeting-chat" rows={6} value={form.transcript || ''} onChange={e => handleChange('transcript', e.target.value.slice(0, 60000))} placeholder={'[길상현] [오후 2:14] 버튼은 뒤쪽으로 옮겨 주세요\n[이호민] [오후 2:15] 네, 다음 주 월요일까지 수정안 드리겠습니다'} className="text-caption font-mono" />
          <p className="text-micro text-muted-foreground">{(form.transcript || '').length.toLocaleString()}자 · 대화방 ‘대화 내보내기’ 텍스트도 됩니다 (최대 60,000자)</p>
        </div>
      ) : (
        <button type="button" className="text-caption text-primary" onClick={() => setChatOpen(true)}>+ 카톡·위챗 대화 붙여넣기</button>
      ))}
      <BilingualField record={form} field="decisions" multiline rows={2} placeholder="결정 사항 / 决定事项" onChange={handleChange} />
      <BilingualField record={form} field="next_steps" multiline rows={2} placeholder="다음 액션 / 下一步" onChange={handleChange} />
      <div className="flex justify-end items-center gap-2">
        {autoSave && (
          <DeferredSaveStatus status={status} />
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>{autoSave ? '닫기' : '취소'}</Button>
        {!autoSave && (
          <Button size="sm" disabled={!(form.title?.trim() || form.title_cn?.trim()) || saving} onClick={() => onSubmit(form)}>저장</Button>
        )}
      </div>
    </div>
  );
}