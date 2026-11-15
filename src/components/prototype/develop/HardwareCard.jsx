import React, { useEffect, useMemo, useState } from 'react';
import { Cpu, Download, Loader2, Save, FileDown, AlertTriangle, ExternalLink, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Card } from '@/components/prototype/develop/DevBits';
import { errorText, uploadProtoFile, addProtoFiles } from '@/lib/prototypeApi';
import { lcscSearchUrl } from '@/lib/pcb';
import { lcscKey } from '@/lib/hw/netlist';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const pct = (v) => `${Math.round(v * 100)} %`;

// 기판 미리보기: 외곽·구멍·부품 자리(앞면 초록, 뒷면 파랑, 못 넣은 것 빨강)·외장 구멍 자리
function PcbPreview({ layout, place }) {
  const pts = layout.outline;
  const all = [...pts, ...place.list.map((p) => [p.rect[0], p.rect[1]]), ...place.list.map((p) => [p.rect[2], p.rect[3]])];
  const x0 = Math.min(...all.map((p) => p[0])) - 4, x1 = Math.max(...all.map((p) => p[0])) + 4;
  const y0 = Math.min(...all.map((p) => p[1])) - 4, y1 = Math.max(...all.map((p) => p[1])) + 4;
  const fill = (p) => (p.outside ? 'hsl(var(--destructive) / 0.35)' : p.side === 'B' ? 'hsl(210 80% 55% / 0.35)' : 'hsl(150 45% 40% / 0.4)');
  return (
    <svg viewBox={`${x0} ${-y1} ${x1 - x0} ${y1 - y0}`} className="w-full max-h-[360px] rounded-lg border bg-secondary/40" role="img" aria-label="기판 부품 배치 미리보기">
      <g transform="scale(1,-1)">
        <polygon points={pts.map((p) => p.join(',')).join(' ')} fill="hsl(150 30% 92%)" stroke="hsl(150 40% 30%)" strokeWidth="0.4" />
        {layout.holes.map((h, i) => <circle key={i} cx={h.x} cy={h.y} r={h.d / 2} fill="hsl(var(--card))" stroke="hsl(150 40% 30%)" strokeWidth="0.3"><title>{h.label}</title></circle>)}
        {place.list.map((p) => (
          <rect key={`${p.c.ref}-${p.side}`} x={p.rect[0]} y={p.rect[1]} width={p.rect[2] - p.rect[0]} height={p.rect[3] - p.rect[1]} fill={fill(p)} stroke={p.anchor ? 'hsl(30 90% 45%)' : 'hsl(150 30% 30% / 0.6)'} strokeWidth={p.anchor ? 0.5 : 0.15}>
            <title>{`${p.c.ref} ${p.c.value}${p.side === 'B' ? ' (뒷면)' : ''}${p.outside ? ' — 기판에 못 넣음' : ''}${p.anchor ? ` — ${p.anchor.label}` : ''}`}</title>
          </rect>
        ))}
      </g>
    </svg>
  );
}

