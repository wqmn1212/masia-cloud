import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLeaveGuard } from '@/lib/useLeaveGuard';
import { Link, useSearchParams } from 'react-router-dom';
import { CircuitBoard, Upload, Download, Save, Loader2, Undo2, Redo2, MousePointer2, Spline, CircleDot, Maximize, FileText, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useProtoProject, signProtoFile, uploadProtoFile, addProtoFiles, errorText } from '@/lib/prototypeApi';
import PcbCanvas, { LAYER_COLOR } from '@/components/pcb/PcbCanvas';
import { DrcPanel, NetRulesPanel, SimPanel, PropsPanel, ImpedancePanel, KIND_LABEL } from '@/components/pcb/PcbPanels';
import { parseBoard, toKicadText, placeFootprint, flipFootprint, addTrack, addVia, removeItems, updateTrack, boardStats, netName } from '@/lib/pcbArt/board';
import { analyzeConnectivity } from '@/lib/pcbArt/connectivity';
import { runDrc, guessNetRules, drcCounts, FAB_PROFILES } from '@/lib/pcbArt/drc';
import { widthForCurrent } from '@/lib/pcbArt/ipc';
import { boardsFromZip } from '@/lib/pcbArt/zipRead';
import { takeHandoff } from '@/lib/pcbArt/handoff';

const TABS = [['drc', '검사'], ['nets', '넷 설정'], ['sim', '시뮬레이션'], ['props', '선택'], ['z0', '임피던스']];
const LAYER_TOGGLES = [['F.Cu', '앞 동박'], ['B.Cu', '뒤 동박'], ['zones', '동박면'], ['F.SilkS', '앞 실크'], ['B.SilkS', '뒤 실크'], ['ratsnest', '미연결선'], ['drc', '검사 표시'], ['refs', '부품 이름']];
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const ruleKey = (name) => `pcbart.rules.${name}`;
const loadRules = (name) => { try { return JSON.parse(localStorage.getItem(ruleKey(name)) || 'null'); } catch { return null; } };
const saveRules = (name, r) => { try { localStorage.setItem(ruleKey(name), JSON.stringify(r)); } catch { /* 저장 불가 환경 */ } };
// 초록 → 노랑 → 빨강
const heat = (x) => { const t = Math.max(0, Math.min(1, x)); const r = t < 0.5 ? Math.round(52 + (255 - 52) * t * 2) : 255; const g = t < 0.5 ? Math.round(199 + (214 - 199) * t * 2) : Math.round(214 - (214 - 59) * (t - 0.5) * 2); const b = t < 0.5 ? Math.round(89 - 79 * t * 2) : Math.round(10 + 38 * (t - 0.5) * 2); return `rgb(${r},${g},${b})`; };

