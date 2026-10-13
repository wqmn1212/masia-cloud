import React, { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DropZone from '@/components/ui/drop-zone';
import { FlaskConical, Loader2, Save, ScanSearch, Upload, X } from 'lucide-react';
import { parseStepFileFromFile } from '@/lib/stepParser';
import { guessMaterial } from '@/lib/materialGuess';
import { parseStl, STL_UNITS } from '@/lib/moldReview/stl';
import { classifyPartForMolding } from '@/lib/moldReview/partFilter';
import { materialKeyFromGuess } from '@/lib/moldReview/materials';
import { DEFAULT_ANALYSIS_OPTIONS, MOLD_REVIEW_DEFLECTION_MM } from '@/lib/moldReview/options';
import { buildMoldReport, DEFAULT_REPORT_SETTINGS } from '@/lib/moldReview/report';
import { runMoldReview } from '@/lib/moldReview/runMoldReview';
import MoldViewer from '@/components/moldreview/MoldViewer';
import MoldSettingsPanel from '@/components/moldreview/MoldSettingsPanel';
import MoldSummary from '@/components/moldreview/MoldSummary';
import MoldIssueList from '@/components/moldreview/MoldIssueList';
import MoldSpecBox from '@/components/moldreview/MoldSpecBox';
import MoldPartPicker from '@/components/moldreview/MoldPartPicker';
import MoldReviewSaveDialog from '@/components/moldreview/MoldReviewSaveDialog';
import MoldReviewHistory from '@/components/moldreview/MoldReviewHistory';

const MODES = [
  ['all', '종합'],
  ['draft', '구배'],
  ['under', '언더컷 · 파팅'],
  ['thick', '살 두께'],
  ['flow', '게이트 · 웰드라인'],
];

const MAX_STL_MB = 100;
const pickAnalysis = (o) => ({ pull: o.pull, cosmetic: o.cosmetic, sinkRatio: o.sinkRatio });

function Section({ title, children, action }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export default function MoldReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const viewerRef = useRef(null);
  const jobRef = useRef(null);

  const [source, setSource] = useState(null); // { kind: 'step'|'stl'|'sample', fileName, parts }
  const [partIndex, setPartIndex] = useState(null);
  const [stlUnit, setStlUnit] = useState('mm');
  const [parsing, setParsing] = useState(null); // { label, percent }
  const [analysis, setAnalysis] = useState(pickAnalysis(DEFAULT_ANALYSIS_OPTIONS));
  const [ranAnalysis, setRanAnalysis] = useState(null);
  const [settings, setSettings] = useState({ ...DEFAULT_REPORT_SETTINGS });
  const [running, setRunning] = useState(null); // { label, percent }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('all');
  const [focus, setFocus] = useState(null);
  const [lang, setLang] = useState('ko');
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const part = source && partIndex != null ? source.parts[partIndex] : null;
  const report = useMemo(
    () => (result ? buildMoldReport(result, { ...settings, partName: part?.part_name, fileName: source?.fileName }) : null),
    [result, settings, part, source],
  );
  const dirty = !!ranAnalysis && JSON.stringify(analysis) !== JSON.stringify(ranAnalysis);

  const analyze = (input, opts) => {
    jobRef.current?.cancel();
    setError('');
    setRunning({ label: '검토 시작', percent: 0 });
    const job = runMoldReview(input, { ...DEFAULT_ANALYSIS_OPTIONS, ...opts }, (p) => setRunning(p));
    jobRef.current = job;
    job.promise
      .then((r) => {
        if (jobRef.current !== job) return;
        setResult(r);
        setRanAnalysis(opts);
        setMode('all');
        setFocus(null);
      })
      .catch((e) => {
        if (!e.cancelled && jobRef.current === job) setError(e.message);
      })
      .finally(() => {
        if (jobRef.current === job) {
          jobRef.current = null;
          setRunning(null);
        }
      });
  };

  const inputOf = (p) => (p.sample ? { sample: true } : { positions: p.mesh.positions, indices: p.mesh.indices });

  const selectPart = (parts, index, opts = analysis) => {
    const p = parts[index];
    setPartIndex(index);
    setResult(null);
    if (!p.sample) {
      const guess = materialKeyFromGuess(guessMaterial(p.part_name).material);
      setSettings((s) => ({ ...s, materialKey: guess.key }));
    }
    analyze(inputOf(p), opts);
  };

  const handleFile = async (file) => {
    const name = (file?.name || '').toLowerCase();
    setError('');
    try {
      if (name.endsWith('.stl')) {
        if (file.size > MAX_STL_MB * 1024 * 1024) throw new Error(`STL 파일 크기 상한(${MAX_STL_MB}MB)을 넘었습니다`);
        const unit = STL_UNITS.find((u) => u.value === stlUnit) || STL_UNITS[0];
        const mesh = parseStl(await file.arrayBuffer(), unit.scale);
        const parts = [{ part_name: file.name.replace(/\.stl$/i, ''), triangle_count: mesh.indices.length / 3, mesh, molded: true }];
        setSource({ kind: 'stl', fileName: file.name, parts });
        selectPart(parts, 0);
        return;
      }
      setParsing({ label: 'STEP 형상 읽는 중 (처음 한 번은 변환기를 불러옵니다)', percent: 0 });
      const { parts: raw } = await parseStepFileFromFile(file, {
        deflection: MOLD_REVIEW_DEFLECTION_MM,
        onProgress: ({ percent }) => setParsing({ label: 'STEP 형상 읽는 중', percent }),
      });
      if (!raw.length) throw new Error('부품 형상이 없습니다');
      const parts = raw.map((p) => ({ ...p, ...classifyPartForMolding(p) }));
      // 사출 부품을 앞에, 그 안에서는 큰 부품부터
      parts.sort((a, b) => (b.molded - a.molded) || (b.triangle_count - a.triangle_count));
      setSource({ kind: 'step', fileName: file.name, parts });
      selectPart(parts, 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(null);
    }
  };

  const loadSample = () => {
    const parts = [{ part_name: '샘플 하우징 (75 × 46 × 22mm)', sample: true, molded: true }];
    setSource({ kind: 'sample', fileName: null, parts });
    setSettings((s) => ({ ...s, materialKey: 'ABS' }));
    selectPart(parts, 0);
  };

  const rerun = () => part && analyze(inputOf(part), analysis);
  const cancel = () => jobRef.current?.cancel();

  const showItem = (it) => {
    setMode(it.mode);
    if (it.focus?.position) setFocus({ position: it.focus.position, at: Date.now() });
    else if (it.view) setFocus({ view: it.view, at: Date.now() });
  };

  const handleSave = async ({ cardId, note, withSnapshot }) => {
    if (!result || !report) return;
    setSaving(true);
    try {
      let snapshotUrl;
      if (withSnapshot) {
        const blob = await viewerRef.current?.snapshot();
        if (blob) {
          const file = new File([blob], `mold-review-${Date.now()}.png`, { type: 'image/png' });
          const uploaded = await base44.integrations.Core.UploadFile({ file });
          snapshotUrl = uploaded.file_url;
        }
      }
      const s = result.summary, c = report.calc;
      await base44.entities.MoldReview.create({
        tenant_id: user?.tenant_id,
        card_id: cardId || undefined,
        source_file_name: source?.fileName || '',
        part_name: part?.part_name || '',
        material: report.material.name,
        engine_version: result.version,
        pull_direction: result.pull.label,
        settings: {
          draft_min_deg: settings.draftMin,
          texture_depth_mm: settings.textureDepth,
          cavities: c.cavities,
          cosmetic: result.options.cosmetic,
          sink_ratio: result.options.sinkRatio,
          pull: result.options.pull,
        },
        summary: {
          size_mm: s.size.map((v) => Math.round(v * 10) / 10),
          volume_cm3: Math.round(s.volume) / 1000,
          weight_g: Math.round(c.weight * 10) / 10,
          nominal_wall_mm: Math.round(s.nominal * 100) / 100,
          projected_area_cm2: Math.round(c.projectedCm2 * 10) / 10,
          tonnage: Math.round(c.tonnage),
          machine_ton: c.machine,
          undercut_count: result.undercuts.length,
          slide_count: result.undercuts.filter((u) => u.type === 'slide').length,
          lifter_count: result.undercuts.filter((u) => u.type === 'lifter').length,
          parting_length_mm: Math.round(result.parting.length),
          gate_plan: report.plan?.id || '',
          flow_ratio: report.plan ? Math.round(report.plan.lt) : 0,
          weld_count: report.plan ? report.plan.weldGroups.length : 0,
        },
        issues: report.items.map((it) => ({
          key: it.id, level: it.level, title_ko: it.title.ko, text_ko: it.text.ko, title_zh: it.title.zh, text_zh: it.text.zh,
        })),
        high_count: report.counts.hi,
        caution_count: report.counts.mid,
        spec_ko: report.spec.ko,
        spec_zh: report.spec.zh,
        snapshot_url: snapshotUrl,
        note,
      });
      queryClient.invalidateQueries({ queryKey: ['mold-reviews'] });
      setSaveOpen(false);
      toast({ title: '금형 검토를 저장했습니다', description: part?.part_name });
    } catch (e) {
      toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const busy = !!running || !!parsing;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ScanSearch className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">금형 사전 검토</h1>
          <p className="text-xs text-muted-foreground">
            STEP · STL 형상으로 구배 · 언더컷 · 살 두께 · 파팅라인 · 게이트 · 웰드라인을 미리 보고, 공장에 보낼 금형 설계 지시서(한 · 중)를 만듭니다
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={loadSample} disabled={busy}>
          <FlaskConical className="h-4 w-4" />
          샘플로 해 보기
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <DropZone onFile={handleFile} accept=".stp,.step,.stl">
          <div className="flex flex-wrap items-center gap-3">
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
              <Upload className="h-4 w-4" />
              STEP(.stp/.step) · STL 을 끌어놓거나 클릭해 선택
              <input
                type="file"
                className="hidden"
                accept=".stp,.step,.stl"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              STL 단위
              <Select value={stlUnit} onValueChange={setStlUnit}>
                <SelectTrigger className="h-8 w-[88px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STL_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {source?.parts?.length > 1 && (
              <div className="min-w-[260px] flex-1">
                <MoldPartPicker parts={source.parts} value={partIndex} onChange={(i) => selectPart(source.parts, i)} disabled={busy} />
              </div>
            )}
          </div>
        </DropZone>
        {parsing && (
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {parsing.label}
            <Progress value={parsing.percent} className="max-w-xs" />
          </div>
        )}
        {part?.note && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{part.note}</p>}
        {part && !part.molded && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">이 부품은 {part.reason}으로 보여 사출 검토 대상이 아닐 수 있습니다.</p>}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">
          파일은 서버로 보내지 않고 이 브라우저 안에서 계산합니다. 형상만 보는 추정이므로 최종 판단은 금형 설계자와 모류분석(模流分析)으로 확정합니다.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="보기 방식">
            {MODES.map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                disabled={!result}
                onClick={() => {
                  setMode(m);
                  if (m === 'flow' && mode !== 'flow') setFocus({ view: 'bottom', at: Date.now() });
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${mode === m ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <MoldViewer ref={viewerRef} result={result} report={report} mode={mode} focus={focus} className="h-[58vh] min-h-[380px] lg:h-[calc(100vh-11rem)]" />
            {!result && !running && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground/80">부품을 불러오면 검토가 시작됩니다</p>
                  <p className="mt-1 text-xs">위에서 STEP · STL 을 올리거나 &lsquo;샘플로 해 보기&rsquo;를 눌러 주세요.</p>
                </div>
              </div>
            )}
            {running && (
              <div className="absolute inset-0 z-30 grid place-items-center rounded-xl bg-background/60 backdrop-blur-[1px]">
                <div className="w-[min(320px,85%)] space-y-3 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {running.label}
                  </div>
                  <Progress value={running.percent} />
                  <Button type="button" variant="ghost" size="sm" className="w-full" onClick={cancel}>
                    <X className="h-3.5 w-3.5" />
                    취소
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Section title="검토 조건">
            <MoldSettingsPanel
              analysis={analysis}
              onAnalysisChange={setAnalysis}
              settings={settings}
              onSettingsChange={setSettings}
              onRerun={rerun}
              canRerun={!!part && !busy}
              dirty={dirty}
              cavitiesAuto={report?.calc.cavitiesAuto}
            />
          </Section>

          {result && report && (
            <>
              <Section title={`부품 요약 · ${part?.part_name || ''}`}>
                <MoldSummary result={result} report={report} cavitiesManual={!!settings.cavities} />
              </Section>

              <Section
                title="검토 결과"
                action={(
                  <div className="inline-flex rounded-lg border p-0.5">
                    {[['ko', '한국어'], ['zh', '中文']].map(([v, label]) => (
                      <button key={v} type="button" aria-pressed={lang === v} onClick={() => setLang(v)} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${lang === v ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              >
                <MoldIssueList items={report.items} lang={lang} onShow={showItem} />
              </Section>

              <Section title="금형 설계 지시서 초안">
                <MoldSpecBox spec={report.spec} />
              </Section>

              <Button type="button" className="w-full" onClick={() => setSaveOpen(true)} disabled={busy}>
                <Save className="h-4 w-4" />
                검토 결과 저장
              </Button>
            </>
          )}

          <Section title="저장한 검토">
            <MoldReviewHistory />
          </Section>
        </div>
      </div>

      <MoldReviewSaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onConfirm={handleSave}
        isSaving={saving}
        partName={part?.part_name}
      />
    </div>
  );
}
