import React, { useMemo, useState } from 'react';
import { Ruler, Plus, X, Loader2, Check, AlertTriangle, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';
import { AXIS_LABEL, checkLocks, cleanLocks, fitLocks } from '@/lib/conceptEdit';

const sel = 'h-8 rounded-md border bg-background px-2 text-caption';

/**
 * 요구 치수 고정: 꼭 지킬 치수를 적어 두면 지금 형상과 비교해 보여 주고, AI 로 만들 때마다 그 치수에 맞춘다.
 * onFit(맞춘 부품) 을 주면 '어긋난 치수 맞추기' 로 형상을 바로 고친다 (편집 중이면 초안에, 아니면 편집을 열어서).
 */
export default function ConceptLocksPanel({ conceptId, locks: saved, parts, onSaved, onFit }) {
  const locks = useMemo(() => cleanLocks(saved), [saved]);
  const hasShape = (parts || []).length > 0;
  // 형상을 만들기 전이면 비교하지 않고 목록만 (만들 때 AI 에 알려 주고 맞춘다)
  const rows = useMemo(() => (hasShape ? checkLocks(parts, locks) : locks.map((l) => ({ ...l, ok: true, pending: true }))), [parts, locks, hasShape]);
  const [form, setForm] = useState({ part_id: '', axis: 'y', mm: '', tol: '1', label: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const misses = rows.filter((r) => !r.ok && !r.missing);
  const name = (id) => (parts || []).find((p) => p.id === id)?.name || id;

  const save = async (next) => {
    setBusy(true); setError('');
    try { const res = await runConcept('set_locks', { concept_id: conceptId, locks: next }); onSaved?.(res.concept); }
    catch (e) { setError(errorText(e)); }
    setBusy(false);
  };
  const add = async () => {
    const mm = Number(form.mm);
    if (!(mm > 0)) { setError('치수(mm)를 적어 주세요'); return; }
    await save([...locks, { id: `L${Date.now().toString(36)}`, axis: form.axis, mm, tol: Number(form.tol) || 1, part_id: form.part_id || null, label: form.label.trim() }]);
    setForm((f) => ({ ...f, mm: '', label: '' }));
  };

  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-1.5 text-label font-semibold"><Ruler className="h-4 w-4 text-primary" />요구 치수</p>
        {rows.length > 0 && hasShape && <span className={`rounded-full px-2 py-0.5 text-micro ${misses.length ? 'bg-destructive/10 text-destructive' : 'bg-success/15 text-success-text'}`}>{misses.length ? `어긋남 ${misses.length}` : '모두 맞음'}</span>}
      </div>
      <p className="text-micro text-muted-foreground">꼭 지킬 치수를 적어 두면 AI 로 만들거나 고칠 때마다 알려 주고 결과를 그 치수에 맞춥니다. 다음 버전으로 이어집니다.</p>
      {rows.length > 0 && (
        <ul className="space-y-1">{rows.map((r) => (
          <li key={r.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-caption ${r.ok ? 'bg-secondary' : 'bg-destructive/10'}`}>
            {r.ok ? <Check className="h-3.5 w-3.5 shrink-0 text-success-text" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
            <span className="min-w-0 flex-1 truncate">{r.part_id ? name(r.part_id) : '제품 전체'} {AXIS_LABEL[r.axis]} <b className="tabular-nums">{r.mm}</b> mm ±{r.tol}{r.label ? <span className="text-muted-foreground"> · {r.label}</span> : null}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{r.pending ? '만들 때 맞춤' : r.missing ? '부품 없음' : `지금 ${r.actual}${r.ok ? '' : ` (${r.diff > 0 ? '+' : ''}${r.diff})`}`}</span>
            <button type="button" aria-label="치수 지우기" disabled={busy} onClick={() => save(locks.filter((l) => l.id !== r.id))} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}</ul>
      )}
      {onFit && misses.length > 0 && <Button size="sm" variant="outline" onClick={() => onFit(fitLocks(parts, locks).parts)}><Wand2 className="h-4 w-4" />어긋난 치수 맞추기</Button>}
      <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
        <select aria-label="대상" value={form.part_id} onChange={(e) => setForm({ ...form, part_id: e.target.value })} className={`${sel} max-w-[140px]`}>
          <option value="">제품 전체</option>
          {(parts || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select aria-label="방향" value={form.axis} onChange={(e) => setForm({ ...form, axis: e.target.value })} className={sel}>
          {Object.entries(AXIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Input aria-label="치수 mm" type="number" inputMode="decimal" value={form.mm} onChange={(e) => setForm({ ...form, mm: e.target.value })} placeholder="mm" className="h-8 w-20 tabular-nums" />
        <Input aria-label="허용 오차 mm" type="number" inputMode="decimal" value={form.tol} onChange={(e) => setForm({ ...form, tol: e.target.value })} className="h-8 w-14 tabular-nums" title="허용 ± mm" />
        <Input aria-label="메모" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="메모 (선택)" className="h-8 min-w-[90px] flex-1" />
        <Button size="sm" className="h-8" onClick={add} disabled={busy || !form.mm}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}추가</Button>
      </div>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}