// 회로 설계: 기능 → 실제 회로도(MCU·전원·기능 회로) → KiCad 프로젝트·기판 외곽 DXF·JLCPCB 부품표
export default function HardwareCard({ project, dev, user, onSaved, change }) {
  const [mods, setMods] = useState(null);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState('');
  const [boardKey, setBoardKey] = useState('main');
  const [fabSrv, setFabSrv] = useState(null);
  const [fab, setFab] = useState(null); // { state, secs, run_url, summaries, error, zip }
  useEffect(() => { import('@/lib/hw/fabClient').then((m) => m.fabStatus()).then(setFabSrv).catch(() => setFabSrv({ ready: false })); }, []);
  useEffect(() => {
    let alive = true;
    Promise.all([import('@/lib/hw/kicadLib.data.js'), import('@/lib/hw/exportHw.js')]).then(([lib, ex]) => { if (alive) setMods({ lib, ex }); }).catch((e) => toast({ title: errorText(e), variant: 'destructive' }));
    return () => { alive = false; };
  }, []);
  const key = JSON.stringify([dev.features, dev.mcu, dev.supply_v, dev.rules, dev.mold_design?.template, dev.mold_design?.params, dev.hw]);
  const pkg = useMemo(() => {
    if (!mods) return null;
    try { return mods.ex.buildHwPackage(dev, mods.lib, { title: project.title, seed: project.id, date: new Date().toISOString().slice(0, 10) }); }
    catch (e) { return { error: e.message || String(e) }; }
  }, [mods, key]);

  if (!mods || !pkg) return <Card title="실제 회로도 · 기판 (KiCad)" icon={Cpu}><p className="flex items-center gap-2 text-caption text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />부품 라이브러리 불러오는 중</p></Card>;
  if (pkg.error) return <Card title="실제 회로도 · 기판 (KiCad)" icon={Cpu}><p className="text-caption text-destructive">{pkg.error}</p></Card>;
  const { hw, bom } = pkg;
  const board = pkg.boards.find((b) => b.key === boardKey) || pkg.boards[0];
  const { layout, pcb } = board;
  const split = (dev.hw?.split || []).includes('light');
  const hasLight = (dev.features || []).some((f) => f.kind === 'light');
  const mainPlace = pkg.boards[0].pcb.place;
  const suggestSplit = hasLight && !split && (mainPlace.outside.length > 0 || mainPlace.density > 0.75);
  // 기본 표에 없는 부품의 LCSC 번호를 직접 넣는다 (같은 부품 전부에 적용, 설정에 저장)
  const setLcsc = (part, v) => change?.((d) => { const m = { ...(d.hw?.lcsc || {}) }; if (v) m[lcscKey(part)] = v; else delete m[lcscKey(part)]; return { hw: { ...(d.hw || {}), lcsc: m } }; });
  const setSplit = (on) => change?.((d) => ({ hw: { ...(d.hw || {}), split: on ? ['light'] : [] } }));
  const smt = (pkg.boards.find((b) => b.key === boardKey) || pkg.boards[0]).bom.filter((r) => r.smt);
  const withLcsc = smt.filter((r) => r.lcsc).length;
  const notes = [...hw.notes, ...(board.key === 'main' ? [] : layout.notes || []), ...(pcb.place.clash.length ? [`외장 구멍 자리에 맞춘 부품끼리 겹칩니다 (${pcb.place.clash.join(', ')}). 3D 도면에서 구멍 간격을 벌리거나 부품을 바꾸세요.`] : []), ...(pcb.place.outside.length ? [`기판에 못 넣은 부품 ${pcb.place.outside.length}개 (${pcb.place.outside.join(', ')}) — 기판 오른쪽 밖에 두었습니다. 기판을 키우거나 부품을 작게·별도 기판으로 나누세요.`] : [])];
  const files = () => mods.ex.hwFiles(pkg, project.title);
  const download = async (kind) => {
    setBusy(kind);
    try {
      const { downloadBlob, downloadText } = await import('@/lib/devkit/conceptExport');
      if (kind === 'zip') {
        const { makeZip } = await import('@/lib/zipStore');
        downloadBlob(new Blob([makeZip(files())], { type: 'application/zip' }), `${pkg.slug}-kicad-${stamp()}.zip`);
      } else if (kind === 'dxf') {
        const { toDxf } = await import('@/lib/hw/kicad.js');
        downloadText(toDxf(layout), `${board.slug}-pcb-outline-${stamp()}.dxf`, 'application/dxf');
      } else if (kind === 'bom') {
        downloadText(mods.ex.jlcBomCsv(board.bom), `${board.slug}-bom-jlcpcb-${stamp()}.csv`, 'text/csv');
      }
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };
  const runFab = async () => {
    setBusy('fab');
    setFab({ state: 'queued', secs: 0 });
    try {
      const { fabricate } = await import('@/lib/hw/fabClient');
      const r = await fabricate(dev, { title: project.title, seed: project.id, onState: (state, secs, run_url) => setFab({ state, secs, run_url }) });
      setFab({ state: 'done', ...r });
      const { downloadBlob } = await import('@/lib/devkit/conceptExport');
      downloadBlob(new Blob([r.zip], { type: 'application/zip' }), `${pkg.slug}-pcb-fab-${stamp()}.zip`);
      const f = await uploadProtoFile(new File([r.zip], `${pkg.slug}-pcb-fab-${stamp()}.zip`, { type: 'application/zip' }), user, { category: 'PCB', note: `자동 배선·제조 파일 (거버·드릴·JLCPCB 부품표·좌표) — ${r.summaries.map((x) => `${x.board}: ${x.routed ? `미연결 ${x.unconnected}` : '배선 안 함'}`).join(', ')}` });
      await addProtoFiles(project.id, [f]);
      onSaved?.();
    } catch (e) { setFab({ state: 'failed', error: errorText(e), run_url: e.run_url, summaries: e.summaries }); }
    setBusy('');
  };
  const save = async () => {
    setBusy('save');
    try {
      const { makeZip } = await import('@/lib/zipStore');
      const name = `${pkg.slug}-kicad-${stamp()}.zip`;
      const f = await uploadProtoFile(new File([makeZip(files())], name, { type: 'application/zip' }), user, { category: 'PCB', note: `워크벤치에서 만든 KiCad 프로젝트 (${hw.module} · 부품 ${hw.comps.length}개 · 넷 ${hw.nets.size}개 · 기판 ${layout.size.join('×')} mm)` });
      await addProtoFiles(project.id, [f]);
      onSaved?.();
      toast({ title: 'KiCad 프로젝트를 시제품 파일에 저장했습니다', description: '이전 파일은 그대로 두고 새 파일로 추가했습니다' });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  return (
    <Card title="실제 회로도 · 기판 (KiCad)" icon={Cpu} tag={`${hw.module} · 부품 ${hw.comps.length}`}
      actions={<>
        <Button size="sm" onClick={() => download('zip')} disabled={!!busy}>{busy === 'zip' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}KiCad 프로젝트</Button>
        <Button size="sm" variant="outline" onClick={() => download('dxf')} disabled={!!busy}><FileDown className="w-4 h-4" />기판 외곽 DXF</Button>
        <Button size="sm" variant="outline" onClick={() => download('bom')} disabled={!!busy}><FileDown className="w-4 h-4" />JLCPCB 부품표</Button>
        <Button size="sm" variant="outline" onClick={save} disabled={!!busy}>{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}프로젝트에 저장</Button>
      </>}>
      {hasLight && (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-caption ${suggestSplit ? 'border border-warning/40 bg-warning/10 text-warning-text' : 'bg-secondary'}`}>
          <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} disabled={!change} />LED 구동부를 별도 기판으로 (본체 안, LED 판 가까이)</label>
          <span className="text-micro">{suggestSplit ? `제어 기판이 좁습니다 (부품 자리 ${pct(mainPlace.density)}${mainPlace.outside.length ? `, 못 넣은 부품 ${mainPlace.outside.length}개` : ''}). 나누면 두 기판을 8핀 이하 커넥터 하나로 잇습니다.` : split ? '제어 기판 ↔ LED 구동 기판을 커넥터 하나로 잇습니다.' : '부품이 넘치면 나누세요.'}</span>
        </div>
      )}
      {pkg.boards.length > 1 && (
        <div className="inline-flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="기판">
          {pkg.boards.map((b) => (
            <button key={b.key} type="button" role="tab" aria-selected={board.key === b.key} onClick={() => setBoardKey(b.key)}
              className={`rounded-md px-3 py-1.5 text-label font-semibold ${board.key === b.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{b.name} · {b.hw.comps.length}</button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        {[['넷 (연결)', `${board.hw.nets.size}개`], ['부품표', `${board.bom.length}줄 · SMT ${smt.length}`], ['LCSC 번호', `${withLcsc}/${smt.length} 확정`], [board.name, `${layout.size.join(' × ')} mm`]].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-secondary px-3 py-2"><p className="text-micro text-muted-foreground">{k}</p><p className="text-label font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>
      {notes.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-caption text-warning-text space-y-0.5">
          {notes.map((n) => <p key={n} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{n}</p>)}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-1.5 min-w-0">
          <PcbPreview layout={layout} place={pcb.place} />
          <p className="text-micro text-muted-foreground">
            외곽: {layout.source} · 부품 자리 합 {Math.round(pcb.place.usedArea)} / {Math.round(layout.area)} mm² ({pct(pcb.place.density)}) · 초록 = 앞면, 파랑 = 뒷면 {pcb.place.bottom.length}개, 주황 테두리 = 외장 구멍에 맞춘 자리, 빨강 = 못 넣음.
            배치는 배선 전 임시 자리입니다.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-caption font-semibold">MCU 핀</p>
          <div className="max-h-[330px] overflow-y-auto rounded-lg border">
            <table className="w-full text-caption">
              <tbody>
                {(board.key === 'main' ? hw.pinMap : []).map((p) => <tr key={p.gpio} className="border-b last:border-0"><td className="px-2 py-1 tabular-nums text-muted-foreground">GPIO{p.gpio}</td><td className="px-2 py-1 font-mono text-micro">{p.net}</td><td className="px-2 py-1 text-muted-foreground truncate max-w-[110px]">{p.role}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {board.hw.blocks.map((b) => (
          <div key={b.id} className="rounded-lg border">
            <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen((o) => (o === b.id ? '' : b.id))} aria-expanded={open === b.id}>
              <span className="text-label font-semibold">{b.name}</span>
              <span className="text-micro text-muted-foreground">부품 {b.refs.length}개</span>
              <span className="ml-auto text-micro text-muted-foreground">{open === b.id ? '접기' : '펼치기'}</span>
            </button>
            {open === b.id && (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-caption">
                  <thead className="text-left text-muted-foreground"><tr><th className="px-3 py-1.5 font-medium">참조</th><th className="px-3 py-1.5 font-medium">부품</th><th className="px-3 py-1.5 font-medium">연결</th><th className="px-3 py-1.5 font-medium">LCSC</th></tr></thead>
                  <tbody>
                    {b.refs.map((c) => (
                      <tr key={c.ref} className="border-t align-top">
                        <td className="px-3 py-1.5 font-mono">{c.ref}</td>
                        <td className="px-3 py-1.5"><p>{c.value}</p>{c.note && <p className="text-micro text-muted-foreground">{c.note}</p>}</td>
                        <td className="px-3 py-1.5 font-mono text-micro text-muted-foreground">{Object.entries(c.conns).filter(([, n], i, arr) => arr.findIndex(([, m]) => m === n) === i).map(([, n]) => n).join(' · ')}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{c.part.lcsc
                          ? <span className="inline-flex items-center gap-1"><a href={lcscSearchUrl(c.part.lcsc)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">{c.part.lcsc}<ExternalLink className="w-3 h-3" /></a>{c.part.lcsc_user && <button type="button" className="text-micro text-muted-foreground underline" onClick={() => setLcsc(c.part, '')} disabled={!change}>직접 넣음 · 지우기</button>}</span>
                          : (
                            <span className="inline-flex items-center gap-1.5">
                              {c.part.search && <a href={lcscSearchUrl(c.part.search)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground">찾기<ExternalLink className="w-3 h-3" /></a>}
                              {change && c.part.fp && <input aria-label={`${c.ref} LCSC 번호`} placeholder="C번호" className="h-6 w-20 rounded border bg-background px-1.5 font-mono text-micro" onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={(e) => { const v = e.target.value.trim().toUpperCase(); if (/^C\d{3,9}$/.test(v)) setLcsc(c.part, v); else if (v) e.target.value = ''; }} />}
                            </span>
                          )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
      {hw.offboard.length > 0 && (
        <div className="rounded-lg bg-secondary px-3 py-2 text-caption space-y-1">
          {hw.offboard.map((o) => <p key={o.name}><span className="font-semibold">{o.name} (별도 기판)</span> — {o.note} {o.parts.map(([n, q]) => `${n} ×${q}`).join(', ')}</p>)}
        </div>
      )}
      <div className="rounded-lg border p-3 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Factory className="w-4 h-4 text-primary" /><p className="text-label font-semibold">자동 배선 · 제조 파일 (JLCPCB)</p>
          <Button size="sm" className="ml-auto" onClick={runFab} disabled={!fabSrv?.ready || !!busy || pkg.boards.some((b) => b.pcb.place.outside.length)}>{busy === 'fab' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Factory className="w-4 h-4" />}자동 배선하고 제조 파일 만들기</Button>
        </div>
        <p className="text-micro text-muted-foreground">서버에서 기판마다 자동 배선(Freerouting) → 양면 GND 동박 → DRC → 거버·드릴 → JLCPCB 부품표·좌표(CPL)를 만들어 zip 으로 받고 시제품 파일에도 저장합니다 (5~15분).
          {!fabSrv?.ready && ' 빌드 서버가 아직 연결되지 않았습니다 (관리자: GitHub 토큰 설정 필요).'}{pkg.boards.some((b) => b.pcb.place.outside.length) && ' 기판에 못 넣은 부품이 있으면 배선하지 않습니다.'}</p>
        {fab && (
          <div className={`text-micro ${fab.state === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {fab.state === 'queued' && `대기 중… ${fab.secs || 0}초`}{fab.state === 'building' && `배선·제조 파일 만드는 중… ${fab.secs || 0}초`}
            {fab.state === 'failed' && fab.error}
            {fab.state === 'done' && 'zip 을 받았고 시제품 파일에 저장했습니다.'}
            {fab.run_url && <a href={fab.run_url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary">기록<ExternalLink className="w-3 h-3" /></a>}
            {(fab.summaries || []).map((x) => (
              <div key={x.board} className="text-foreground">
                <p>{x.name || x.board}: {x.routed ? `선 ${x.tracks}개 · 비아 ${x.vias}개 · 남은 미연결 ${x.unconnected}개${x.passes === 2 ? ' (2차 배선 반영)' : ''}` : '배선 안 함'} · 고칠 DRC 오류 {Object.entries(x.blocking || {}).map(([k, v]) => `${k} ${v}`).join(', ') || '없음'}</p>
                {(x.open || []).length > 0 && <ul className="ml-3 list-disc text-muted-foreground">{x.open.slice(0, 8).map((o, i) => <li key={i}>손으로 이을 곳: {o.net} — {o.a.replace(/\[[^\]]*\] /, '')} ↔ {o.b.replace(/\[[^\]]*\] /, '')}</li>)}</ul>}
                {(x.known || []).filter((k) => /courtyards|hole_clearance|starved/.test(k.kind)).map((k) => <p key={k.kind} className="ml-3 text-muted-foreground">확인만: {k.why} {k.count}건</p>)}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-micro text-muted-foreground">KiCad 7 이상에서 프로젝트를 열면 회로도와 기판이 이어져 있어 배선만 하면 됩니다. 값은 데이터시트 권장 회로 기준 초안이며, 발주 전에 회로 설계자가 검토해야 합니다. LCSC 번호는 확실한 것만 넣었고, 나머지는 PCB 부품 탭에서 확정합니다.</p>
    </Card>
  );
}
