import React, { useMemo, useState } from 'react';
import { AlertTriangle, CircleAlert, Info, Play, Loader2, RotateCw, FlipHorizontal2, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { allPads, netName } from '@/lib/pcbArt/board';
import { simulateNet, padKey, defaultSource, defaultLoads } from '@/lib/pcbArt/sim';
import { widthForCurrent, microstripZ0, widthForZ0, OZ_MM } from '@/lib/pcbArt/ipc';

const sel = 'h-8 rounded-md border bg-background px-2 text-caption';
const fmt = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toString());
const SEV = { error: ['오류', 'text-destructive', CircleAlert], warn: ['주의', 'text-warning-text', AlertTriangle], info: ['참고', 'text-primary', Info] };
export const KIND_LABEL = { gnd: '접지', power: '전원', hv: '고전압', signal: '신호' };

/** 검사 결과 목록: 누르면 그 자리로 */
export function DrcPanel({ list, onFocus }) {
  const [sev, setSev] = useState('all');
  const [cat, setCat] = useState('all');
  const [openUnrouted, setOpenUnrouted] = useState(false);
  const cats = [...new Set(list.map((d) => d.cat))];
  const shown = list.filter((d) => (sev === 'all' || d.sev === sev) && (cat === 'all' || d.cat === cat));
  // 미연결은 넷마다 하나로 묶어 보여 준다 (많으면 목록이 묻힌다)
  const grouped = [];
  const unrouted = new Map();
  for (const d of shown) {
    if (d.code !== 'unrouted') { grouped.push(d); continue; }
    if (!unrouted.has(d.net)) { const g = { ...d, count: 0 }; unrouted.set(d.net, g); grouped.push(g); }
    unrouted.get(d.net).count += 1;
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <select aria-label="심각도" value={sev} onChange={(e) => setSev(e.target.value)} className={sel}>
          <option value="all">전체 {list.length}</option>
          {Object.entries(SEV).map(([k, [l]]) => <option key={k} value={k}>{l} {list.filter((d) => d.sev === k).length}</option>)}
        </select>
        <select aria-label="분류" value={cat} onChange={(e) => setCat(e.target.value)} className={sel}>
          <option value="all">모든 분류</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {grouped.length === 0 ? <p className="text-caption text-muted-foreground">걸린 것이 없습니다.</p> : (() => {
        // 제조·전기 문제를 먼저, 미연결(배선 전이면 당연히 많다)은 한 줄로 접어 맨 아래에
        const main = grouped.filter((d) => d.code !== 'unrouted');
        const wires = grouped.filter((d) => d.code === 'unrouted');
        const spots = wires.reduce((n, d) => n + (d.count || 1), 0);
        const showWires = openUnrouted || main.length === 0;
        const Row = (d) => {
          const [l, cls, Icon] = SEV[d.sev];
          return (
            <li key={d.id}>
              <button type="button" onClick={() => d.at && onFocus(d)} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-caption hover:bg-secondary">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cls}`} aria-label={l} />
                <span className="min-w-0 flex-1"><span className="font-medium">{d.title}{d.count > 1 ? ` 외 ${d.count - 1}곳` : ''}</span><span className="block text-micro text-muted-foreground">{d.cat} · {d.detail}</span></span>
              </button>
            </li>
          );
        };
        return (
          <ul className="max-h-[52vh] space-y-1 overflow-y-auto pr-1">
            {main.slice(0, 400).map(Row)}
            {wires.length > 0 && main.length > 0 && (
              <li><button type="button" aria-expanded={showWires} onClick={() => setOpenUnrouted((v) => !v)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed px-2 py-2 text-left text-caption hover:bg-secondary">
                <span><span className="font-medium">미연결 넷 {wires.length}개 · {spots}곳</span><span className="block text-micro text-muted-foreground">배선을 마치기 전이면 정상입니다</span></span>
                <span className="text-micro text-primary">{showWires ? '접기' : '펼치기'}</span>
              </button></li>
            )}
            {showWires && wires.slice(0, 400).map(Row)}
          </ul>
        );
      })()}
    </div>
  );
}

/** 넷 설정: 종류·전압·전류 (검사·시뮬레이션의 기준). 이름으로 짐작한 값을 고칠 수 있다 */
export function NetRulesPanel({ board, rules, onChange, highlight, onHighlight }) {
  const [q, setQ] = useState('');
  const [onlyKey, setOnlyKey] = useState(true);
  const counts = useMemo(() => { const m = {}; for (const p of allPads(board)) if (p.net) m[p.net] = (m[p.net] || 0) + 1; return m; }, [board]);
  const nets = [...board.nets.entries()].filter(([id]) => id > 0)
    .filter(([id, name]) => (!q || name.toLowerCase().includes(q.toLowerCase())) && (!onlyKey || rules[id]?.kind !== 'signal' || rules[id]?.i > 0))
    .sort((a, b) => (rules[b[0]]?.i || 0) - (rules[a[0]]?.i || 0) || (counts[b[0]] || 0) - (counts[a[0]] || 0));
  const set = (id, patch) => onChange({ ...rules, [id]: { ...(rules[id] || { kind: 'signal', v: 0, i: 0 }), ...patch } });
  return (
    <div className="space-y-2">
      <p className="text-micro text-muted-foreground">이름으로 종류·전압을 짐작했습니다. 큰 전류가 흐르는 넷은 전류(A)를 넣어야 폭·연결 강도·고전압 간격을 검사합니다.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1"><Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="넷 찾기" value={q} onChange={(e) => setQ(e.target.value)} placeholder="넷 이름" className="h-8 pl-7" /></label>
        <label className="flex items-center gap-1.5 text-micro"><input type="checkbox" checked={onlyKey} onChange={(e) => setOnlyKey(e.target.checked)} />전원·접지만</label>
      </div>
      <div className="max-h-[48vh] overflow-y-auto">
        <table className="w-full text-caption">
          <thead><tr className="text-left text-micro text-muted-foreground"><th className="py-1">넷</th><th>종류</th><th className="w-16">V</th><th className="w-16">A</th></tr></thead>
          <tbody>{nets.map(([id, name]) => {
            const r = rules[id] || { kind: 'signal', v: 0, i: 0 };
            return (
              <tr key={id} className={highlight === id ? 'bg-primary/10' : ''}>
                <td className="max-w-[120px] py-0.5"><button type="button" onClick={() => onHighlight(highlight === id ? null : id)} className="block truncate text-left hover:underline" title={`${name} · 패드 ${counts[id] || 0}개 — 눌러서 기판에서 강조`}>{name}</button></td>
                <td><select aria-label={`${name} 종류`} value={r.kind} onChange={(e) => set(id, { kind: e.target.value })} className="h-7 rounded border bg-background px-1 text-micro">{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td><Input aria-label={`${name} 전압`} type="number" inputMode="decimal" value={r.v || ''} onChange={(e) => set(id, { v: Number(e.target.value) || 0 })} className="h-7 px-1 text-micro tabular-nums" /></td>
                <td><Input aria-label={`${name} 전류`} type="number" inputMode="decimal" step="0.1" value={r.i || ''} onChange={(e) => set(id, { i: Number(e.target.value) || 0 })} className="h-7 px-1 text-micro tabular-nums" /></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/** 넷 시뮬레이션 설정·결과 */
export function SimPanel({ board, conn, rules, result, onResult, onFocus, colorBy, onColorBy }) {
  const candidates = [...board.nets.entries()].filter(([id]) => id > 0 && ['gnd', 'power', 'hv'].includes(rules[id]?.kind));
  const [net, setNet] = useState(() => (candidates.find(([id]) => rules[id]?.i > 0) || candidates[0] || [0])[0]);
  const pads = useMemo(() => allPads(board).filter((p) => p.net === net && p.type !== 'np_thru_hole'), [board, net]);
  const [source, setSource] = useState(() => defaultSource(board, net));
  const total = rules[net]?.i || 1;
  const [loads, setLoads] = useState(() => defaultLoads(board, net, source, total));
  const [busy, setBusy] = useState(false);
  const pickNet = (id) => { const s = defaultSource(board, id); setNet(id); setSource(s); setLoads(defaultLoads(board, id, s, rules[id]?.i || 1)); onResult(null); };
  const pickSource = (k) => { setSource(k); setLoads(defaultLoads(board, net, k, loads.reduce((s, l) => s + l.i, 0) || total)); };
  const run = () => {
    setBusy(true);
    setTimeout(() => { onResult({ ...simulateNet(board, { net, source, sourceV: rules[net]?.v || 0, loads, conn }), net }); setBusy(false); }, 10);
  };
  const isGnd = rules[net]?.kind === 'gnd';
  const r = result?.net === net ? result : null;
  return (
    <div className="space-y-2 text-caption">
      <p className="text-micro text-muted-foreground">한 넷의 동박(트랙·비아·동박면·서멀 스포크)을 저항망으로 풀어 전압 강하와 구간 전류·온도 상승을 봅니다. {isGnd ? '접지 넷은 부하에서 공급점(전원·배터리 접지 단자)으로 돌아오는 전류로 계산하며, 강하는 접지가 들뜨는 크기입니다.' : ''}</p>
      <label className="block space-y-1"><span className="text-micro text-muted-foreground">넷</span>
        <select aria-label="시뮬레이션 넷" value={net} onChange={(e) => pickNet(Number(e.target.value))} className={`${sel} w-full`}>
          {candidates.length === 0 && <option value={0}>넷 설정에서 전원·접지 넷을 정하세요</option>}
          {candidates.map(([id, name]) => <option key={id} value={id}>{name} ({KIND_LABEL[rules[id].kind]}{rules[id].i ? ` · ${rules[id].i} A` : ''})</option>)}
        </select>
      </label>
      {net > 0 && (
        <>
          <label className="block space-y-1"><span className="text-micro text-muted-foreground">공급점 ({isGnd ? '전원·배터리 접지 단자' : '전원이 들어오는 패드'})</span>
            <select aria-label="공급점" value={source || ''} onChange={(e) => pickSource(e.target.value)} className={`${sel} w-full`}>
              {pads.map((p) => <option key={padKey(p)} value={padKey(p)}>{p.ref} {p.num}번</option>)}
            </select>
          </label>
          <div className="space-y-1">
            <p className="text-micro text-muted-foreground">부하 전류 (A) — 합계 {fmt(loads.reduce((s, l) => s + l.i, 0), 3)} A</p>
            <div className="max-h-40 space-y-1 overflow-y-auto">{loads.map((l, i) => (
              <div key={l.key} className="flex items-center gap-2">
                <span className="flex-1 truncate">{l.ref} {l.num}번</span>
                <Input aria-label={`${l.ref} ${l.num} 전류`} type="number" step="0.05" inputMode="decimal" value={l.i} onChange={(e) => setLoads(loads.map((x, j) => (j === i ? { ...x, i: Number(e.target.value) || 0 } : x)))} className="h-7 w-20 px-1 text-micro tabular-nums" />
                <button type="button" aria-label="부하 빼기" onClick={() => setLoads(loads.filter((_, j) => j !== i))} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}</div>
            <select aria-label="부하 더하기" value="" onChange={(e) => e.target.value && setLoads([...loads, { key: e.target.value, ref: e.target.value.split(':')[1], num: e.target.value.split(':')[2], i: 0.1 }])} className={`${sel} w-full`}>
              <option value="">+ 부하 패드 더하기</option>
              {pads.filter((p) => padKey(p) !== source && !loads.some((l) => l.key === padKey(p))).map((p) => <option key={padKey(p)} value={padKey(p)}>{p.ref} {p.num}번</option>)}
            </select>
          </div>
          <Button size="sm" onClick={run} disabled={busy || !source || !loads.length}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}시뮬레이션</Button>
        </>
      )}
      {r && !r.ok && <p className="text-destructive">{r.error}</p>}
      {r?.ok && (
        <div className="space-y-2 rounded-lg border p-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            {[['가장 큰 강하', `${fmt(r.maxDrop * 1000, 1)} mV${rules[net]?.v ? ` (${fmt((r.maxDrop / rules[net].v) * 100, 2)} %)` : ''}`],
              ['동박 손실', `${fmt(r.loss * 1000, 1)} mW`],
              ['가장 뜨거운 트랙', r.hotTrack ? `+${fmt(r.hotTrack.dT, 1)} °C (${fmt(r.hotTrack.I, 2)} A, ${fmt(r.hotTrack.w, 2)} mm)` : '—'],
              ['서멀 스포크', r.hotSpoke ? `${r.hotSpoke.ref} ${r.hotSpoke.num}번 +${fmt(r.hotSpoke.dT, 1)} °C` : '없음']].map(([k, v]) => (
              <div key={k} className="rounded bg-secondary px-2 py-1"><p className="text-micro text-muted-foreground">{k}</p><p className="font-semibold tabular-nums">{v}</p></div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-micro">
            <span className="text-muted-foreground">기판 색</span>
            <select aria-label="기판 색 기준" value={colorBy} onChange={(e) => onColorBy(e.target.value)} className="h-7 rounded border bg-background px-1">
              <option value="dT">온도 상승</option><option value="J">전류 밀도</option><option value="off">끄기</option>
            </select>
            <span className="ml-auto flex items-center gap-1"><span className="h-2 w-12 rounded" style={{ background: 'linear-gradient(90deg,#34c759,#ffd60a,#ff3b30)' }} />{colorBy === 'J' ? '0 → 50 A/mm²' : '0 → 20 °C'}</span>
          </div>
          <ul className="space-y-0.5">{[...r.loads].sort((a, b) => (b.drop ?? 1e9) - (a.drop ?? 1e9)).slice(0, 8).map((l) => (
            <li key={l.key}><button type="button" className="flex w-full justify-between rounded px-1 hover:bg-secondary" onClick={() => onFocus(l.key)}><span>{l.ref} {l.num}번 ({fmt(l.i, 2)} A)</span><span className="tabular-nums">{l.drop == null ? <span className="text-destructive">공급점과 끊김</span> : `−${fmt(l.drop * 1000, 1)} mV`}</span></button></li>
          ))}</ul>
          {r.floating.length > 0 && <p className="text-destructive">공급점과 이어지지 않은 부하 {r.floating.length}곳 — 배선을 먼저 마치세요.</p>}
          <p className="text-micro text-muted-foreground">근사 계산입니다 (IPC-2221B 온도 식, 동박면은 연속 판, 서멀 스포크 4개). 검사 탭의 ‘전류에 비해 가늚’ 은 이 구간 전류로 다시 판정합니다.</p>
        </div>
      )}
    </div>
  );
}

/** 고른 것의 속성 */
export function PropsPanel({ board, selected, rules, onWidth, onRotate, onFlip, onDelete }) {
  if (!selected) return <p className="text-caption text-muted-foreground">기판에서 부품·트랙·비아를 누르면 여기에 나옵니다.</p>;
  if (selected.type === 'fp') {
    const f = board.footprints[selected.index];
    if (!f) return null;
    return (
      <div className="space-y-2 text-caption">
        <p className="text-label font-semibold">{f.ref} <span className="font-normal text-muted-foreground">{f.value}</span></p>
        <p className="text-micro text-muted-foreground">{f.lib} · {f.side === 'F' ? '앞면' : '뒷면'} · ({fmt(f.x, 2)}, {fmt(f.y, 2)}) mm · {fmt(f.rot, 0)}°</p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={onRotate}><RotateCw className="h-3.5 w-3.5" />90° 돌리기 (R)</Button>
          <Button size="sm" variant="outline" onClick={onFlip}><FlipHorizontal2 className="h-3.5 w-3.5" />앞뒤 바꾸기 (F)</Button>
        </div>
        <p className="text-micro text-muted-foreground">끌어서 옮깁니다 (0.1 mm 격자).</p>
      </div>
    );
  }
  if (selected.type === 'track') {
    const t = board.tracks.find((x) => x.id === selected.id);
    if (!t) return null;
    const I = rules[t.net]?.i || 0;
    return (
      <div className="space-y-2 text-caption">
        <p className="text-label font-semibold">트랙 · {netName(board, t.net)}</p>
        <p className="text-micro text-muted-foreground">{t.layer} · 길이 {fmt(Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]), 2)} mm</p>
        <label className="flex items-center gap-2">폭 (mm)<Input aria-label="트랙 폭" type="number" step="0.05" min="0.05" value={t.w} onChange={(e) => Number(e.target.value) > 0 && onWidth(Number(e.target.value))} className="h-8 w-24 tabular-nums" /></label>
        {I > 0 && <p className={`text-micro ${t.w < widthForCurrent(I) ? 'text-destructive' : 'text-muted-foreground'}`}>넷 전류 {I} A 에 필요한 폭 {fmt(widthForCurrent(I), 2)} mm (10 °C 상승)</p>}
        <Button size="sm" variant="outline" className="text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />지우기 (Del)</Button>
      </div>
    );
  }
  const v = board.vias.find((x) => x.id === selected.id);
  if (!v) return null;
  return (
    <div className="space-y-2 text-caption">
      <p className="text-label font-semibold">비아 · {netName(board, v.net)}</p>
      <p className="text-micro text-muted-foreground">지름 {v.size} mm · 구멍 {v.drill} mm · {v.layers.join('–')}</p>
      <Button size="sm" variant="outline" className="text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />지우기 (Del)</Button>
    </div>
  );
}

/** 마이크로스트립 임피던스 계산 (고른 트랙 폭을 넣는다) */
export function ImpedancePanel({ board, selectedWidth }) {
  const two = board.copper.length <= 2;
  const [h, setH] = useState(two ? Math.round((board.thickness - 2 * OZ_MM) * 100) / 100 : 0.2);
  const [er, setEr] = useState(4.4);
  const [w, setW] = useState(selectedWidth || 0.3);
  const [target, setTarget] = useState(50);
  const z = microstripZ0({ w, h, er, t: board.copperMm || OZ_MM });
  return (
    <div className="space-y-2 text-caption">
      <p className="text-micro text-muted-foreground">겉면 트랙과 바로 아래 접지면 사이 (마이크로스트립, IPC-2141 근사). 안테나 급전선·고속 신호에 씁니다. {two ? '2층 기판은 유전체가 두꺼워 50 Ω 이 넓은 트랙이 됩니다 — 4층을 권합니다.' : ''}</p>
      <div className="grid grid-cols-3 gap-1.5">
        <label className="space-y-0.5"><span className="text-micro text-muted-foreground">폭 mm</span><Input type="number" step="0.01" value={w} onChange={(e) => setW(Number(e.target.value) || 0)} className="h-8 tabular-nums" /></label>
        <label className="space-y-0.5"><span className="text-micro text-muted-foreground">유전체 mm</span><Input type="number" step="0.01" value={h} onChange={(e) => setH(Number(e.target.value) || 0)} className="h-8 tabular-nums" /></label>
        <label className="space-y-0.5"><span className="text-micro text-muted-foreground">유전율</span><Input type="number" step="0.1" value={er} onChange={(e) => setEr(Number(e.target.value) || 1)} className="h-8 tabular-nums" /></label>
      </div>
      <p className="rounded bg-secondary px-2 py-1.5">임피던스 <b className="tabular-nums">{z == null ? '—' : `${fmt(z, 1)} Ω`}</b></p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">목표</span><Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value) || 50)} className="h-8 w-20 tabular-nums" /> Ω →
        <b className="tabular-nums">{fmt(widthForZ0(target, { h, er, t: board.copperMm || OZ_MM }), 3)} mm</b>
      </div>
    </div>
  );
}
