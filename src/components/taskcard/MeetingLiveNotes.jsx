import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
const fields = ['attendees', 'notes', 'decisions', 'next_steps'];
export default function MeetingLiveNotes({ log, onSaved }) {
  const key = `meeting-notes:${log.id}`;
  const draft = JSON.parse(localStorage.getItem(key) || 'null');
  const [form, setForm] = useState(Object.fromEntries(fields.map(f => [f, draft?.[f] ?? log[f] ?? ''])));
  const [status, setStatus] = useState(draft ? '복구된 내용을 저장 중...' : '자동저장됨');
  const latest = useRef(form);
  latest.current = form;
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(form));
    setStatus('저장 중...');
    const snapshot = JSON.stringify(form);
    const timer = setTimeout(async () => {
      try {
        await base44.entities.MeetingLog.update(log.id, form);
        if (JSON.stringify(latest.current) === snapshot) {
          localStorage.removeItem(key);
          setStatus('자동저장됨');
          onSaved?.();
        }
      } catch {
        setStatus('기기에 임시저장됨 · 연결 시 재시도');
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [form]);
  const set = (name, value) => setForm(current => ({ ...current, [name]: value }));
  return <div className="space-y-2 border-t bg-muted/20 p-3">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold">미팅 내용 작성</p><span className="text-[11px] text-muted-foreground">{status}</span></div>
    <Input placeholder="참석자" value={form.attendees} onChange={e => set('attendees', e.target.value)} />
    <Textarea placeholder="논의 내용" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} />
    <Textarea placeholder="결정 사항" rows={2} value={form.decisions} onChange={e => set('decisions', e.target.value)} />
    <Textarea placeholder="다음 액션" rows={2} value={form.next_steps} onChange={e => set('next_steps', e.target.value)} />
    <p className="text-[11px] text-muted-foreground">입력 즉시 이 기기에 임시 보관되며, 서버에도 자동 저장됩니다.</p>
  </div>;
}