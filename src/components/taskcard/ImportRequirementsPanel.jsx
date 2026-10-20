import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Plus, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { IMPORT_REQS, REQ_STATUS, pendingReqs, reqDone } from '@/lib/importRequirements';

const sel = 'h-8 rounded-md border bg-background px-2 text-xs';

// 수입 요건 확인: 발주 전에 이 제품에 필요한 인증·신고를 고르고 진행 상태를 남긴다. 남은 요건이 있으면 출항 전에 경고.
export default function ImportRequirementsPanel({ card, user }) {
  const qc = useQueryClient();
  const [list, setList] = useState(card.import_requirements || []);
  const [custom, setCustom] = useState('');
  useEffect(() => { setList(card.import_requirements || []); }, [card.id, card.import_req_updated_at]);
  const has = (key) => list.some((r) => r.key === key);
  const toggle = (req) => setList((l) => (has(req.key) ? l.filter((r) => r.key !== req.key) : [...l, { key: req.key, label: req.label, status: 'REQUIRED', cert_no: '', due_date: '', note: '' }]));
  const patch = (i, p) => setList((l) => l.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const addCustom = () => { if (!custom.trim()) return; setList((l) => [...l, { key: `OTHER_${Date.now()}`, label: custom.trim(), status: 'REQUIRED', cert_no: '', due_date: '', note: '' }]); setCustom(''); };
  const dirty = JSON.stringify(list) !== JSON.stringify(card.import_requirements || []);
  const save = useMutation({
    mutationFn: () => base44.entities.TaskCard.update(card.id, { import_requirements: list, import_req_updated_at: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-cards'] }); qc.invalidateQueries({ queryKey: ['client-card-detail', card.id] }); toast({ title: '수입 요건을 저장했습니다' }); },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  const pending = pendingReqs(list).length;
  return (
    <section className="mt-6 space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileCheck2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">수입 요건 (인증·신고)</h3>
        {list.length > 0 && (pending ? <Badge className="border-0 bg-destructive/10 text-destructive">남은 요건 {pending}</Badge> : <Badge className="border-0 bg-primary/10 text-primary">모두 완료</Badge>)}
      </div>
      <p className="text-xs text-muted-foreground">발주 전에 이 제품에 필요한 인증·신고를 골라 두세요. 인증 없이 들어오면 세관에 묶여 보관료가 나가거나 반송·폐기될 수 있습니다.</p>
      <div className="flex flex-wrap gap-1.5">
        {IMPORT_REQS.map((r) => (
          <button key={r.key} type="button" title={r.hint} aria-pressed={has(r.key)} onClick={() => toggle(r)}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${has(r.key) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:border-primary/40'}`}>{r.label}</button>
        ))}
      </div>
      {list.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {list.map((r, i) => (
            <li key={r.key} className="space-y-1.5 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${reqDone(r) ? 'bg-primary' : 'bg-destructive'}`} />
                <p className="min-w-0 flex-1 text-xs font-semibold">{r.label}</p>
                <select aria-label={`${r.label} 상태`} className={sel} value={r.status} onChange={(e) => patch(i, { status: e.target.value })}>{Object.entries(REQ_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <button type="button" aria-label={`${r.label} 빼기`} onClick={() => setList((l) => l.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-[1fr_140px_2fr]">
                <Input className="h-7 text-xs" placeholder="인증·신고 번호" value={r.cert_no} onChange={(e) => patch(i, { cert_no: e.target.value })} />
                <Input type="date" className="h-7 text-xs" aria-label={`${r.label} 완료 예정일`} value={r.due_date} onChange={(e) => patch(i, { due_date: e.target.value })} />
                <Input className="h-7 text-xs" placeholder="메모 (고객에게 보임: 시험기관, 진행 상황)" value={r.note} onChange={(e) => patch(i, { note: e.target.value })} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 max-w-xs text-xs" placeholder="그 외 요건 직접 추가" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addCustom}><Plus className="h-3 w-3" />추가</Button>
        <Button size="sm" className="ml-auto" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? '저장 중…' : '저장'}</Button>
      </div>
    </section>
  );
}
