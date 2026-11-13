import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircuitBoard, Play, Pause, RotateCcw, Save, FolderOpen, Download, Upload, Undo2, Redo2, FilePlus2, AlertTriangle, Loader2, Activity, LineChart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CircuitCanvas, { fitView } from '@/components/circuit/CircuitCanvas';
import { PartPalette, PropertiesPanel, ScopePanel } from '@/components/circuit/CircuitPanels';
import AnalysisPanel, { defaultSettings, buildRequest, checkRequest, TRACE_COLORS } from '@/components/circuit/AnalysisPanel';
import { Simulator } from '@/lib/circuit/solver';
import { ScopeRecorder, traceLabel } from '@/lib/circuit/scope';
import { EXAMPLES, exampleCircuit, emptyCircuit } from '@/lib/circuit/examples';
import { PARTS, formatSI, newId, refNames, terminals, TERMINAL_NAMES } from '@/lib/circuit/parts';
import { toSpice } from '@/lib/circuit/spice';
import { actorName, errorText } from '@/lib/prototypeApi';

const DTS = [[1e-6, '1 µs'], [2e-6, '2 µs'], [5e-6, '5 µs'], [1e-5, '10 µs'], [2e-5, '20 µs'], [5e-5, '50 µs'], [1e-4, '100 µs'], [1e-3, '1 ms']];
const SHORTCUT = { v: 'select', w: 'wire', r: null };
const isDark = () => document.documentElement.classList.contains('dark');

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** 불러온 JSON 이 회로인지 확인하고 정리 */
function cleanCircuit(raw) {
  const parts = Array.isArray(raw?.parts) ? raw.parts : Array.isArray(raw?.circuit?.parts) ? raw.circuit.parts : null;
  if (!parts) return null;
  const ok = parts.filter((p) => PARTS[p?.type] && ['x1', 'y1', 'x2', 'y2'].every((k) => Number.isFinite(Number(p[k]))));
  return { version: 1, parts: ok.map((p) => ({ id: p.id || newId(), type: p.type, x1: Math.round(p.x1), y1: Math.round(p.y1), x2: Math.round(p.x2), y2: Math.round(p.y2), props: { ...(PARTS[p.type].defaults || {}), ...(p.props || {}) } })), dt: Number(raw.dt || raw?.circuit?.dt) || undefined };
}

