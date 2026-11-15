import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Download, FileArchive, Save, Loader2, RotateCcw, ShieldCheck, AlertTriangle, Info, Factory, Scissors, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Card } from '@/components/prototype/develop/DevBits';
import CadViewer from '@/components/prototype/develop/CadViewer';
import MoldSummary from '@/components/moldreview/MoldSummary';
import MoldIssueList from '@/components/moldreview/MoldIssueList';
import { TEMPLATES, TEMPLATE_KEYS, defaultParams, cleanParams, guessFromConcept } from '@/lib/cad/catalog';
import { cadCall } from '@/lib/cad/cadClient';
import { runMoldReview } from '@/lib/moldReview/runMoldReview';
import { DEFAULT_ANALYSIS_OPTIONS } from '@/lib/moldReview/options';
import { buildMoldReport } from '@/lib/moldReview/report';
import { errorText, uploadProtoFile, addProtoFiles } from '@/lib/prototypeApi';
import MoldQuotePanel from '@/components/prototype/develop/MoldQuotePanel';

const MoldViewer = React.lazy(() => import('@/components/moldreview/MoldViewer'));

const MOLD_MODES = [['all', '종합'], ['draft', '구배'], ['under', '언더컷 · 파팅'], ['thick', '살 두께']];
const moldKey = (m) => (/PC\/ABS/i.test(m) ? 'PCABS' : /^PC/i.test(m) ? 'PC' : /^PP/i.test(m) ? 'PP' : 'ABS');
const fmt = (n, d = 1) => Number(n || 0).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').slice(0, 60) || 'design';
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

