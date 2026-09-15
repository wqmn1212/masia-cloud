import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
export default function MeetingAnalysisFields({ result, applied, busy, onApply }) {
  const [replace, setReplace] = useState(false);
  return <section className="space-y-3 rounded-lg border p-3">
    <h5 className="text-sm font-semibold">미팅 기록에 반영</h5>
    <p className="whitespace-pre-wrap text-sm">{result.summary}</p>
    <div className="text-sm whitespace-pre-wrap"><strong>결정 사항</strong><p>{result.decisions || '확정된 결정 없음'}</p></div>
    <div className="text-sm whitespace-pre-wrap"><strong>다음 액션</strong><p>{result.next_steps || '확인된 액션 없음'}</p></div>
    <label className="flex items-center gap-2 text-xs"><Checkbox checked={replace} onCheckedChange={v => setReplace(!!v)} disabled={busy || applied} />기존 내용을 덮어쓰기 (기본: 기존 내용 보존 후 추가)</label>
    <Button disabled={busy || applied} onClick={() => onApply(replace)}>{applied ? '미팅 기록에 반영됨' : busy ? '저장 중...' : '확인 후 요약·결정·액션 반영'}</Button>
  </section>;
}