export default function CircuitLab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [circuit, setCircuit] = useState(() => exampleCircuit('led'));
  const [title, setTitle] = useState('LED와 저항');
  const [projectId, setProjectId] = useState(params.get('project') || '');
  const [savedId, setSavedId] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState('select');
  const [running, setRunning] = useState(true);
  const [dt, setDt] = useState(1e-5);
  const [speed, setSpeed] = useState(50); // 프레임당 단계 수
  const [span, setSpan] = useState(0.02);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [openList, setOpenList] = useState(false);
  const [, setTick] = useState(0);
  const [scopeVersion, setScopeVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  // 정밀 해석
  const [mode, setMode] = useState('live'); // live | analysis
  const [aSettings, setASettings] = useState(() => defaultSettings(exampleCircuit('led')));
  const [aOut, setAOut] = useState(null);
  const [aRunning, setARunning] = useState(false);
  const [aProgress, setAProgress] = useState(0);
  const [aCircuit, setACircuit] = useState(null); // 해석을 돌린 회로 (바뀌었는지 알리려고)
  const [traces, setTraces] = useState([]);
  const [probeOn, setProbeOn] = useState(true);
  const workerRef = useRef(null);

  const simRef = useRef(null);
  const recorder = useMemo(() => new ScopeRecorder(), []);
  const viewRef = useRef({ scale: 20, ox: 300, oy: 200 });
  const live = useRef({ running: true, steps: 50, onError: null });
  const history = useRef({ past: [], future: [] });
  const fileRef = useRef(null);
  const canvasBox = useRef(null);

  live.current.running = running;
  live.current.steps = speed;
  live.current.onError = (msg) => { setRunning(false); setError(msg); };

  const { data: projects = [] } = useQuery({ queryKey: ['circuitProjects'], queryFn: () => base44.entities.ProtoProject.list('-updated_date', 200) });
  const { data: saved = [], isLoading: savedLoading } = useQuery({ queryKey: ['circuitDesigns'], queryFn: () => base44.entities.CircuitDesign.list('-updated_date', 200), enabled: openList || !!params.get('id') });

  // 회로가 바뀌면 시뮬레이터를 갱신 (값만 바뀌면 상태 유지)
  useEffect(() => {
    const sim = simRef.current;
    if (sim && !sim.error && sim.updateParts(circuit)) return;
    simRef.current = new Simulator(circuit, { dt });
    setError('');
    recorder.clear();
  }, [circuit]);  

  useEffect(() => {
    const sim = simRef.current;
    if (sim) { sim.dt = dt; sim.touch(); }
    recorder.configure(span, dt);
  }, [dt, span, recorder]);

  // 측정값 표시를 초당 몇 번만 갱신
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 250); return () => clearInterval(t); }, []);

  const fit = useCallback((parts) => {
    const r = canvasBox.current?.getBoundingClientRect();
    if (r) fitView(viewRef.current, parts, r.width, r.height);
  }, []);
  useEffect(() => { fit(circuit.parts); }, []);  

  const change = useCallback((next) => {
    history.current.past.push(circuit);
    if (history.current.past.length > 100) history.current.past.shift();
    history.current.future = [];
    setCircuit(next);
    setDirty(true);
  }, [circuit]);

  const undo = useCallback(() => {
    const h = history.current;
    if (!h.past.length) return;
    h.future.push(circuit);
    setCircuit(h.past.pop());
    setSelectedId(null);
  }, [circuit]);
  const redo = useCallback(() => {
    const h = history.current;
    if (!h.future.length) return;
    h.past.push(circuit);
    setCircuit(h.future.pop());
    setSelectedId(null);
  }, [circuit]);

  const selected = circuit.parts.find((p) => p.id === selectedId) || null;
  const updateSelected = (fn) => { if (selected) change({ ...circuit, parts: circuit.parts.map((p) => (p.id === selected.id ? fn(p) : p)) }); };
  const rotate = () => updateSelected((p) => ({ ...p, x2: p.x1 - (p.y2 - p.y1), y2: p.y1 + (p.x2 - p.x1) }));
  const remove = () => { if (!selected) return; change({ ...circuit, parts: circuit.parts.filter((p) => p.id !== selected.id) }); setSelectedId(null); };

  // 단축키
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'escape') { setTool('select'); return; }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); remove(); return; }
      if (k === 'r' && selected) { rotate(); return; }
      if (k === ' ') { e.preventDefault(); if (mode === 'live') setRunning((r) => !r); return; }
      if (SHORTCUT[k]) setTool(SHORTCUT[k]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const load = (c, t, opts = {}) => {
    history.current = { past: [], future: [] };
    setCircuit(c);
    setTitle(t);
    setSelectedId(null);
    setTool('select');
    if (c.dt) setDt(c.dt);
    setSavedId(opts.id || '');
    setProjectId(opts.projectId ?? projectId);
    setDirty(false);
    setError('');
    setRunning(true);
    recorder.traces.splice(0);
    setScopeVersion((v) => v + 1);
    setASettings(defaultSettings(c));
    setAOut(null); setTraces([]); setACircuit(null);
    setTimeout(() => fit(c.parts), 0);
  };

  // 주소의 ?id= 로 저장된 회로 열기
  useEffect(() => {
    const id = params.get('id');
    if (!id || !saved.length || savedId === id) return;
    const rec = saved.find((r) => r.id === id);
    if (rec) load(cleanCircuit(rec.circuit) || emptyCircuit(), rec.title, { id: rec.id, projectId: rec.project_id || '' });
  }, [saved, params]);  

  const reset = () => { simRef.current?.reset(); recorder.clear(); setError(''); setRunning(true); };

  const addScope = (kind) => {
    if (!selected) return;
    const name = selected.type === 'probe' ? '전압 표시' : PARTS[selected.type]?.label || selected.type;
    const same = circuit.parts.filter((p) => p.type === selected.type);
    const label = traceLabel(selected, kind, same.length > 1 ? `${name}${same.indexOf(selected) + 1}` : name);
    recorder.add(selected.id, kind, label);
    recorder.clear();
    setScopeVersion((v) => v + 1);
  };

  // ── 정밀 해석 ──
  const refs = useMemo(() => refNames(circuit.parts), [circuit.parts]);
  const nodeName = (n) => (n === 0 ? '0 (접지)' : `N${n}`);
  const stopWorker = () => { workerRef.current?.terminate(); workerRef.current = null; };
  useEffect(() => stopWorker, []);

  const runAnalysisNow = () => {
    const req = buildRequest(aSettings);
    const bad = checkRequest(req);
    if (bad) { setAOut({ runs: [], error: bad }); return; }
    stopWorker();
    const w = new Worker(new URL('../lib/circuit/analysis.worker.js', import.meta.url), { type: 'module' });
    workerRef.current = w;
    const id = Date.now();
    const snap = JSON.parse(JSON.stringify(circuit));
    setARunning(true); setAProgress(0);
    w.onmessage = (e) => {
      if (e.data.id !== id) return;
      if (e.data.progress != null) setAProgress(e.data.progress);
      if (e.data.done) {
        setARunning(false); stopWorker();
        setAOut(e.data.out); setACircuit(snap);
        // 그래프가 비어 있으면 그럴듯한 노드 하나를 먼저 올린다
        if (!e.data.out.error && e.data.out.type !== 'op' && traces.length === 0) {
          const guess = circuit.parts.find((p) => p.type === 'probe') || circuit.parts.find((p) => ['capacitor', 'led'].includes(p.type));
          const n = guess ? simRef.current?.nodeAt(guess.x1, guess.y1) : 0;
          if (n) setTraces([{ id: `v${n}`, kind: 'v', node: n, label: `V(${nodeName(n)})`, color: TRACE_COLORS[0], at: { x: guess.x1, y: guess.y1 } }]);
        }
      }
    };
    w.onerror = (err) => { setARunning(false); stopWorker(); setAOut({ runs: [], error: `해석을 시작하지 못했습니다: ${err.message || ''}` }); };
    w.postMessage({ id, circuit: snap, settings: req });
  };

  const toggleTrace = (t) => {
    setTraces((list) => {
      if (list.some((x) => x.id === t.id)) return list.filter((x) => x.id !== t.id);
      const used = new Set(list.map((x) => x.color));
      const color = TRACE_COLORS.find((c) => !used.has(c)) || TRACE_COLORS[list.length % TRACE_COLORS.length];
      return [...list.slice(-7), { ...t, color }];
    });
  };
  const nodeTrace = (n, at) => ({ id: `v${n}`, kind: 'v', node: n, label: `V(${nodeName(n)})`, at });
  const partTrace = (p) => ({ id: `i${p.id}`, kind: 'i', partId: p.id, label: `I(${refs.get(p.id) || PARTS[p.type]?.label})` });

  const onCanvasSelect = (id) => {
    setSelectedId(id);
    if (mode !== 'analysis' || !probeOn || !id || !aOut || aOut.error || aOut.type === 'op') return;
    const p = circuit.parts.find((x) => x.id === id);
    const sim = simRef.current;
    if (!p || !sim) return;
    if (p.type === 'wire' || p.type === 'probe') {
      const n = sim.nodeAt(p.x1, p.y1);
      if (n) toggleTrace(nodeTrace(n, { x: (p.x1 + (p.type === 'wire' ? p.x2 : p.x1)) / 2, y: (p.y1 + (p.type === 'wire' ? p.y2 : p.y1)) / 2 }));
    } else if (!['ground', 'voltmeter'].includes(p.type)) toggleTrace(partTrace(p));
  };

  const switchMode = (m) => {
    setMode(m);
    if (m === 'analysis') { setRunning(false); if (!aOut) setASettings((s0) => ({ ...defaultSettings(circuit), type: s0.type })); }
    else { stopWorker(); setARunning(false); setRunning(true); }
  };
  const stale = mode === 'analysis' && aOut && aCircuit && JSON.stringify(aCircuit.parts) !== JSON.stringify(circuit.parts);
  // 노드마다 이어진 부품 이름 (동작점 표·노드 표시에 쓴다)
  const nodeParts = (n) => {
    const sim = simRef.current;
    if (!sim) return '';
    return sim.els.filter((e) => e.n.includes(n) && refs.get(e.id)).map((e) => refs.get(e.id)).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  };
  // 동작점 결과는 회로도의 노드마다 전압을 적는다 (LTspice 처럼)
  const opMarks = () => {
    const sim = simRef.current, r = aOut?.runs?.[0]?.result;
    if (!sim || !r?.nodes || stale) return [];
    const seen = new Set(), out = [];
    const pts = [...sim.topo.segments.map((g) => ({ x: (g.ax + g.bx) / 2, y: (g.ay + g.by) / 2, n: g.node })), ...[...sim.topo.pointNode].map(([k, n]) => { const [x, y] = k.split(',').map(Number); return { x, y, n }; })];
    pts.forEach((p) => {
      if (!p.n || seen.has(p.n) || out.length >= 40) return;
      seen.add(p.n);
      out.push({ id: `op${p.n}`, at: { x: p.x, y: p.y }, color: '#475569', label: `N${p.n} ${formatSI(r.nodes[p.n - 1], 'V', 3)}` });
    });
    return out;
  };
  const marks = mode !== 'analysis' ? [] : aOut?.type === 'op' && !aOut.error ? opMarks() : traces.map((t) => ({ ...t }));

  const save = async () => {
    if (!title.trim()) { toast({ title: '회로 이름을 적어 주세요', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const project = projects.find((p) => p.id === projectId);
      const data = { title: title.trim(), project_id: projectId || '', project_title: project?.title || '', circuit: { version: 1, parts: circuit.parts, dt }, part_count: circuit.parts.filter((p) => p.type !== 'wire').length, updated_by_name: actorName(user) };
      const rec = savedId
        ? await base44.entities.CircuitDesign.update(savedId, data)
        : await base44.entities.CircuitDesign.create({ ...data, tenant_id: user.tenant_id, created_by_name: actorName(user) });
      setSavedId(rec.id);
      setDirty(false);
      setParams((p) => { const n = new URLSearchParams(p); n.set('id', rec.id); return n; }, { replace: true });
      qc.invalidateQueries({ queryKey: ['circuitDesigns'] });
      toast({ title: '회로를 저장했습니다' });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setSaving(false);
  };

  const importJson = async (file) => {
    try {
      const c = cleanCircuit(JSON.parse(await file.text()));
      if (!c) throw new Error('회로 파일이 아닙니다.');
      load(c, file.name.replace(/\.json$/i, ''), { projectId });
    } catch (e) { toast({ title: e.message || '파일을 읽지 못했습니다.', variant: 'destructive' }); }
  };

  const sim = simRef.current;
  const info = selected ? sim?.info(selected.id) : null;
  const warnings = sim?.warnings || [];
  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary"><CircuitBoard className="h-5 w-5" /><span className="text-label font-semibold">회로 시뮬레이터</span></div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="h-9 w-64 text-title font-semibold" aria-label="회로 이름" />
            <select className="h-9 max-w-[220px] rounded-md border bg-transparent px-2 text-label" value={projectId} onChange={(e) => { setProjectId(e.target.value); setDirty(true); }} aria-label="연결할 시제품">
              <option value="">시제품 연결 안 함</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {project && <Link to={`/prototypes/${project.id}`} className="text-caption text-primary hover:underline">시제품 열기</Link>}
            {dirty && <span className="text-caption text-muted-foreground">저장 안 된 변경</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => load(emptyCircuit(), '새 회로', { projectId })}><FilePlus2 className="h-4 w-4" />새 회로</Button>
          <select className="h-9 rounded-md border bg-transparent px-2 text-label" value="" onChange={(e) => { const ex = EXAMPLES.find((x) => x.key === e.target.value); if (ex) load(exampleCircuit(ex.key), ex.title, { projectId }); }} aria-label="예제 회로 열기">
            <option value="">예제 열기…</option>
            {EXAMPLES.map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => setOpenList(true)}><FolderOpen className="h-4 w-4" />저장된 회로</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />불러오기</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          <Button variant="outline" size="sm" onClick={() => download(`${title || 'circuit'}.json`, JSON.stringify({ title, dt, parts: circuit.parts }, null, 1), 'application/json')}><Download className="h-4 w-4" />JSON</Button>
          <Button variant="outline" size="sm" onClick={() => download(`${title || 'circuit'}.cir`, toSpice(circuit, mode === 'analysis' ? { title, analysis: buildRequest(aSettings) } : { title, dt, stop: Math.max(dt * 2000, span) }), 'text/plain')}><Download className="h-4 w-4" />SPICE</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}저장</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2">
        <div className="flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="시뮬레이션 방식">
          {[['live', '실시간', Activity], ['analysis', '정밀 해석', LineChart]].map(([k, l, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => switchMode(k)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label ${mode === k ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'}`}><Icon className="h-3.5 w-3.5" />{l}</button>
          ))}
        </div>
        <span className="mx-1 h-5 w-px bg-border" />
        {mode === 'analysis' ? (
          <>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} title="되돌리기 (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} title="다시 하기 (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
            <span className="text-caption text-muted-foreground">해석을 실행한 뒤 회로도의 전선(전압)이나 부품(전류)을 누르면 그래프에 올라갑니다.</span>
            {stale && <span className="text-caption font-medium text-warning-text">회로가 바뀌었습니다. 다시 실행하세요.</span>}
          </>
        ) : (<>
        <Button size="sm" variant={running ? 'secondary' : 'default'} onClick={() => { if (error) return; setRunning(!running); }} disabled={!!error}>
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{running ? '일시정지' : '실행'}
        </Button>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="h-4 w-4" />처음부터</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} title="되돌리기 (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} title="다시 하기 (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <label className="flex items-center gap-1.5 text-caption text-muted-foreground">시간 간격
          <select className="h-8 rounded-md border bg-transparent px-1.5 text-label text-foreground" value={dt} onChange={(e) => setDt(Number(e.target.value))}>
            {DTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-caption text-muted-foreground">속도
          <input type="range" min={1} max={400} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-28 accent-primary" aria-label="시뮬레이션 속도" />
        </label>
        <span className="font-mono text-caption tabular-nums text-muted-foreground">t = {formatSI(sim?.t || 0, 's')} · 실제 1초에 {formatSI(dt * speed * 60, 's', 2)} 진행</span>
        {sim?.slow > 0 && <span className="text-caption text-warning-text">수렴 지연 {sim.slow}회</span>}
        </>)}
      </div>

      {(error || warnings.length > 0) && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-label ${error ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning-text'}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{error && <p>{error} 회로를 고치면 다시 계산합니다.</p>}{warnings.map((w) => <p key={w}>{w}</p>)}</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[176px_minmax(0,1fr)_288px]">
        <div className="order-2 max-h-56 overflow-y-auto rounded-xl border bg-card p-2.5 lg:order-1 lg:max-h-[620px]">
          <PartPalette tool={tool} setTool={setTool} />
        </div>
        <div className="order-1 min-w-0 space-y-4 lg:order-2">
          <div ref={canvasBox} className="h-[460px] lg:h-[620px]">
            <CircuitCanvas circuit={circuit} onChange={change} selectedId={selectedId} onSelect={onCanvasSelect} tool={tool} setTool={setTool}
              simRef={simRef} live={live} recorder={recorder} viewRef={viewRef} marks={marks} showLive={mode === 'live'} />
          </div>
          {mode === 'analysis' ? (
            <AnalysisPanel circuit={circuit} settings={aSettings} setSettings={setASettings} out={aOut} running={aRunning} progress={aProgress}
              onRun={runAnalysisNow} onCancel={() => { stopWorker(); setARunning(false); }} traces={traces} setTraces={setTraces}
              probeOn={probeOn} setProbeOn={setProbeOn} nodeName={nodeName} nodeParts={nodeParts} />
          ) : (
            <ScopePanel recorder={recorder} span={span} onSpan={setSpan} version={scopeVersion} dark={isDark()} onRemove={(i) => { recorder.remove(i); setScopeVersion((v) => v + 1); }} />
          )}
        </div>
        <div className="order-3 rounded-xl border bg-card p-4 lg:max-h-[620px] lg:overflow-y-auto">
          {selected ? (
            <PropertiesPanel part={selected} info={mode === 'live' ? info : null} refName={refs.get(selected.id)} onProps={(props) => updateSelected((p) => ({ ...p, props }))} onRotate={rotate} onDelete={remove} onScope={mode === 'live' ? addScope : null}>
              {mode === 'analysis' && aOut && !aOut.error && aOut.type !== 'op' && !['wire', 'ground'].includes(selected.type) && (
                <div className="space-y-1.5">
                  <p className="text-caption text-muted-foreground">결과 그래프에 올리기</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.type !== 'probe' && selected.type !== 'voltmeter' && <Button size="sm" variant="outline" onClick={() => toggleTrace(partTrace(selected))}>전류</Button>}
                    {terminals(selected).map((t, k) => {
                      const n = simRef.current?.nodeAt(t.x, t.y);
                      if (!n) return null;
                      const nm = TERMINAL_NAMES[selected.type]?.[k] || (terminals(selected).length === 1 ? '' : k === 0 ? '1번' : '2번');
                      return <Button key={k} size="sm" variant="outline" onClick={() => toggleTrace(nodeTrace(n, t))}>{nm ? `${nm} 단자 ` : ''}전압 V({nodeName(n)})</Button>;
                    })}
                  </div>
                </div>
              )}
            </PropertiesPanel>
          ) : (
            <div className="space-y-3 text-label">
              <p className="text-title font-semibold">사용 방법</p>
              <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
                <li>왼쪽에서 부품을 고르고 회로도에서 끌면 그 길이·방향으로 놓입니다. 클릭만 하면 기본 길이로 놓입니다.</li>
                <li>전선(W)은 점에서 점으로 끕니다. 대각선으로 끌면 ㄱ자로 이어집니다. 전선 가운데에 닿은 단자도 연결됩니다.</li>
                <li>부품을 끌어 옮기고, 고른 부품의 동그란 끝점을 끌어 늘이거나 방향을 바꿉니다. 스위치는 클릭하면 켜고 꺼집니다.</li>
                <li>R 돌리기 · Delete 지우기 · Ctrl+Z 되돌리기 · 스페이스 실행/정지 · 휠 확대 · 빈 곳 끌기 화면 이동</li>
                <li>선 색은 전압(초록 +, 빨강 −), 노란 점은 전류의 방향과 크기입니다.</li>
              </ul>
              <p className="text-caption text-muted-foreground">위쪽의 ‘정밀 해석’에서 동작점·과도·교류(보드 선도)·직류 스윕과 부품 오차(몬테카를로)·온도 해석을 할 수 있습니다. 부품 모델은 데이터시트 대표값 근사이므로, 제조사 모델로 최종 확인할 때는 SPICE 로 내보내 LTspice 에서 확인하세요.</p>
              {EXAMPLES.find((x) => x.title === title)?.note && <p className="rounded-lg bg-primary/5 p-3 text-caption text-foreground">{EXAMPLES.find((x) => x.title === title).note}</p>}
            </div>
          )}
        </div>
      </div>

      <Dialog open={openList} onOpenChange={setOpenList}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>저장된 회로</DialogTitle></DialogHeader>
          {savedLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : saved.length === 0 ? <p className="py-6 text-center text-label text-muted-foreground">아직 저장한 회로가 없습니다.</p>
            : (
              <div className="max-h-[420px] space-y-1 overflow-y-auto">
                {saved.map((r) => (
                  <button key={r.id} type="button" className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted"
                    onClick={() => { load(cleanCircuit(r.circuit) || emptyCircuit(), r.title, { id: r.id, projectId: r.project_id || '' }); setParams((p) => { const n = new URLSearchParams(p); n.set('id', r.id); return n; }, { replace: true }); setOpenList(false); }}>
                    <p className="text-label font-medium">{r.title}</p>
                    <p className="text-caption text-muted-foreground">{[r.project_title, `부품 ${r.part_count ?? '-'}개`, r.updated_by_name, String(r.updated_date || '').slice(0, 10)].filter(Boolean).join(' · ')}</p>
                  </button>
                ))}
              </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
