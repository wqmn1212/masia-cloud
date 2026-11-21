import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLeaveGuard } from '@/lib/useLeaveGuard';
import { Move, RotateCw, Maximize2, Undo2, Redo2, Copy, FlipHorizontal2, Trash2, Save, X, Loader2, Sparkles, Layers, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ConceptEditCanvas from '@/components/prototype/concept/ConceptEditCanvas';
import ConceptLocksPanel from '@/components/prototype/concept/ConceptLocksPanel';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';
import { SHAPE_LABEL, LAYER_LABEL, FINISH_LABEL, AXIS_LABEL, sceneBounds, bodyParts, updatePart, addPart, duplicatePart, mirrorPart, removePart, diffParts, diffText } from '@/lib/conceptEdit';

const MODES = [['translate', '이동', Move, 'W'], ['rotate', '회전', RotateCw, 'E'], ['scale', '크기', Maximize2, 'R']];
const sel = 'h-8 w-full rounded-md border bg-background px-2 text-caption';
const numVal = (v) => (v === '' || v === '-' ? v : Number(v));

function NumRow({ label, value, onChange, step = 1 }) {
  return (
    <div className="grid grid-cols-[52px_1fr_1fr_1fr] items-center gap-1">
      <span className="text-micro text-muted-foreground">{label}</span>
      {['x', 'y', 'z'].map((k) => (
        <label key={k} className="relative">
          <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-micro text-muted-foreground">{AXIS_LABEL[k][0]}</span>
          <Input type="number" step={step} inputMode="decimal" aria-label={`${label} ${AXIS_LABEL[k]}`} value={value?.[k] ?? ''}
            onChange={(e) => { const v = numVal(e.target.value); if (typeof v === 'number' && Number.isFinite(v)) onChange({ [k]: v }); }}
            className="h-8 pl-5 pr-1 text-caption tabular-nums" />
        </label>
      ))}
    </div>
  );
}

function PartForm({ part, onChange }) {
  return (
    <div className="space-y-2">
      <Input aria-label="부품 이름" value={part.name || ''} onChange={(e) => onChange({ name: e.target.value }, 'name')} className="h-8 text-label font-medium" />
      <div className="grid grid-cols-3 gap-1">
        <select aria-label="모양" value={part.shape} onChange={(e) => onChange({ shape: e.target.value, ...(e.target.value === 'sphere_cut' && part.cut == null ? { cut: 0 } : {}) })} className={sel}>
          {Object.entries(SHAPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="종류" value={part.layer} onChange={(e) => onChange({ layer: e.target.value })} className={sel}>
          {Object.entries(LAYER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="마감" value={part.finish} onChange={(e) => onChange({ finish: e.target.value })} className={sel}>
          {Object.entries(FINISH_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <NumRow label="크기 mm" value={part.size} onChange={(v) => onChange({ size: v }, 'size')} />
      <NumRow label="위치 mm" value={part.position} onChange={(v) => onChange({ position: v }, 'pos')} />
      <NumRow label="회전 °" value={part.rotation_deg} onChange={(v) => onChange({ rotation_deg: v }, 'rot')} step={5} />
      {part.shape === 'sphere_cut' && (
        <label className="flex items-center gap-2 text-micro text-muted-foreground">자른 높이 (−0.95 ~ 0.95)
          <Input type="number" step={0.05} value={part.cut ?? 0} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange({ cut: Math.max(-0.95, Math.min(0.95, v)) }, 'cut'); }} className="h-8 w-20 tabular-nums" />
        </label>
      )}
      <div className="flex items-center gap-2">
        <input type="color" aria-label="색" value={/^#[0-9a-f]{6}$/i.test(part.color || '') ? part.color : '#b9c2d0'} onChange={(e) => onChange({ color: e.target.value }, 'color')} className="h-8 w-10 cursor-pointer rounded border bg-background p-0.5" />
        <Input aria-label="재질" value={part.material || ''} onChange={(e) => onChange({ material: e.target.value }, 'mat')} placeholder="재질 (예: ABS)" className="h-8 flex-1 text-caption" />
      </div>
      <Input aria-label="역할" value={part.role || ''} onChange={(e) => onChange({ role: e.target.value }, 'role')} placeholder="역할 메모" className="h-8 text-caption" />
    </div>
  );
}

/**
 * 컨셉 3D 직접 편집: 부품을 눌러 고르고 수치·손잡이로 고친 뒤 새 버전으로 저장한다 (AI 없이).
 * 고른 부품만 AI 로 바꾸기는 저장된 형상 기준이라, 편집 중 바뀐 것이 있으면 먼저 저장해야 한다.
 */
export default function ConceptEditor({ conceptId, version, preview, locks, initialParts, onSaved, onLocksSaved, onCancel }) {
  const base = preview.parts || [];
  const [draft, setDraft] = useState(initialParts || base);
  const hist = useRef({ past: [], future: [], lastKey: '', lastAt: 0 });
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState('translate');
  const [xray, setXray] = useState(false);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const diff = useMemo(() => diffParts(base, draft), [base, draft]);
  const dirty = diff.count > 0;
  useLeaveGuard(dirty, { back: true, message: '저장하지 않은 3D 편집이 있습니다. 떠나면 사라집니다 (‘새 버전으로 저장’을 먼저 누르세요). 떠날까요?' });
  const size = useMemo(() => sceneBounds(bodyParts(draft)).size, [draft]); // 본체 크기 (케이블 등 기타 제외, 요구 치수와 같은 기준)
  const one = selected.length === 1 ? draft.find((p) => p.id === selected[0]) : null;

  // 고치기: 같은 칸을 이어서 입력하면 되돌리기 한 번으로 묶는다
  const commit = (next, key = '') => {
    const h = hist.current;
    const now = Date.now();
    if (!(key && key === h.lastKey && now - h.lastAt < 1500)) { h.past.push(draft); if (h.past.length > 100) h.past.shift(); }
    h.future = []; h.lastKey = key; h.lastAt = now;
    setDraft(next);
  };
  const undo = () => { const h = hist.current; if (!h.past.length) return; h.future.push(draft); h.lastKey = ''; setDraft(h.past.pop()); };
  const redo = () => { const h = hist.current; if (!h.future.length) return; h.past.push(draft); h.lastKey = ''; setDraft(h.future.pop()); };
  const change = (patch, key) => one && commit(updatePart(draft, one.id, patch), key ? `${one.id}:${key}` : '');
  const act = (fn) => { const r = fn(); commit(r.parts); if (r.id) setSelected([r.id]); };
  const del = () => { if (!selected.length) return; commit(selected.reduce((ps, id) => removePart(ps, id), draft)); setSelected([]); };
  const select = (id, additive) => setSelected((s) => (!id ? (additive ? s : []) : additive ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));

  // 단축키: W·E·R 손잡이, Delete 삭제, Ctrl+Z / Ctrl+Shift+Z (입력 칸에서는 쓰지 않는다)
  const keys = useRef({});
  keys.current = { undo, redo, del, setMode };
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); (e.shiftKey ? keys.current.redo : keys.current.undo)(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); keys.current.redo(); }
      else if (k === 'delete' || k === 'backspace') keys.current.del();
      else if (k === 'w') keys.current.setMode('translate'); else if (k === 'e') keys.current.setMode('rotate'); else if (k === 'r') keys.current.setMode('scale');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const save = async () => {
    setBusy('save'); setError('');
    try {
      const res = await runConcept('save_edit', { concept_id: conceptId, parts: draft, note: note.trim() || diffText(diff), summary: diffText(diff) });
      onSaved(res.concept, res.lock_misses || []);
    } catch (e) { setError(errorText(e)); }
    setBusy('');
  };
  const askAi = async () => {
    if (!ask.trim() || !selected.length) return;
    setBusy('ai'); setError('');
    try {
      const res = await runConcept('revise', { concept_id: conceptId, change_request: ask.trim(), part_ids: selected }, () => setBusy('ai-wait'));
      setAsk('');
      onSaved(res.concept, res.lock_fit?.misses || []);
    } catch (e) { setError(errorText(e)); }
    setBusy('');
  };
  const names = selected.map((id) => draft.find((p) => p.id === id)?.name).filter(Boolean);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="relative min-h-[460px] overflow-hidden rounded-2xl border bg-gradient-to-b from-secondary to-card lg:sticky lg:top-16 lg:h-[max(540px,min(calc(100vh-6rem),840px))] lg:self-start">
        <ConceptEditCanvas parts={draft} selected={selected} mode={mode} xray={xray} onSelect={select} onTransform={(id, patch) => commit(updatePart(draft, id, patch))} />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg border bg-card/90 p-0.5 backdrop-blur" role="radiogroup" aria-label="손잡이">
            {MODES.map(([k, label, Icon, key]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} title={`${label} (${key})`}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-caption ${mode === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><Icon className="h-3.5 w-3.5" />{label}</button>
            ))}
          </div>
          <Button size="sm" variant={xray ? 'default' : 'outline'} className="h-8 bg-card/90" onClick={() => setXray(!xray)} aria-pressed={xray}><Layers className="h-3.5 w-3.5" />내부</Button>
        </div>
        <p className="absolute right-3 top-3 rounded-full bg-card/85 px-3 py-1 text-caption tabular-nums backdrop-blur">약 {size.x} × {size.z} × {size.y} mm</p>
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8 bg-card/90" onClick={undo} disabled={!hist.current.past.length} aria-label="되돌리기 (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" className="h-8 bg-card/90" onClick={redo} disabled={!hist.current.future.length} aria-label="다시 하기 (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
          <select aria-label="부품 추가" value="" onChange={(e) => e.target.value && act(() => addPart(draft, e.target.value))} className="h-8 rounded-md border bg-card/90 px-2 text-caption">
            <option value="">+ 부품 추가</option>
            {Object.entries(SHAPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button size="sm" variant="outline" className="h-8 bg-card/90" disabled={!one} onClick={() => act(() => duplicatePart(draft, one.id))}><Copy className="h-3.5 w-3.5" />복제</Button>
          <Button size="sm" variant="outline" className="h-8 bg-card/90" disabled={!one} onClick={() => act(() => mirrorPart(draft, one.id))}><FlipHorizontal2 className="h-3.5 w-3.5" />좌우 대칭</Button>
          <Button size="sm" variant="outline" className="h-8 bg-card/90 text-destructive" disabled={!selected.length} onClick={del}><Trash2 className="h-3.5 w-3.5" />삭제</Button>
          <span className="ml-auto hidden rounded-full bg-card/85 px-2.5 py-1 text-micro text-muted-foreground backdrop-blur md:inline"><MousePointerClick className="mr-1 inline h-3 w-3" />누르면 고르기 · Shift 로 여러 개 · 끌어서 돌려 보기</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <p className="text-label font-semibold">v{version} 직접 편집</p>
          <p className="text-caption text-muted-foreground">{dirty ? `바뀐 것: ${diffText(diff)}` : '부품을 눌러 고친 뒤 새 버전으로 저장합니다. 이 버전은 그대로 남습니다.'}</p>
          <Input aria-label="변경 메모" value={note} onChange={(e) => setNote(e.target.value)} placeholder="변경 메모 (비우면 바뀐 것으로 채움)" className="h-8 text-caption" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={!dirty || !!busy}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}새 버전으로 저장</Button>
            <Button size="sm" variant="ghost" onClick={() => { if (!dirty || window.confirm('저장하지 않은 편집을 버릴까요?')) onCancel(); }} disabled={!!busy}><X className="h-4 w-4" />편집 끝내기</Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          {one ? <PartForm key={one.id} part={one} onChange={change} />
            : <p className="text-caption text-muted-foreground">{selected.length > 1 ? `${selected.length}개 고름: ${names.join(', ')}` : '3D 나 아래 목록에서 부품을 고르세요.'}</p>}
        </div>

        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-label font-semibold"><Sparkles className="h-4 w-4 text-primary" />고른 부품만 AI 로 바꾸기</p>
          <p className="text-micro text-muted-foreground">{selected.length ? `대상: ${names.join(', ')} — 다른 부품은 그대로 둡니다.` : '부품을 먼저 고르세요 (Shift 로 여러 개).'}{dirty ? ' 편집한 내용을 먼저 저장해야 씁니다.' : ''}</p>
          <Textarea aria-label="AI 변경 요청" rows={2} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="예: 지름 20mm 로 키우고 오른쪽 뒤로 옮겨 줘" className="text-caption" disabled={dirty || !!busy} />
          <Button size="sm" variant="outline" onClick={askAi} disabled={dirty || !selected.length || !ask.trim() || !!busy}>{busy.startsWith('ai') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}새 버전 만들기</Button>
          {busy === 'ai-wait' && <p className="text-micro text-muted-foreground">시간이 걸리고 있습니다. 결과를 확인하는 중…</p>}
        </div>

        <ConceptLocksPanel conceptId={conceptId} locks={locks} parts={draft} onSaved={onLocksSaved} onFit={(fitted) => commit(fitted)} />

        <div className="max-h-[320px] overflow-y-auto rounded-2xl border bg-card p-2">
          <p className="px-2 py-1 text-caption font-semibold text-muted-foreground">부품 {draft.length}</p>
          {draft.map((p) => (
            <button key={p.id} type="button" onClick={(e) => select(p.id, e.shiftKey || e.metaKey || e.ctrlKey)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-caption ${selected.includes(p.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
              <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: p.color }} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-micro text-muted-foreground">{SHAPE_LABEL[p.shape] || p.shape}</span>
            </button>
          ))}
        </div>
        {error && <p className="text-caption text-destructive">{error}</p>}
      </div>
    </div>
  );
}