/** 검토 보고서 (마크다운): 공장·설계자에게 그대로 보낼 수 있게 */
function reportText(name, board, drc, rules, profile, sim) {
  const st = boardStats(board), c = drcCounts(drc);
  const lines = [`# PCB 아트웍 검토 — ${name}`, '', `- 날짜: ${new Date().toISOString().slice(0, 10)}`, `- 기판: ${st.w} × ${st.h} mm · ${st.layers}층 · 부품 ${st.parts} · 넷 ${st.nets} · 트랙 ${st.tracks} · 비아 ${st.vias} · 동박면 ${st.zones}`, `- 제조 기준: ${FAB_PROFILES[profile].label}`, `- 결과: 오류 ${c.error} · 주의 ${c.warn} · 참고 ${c.info}`, ''];
  const keyNets = Object.entries(rules).filter(([, r]) => r.kind !== 'signal' || r.i > 0);
  if (keyNets.length) lines.push('## 넷 기준', '', '| 넷 | 종류 | 전압 | 전류 |', '|---|---|---|---|', ...keyNets.map(([id, r]) => `| ${netName(board, Number(id))} | ${KIND_LABEL[r.kind]} | ${r.v || '-'} V | ${r.i || '-'} A |`), '');
  for (const sev of ['error', 'warn', 'info']) {
    const list = drc.filter((d) => d.sev === sev);
    if (!list.length) continue;
    lines.push(`## ${sev === 'error' ? '오류' : sev === 'warn' ? '주의' : '참고'} (${list.length})`, '');
    const seen = new Map();
    for (const d of list) { const k = d.code === 'unrouted' ? `미연결 ${netName(board, d.net)}` : `${d.title}`; seen.set(k, (seen.get(k) || { d, n: 0 })); seen.get(k).n += 1; }
    for (const [k, { d, n: cnt }] of [...seen.entries()].slice(0, 150)) lines.push(`- [${d.cat}] ${k}${cnt > 1 ? ` (${cnt}곳)` : ''} — ${d.detail}${d.at ? ` @ (${d.at[0].toFixed(2)}, ${d.at[1].toFixed(2)}) mm` : ''}`);
    lines.push('');
  }
  if (sim?.ok) {
    lines.push(`## 시뮬레이션 — ${netName(board, sim.net)}`, '', `- 부하 합계 ${sim.total.toFixed(3)} A, 가장 큰 강하 ${(sim.maxDrop * 1000).toFixed(1)} mV, 동박 손실 ${(sim.loss * 1000).toFixed(1)} mW`);
    if (sim.hotTrack) lines.push(`- 가장 뜨거운 트랙: +${sim.hotTrack.dT.toFixed(1)} °C (${sim.hotTrack.I.toFixed(2)} A, 폭 ${sim.hotTrack.w} mm)`);
    if (sim.hotSpoke) lines.push(`- 서멀 스포크: ${sim.hotSpoke.ref} ${sim.hotSpoke.num}번 +${sim.hotSpoke.dT.toFixed(1)} °C`);
    lines.push('');
  }
  lines.push('> 앱의 근사 검사입니다 (IPC-2221B 기준식, 동박면은 연속 판 근사). 발주 전 KiCad DRC 와 설계자 검토를 함께 하세요.');
  return lines.join('\n');
}

