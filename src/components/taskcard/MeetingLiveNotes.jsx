import { useEffect, useRef, useState } from 'react';
import { editBilingual } from '@/lib/saveBilingual';
import useDeferredBilingualSave from '@/components/language/useDeferredBilingualSave';
import DeferredSaveStatus from '@/components/language/DeferredSaveStatus';
import BilingualField from '@/components/language/BilingualField';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
const fields = ['attendees', 'notes', 'decisions', 'next_steps'];
export default function MeetingLiveNotes({ log, onSaved }) {
  const key = `meeting-notes:${log.id}`;
  const draft = JSON.parse(localStorage.getItem(key) || 'null');
  const [form, setForm] = useState({ ...Object.fromEntries(fields.flatMap(f => [f, `${f}_cn`]).map(f => [f, draft?.[f] ?? log[f] ?? ''])), __bilingualDirty: draft?.__bilingualDirty || (draft ? Object.fromEntries(Object.keys(draft).map(k => [k, true])) : {}) });
  const latest = useRef(form);
  latest.current = form;
  useEffect(() => { localStorage.setItem(key, JSON.stringify(form)); }, [key, form]);
  const { status } = useDeferredBilingualSave({
    entity: 'MeetingLog', id: log.id, form, setForm,
    initialForm: Object.fromEntries(fields.flatMap(f => [f, `${f}_cn`]).map(f => [f, log[f] || ''])),
    onSaved: saved => {
      if (fields.flatMap(f => [f, `${f}_cn`]).every(f => (latest.current[f] || '') === (saved[f] || ''))) localStorage.removeItem(key);
      onSaved?.();
    },
  });
  const set = (name, value) => setForm(current => editBilingual(current, name, value));
  return <div className="space-y-2 border-t bg-muted/20 p-3">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold">미팅 내용 작성</p><DeferredSaveStatus status={status} /></div>
    <BilingualField record={form} field="attendees" placeholder="참석자 / 参与者" onChange={set} />
    <BilingualField record={form} field="notes" multiline rows={4} placeholder="논의 내용 / 讨论内容" onChange={set} />
    <BilingualField record={form} field="decisions" multiline rows={2} placeholder="결정 사항 / 决定事项" onChange={set} />
    <BilingualField record={form} field="next_steps" multiline rows={2} placeholder="다음 액션 / 下一步" onChange={set} />
    <p className="text-[11px] text-muted-foreground">입력 즉시 이 기기에 임시 보관되며, 서버에도 자동 저장됩니다.</p>
  </div>;
}