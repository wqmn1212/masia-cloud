import { useEffect, useRef, useState } from 'react';
import { saveBilingual, editBilingual } from '@/lib/saveBilingual';
import BilingualField from '@/components/language/BilingualField';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
const fields = ['attendees', 'notes', 'decisions', 'next_steps'];
export default function MeetingLiveNotes({ log, onSaved }) {
  const key = `meeting-notes:${log.id}`;
  const draft = JSON.parse(localStorage.getItem(key) || 'null');
  const [form, setForm] = useState({ ...Object.fromEntries(fields.flatMap(f => [f, `${f}_cn`]).map(f => [f, draft?.[f] ?? log[f] ?? ''])), __bilingualDirty: draft?.__bilingualDirty || (draft ? Object.fromEntries(Object.keys(draft).map(k => [k, true])) : {}) });
  const [status, setStatus] = useState(draft ? '복구된 내용을 저장 중...' : '자동저장됨');
  const latest = useRef(form);
  latest.current = form;
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(form));
    setStatus('저장 중...');
    const snapshot = JSON.stringify(form);
    const timer = setTimeout(async () => {
      try {
        const saved = await saveBilingual('MeetingLog', form, log.id);
        if (JSON.stringify(latest.current) === snapshot) {
          const next = { ...form, ...Object.fromEntries(fields.flatMap(f => [f, `${f}_cn`]).map(f => [f, saved[f] || ''])) };
          if (JSON.stringify(next) !== snapshot) setForm(next);
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
  const set = (name, value) => setForm(current => editBilingual(current, name, value));
  return <div className="space-y-2 border-t bg-muted/20 p-3">
    <div className="flex items-center justify-between"><p className="text-xs font-semibold">미팅 내용 작성</p><span className="text-[11px] text-muted-foreground">{status}</span></div>
    <BilingualField record={form} field="attendees" placeholder="참석자 / 参与者" onChange={set} />
    <BilingualField record={form} field="notes" multiline rows={4} placeholder="논의 내용 / 讨论内容" onChange={set} />
    <BilingualField record={form} field="decisions" multiline rows={2} placeholder="결정 사항 / 决定事项" onChange={set} />
    <BilingualField record={form} field="next_steps" multiline rows={2} placeholder="다음 액션 / 下一步" onChange={set} />
    <p className="text-[11px] text-muted-foreground">입력 즉시 이 기기에 임시 보관되며, 서버에도 자동 저장됩니다.</p>
  </div>;
}