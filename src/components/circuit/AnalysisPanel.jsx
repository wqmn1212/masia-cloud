import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, X, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { PARTS, formatSI, parseSI, refNames } from '@/lib/circuit/parts';
import { measureWave, measureBode } from '@/lib/circuit/analysis';
import ResultPlot from './ResultPlot';

export const TRACE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#65a30d'];
const RUN_COLORS = ['#2563eb', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#ea580c', '#4f46e5'];
const TYPES = [['op', '동작점'], ['tran', '과도 해석'], ['ac', '교류 (보드 선도)'], ['dc', '직류 스윕']];
const SOURCES = ['dcv', 'acv', 'pulse', 'dci'];

/** 회로에 맞는 기본 설정 */
export function defaultSettings(circuit) {
  const parts = circuit.parts || [];
  const freqs = parts.filter((p) => p.type === 'acv' || p.type === 'pulse').map((p) => Number(p.props?.freq) || 0).filter((f) => f > 0);
  const fmin = freqs.length ? Math.min(...freqs) : 0, fmax = freqs.length ? Math.max(...freqs) : 0;
  const ac = parts.find((p) => p.type === 'acv') || parts.find((p) => SOURCES.includes(p.type));
  const dc = parts.find((p) => p.type === 'dcv') || parts.find((p) => SOURCES.includes(p.type));
  return {
    type: 'tran',
    stop: fmin ? 5 / fmin : 0.01,
    maxStep: fmax ? 1 / (fmax * 200) : 0,
    fromZero: false,
    sourceId: ac?.id || '',
    fStart: 10, fStop: 1e6, perDecade: 40,
    dcSourceId: dc?.id || '',
    from: 0, to: Number(dc?.props?.v ?? dc?.props?.i ?? 5) || 5, points: 101,
    temp: 27,
    sweep: { kind: 'none', partId: '', key: '', valuesText: '', runs: 20, tol: 5, seed: 1, tempsText: '-20, 27, 85' },
  };
}

function SiField({ label, value, unit, onChange, hint }) {
  const [text, setText] = useState(value ? formatSI(value, '').replace(' ', '') : '0');
  useEffect(() => { setText(value ? formatSI(value, '').replace(' ', '') : '0'); }, [value]);
  const commit = () => { const v = parseSI(text); if (Number.isFinite(v)) onChange(v); else setText(formatSI(value, '').replace(' ', '')); };
  return (
    <label className="space-y-1">
      <span className="block text-caption text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <Input value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} className="h-8 w-28 font-mono text-label" />
        {unit && <span className="text-caption text-muted-foreground">{unit}</span>}
      </span>
      {hint && <span className="block text-micro text-muted-foreground">{hint}</span>}
    </label>
  );
}

const numList = (text) => String(text || '').split(/[,\s]+/).map((t) => parseSI(t)).filter(Number.isFinite);

/** 해석 결과에서 그래프 선 만들기 */
function seriesFor(out, traces) {
  const runs = out?.runs || [];
  const multi = runs.length > 1;
  const res = { main: [], phase: [] };
  traces.forEach((t, ti) => {
    runs.forEach((run, ri) => {
      const r = run.result;
      // 몬테카를로는 한 색으로 겹치고 기준값만 진하게, 값·온도 바꾸기는 회차마다 다른 색
      const mc = out.sweepKind === 'mc';
      const color = multi && !mc && traces.length === 1 ? RUN_COLORS[ri % RUN_COLORS.length] : t.color;
      const alpha = !multi ? 1 : mc ? (ri === 0 ? 1 : 0.28) : traces.length > 1 ? Math.max(0.3, 1 - ri * 0.15) : 1;
      const width = mc && ri === 0 ? 2.2 : 1.6;
      const label = [t.label, multi ? run.label : ''].filter(Boolean).join(' · ');
      if (out.type === 'ac') {
        const re = t.kind === 'v' ? r.nodesRe?.[t.node - 1] : r.elemRe?.[t.partId];
        const im = t.kind === 'v' ? r.nodesIm?.[t.node - 1] : r.elemIm?.[t.partId];
        if (!re) return;
        const m = measureBode(r.x, re, im);
        res.main.push({ x: r.x, y: m.db, color, alpha, width, label, m, trace: ti, run: ri });
        res.phase.push({ x: r.x, y: m.ph, color, alpha, width, label });
      } else {
        const y = t.kind === 'v' ? r.nodes?.[t.node - 1] : r.elems?.[t.partId];
        if (!y) return;
        res.main.push({ x: r.x, y, color, alpha, width, label, m: measureWave(r.x, y), trace: ti, run: ri });
      }
    });
  });
  return res;
}

const stats = (vals) => {
  const v = vals.filter(Number.isFinite);
  if (!v.length) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  return { min: Math.min(...v), max: Math.max(...v), mean, sd };
};

export default function AnalysisPanel({ circuit, settings, setSettings, out, running, progress, onRun, onCancel, traces, setTraces, probeOn, setProbeOn, nodeName, nodeParts }) {
  const s = settings;
  const set = (patch) => setSettings({ ...s, ...patch });
  const setSweep = (patch) => setSettings({ ...s, sweep: { ...s.sweep, ...patch } });
  const refs = useMemo(() => refNames(circuit.parts), [circuit.parts]);
  const sources = circuit.parts.filter((p) => SOURCES.includes(p.type));
  const srcLabel = (p) => `${refs.get(p.id) || ''} ${PARTS[p.type].label}`;
  const sweepable = circuit.parts.filter((p) => (PARTS[p.type]?.fields || []).some((f) => !f[3]));
  const sweepPart = circuit.parts.find((p) => p.id === s.sweep.partId);
  const keys = (PARTS[sweepPart?.type]?.fields || []).filter((f) => !f[3]);
  const ser = useMemo(() => (out && !out.error && out.type !== 'op' ? seriesFor(out, traces) : null), [out, traces]);
  const xUnit = out?.type === 'ac' ? 'Hz' : out?.type === 'dc' ? (out.runs?.[0]?.result?.unit || 'V') : 's';
  const yUnitOf = (t) => (t.kind === 'v' ? 'V' : 'A');
  const sameUnit = traces.length && traces.every((t) => t.kind === traces[0].kind);
  const scroll = useRef(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPES.map(([k, l]) => (
            <button key={k} type="button" onClick={() => set({ type: k })}
              className={cn('rounded-md px-3 py-1.5 text-label', s.type === k ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70')}>{l}</button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {running ? (
              <>
                <span className="w-24 overflow-hidden rounded-full bg-muted"><span className="block h-1.5 bg-primary transition-all" style={{ width: `${Math.round((progress || 0) * 100)}%` }} /></span>
                <Button size="sm" variant="outline" onClick={onCancel}><Square className="h-3.5 w-3.5" />멈추기</Button>
              </>
            ) : <Button size="sm" onClick={onRun}><Play className="h-4 w-4" />해석 실행</Button>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
          {s.type === 'tran' && (
            <>
              <SiField label="끝 시간" unit="s" value={s.stop} onChange={(v) => set({ stop: Math.max(v, 1e-9) })} />
              <SiField label="최대 시간 간격" unit="s" value={s.maxStep} onChange={(v) => set({ maxStep: Math.max(v, 0) })} hint="0 이면 끝 시간의 1/2000" />
              <label className="flex items-center gap-2 pb-1.5 text-label"><Switch checked={!s.fromZero} onCheckedChange={(v) => set({ fromZero: !v })} />동작점에서 시작 <span className="text-caption text-muted-foreground">(끄면 0 V 에서 전원을 켠 것처럼)</span></label>
            </>
          )}
          {s.type === 'ac' && (
            <>
              <label className="space-y-1"><span className="block text-caption text-muted-foreground">신호를 넣을 전원 (1 V 교류)</span>
                <select className="h-8 rounded-md border bg-transparent px-2 text-label" value={s.sourceId} onChange={(e) => set({ sourceId: e.target.value })}>
                  <option value="">고르세요</option>{sources.map((p) => <option key={p.id} value={p.id}>{srcLabel(p)}</option>)}
                </select></label>
              <SiField label="시작 주파수" unit="Hz" value={s.fStart} onChange={(v) => set({ fStart: Math.max(v, 1e-3) })} />
              <SiField label="끝 주파수" unit="Hz" value={s.fStop} onChange={(v) => set({ fStop: Math.max(v, 1e-3) })} />
              <SiField label="10배당 점 수" value={s.perDecade} onChange={(v) => set({ perDecade: Math.max(2, Math.min(500, Math.round(v))) })} />
            </>
          )}
          {s.type === 'dc' && (
            <>
              <label className="space-y-1"><span className="block text-caption text-muted-foreground">값을 바꿀 전원</span>
                <select className="h-8 rounded-md border bg-transparent px-2 text-label" value={s.dcSourceId} onChange={(e) => set({ dcSourceId: e.target.value })}>
                  <option value="">고르세요</option>{sources.map((p) => <option key={p.id} value={p.id}>{srcLabel(p)}</option>)}
                </select></label>
              <SiField label="시작 값" value={s.from} onChange={(v) => set({ from: v })} />
              <SiField label="끝 값" value={s.to} onChange={(v) => set({ to: v })} />
              <SiField label="점 수" value={s.points} onChange={(v) => set({ points: Math.max(2, Math.min(2000, Math.round(v))) })} />
            </>
          )}
          {s.type === 'op' && <p className="text-caption text-muted-foreground">콘덴서는 끊고 코일은 이은 상태의 직류 전압·전류를 구합니다.</p>}
          <SiField label="온도" unit="°C" value={s.temp} onChange={(v) => set({ temp: v })} />
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <label className="space-y-1"><span className="block text-caption text-muted-foreground">반복 해석</span>
              <select className="h-8 rounded-md border bg-transparent px-2 text-label" value={s.sweep.kind} onChange={(e) => setSweep({ kind: e.target.value })}>
                <option value="none">한 번만</option>
                <option value="param">부품 값 바꿔 가며</option>
                <option value="mc">몬테카를로 (부품 오차)</option>
                <option value="temp">온도 바꿔 가며</option>
              </select></label>
            {s.sweep.kind === 'param' && (
              <>
                <label className="space-y-1"><span className="block text-caption text-muted-foreground">부품</span>
                  <select className="h-8 rounded-md border bg-transparent px-2 text-label" value={s.sweep.partId} onChange={(e) => { const p = circuit.parts.find((x) => x.id === e.target.value); const k = (PARTS[p?.type]?.fields || []).find((f) => !f[3])?.[0] || ''; setSweep({ partId: e.target.value, key: k }); }}>
                    <option value="">고르세요</option>
                    {sweepable.map((p) => <option key={p.id} value={p.id}>{refs.get(p.id)} {PARTS[p.type].label}</option>)}
                  </select></label>
                {keys.length > 0 && (
                  <label className="space-y-1"><span className="block text-caption text-muted-foreground">값</span>
                    <select className="h-8 rounded-md border bg-transparent px-2 text-label" value={s.sweep.key} onChange={(e) => setSweep({ key: e.target.value })}>
                      {keys.map(([k, l, u]) => <option key={k} value={k}>{l}{u ? ` (${u})` : ''}</option>)}
                    </select></label>
                )}
                <label className="space-y-1"><span className="block text-caption text-muted-foreground">바꿀 값들 (쉼표로)</span>
                  <Input value={s.sweep.valuesText} onChange={(e) => setSweep({ valuesText: e.target.value })} placeholder="예: 1k, 2.2k, 4.7k" className="h-8 w-48 font-mono text-label" /></label>
              </>
            )}
            {s.sweep.kind === 'mc' && (
              <>
                <SiField label="횟수" value={s.sweep.runs} onChange={(v) => setSweep({ runs: Math.max(2, Math.min(200, Math.round(v))) })} />
                <SiField label="저항·콘덴서·코일 오차" unit="± %" value={s.sweep.tol} onChange={(v) => setSweep({ tol: Math.max(0, Math.min(50, v)) })} />
                <SiField label="난수 씨앗" value={s.sweep.seed} onChange={(v) => setSweep({ seed: Math.round(v) || 1 })} hint="같은 씨앗이면 같은 결과" />
              </>
            )}
            {s.sweep.kind === 'temp' && (
              <label className="space-y-1"><span className="block text-caption text-muted-foreground">온도들 (°C, 쉼표로)</span>
                <Input value={s.sweep.tempsText} onChange={(e) => setSweep({ tempsText: e.target.value })} className="h-8 w-48 font-mono text-label" /></label>
            )}
          </div>
        </div>
        {out?.error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-label text-destructive">{out.error}</p>}
      </div>

      {out && !out.error && out.type === 'op' && <OpTable out={out} circuit={circuit} refs={refs} nodeName={nodeName} nodeParts={nodeParts} />}

      {out && !out.error && out.type !== 'op' && (
        <div ref={scroll} className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-label font-semibold">결과 그래프</p>
            <span className="text-caption text-muted-foreground">{out.runs.length > 1 ? `${out.runs.length}회 반복 · ` : ''}{out.type === 'tran' ? `시간 간격 ${formatSI(out.runs[0]?.result?.dt, 's')}` : out.type === 'ac' ? '크기(dB)와 위상' : '전원 값에 따른 변화'}</span>
            <label className="ml-auto flex items-center gap-2 text-caption"><Crosshair className="h-3.5 w-3.5" />회로도 클릭으로 추가 <Switch checked={probeOn} onCheckedChange={setProbeOn} /></label>
          </div>
          {traces.length === 0 ? (
            <p className="py-8 text-center text-caption text-muted-foreground">회로도에서 전선을 누르면 그 노드의 전압이, 부품을 누르면 그 부품의 전류가 그래프에 더해집니다.</p>
          ) : (
            <>
              {sameUnit ? (
                <ResultPlot series={ser.main} xLog={out.type === 'ac'} xUnit={xUnit} yUnit={out.type === 'ac' ? 'dB' : yUnitOf(traces[0])} yLabel={out.type === 'ac' ? '크기' : ''} height={out.type === 'ac' ? 200 : 260} />
              ) : (
                ['v', 'i'].map((k) => {
                  const part = ser.main.filter((x) => traces[x.trace]?.kind === k);
                  return part.length ? <ResultPlot key={k} series={part} xLog={out.type === 'ac'} xUnit={xUnit} yUnit={out.type === 'ac' ? 'dB' : k === 'v' ? 'V' : 'A'} yLabel={k === 'v' ? '전압' : '전류'} height={180} /> : null;
                })
              )}
              {out.type === 'ac' && <ResultPlot series={ser.phase} xLog xUnit="Hz" yUnit="°" yLabel="위상" height={150} />}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {traces.map((t, i) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 text-caption">
                    <span className="h-2 w-3 rounded-sm" style={{ background: t.color }} />{t.label}
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setTraces(traces.filter((_, k) => k !== i))} aria-label={`${t.label} 빼기`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {out.runs.length > 1 && out.sweepKind !== 'mc' && traces.length === 1 && out.runs.length <= 10 && out.runs.map((r, i) => (
                  <span key={r.label} className="inline-flex items-center gap-1.5 text-caption text-muted-foreground"><span className="h-0.5 w-3" style={{ background: RUN_COLORS[i % RUN_COLORS.length] }} />{r.label}</span>
                ))}
              </div>
              <Measurements out={out} ser={ser} traces={traces} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Measurements({ out, ser, traces }) {
  const multi = out.runs.length > 1;
  const cols = out.type === 'ac'
    ? [['저주파 이득', (m) => m.lowGain, 'dB'], ['최대 이득', (m) => m.peakGain, 'dB'], ['최대 이득 주파수', (m) => m.peakFreq, 'Hz'], ['−3 dB 주파수', (m) => m.f3db, 'Hz']]
    : [['최소', (m) => m.min], ['최대', (m) => m.max], ['평균', (m) => m.avg], ['실효값', (m) => m.rms], ['피크 간', (m) => m.pp], ['마지막', (m) => m.final], ...(out.type === 'tran' ? [['주파수', (m) => m.freq, 'Hz']] : [])];
  const unitOf = (t, c) => c[2] || (t.kind === 'v' ? 'V' : 'A');
  const fmt = (v, u) => (!Number.isFinite(v) ? '—' : u === 'dB' ? `${v.toFixed(2)} dB` : formatSI(v, u, 4));
  // 반복이 많으면 회차별 표 대신 통계
  const rows = [];
  traces.forEach((t, ti) => {
    const list = ser.main.filter((x) => x.trace === ti);
    if (!list.length) return;
    if (multi && out.runs.length > 8) {
      cols.forEach((c) => { const st = stats(list.map((x) => c[1](x.m))); if (st) rows.push({ key: `${t.id}${c[0]}`, name: `${t.label} · ${c[0]}`, cells: [fmt(st.min, unitOf(t, c)), fmt(st.mean, unitOf(t, c)), fmt(st.max, unitOf(t, c)), fmt(st.sd, unitOf(t, c))] }); });
    } else list.forEach((x) => rows.push({ key: `${t.id}${x.run}`, name: x.label, cells: cols.map((c) => fmt(c[1](x.m), unitOf(t, c))) }));
  });
  const head = multi && out.runs.length > 8 ? ['측정', '최소', '평균', '최대', '표준편차'] : ['선', ...cols.map((c) => c[0])];
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-caption">
        <thead className="text-left text-muted-foreground"><tr>{head.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y font-mono tabular-nums">
          {rows.map((r) => <tr key={r.key}><td className="px-2 py-1.5 font-sans">{r.name}</td>{r.cells.map((c, i) => <td key={i} className="px-2 py-1.5">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function OpTable({ out, circuit, refs, nodeName, nodeParts }) {
  const multi = out.runs.length > 1;
  const first = out.runs[0]?.result;
  if (!first) return null;
  const parts = new Map(circuit.parts.map((p) => [p.id, p]));
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-label font-semibold">노드 전압</p>
        <table className="w-full text-caption">
          <thead className="text-left text-muted-foreground"><tr><th className="px-2 py-1 font-medium">노드</th><th className="px-2 py-1 font-medium">연결된 부품</th>{out.runs.map((r) => <th key={r.label} className="px-2 py-1 font-medium">{multi ? r.label : '전압'}</th>)}</tr></thead>
          <tbody className="divide-y font-mono tabular-nums">
            {first.nodes.map((_, i) => (
              <tr key={i}><td className="px-2 py-1 font-sans">{nodeName(i + 1)}</td><td className="px-2 py-1 font-sans text-muted-foreground">{nodeParts?.(i + 1)}</td>{out.runs.map((r) => <td key={r.label} className="px-2 py-1">{formatSI(r.result.nodes[i], 'V', 4)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p className="mb-2 text-label font-semibold">부품 전류·전력{multi ? ` (${out.runs[0].label})` : ''}</p>
        <table className="w-full text-caption">
          <thead className="text-left text-muted-foreground"><tr><th className="px-2 py-1 font-medium">부품</th><th className="px-2 py-1 font-medium">전류</th><th className="px-2 py-1 font-medium">전력</th><th className="px-2 py-1 font-medium">영역</th></tr></thead>
          <tbody className="divide-y font-mono tabular-nums">
            {first.elems.filter((e) => !['probe', 'voltmeter'].includes(e.type)).map((e) => {
              const p = parts.get(e.id);
              return (
                <tr key={e.id}><td className="px-2 py-1 font-sans">{refs.get(e.id) || ''} {PARTS[p?.type]?.label || e.type}</td><td className="px-2 py-1">{formatSI(e.current, 'A', 4)}</td><td className="px-2 py-1">{formatSI(e.power, 'W', 3)}</td><td className="px-2 py-1 font-sans">{e.region || ''}</td></tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 설정 → 워커에 보낼 값 */
export function buildRequest(s) {
  const sweep = { kind: s.sweep.kind };
  if (s.sweep.kind === 'param') Object.assign(sweep, { partId: s.sweep.partId, key: s.sweep.key, values: numList(s.sweep.valuesText) });
  if (s.sweep.kind === 'mc') Object.assign(sweep, { runs: s.sweep.runs, tol: s.sweep.tol, seed: s.sweep.seed });
  if (s.sweep.kind === 'temp') Object.assign(sweep, { values: numList(s.sweep.tempsText) });
  const base = { type: s.type, temp: s.temp, sweep };
  if (s.type === 'tran') return { ...base, stop: s.stop, maxStep: s.maxStep, fromZero: s.fromZero };
  if (s.type === 'ac') return { ...base, sourceId: s.sourceId, fStart: s.fStart, fStop: s.fStop, perDecade: s.perDecade };
  if (s.type === 'dc') return { ...base, sourceId: s.dcSourceId, from: s.from, to: s.to, points: s.points };
  return base;
}

export function checkRequest(r) {
  if (r.type === 'ac' && !r.sourceId) return '교류 신호를 넣을 전원을 고르세요.';
  if (r.type === 'dc' && !r.sourceId) return '값을 바꿀 전원을 고르세요.';
  if (r.sweep.kind === 'param' && (!r.sweep.partId || !r.sweep.values?.length)) return '바꿀 부품과 값들을 적어 주세요.';
  if (r.sweep.kind === 'temp' && !r.sweep.values?.length) return '온도 값을 적어 주세요.';
  if (r.type === 'tran' && r.stop / (r.maxStep || r.stop / 2000) > 2e6) return '단계가 너무 많습니다. 최대 시간 간격을 늘리거나 끝 시간을 줄이세요.';
  return '';
}
