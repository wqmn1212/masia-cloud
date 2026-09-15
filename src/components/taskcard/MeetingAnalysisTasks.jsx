import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
const LABELS = { LOW: '낮음', MEDIUM: '보통', HIGH: '높음', URGENT: '긴급' };
export default function MeetingAnalysisTasks({ result, selected, setSelected, adding, added, onAdd }) {
  return <section className="space-y-3">
    {!!result.risks?.length && <div className="text-sm text-destructive"><h5 className="font-semibold">리스크 / 확인 필요</h5>{result.risks.map((r,i) => <p key={i}>· {r}</p>)}</div>}
    <h5 className="text-sm font-semibold">추천 업무 — 검토 후 선택하여 추가</h5>
    {!result.tasks?.length && <p className="text-sm text-muted-foreground">추가로 확인된 업무가 없습니다.</p>}
    {(result.tasks || []).map((t,i) => <label key={i} className="flex gap-2 rounded-lg border p-3">
      <Checkbox checked={!!selected[i]} disabled={adding || !!added} onCheckedChange={v => setSelected(s => ({ ...s, [i]: !!v }))} />
      <div className="min-w-0 space-y-1 text-sm"><p>{t.title} <Badge variant="outline">{LABELS[t.priority]}</Badge></p><p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.description}</p>{t.due_date && <p className="text-xs">기한: {t.due_date}</p>}</div>
    </label>)}
    {!!result.tasks?.length && <Button disabled={adding || !!added || !Object.values(selected).some(Boolean)} onClick={onAdd}>{added ? `${added}개 업무 추가됨` : adding ? '저장 중...' : '선택 업무 추가'}</Button>}
  </section>;
}