function ParamInput({ p, value, onChange, disabled }) {
  if (p.type === 'select') {
    return (
      <select value={String(value)} disabled={disabled} onChange={(e) => onChange(typeof p.def === 'number' ? Number(e.target.value) : e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-label" aria-label={p.label}>
        {p.options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
      </select>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={p.min} max={p.max} step={p.step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-primary" aria-label={`${p.label} 슬라이더`} />
      <Input type="number" min={p.min} max={p.max} step={p.step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-20 tabular-nums" aria-label={p.label} />
      <span className="w-6 text-micro text-muted-foreground">{p.unit}</span>
    </div>
  );
}

// 2단계 · 금형용 설계: 템플릿 치수 → 솔리드(살두께·분할·구배·보스·리브·구멍) → STEP · 간섭 검사 · 금형 점검을 바로 한다
export default function MoldDesignStep({ project, concept, dev, change, user, onSaved }) {
  const initial = useMemo(() => {
    const s = dev.mold_design;
    if (s?.template && TEMPLATES[s.template]) return { template: s.template, params: cleanParams(s.template, s.params) };
    return guessFromConcept(concept?.preview);
  }, []);
  const [tpl, setTpl] = useState(initial.template);
  const [params, setParams] = useState(initial.params);
  const [model, setModel] = useState(null);
  const [status, setStatus] = useState({ busy: true, label: 'CAD 엔진 불러오는 중' });
  const [inter, setInter] = useState(null);
  const [mold, setMold] = useState({});
  const [sel, setSel] = useState(null);
  const [tilt, setTilt] = useState(0);
  const [explode, setExplode] = useState(0);
  const [section, setSection] = useState('none');
  const [focus, setFocus] = useState(null);
  const [moldMode, setMoldMode] = useState('all');
  const [moldFocus, setMoldFocus] = useState(null);
  const [busy, setBusy] = useState('');
  const [pcbBoxes, setPcbBoxes] = useState([]);
  const [showPcbParts, setShowPcbParts] = useState(true);
  const seqRef = useRef(0);
  const moldJob = useRef(null);
  const moldCache = useRef(new Map()); // 형상이 같은 부품은 금형 점검을 다시 하지 않는다 (위치만 바뀐 경우 포함)
  const T = TEMPLATES[tpl];

  const persist = (template, next) => change((d) => ({ mold_design: { ...(d.mold_design || {}), template, params: next, concept_id: concept?.id || null, updated_at: new Date().toISOString() } }));
  const setParam = (k, v) => { const next = { ...params, [k]: v }; setParams(next); persist(tpl, next); };
  const chooseTemplate = (key) => {
    const guess = guessFromConcept(concept?.preview);
    const next = guess.template === key ? guess.params : defaultParams(key);
    setTpl(key); setParams(next); persist(key, next); setSel(null); setTilt(0);
  };
  const fromConcept = () => { const g = guessFromConcept(concept?.preview); setTpl(g.template); setParams(g.params); persist(g.template, g.params); };

  // 치수가 바뀌면 0.6초 뒤 다시 만든다 → 간섭 검사 → 사출 부품 금형 점검 (뒤에서 차례로)
  const key = JSON.stringify([tpl, params]);
  useEffect(() => {
    const t = setTimeout(() => rebuild(), 600);
    return () => clearTimeout(t);
  }, [key]);
  useEffect(() => () => { seqRef.current++; moldJob.current?.cancel(); }, []);

  async function rebuild() {
    const seq = ++seqRef.current;
    const live = () => seq === seqRef.current;
    moldJob.current?.cancel();
    setStatus({ busy: true, label: '솔리드 만드는 중' });
    try {
      const res = await cadCall('build', { template: tpl, params }, (label) => live() && setStatus({ busy: true, label }));
      if (!live()) return;
      setModel(res); setInter(null); setMold({});
      setStatus({ busy: false, ms: res.ms });
      setSel((s) => (s && res.parts.some((p) => p.id === s) ? s : null));
      // 회로 단계에서 자동 배치한 기판 부품(높이 있는 것)을 상자로 넣어 외장과 닿는지 같이 본다
      let boxes = [];
      if ((dev.features || []).length) {
        try {
          const [lib, ex, pp] = await Promise.all([import('@/lib/hw/kicadLib.data.js'), import('@/lib/hw/exportHw.js'), import('@/lib/cad/pcbParts.js')]);
          const pkg = ex.buildHwPackage({ ...dev, mold_design: { ...(dev.mold_design || {}), template: tpl, params } }, lib, { title: project.title, seed: project.id });
          boxes = pp.pcbPartBoxes(pkg.boards[0]);
        } catch { boxes = []; }
      }
      if (!live()) return;
      setPcbBoxes(boxes);
      const it = await cadCall('interference', { extra: boxes.map((b) => ({ id: b.id, name: b.name, V: b.mesh.V, F: b.mesh.F })) });
      if (!live()) return;
      setInter({ ...it, pcbParts: boxes.length });
      for (const p of res.parts.filter((x) => x.mold)) {
        if (!live()) return;
        const ck = `${p.id}|${p.material}|${p.volume.toFixed(2)}|${[p.bbox[3] - p.bbox[0], p.bbox[4] - p.bbox[1], p.bbox[5] - p.bbox[2]].map((v) => v.toFixed(2)).join(',')}`;
        const cached = moldCache.current.get(ck);
        if (cached) { setMold((m) => ({ ...m, [p.id]: cached })); continue; }
        setMold((m) => ({ ...m, [p.id]: { running: true } }));
        const input = await cadCall('moldMesh', { partId: p.id });
        if (!live()) return;
        const job = runMoldReview(input, DEFAULT_ANALYSIS_OPTIONS);
        moldJob.current = job;
        const result = await job.promise;
        if (!live()) return;
        const report = buildMoldReport(result, { materialKey: moldKey(p.material), partName: p.name });
        moldCache.current.set(ck, { result, report });
        if (moldCache.current.size > 40) moldCache.current.delete(moldCache.current.keys().next().value);
        setMold((m) => ({ ...m, [p.id]: { result, report } }));
      }
    } catch (e) {
      if (e?.cancelled || !live()) return;
      setStatus({ busy: false, error: e.message || String(e) });
    }
  }

  const parts = model?.parts || [];
  // 화면에만 보태는 기판 부품 상자 (부품 표·무게·STEP 에는 넣지 않는다)
  const viewParts = useMemo(() => {
    if (!showPcbParts || !pcbBoxes.length) return parts;
    const group = parts.find((p) => p.id === 'pcb')?.group;
    return [...parts, ...pcbBoxes.map((b) => ({ id: b.id, name: b.name, material: '부품', color: '#2E3238', group, mesh: b.mesh }))];
  }, [parts, pcbBoxes, showPcbParts]);
  // 원가 추정·설계 확정이 쓰는 요약 (사출 부품 무게·재질·크기·슬라이드·금형 점검) — 바뀔 때만 저장
  useEffect(() => {
    if (!model?.parts?.length) return;
    const molded = model.parts.filter((p) => p.mold);
    if (molded.some((p) => !mold[p.id]?.report)) return;
    const summary = { parts: model.parts.map((p) => ({ id: p.id, name: p.name, material: p.material, mold: !!p.mold, weight: Math.round((p.weight || 0) * 10) / 10, size: p.bbox ? [p.bbox[3] - p.bbox[0], p.bbox[4] - p.bbox[1], p.bbox[5] - p.bbox[2]].map((v) => Math.round(v)) : null, slides: p.mold ? (mold[p.id].result?.undercuts || []).filter((u) => u.type === 'slide').length : 0, hi: p.mold ? mold[p.id].report.counts.hi : 0 })), template: model.template };
    if (JSON.stringify(summary) !== JSON.stringify(dev.mold_design?.summary)) change((d) => ({ mold_design: { ...(d.mold_design || {}), summary: { ...summary, at: new Date().toISOString() } } }));
  }, [model, mold]); // eslint-disable-line react-hooks/exhaustive-deps
  const moldParts = parts.filter((p) => p.mold);
  const selPart = parts.find((p) => p.id === sel) || null;
  const selMold = sel ? mold[sel] : null;
  const motion = model?.motion || null;
  const overlaps = inter?.overlaps || [];
  const motionIssues = inter?.motion?.issues || [];
  const markers = useMemo(() => [...overlaps, ...motionIssues.filter((m) => m.angle === tilt)].map((o) => ({ at: o.at, kind: o.kind })), [inter, tilt]);
  const moldDone = moldParts.filter((p) => mold[p.id]?.report);
  const hi = moldDone.reduce((n, p) => n + (mold[p.id].report.counts.hi || 0), 0);
  const mid = moldDone.reduce((n, p) => n + (mold[p.id].report.counts.mid || 0), 0);
  const totalWeight = parts.reduce((n, p) => n + (p.weight || 0), 0);
  const base = `${safe(project.title)}-${tpl}`;

  const stepBuffer = async (ids) => cadCall('step', ids ? { ids } : {}, () => {});
  // 금형 업체용 묶음: 조립 STEP + 사출 부품별 STEP + 설계 조건 문서
  const moldZip = async () => {
    const { makeZip } = await import('@/lib/zipStore');
    const files = [];
    files.push({ name: `${base}-assembly.step`, data: new Uint8Array(await stepBuffer()) });
    for (const p of moldParts) files.push({ name: `molded/${safe(p.name)}.step`, data: new Uint8Array(await stepBuffer([p.id])) });
    files.push({ name: 'README-설계조건.txt', data: new TextEncoder().encode(specText()) });
    return makeZip(files);
  };
  const download = async (kind) => {
    setBusy(kind);
    try {
      const { downloadBlob } = await import('@/lib/devkit/conceptExport');
      if (kind === 'step') {
        const buf = await stepBuffer();
        downloadBlob(new Blob([buf], { type: 'application/step' }), `${base}-assembly-${stamp()}.step`);
      } else {
        downloadBlob(new Blob([await moldZip()], { type: 'application/zip' }), `${base}-mold-package-${stamp()}.zip`);
      }
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };
  const saveToProject = async () => {
    setBusy('save');
    try {
      const buf = await stepBuffer();
      const name = `${base}-assembly-${stamp()}.step`;
      const f = await uploadProtoFile(new File([buf], name, { type: 'application/step' }), user, { category: 'MODEL3D', note: `금형용 설계에서 만든 STEP (${T.label} · 부품 ${parts.length}개, 사출 ${moldParts.length}개)` });
      await addProtoFiles(project.id, [f]);
      onSaved?.();
      toast({ title: 'STEP 을 시제품 파일에 저장했습니다', description: '3D 검토·부품표·금형 검토·설계 자료실에서 바로 열 수 있습니다' });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };
  function specText() {
    const lines = [`${project.title} · ${T.label}`, `만든 날: ${new Date().toLocaleString('ko-KR')}`, '', '[치수]'];
    for (const p of T.params) lines.push(`- ${p.label}: ${p.type === 'select' ? (p.options.find(([v]) => String(v) === String(params[p.key]))?.[1] || params[p.key]) : `${params[p.key]} ${p.unit || ''}`}`);
    lines.push('', '[부품]');
    for (const p of parts) lines.push(`- ${p.name} · ${p.material}${p.mold ? ' · 사출' : ''} · 약 ${fmt(p.weight, 1)} g${mold[p.id]?.report ? ` · 금형 점검 높음 ${mold[p.id].report.counts.hi} / 주의 ${mold[p.id].report.counts.mid}` : ''}`);
    if (model?.notes?.length) { lines.push('', '[설계 메모]'); for (const n of model.notes) lines.push(`- ${n}`); }
    if (overlaps.length || motionIssues.length) {
      lines.push('', '[간섭]');
      for (const o of overlaps) lines.push(`- ${o.aName} ↔ ${o.bName}: ${fmt(o.depth, 2)} mm 파고듦`);
      for (const o of motionIssues) lines.push(`- ${o.aName} ↔ ${o.bName}: ${o.angle}° 에서 ${o.kind === 'overlap' ? `${fmt(o.depth, 2)} mm 파고듦` : `틈 ${fmt(o.gap, 2)} mm`}`);
    }
    lines.push('', '이 파일은 치수 템플릿으로 자동 생성한 설계 초안입니다. 금형 발주 전 설계자가 공차·조립·강도를 검토하고, 금형 업체가 금형 설계(코어·캐비티·냉각·이젝터)를 확정합니다.');
    return lines.join('\r\n');
  }

  const groups = [...new Set(T.params.map((p) => p.group))];
  const showOverlap = (o) => { setTilt(o.angle || 0); setFocus({ at: o.at, t: Date.now() }); };

  return (
    <div className="space-y-4">
      <Card title="금형용 설계 · 바로 STEP" icon={Box} tag="솔리드"
        actions={(
          <>
            <Button size="sm" variant="outline" disabled={!parts.length || !!busy || status.busy} onClick={() => download('step')}>{busy === 'step' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}STEP (조립)</Button>
            <Button size="sm" variant="outline" disabled={!parts.length || !!busy || status.busy} onClick={() => download('zip')}>{busy === 'zip' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}금형 업체용 묶음</Button>
            <Button size="sm" disabled={!parts.length || !!busy || status.busy} onClick={saveToProject}>{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}프로젝트에 저장</Button>
          </>
        )}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={tpl} onChange={(e) => chooseTemplate(e.target.value)} className="h-9 min-w-[220px] rounded-md border bg-background px-2 text-label" aria-label="제품 형태">
            {TEMPLATE_KEYS.map((k) => <option key={k} value={k}>{TEMPLATES[k].label}</option>)}
          </select>
          {concept && <Button size="sm" variant="ghost" onClick={fromConcept}><RotateCcw className="w-4 h-4" />컨셉 치수로</Button>}
          <span className="text-caption text-muted-foreground">{T.hint}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-caption" aria-live="polite">
          {status.busy ? <span className="inline-flex items-center gap-1.5 text-primary"><Loader2 className="w-3.5 h-3.5 animate-spin" />{status.label}</span>
            : status.error ? <span className="inline-flex items-center gap-1.5 text-destructive"><AlertTriangle className="w-3.5 h-3.5" />{status.error}</span>
              : <span className="text-muted-foreground">만들기 {fmt(status.ms / 1000, 1)}초 · 부품 {parts.length}개 (사출 {moldParts.length}) · 약 {fmt(totalWeight, 0)} g</span>}
          {!status.busy && parts.length > 0 && (
            <>
              <Chip tone={!inter ? 'muted' : overlaps.length ? 'bad' : 'good'}>{!inter ? '간섭 검사 중…' : overlaps.length ? `간섭 ${overlaps.length}곳` : '조립 간섭 없음'}</Chip>
              {motion && <Chip tone={!inter ? 'muted' : motionIssues.some((m) => m.kind === 'overlap') ? 'bad' : motionIssues.length ? 'warn' : 'good'}>{!inter ? `${motion.label} 검사 중…` : motionIssues.length ? `${motion.label}: ${motionIssues.some((m) => m.kind === 'overlap') ? '닿음' : `틈 ${fmt(Math.min(...motionIssues.map((m) => m.gap || 0)), 2)} mm`}` : `${motion.label} 여유 있음`}</Chip>}
              <Chip tone={moldDone.length < moldParts.length ? 'muted' : hi ? 'bad' : mid ? 'warn' : 'good'}>{moldDone.length < moldParts.length ? `금형 점검 ${moldDone.length}/${moldParts.length}…` : `금형 점검 높음 ${hi} · 주의 ${mid}`}</Chip>
            </>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2 min-w-0">
          <div className="relative">
            <CadViewer parts={viewParts} motion={motion} tilt={tilt} explode={explode} section={section} selected={sel} onSelect={setSel} markers={markers} focus={focus} className="h-[440px] sm:h-[520px]" />
            {status.busy && !parts.length && <div className="absolute inset-0 grid place-items-center text-caption text-muted-foreground"><span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{status.label}</span></div>}
            {selPart && <div className="absolute left-3 top-3 max-w-[70%] rounded-lg bg-card/90 px-3 py-1.5 text-caption shadow-sm"><b>{selPart.name}</b> · {selPart.material}{selPart.mold ? ' · 사출' : ''}</div>}
          </div>
          <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-3">
            <label className="space-y-1 text-caption"><span className="flex items-center gap-1 font-medium"><Scissors className="w-3.5 h-3.5" />단면</span>
              <select value={section} onChange={(e) => setSection(e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-caption" aria-label="단면">
                <option value="none">없음</option><option value="y">앞뒤로 자르기</option><option value="x">좌우로 자르기</option>
              </select>
              {pcbBoxes.length > 0 && <span className="flex items-center gap-1.5 pt-1 text-micro text-muted-foreground"><input type="checkbox" checked={showPcbParts} onChange={(e) => setShowPcbParts(e.target.checked)} aria-label="기판 부품 보기" />기판 부품 {pcbBoxes.length}개 보기 (높이 어림)</span>}
            </label>
            <label className="space-y-1 text-caption"><span className="font-medium">분해 보기 {Math.round(explode * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} value={explode} onChange={(e) => setExplode(Number(e.target.value))} className="w-full accent-primary" aria-label="분해 보기" />
            </label>
            {motion ? (
              <label className="space-y-1 text-caption"><span className="font-medium">{motion.label.replace(/ ±.*/, '')} {tilt}°</span>
                <input type="range" min={motion.min} max={motion.max} step={2.5} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} className="w-full accent-primary" aria-label="3D 보기 기울기" />
              </label>
            ) : <p className="self-center text-micro text-muted-foreground">부품을 누르면 강조되고, 사출 부품이면 아래에 금형 점검이 열립니다.</p>}
          </div>
        </div>

        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g} className="rounded-xl border bg-card p-3 space-y-2.5">
              <p className="text-label font-semibold">{g}</p>
              {T.params.filter((p) => p.group === g).map((p) => (
                <div key={p.key} className="space-y-1">
                  <p className="text-caption">{p.label}{p.help && <span className="ml-1 text-micro text-muted-foreground">{p.help}</span>}</p>
                  <ParamInput p={p} value={params[p.key]} onChange={(v) => setParam(p.key, v)} />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>

      {model?.notes?.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-caption text-warning-text space-y-1">
          {model.notes.map((n) => <p key={n} className="flex gap-1.5"><Info className="mt-0.5 w-3.5 h-3.5 shrink-0" />{n}</p>)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="부품" icon={Ruler} tag={`${parts.length}개`}>
          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead><tr className="border-b text-left text-micro text-muted-foreground"><th className="py-1.5 pr-2 font-medium">부품</th><th className="py-1.5 pr-2 font-medium">재질</th><th className="py-1.5 pr-2 text-right font-medium">크기 mm</th><th className="py-1.5 pr-2 text-right font-medium">무게</th><th className="py-1.5 font-medium">금형 점검</th></tr></thead>
              <tbody>
                {parts.map((p) => {
                  const m = mold[p.id];
                  const size = [p.bbox[3] - p.bbox[0], p.bbox[4] - p.bbox[1], p.bbox[5] - p.bbox[2]].map((v) => Math.round(v)).join('×');
                  return (
                    <tr key={p.id} onClick={() => setSel(p.id === sel ? null : p.id)} className={`cursor-pointer border-b last:border-0 hover:bg-muted/50 ${sel === p.id ? 'bg-primary/5' : ''}`}>
                      <td className="py-1.5 pr-2"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: p.color }} />{p.name}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{p.material}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{size}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(p.weight, 1)} g</td>
                      <td className="py-1.5">{!p.mold ? <span className="text-muted-foreground">-</span> : !m ? <span className="text-muted-foreground">대기</span> : m.running ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />점검 중</span> : <Chip tone={m.report.counts.hi ? 'bad' : m.report.counts.mid ? 'warn' : 'good'}>높음 {m.report.counts.hi} · 주의 {m.report.counts.mid}</Chip>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="조립 간섭" icon={ShieldCheck} tag={inter ? `${inter.pairs}쌍 검사${inter.pcbParts ? ` · 기판 부품 ${inter.pcbParts}개 포함` : ''}` : '검사 중'}>
          {!inter ? <p className="flex items-center gap-2 text-caption text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />부품끼리 파고드는 곳{motion ? `과 ${motion.label} 동안 좁아지는 틈` : ''}을 찾는 중…</p> : (
            <div className="space-y-2 text-caption">
              {!overlaps.length && !motionIssues.length && <p className="text-success-text">파고드는 부품이 없습니다{motion ? `. ${motion.label} 동안 틈이 ${motion.clearance} mm 이상 남습니다` : ''}.</p>}
              {overlaps.map((o) => (
                <button key={`${o.a}-${o.b}`} type="button" onClick={() => showOverlap(o)} className="flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-left hover:bg-destructive/10">
                  <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0 text-destructive" /><span><b>{o.aName}</b> ↔ <b>{o.bName}</b>: {fmt(o.depth, 2)} mm 파고듦 <span className="text-muted-foreground">(눌러서 위치 보기)</span></span>
                </button>
              ))}
              {motionIssues.map((o) => (
                <button key={`m-${o.a}-${o.b}`} type="button" onClick={() => showOverlap(o)} className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left ${o.kind === 'overlap' ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10' : 'border-warning/40 bg-warning/10 hover:bg-warning/15'}`}>
                  <AlertTriangle className={`mt-0.5 w-3.5 h-3.5 shrink-0 ${o.kind === 'overlap' ? 'text-destructive' : 'text-warning-text'}`} />
                  <span>{o.angle}° 로 기울이면 <b>{o.aName}</b> ↔ <b>{o.bName}</b> {o.kind === 'overlap' ? `${fmt(o.depth, 2)} mm 파고듦` : `틈 ${fmt(o.gap, 2)} mm (기준 ${motion.clearance} mm)`} <span className="text-muted-foreground">(눌러서 보기)</span></span>
                </button>
              ))}
              {motion && inter.motion?.sweep?.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-micro text-muted-foreground">각도별 가장 좁은 틈 (움직이며 좁아지는 쌍만)</p>
                  <div className="flex items-end gap-1" role="img" aria-label="각도별 최소 틈">
                    {inter.motion.sweep.map((s) => {
                      const g = s.gap;
                      const v = g === Infinity ? 1 : Math.max(0, Math.min(1, g / (motion.clearance * 3)));
                      const tone = g === Infinity || g >= motion.clearance ? 'bg-success/60' : g > 0 ? 'bg-warning' : 'bg-destructive';
                      return <div key={s.angle} className="flex flex-1 flex-col items-center gap-0.5" title={`${s.angle}° · ${g === Infinity ? '1 mm 이상' : g < 0 ? `${fmt(-g, 2)} mm 파고듦` : `${fmt(g, 2)} mm`}`}><div className={`w-full rounded-sm ${tone}`} style={{ height: `${8 + v * 28}px` }} /><span className="text-micro tabular-nums text-muted-foreground">{s.angle}</span></div>;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {selPart?.mold && (
        <Card title={`금형 점검 · ${selPart.name}`} icon={Factory} tag={selPart.material}>
          {!selMold?.report ? <p className="flex items-center gap-2 text-caption text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />이 부품의 구배·언더컷·살두께를 계산하는 중…</p> : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="점검 보기">
                  {MOLD_MODES.map(([m, l]) => <button key={m} type="button" aria-pressed={moldMode === m} onClick={() => setMoldMode(m)} className={`rounded-full border px-3 py-1 text-caption font-semibold ${moldMode === m ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground'}`}>{l}</button>)}
                </div>
                <Suspense fallback={<div className="h-[380px] rounded-xl border bg-secondary" />}>
                  <MoldViewer result={selMold.result} report={selMold.report} mode={moldMode} focus={moldFocus} className="h-[380px]" />
                </Suspense>
              </div>
              <div className="space-y-3">
                <MoldSummary result={selMold.result} report={selMold.report} />
                <MoldIssueList items={selMold.report.items} lang="ko" onShow={(it) => { setMoldMode(MOLD_MODES.some(([m]) => m === it.mode) ? it.mode : 'all'); if (it.focus?.position) setMoldFocus({ position: it.focus.position, at: Date.now() }); else if (it.view) setMoldFocus({ view: it.view, at: Date.now() }); }} />
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <MoldQuotePanel project={project} base={base} buildZip={moldZip} disabled={!parts.length || !!busy || status.busy}
          summary={{ count: moldParts.length, materials: [...new Set(moldParts.map((p) => p.material))].join('/'), weight: Math.round(moldParts.reduce((n, p) => n + (p.weight || 0), 0)) }} />
      </div>

      <p className="text-micro text-muted-foreground">치수 템플릿으로 만든 설계 초안입니다. 살두께·구배·분할·보스·리브·구멍은 사출 기준으로 들어가지만, 금형 발주 전에는 설계자가 공차·조립·강도를 검토하고 금형 업체가 금형 설계를 확정합니다. 계산은 모두 이 브라우저 안에서 합니다.</p>
    </div>
  );
}

function Chip({ tone, children }) {
  const cls = { good: 'bg-success/15 text-success-text', warn: 'bg-warning/15 text-warning-text', bad: 'bg-destructive/10 text-destructive', muted: 'bg-secondary text-muted-foreground' }[tone] || 'bg-secondary';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-semibold ${cls}`}>{children}</span>;
}