// PCB 아트웍 스튜디오: 기판을 열어 보고 고치고, 검사하고, 넷을 시뮬레이션한다
export default function PcbStudio() {
  const [params] = useSearchParams();
  const projectId = params.get('project');
  const { user } = useAuth();
  const { data: project } = useProtoProject(projectId);
  const [name, setName] = useState('');
  const [board, setBoard] = useState(null);
  const [cleanBoard, setCleanBoard] = useState(null); // 마지막으로 열거나 내보내거나 저장한 기판
  useLeaveGuard(!!board && board !== cleanBoard, { back: true, message: '고친 기판을 아직 내려받거나 시제품에 저장하지 않았습니다. 떠나면 사라집니다. 떠날까요?' });
  const [choices, setChoices] = useState([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const hist = useRef({ past: [], future: [] });
  const [, setTick] = useState(0);
  const [rules, setRules] = useState({});
  const [profile, setProfile] = useState('jlc2');
  const [tab, setTab] = useState('drc');
  const [tool, setTool] = useState('select');
  const [activeLayer, setActiveLayer] = useState('F.Cu');
  const [routeWidth, setRouteWidth] = useState(0.25);
  const [visible, setVisible] = useState({});
  const [selected, setSelected] = useState(null);
  const [highlightNet, setHighlightNet] = useState(null);
  const [focus, setFocus] = useState(null);
  const [sim, setSim] = useState(null);
  const [colorBy, setColorBy] = useState('dT');
  const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState('');
  const fileRef = useRef(null);

  // 열기
  const open = useCallback((text, n) => {
    try {
      const b = parseBoard(text);
      setBoard(b); setCleanBoard(b); setName(n); setChoices([]); setError(''); setSelected(null); setSim(null); setHighlightNet(null);
      hist.current = { past: [], future: [] };
      setRules({ ...guessNetRules(b), ...(loadRules(n) || {}) });
      setActiveLayer(b.copper[0] || 'F.Cu');
    } catch (e) { setError(`기판을 읽지 못했습니다: ${e.message}`); }
  }, []);
  const openList = useCallback((list) => { if (!list.length) setError('zip 안에 .kicad_pcb 기판 파일이 없습니다.'); else if (list.length === 1) open(list[0].text, list[0].name.split('/').pop()); else setChoices(list); }, [open]);
  const openBytes = useCallback(async (bytes, n) => {
    const head = new Uint8Array(bytes.slice(0, 2));
    if (head[0] === 0x50 && head[1] === 0x4b) openList(await boardsFromZip(new Uint8Array(bytes)));
    else open(new TextDecoder().decode(bytes), n);
  }, [open, openList]);

  useEffect(() => {
    const go = async () => {
      // 1) 워크벤치 자동 배선 결과 (같은 탭에서 넘겨받음)
      if (params.get('from') === 'fab') { const h = takeHandoff(); if (h?.bytes) { await openBytes(h.bytes, h.name); return; } }
      if (!projectId || !project) return;
      // 2) 시제품 파일
      const fileId = params.get('file');
      if (fileId) {
        setLoading('시제품 파일을 받는 중…');
        try {
          const url = await signProtoFile(projectId, fileId);
          const f = (project.files || []).find((x) => x.id === fileId);
          const buf = await (await fetch(url)).arrayBuffer();
          await openBytes(buf, f?.name || 'board.kicad_pcb');
        } catch (e) { setError(errorText(e)); }
        setLoading(''); return;
      }
      // 3) 워크벤치 설계로 만든 기판 (배선 전)
      const key = params.get('board');
      if (key && project.dev) {
        setLoading('워크벤치 설계로 기판을 만드는 중…');
        try {
          const [lib, { buildHwPackage }] = await Promise.all([import('@/lib/hw/kicadLib.data'), import('@/lib/hw/exportHw')]);
          const pkg = buildHwPackage(project.dev, lib, { title: project.title, seed: project.id, date: new Date().toISOString().slice(0, 10) });
          const b = pkg.boards.find((x) => x.key === key) || pkg.boards[0];
          open(b.pcb.text, `${b.slug}.kicad_pcb`);
        } catch (e) { setError(errorText(e)); }
        setLoading('');
      }
    };
    go();
  }, [projectId, project?.id]);

  // 편집 (되돌리기 가능)
  const commit = (next) => { hist.current.past.push(board); if (hist.current.past.length > 80) hist.current.past.shift(); hist.current.future = []; setBoard(next); };
  const undo = () => { const h = hist.current; if (!h.past.length) return; h.future.push(board); setBoard(h.past.pop()); setTick((t) => t + 1); };
  const redo = () => { const h = hist.current; if (!h.future.length) return; h.past.push(board); setBoard(h.future.pop()); setTick((t) => t + 1); };
  const rotateSel = () => { if (selected?.type === 'fp') { const f = board.footprints[selected.index]; commit(placeFootprint(board, selected.index, { rot: f.rot + 90 })); } };
  const flipSel = () => { if (selected?.type === 'fp') commit(flipFootprint(board, selected.index)); };
  const deleteSel = () => { if (selected?.type === 'track' || selected?.type === 'via') { commit(removeItems(board, [selected.id])); setSelected(null); } };

  const conn = useMemo(() => (board ? analyzeConnectivity(board) : null), [board]);
  const simFresh = sim?.ok && sim.board === board;
  const drc = useMemo(() => (board ? runDrc(board, { profile, rules, conn, segCurrents: simFresh ? sim.segCurrents : null }) : []), [board, profile, rules, conn, simFresh]);
  const counts = drcCounts(drc);
  useEffect(() => { if (name && board) saveRules(name, rules); }, [rules]);

  // 시뮬레이션 색
  const simOverlay = useMemo(() => {
    if (!simFresh || colorBy === 'off') return null;
    const byTrack = new Map();
    for (const e of sim.edges) if (e.kind === 'track') { const v = colorBy === 'J' ? e.J / 50 : e.dT / 20; byTrack.set(e.key, Math.max(byTrack.get(e.key) || 0, v)); }
    return {
      trackColor: (id) => (byTrack.has(id) ? heat(byTrack.get(id)) : null),
      markers: sim.edges.filter((e) => e.kind === 'spoke').map((e) => ({ at: e.at[0], color: heat(colorBy === 'J' ? e.J / 50 : e.dT / 20) })),
    };
  }, [sim, simFresh, colorBy]);

  // 단축키 (입력 칸 밖에서)
  const keys = useRef({});
  keys.current = { undo, redo, rotateSel, flipSel, deleteSel, setTool, setSelected, board, setActiveLayer, tool };
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
      const k = e.key.toLowerCase(), K = keys.current;
      if (!K.board) return;
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); (e.shiftKey ? K.redo : K.undo)(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); K.redo(); return; }
      if (K.tool === 'route' && ['v', 'enter', 'backspace', 'escape'].includes(k)) return; // 배선 중 키는 캔버스가
      if (k === 'r') K.rotateSel();
      else if (k === 'f') K.flipSel();
      else if (k === 'delete' || k === 'backspace') K.deleteSel();
      else if (k === 'escape') { K.setSelected(null); K.setTool('select'); }
      else if (k === 'x') K.setTool('route');
      else if (k === 's') K.setTool('select');
      else if (k === 'l') K.setActiveLayer((l) => { const c = K.board.copper; return c[(c.indexOf(l) + 1) % c.length]; });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const download = (data, n, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const outName = () => name.replace(/\.kicad_pcb$/i, '').replace(/[^\w.-]+/g, '_') || 'board';
  const exportPcb = () => { download(toKicadText(board), `${outName()}-edited.kicad_pcb`, 'text/plain'); setCleanBoard(board); };
  const report = () => reportText(name, board, drc, rules, profile, simFresh ? sim : null);
  const saveToProject = async () => {
    setBusy('save');
    try {
      const files = [];
      const pcbF = await uploadProtoFile(new File([toKicadText(board)], `${outName()}-${stamp()}.kicad_pcb`, { type: 'text/plain' }), user, { category: 'PCB', note: `PCB 아트웍 스튜디오에서 저장 (오류 ${counts.error} · 주의 ${counts.warn})${board.fillsStale ? ' — 동박면은 KiCad 에서 다시 채우기(B)' : ''}` });
      files.push(pcbF);
      const repF = await uploadProtoFile(new File([report()], `${outName()}-review-${stamp()}.md`, { type: 'text/markdown' }), user, { category: 'PCB', note: 'PCB 아트웍 검토 보고서' });
      files.push(repF);
      await addProtoFiles(projectId, files);
      setCleanBoard(board);
      toast({ title: '기판과 검토 보고서를 시제품 파일에 저장했습니다' });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };
  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 40 * 1024 * 1024) { setError('40MB 이하 파일만 열 수 있습니다.'); return; }
    setLoading('파일을 읽는 중…');
    try { await openBytes(await f.arrayBuffer(), f.name); } catch (er) { setError(er.message); }
    setLoading('');
  };
  const focusLoad = (key) => { const p = board.footprints.flatMap((f) => f.pads).find((x) => `p:${x.ref}:${x.num}:${x.at.join(',')}` === key); if (p) setFocus({ at: p.at, scale: 20, t: Date.now() }); };
  const selNet = selected?.net || (selected?.type === 'track' && board?.tracks.find((t) => t.id === selected.id)?.net) || 0;
  const needW = selNet && rules[selNet]?.i ? widthForCurrent(rules[selNet].i) : 0;

  return (
    <div className="touch-roomy mx-auto max-w-[1600px] space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {project && <Link to={`/prototypes/${project.id}/develop?step=circuit`} className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{project.title}</Link>}
          <div className="mt-1 flex items-center gap-2 text-primary"><CircuitBoard className="h-5 w-5" /><span className="text-label font-semibold">PCB 아트웍 스튜디오</span></div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{name || '기판을 열어 보고 · 고치고 · 검사하고 · 시뮬레이션'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".kicad_pcb,.zip" className="hidden" onChange={pickFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />기판 파일 열기</Button>
          {board && <Button variant="outline" onClick={exportPcb}><Download className="h-4 w-4" />.kicad_pcb</Button>}
          {board && <Button variant="outline" onClick={() => download(report(), `${outName()}-review.md`, 'text/markdown')}><FileText className="h-4 w-4" />검토 보고서</Button>}
          {board && projectId && <Button onClick={saveToProject} disabled={!!busy}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}시제품 파일에 저장</Button>}
        </div>
      </div>

      {loading && <p className="flex items-center gap-2 text-caption text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{loading}</p>}
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-caption text-destructive">{error}</p>}
      {choices.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <span className="text-caption text-muted-foreground">zip 안의 기판:</span>
          {choices.map((c) => <Button key={c.name} size="sm" variant="outline" onClick={() => open(c.text, c.name.split('/').pop())}>{c.name}</Button>)}
        </div>
      )}
      {!board && !loading && (
        <div className="rounded-2xl border bg-card p-6 text-body">
          <p className="font-semibold">기판 파일을 여세요</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-caption text-muted-foreground">
            <li>KiCad 기판 파일(.kicad_pcb) 또는 그것이 든 zip (워크벤치 “자동 배선하고 제조 파일 만들기” 결과 zip 도 됩니다)</li>
            <li>시제품 워크벤치 “회로 설계” 단계에서 “아트웍 스튜디오에서 열기” 를 누르면 워크벤치 설계로 만든 기판이 바로 열립니다</li>
            <li>거버(Gerber)만 있는 기판은 아직 열 수 없습니다 — 설계 업체에 KiCad 파일이나 IPC-2581 을 요청하세요</li>
          </ul>
        </div>
      )}

      {board && (
        <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card p-1.5">
              <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="도구">
                {[['select', '고르기 (S)', MousePointer2], ['route', '배선 (X)', Spline], ['via', '비아', CircleDot]].map(([k, l, Icon]) => (
                  <button key={k} type="button" role="radio" aria-checked={tool === k} onClick={() => setTool(k)} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-caption ${tool === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><Icon className="h-3.5 w-3.5" />{l}</button>
                ))}
              </div>
              <select aria-label="작업 층 (L)" value={activeLayer} onChange={(e) => setActiveLayer(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-caption">
                {board.copper.map((l) => <option key={l} value={l}>{l} {l === 'F.Cu' ? '앞' : l === 'B.Cu' ? '뒤' : ''}</option>)}
              </select>
              <span className="h-3 w-3 rounded-full" style={{ background: LAYER_COLOR[activeLayer] || '#999' }} />
              <label className="flex items-center gap-1 text-caption">폭<Input aria-label="배선 폭 mm" type="number" step="0.05" min="0.1" value={routeWidth} onChange={(e) => Number(e.target.value) > 0 && setRouteWidth(Number(e.target.value))} className="h-8 w-20 tabular-nums" />mm</label>
              {needW > routeWidth && <button type="button" onClick={() => setRouteWidth(Math.ceil(needW * 20) / 20)} className="rounded bg-warning/15 px-2 py-1 text-micro text-warning-text">{netName(board, selNet)} {rules[selNet].i} A → {Math.ceil(needW * 20) / 20} mm 로</button>}
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={undo} disabled={!hist.current.past.length} aria-label="되돌리기 (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={redo} disabled={!hist.current.future.length} aria-label="다시 하기 (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { const pts = board.outline[0]; if (pts) setFocus({ at: [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length], scale: 1, t: Date.now() }); }} aria-label="가운데로"><Maximize className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {LAYER_TOGGLES.filter(([k]) => !k.endsWith('.Cu') || board.copper.includes(k)).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={visible[k] !== false} onClick={() => setVisible((v) => ({ ...v, [k]: v[k] === false }))}
                  className={`rounded-full border px-2.5 py-0.5 text-micro ${visible[k] !== false ? 'border-primary/40 bg-primary/10 text-foreground' : 'text-muted-foreground line-through'}`}>{l}</button>
              ))}
              {highlightNet && <button type="button" onClick={() => setHighlightNet(null)} className="rounded-full bg-primary px-2.5 py-0.5 text-micro text-primary-foreground">강조: {netName(board, highlightNet)} ✕</button>}
            </div>
            <div className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-xl border">
              <PcbCanvas board={board} conn={conn} drc={drc} visible={visible} activeLayer={activeLayer} tool={tool} routeWidth={routeWidth} selected={selected} highlightNet={highlightNet} simOverlay={simOverlay} focus={focus}
                onSelect={(s) => { setSelected(s); if (s) setTab('props'); }}
                onMoveFootprint={(i, x, y) => commit(placeFootprint(board, i, { x, y }))}
                onRoute={({ segments, vias }) => { let b = board; for (const s of segments) b = addTrack(b, { ...s, w: routeWidth }); for (const v of vias) b = addVia(b, v); commit(b); }}
                onAddVia={(v) => commit(addVia(board, v))} onLayer={setActiveLayer} onCursor={setCursor} />
              <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-1.5 text-micro">
                <span className="rounded bg-card/90 px-2 py-0.5 tabular-nums">{cursor ? `${cursor[0].toFixed(2)}, ${cursor[1].toFixed(2)} mm` : '—'}</span>
                <span className="rounded bg-card/90 px-2 py-0.5">{tool === 'route' ? '패드·트랙에서 눌러 시작 → 누를 때마다 꺾기 · V 비아·층 바꾸기 · 같은 넷 패드를 누르거나 Enter·두 번 눌러 끝 · Esc 취소' : tool === 'via' ? '패드·트랙 위를 누르면 그 넷의 비아' : '누르면 고르기 · 부품 끌기 · 빈 곳 끌기·Shift 끌기 = 화면 이동 · 휠 = 확대 · R 돌리기 · F 뒤집기 · Del 지우기'}</span>
              </div>
              {board.fillsStale && board.zones.length > 0 && <p className="absolute right-2 top-2 rounded bg-warning/90 px-2 py-1 text-micro text-black">편집해서 동박면 채움이 낡았습니다 — 점선(근사)으로 봅니다. KiCad 에서 B 로 다시 채우세요.</p>}
            </div>
            <div className="flex flex-wrap gap-2 text-micro text-muted-foreground">
              {Object.entries(boardStats(board)).map(([k, v]) => <span key={k} className="rounded bg-secondary px-2 py-0.5">{{ w: '가로', h: '세로', layers: '층', parts: '부품', nets: '넷', tracks: '트랙', vias: '비아', zones: '동박면' }[k]} {v}{k === 'w' || k === 'h' ? ' mm' : ''}</span>)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border bg-card p-2">
              <span className={`rounded-full px-2 py-0.5 text-micro font-semibold ${counts.error ? 'bg-destructive/10 text-destructive' : 'bg-success/15 text-success-text'}`}>오류 {counts.error}</span>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-micro text-warning-text">주의 {counts.warn}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-micro">참고 {counts.info}</span>
              <select aria-label="제조 기준" value={profile} onChange={(e) => setProfile(e.target.value)} className="ml-auto h-7 rounded border bg-background px-1 text-micro">
                {Object.entries(FAB_PROFILES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap rounded-lg border bg-card p-0.5" role="tablist" aria-label="패널">
              {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-md px-2 py-1.5 text-caption ${tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>)}
            </div>
            <div className="rounded-xl border bg-card p-3">
              {tab === 'drc' && <DrcPanel list={drc} onFocus={(d) => { setFocus({ at: d.at, scale: 25, t: Date.now() }); if (d.net) setHighlightNet(d.net); }} />}
              {tab === 'nets' && <NetRulesPanel board={board} rules={rules} onChange={setRules} highlight={highlightNet} onHighlight={setHighlightNet} />}
              {tab === 'sim' && <SimPanel key={name} board={board} conn={conn} rules={rules} result={sim && sim.board === board ? sim : null} onResult={(r) => { setSim(r ? { ...r, board } : null); if (r?.ok) setHighlightNet(r.net); }} onFocus={focusLoad} colorBy={colorBy} onColorBy={setColorBy} />}
              {tab === 'props' && <PropsPanel board={board} selected={selected} rules={rules} onWidth={(w) => commit(updateTrack(board, selected.id, { w }))} onRotate={rotateSel} onFlip={flipSel} onDelete={deleteSel} />}
              {tab === 'z0' && <ImpedancePanel board={board} selectedWidth={selected?.type === 'track' ? board.tracks.find((t) => t.id === selected.id)?.w : null} />}
            </div>
            {sim?.ok && sim.board !== board && <p className="text-micro text-warning-text">기판을 고쳐서 시뮬레이션 결과가 지난 것입니다. 시뮬레이션 탭에서 다시 실행하세요.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
