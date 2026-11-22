import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setupStage } from '@/lib/stage3d';
import { Play, Pause, SkipBack, SkipForward, Box, Layers, Scissors, Tag, Move3d, Info, Sparkles, Loader2, RotateCcw, FileDown, Video, Square, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createTeardown } from '@/lib/teardown/engine';
import { buildDefaultTour, buildSystems, cleanTour, stepSpecs, tourMissing, FLOW_KINDS, VIEW_LABEL } from '@/lib/teardown/tour';
import TeardownAsk from '@/components/teardown/TeardownAsk';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';

const VIEW_ICON = { solid: Box, glass: Layers, section: Scissors };
const LABEL_MODE = { focus: '이름표: 강조 부품', all: '이름표: 전체', off: '이름표: 끔' };

const Chip = ({ active, onClick, icon: Icon, children, title }) => (
  <button type="button" onClick={onClick} title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-label font-medium backdrop-blur transition-colors ${active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card/85 text-foreground hover:border-primary/50'}`}>
    {Icon && <Icon className="h-3.5 w-3.5" />}{children}
  </button>
);

/**
 * 작동 원리 3D: 자동 해설 투어 + 보기 방식(실물·투명 외장·단면) + 분해 + 부분별 보기.
 * 형상은 컨셉 부품 그대로 쓰고, 투어는 저장된 것(AI·직원 편집)이 있으면 그것, 없으면 부품·기능으로 기본 투어를 만든다.
 * staff: AI 로 투어 다시 쓰기, 질문하면 3D 로 답하기, HTML·영상 저장 (고객 화면에서는 보기만)
 */
export default function TeardownView({ parts, savedTour, dev, title, overall, conceptId, version, onChanged, staff = false }) {
  const features = dev?.features;
  const supplyV = dev?.supply_v;
  const defaultTour = useMemo(() => buildDefaultTour({ parts, features, title, overall, supplyV }), [parts, features, title, overall, supplyV]);
  const saved = useMemo(() => (savedTour?.steps?.length ? cleanTour(savedTour, parts) : null), [savedTour, parts]);
  const tour = saved?.steps?.length ? saved : defaultTour;
  const missing = savedTour?.steps?.length ? tourMissing(savedTour, parts) : 0;
  const systems = useMemo(() => buildSystems({ parts, features }), [parts, features]);

  const hostRef = useRef(null);
  const api = useRef(null);
  const [st, setSt] = useState({ index: -1, count: 0, playing: false, step: null, view: 'solid', explode: 0, labels: 'focus' });
  const [progress, setProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !parts?.length) return undefined;
    let t;
    try {
      t = createTeardown(host, { THREE, OrbitControls, RoundedBoxGeometry, RoomEnvironment, stage: setupStage }, { parts, tour, title, onChange: setSt, onProgress: setProgress });
    } catch (e) { setError(e.message || '3D 를 열지 못했습니다'); return undefined; }
    api.current = t;
    setSt(t.getState());
    return () => { api.current = null; t.destroy(); };
  }, [parts, tour, title]);

  const step = st.step;
  const specs = useMemo(() => stepSpecs(step, { parts, features, supplyV }), [step, parts, features, supplyV]);
  const flowKinds = [...new Set((step?.flows || []).map((f) => f.kind))];

  const exportHtml = async () => {
    setBusy('html'); setError('');
    try {
      const { teardownHtml, downloadBlob, safeFileName } = await import('@/lib/teardown/exportHtml');
      const html = teardownHtml({ title, parts, tour, systems, overall });
      downloadBlob(new Blob([html], { type: 'text/html' }), `${safeFileName(title)}-작동원리.html`);
    } catch (e) { setError(e.message || 'HTML 을 만들지 못했습니다'); }
    setBusy('');
  };
  const recordVideo = async () => {
    if (!api.current) return;
    setRecording(true); setError('');
    try {
      const { downloadBlob, safeFileName } = await import('@/lib/teardown/exportHtml');
      const blob = await api.current.record({ title });
      if (blob?.size) downloadBlob(blob, `${safeFileName(title)}-작동원리.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
    } catch (e) { setError(e.message || '영상을 만들지 못했습니다'); }
    setRecording(false);
  };
  const aiTour = async (body, label) => {
    setBusy(label); setError('');
    try {
      const res = await runConcept('tour', { concept_id: conceptId, ...body });
      onChanged?.(res.concept);
    } catch (e) { setError(errorText(e)); }
    setBusy('');
  };
  const [ask, setAsk] = useState('');

  if (!parts?.length) return <p className="rounded-2xl border bg-card p-6 text-body text-muted-foreground">3D 부품이 있어야 작동 원리를 보여 줄 수 있습니다.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-3">
        <div className="relative h-[420px] overflow-hidden rounded-2xl border stage-bg sm:h-[560px]">
          <div ref={hostRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" data-testid="teardown-stage" />
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
            {Object.entries(VIEW_LABEL).map(([k, l]) => <Chip key={k} active={st.view === k} onClick={() => api.current?.setView(k)} icon={VIEW_ICON[k]}>{l}</Chip>)}
          </div>
          <div className="absolute right-3 top-3 z-10 flex flex-wrap items-center justify-end gap-1.5">
            <label className="inline-flex items-center gap-2 rounded-full border bg-card/85 px-3 py-1.5 text-label backdrop-blur">
              <Move3d className="h-3.5 w-3.5" />분해
              <input type="range" min="0" max="100" value={Math.round(st.explode * 100)} onChange={(e) => api.current?.setExplode(Number(e.target.value) / 100)} className="w-20 accent-primary" aria-label="분해 정도" />
            </label>
            <Chip active={st.labels !== 'off'} onClick={() => api.current?.setLabels({ focus: 'all', all: 'off', off: 'focus' }[st.labels])} icon={Tag}>{LABEL_MODE[st.labels]}</Chip>
          </div>
          {error && <p className="absolute bottom-3 left-3 right-3 z-10 rounded-xl bg-destructive/10 px-3 py-2 text-caption text-destructive backdrop-blur">{error}</p>}
          {recording && <p className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full bg-destructive px-3 py-1.5 text-caption font-medium text-destructive-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive-foreground" />녹화 중 {st.index + 1}/{st.count}</p>}
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-baseline gap-2">
            <p className="text-title font-semibold">{step?.title || '작동 원리'}</p>
            {st.index >= 0 && <span className="text-caption tabular-nums text-muted-foreground">{st.index + 1} / {st.count}</span>}
            {st.adhoc && <span className="text-caption text-muted-foreground">부분 보기</span>}
          </div>
          <p className="mt-1 min-h-[44px] text-body leading-relaxed text-muted-foreground" aria-live="polite">{step?.caption || '재생을 누르면 제품이 어떻게 동작하는지 차례로 보여 줍니다.'}</p>
          {(specs.length > 0 || flowKinds.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {specs.map((s) => <span key={s.label} className="rounded-full bg-secondary px-2.5 py-1 text-caption"><span className="text-muted-foreground">{s.label}</span> <span className="font-medium tabular-nums">{s.value}</span></span>)}
              {flowKinds.map((k) => <span key={k} className="inline-flex items-center gap-1 text-caption text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FLOW_KINDS[k].color }} />{FLOW_KINDS[k].label}</span>)}
            </div>
          )}
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${st.index >= 0 ? progress * 100 : 0}%` }} /></div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => api.current?.prev()} disabled={recording} aria-label="이전 단계"><SkipBack className="h-4 w-4" /></Button>
            <Button size="sm" onClick={() => api.current?.toggle()} disabled={recording}>{st.playing ? <><Pause className="h-4 w-4" />일시정지</> : <><Play className="h-4 w-4" />{st.ended ? '처음부터' : '재생'}</>}</Button>
            <Button size="sm" variant="outline" onClick={() => api.current?.next()} disabled={recording} aria-label="다음 단계"><SkipForward className="h-4 w-4" /></Button>
            <span className="ml-auto text-micro text-muted-foreground">끌어서 돌리면 자동 재생이 멈춥니다</span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="rounded-2xl border bg-card p-2">
          <p className="flex items-center gap-1.5 px-2 py-1.5 text-caption font-semibold text-muted-foreground"><ListOrdered className="h-3.5 w-3.5" />단계 {tour.steps.length}
            <span className="ml-auto font-normal">{saved ? (saved.source === 'ai' ? 'AI 가 쓴 투어' : '고친 투어') : '기본 투어'}</span></p>
          <div className="max-h-[300px] overflow-y-auto">
            {tour.steps.map((s, i) => (
              <button key={s.id} type="button" onClick={() => api.current?.goto(i, { play: false })} disabled={recording}
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-label transition-colors ${st.index === i ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'}`}>
                <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{i + 1}</span><span className="min-w-0 truncate">{s.title}</span>
              </button>
            ))}
          </div>
          {saved && saved.version != null && version != null && saved.version !== version && <p className="px-2 pb-1 text-micro text-warning-text">v{saved.version} 형상으로 쓴 투어입니다{missing ? ` (사라진 부품 ${missing}곳은 빼고 보여 줍니다)` : ''}.</p>}
        </div>

        {systems.length > 0 && (
          <div className="rounded-2xl border bg-card p-3">
            <p className="px-1 pb-2 text-caption font-semibold text-muted-foreground">부분별로 보기</p>
            <div className="flex flex-wrap gap-1.5">
              {systems.map((s) => <Chip key={s.id} active={st.adhoc && st.step?.id === s.id} onClick={() => api.current?.show(s)}>{s.title}</Chip>)}
            </div>
          </div>
        )}

        {staff && conceptId && <TeardownAsk conceptId={conceptId} current={step?.title} onShow={(s) => api.current?.show(s)} />}

        {staff && (
          <div className="space-y-2 rounded-2xl border bg-card p-3">
            {conceptId && (
              <>
                <p className="px-1 text-caption font-semibold text-muted-foreground">투어 설명</p>
                <textarea value={ask} onChange={(e) => setAsk(e.target.value)} rows={2} maxLength={500} placeholder="AI 에게 바라는 점 (예: 수면 모드 위주로, 안전 장치도 보여 줘)"
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-label placeholder:text-muted-foreground" />
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => aiTour({ ask }, 'ai')} disabled={!!busy || recording}>{busy === 'ai' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}AI 로 투어 쓰기</Button>
                  {saved && <Button size="sm" variant="outline" onClick={() => aiTour({ reset: true }, 'reset')} disabled={!!busy || recording}>{busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}기본 투어로</Button>}
                </div>
                <p className="px-1 text-micro text-muted-foreground">AI 는 순서와 설명만 씁니다. 모양은 이 컨셉의 부품 그대로이고, 없는 부품은 걸러 냅니다. 고객 공개에 함께 실립니다.</p>
              </>
            )}
            <p className="px-1 pt-1 text-caption font-semibold text-muted-foreground">미팅 자료로 저장</p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={exportHtml} disabled={!!busy || recording}>{busy === 'html' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}HTML 파일</Button>
              {recording
                ? <Button size="sm" variant="destructive" onClick={() => api.current?.stopRecording()}><Square className="h-4 w-4" />녹화 멈추기</Button>
                : <Button size="sm" variant="outline" onClick={recordVideo} disabled={!!busy}><Video className="h-4 w-4" />투어 영상</Button>}
            </div>
            <p className="px-1 text-micro text-muted-foreground">HTML 은 인터넷 없이 브라우저로 열리는 파일 하나입니다. 영상은 투어를 처음부터 끝까지 한 번 재생하며 녹화합니다 (약 {Math.round(tour.steps.reduce((a, s) => a + s.dur, 0))}초).</p>
          </div>
        )}
        <p className="flex items-start gap-1.5 px-1 text-micro text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />컨셉 단계의 개념 시각화입니다. 흐름·동작은 설명을 돕는 표시이며 실제 회로·치수와 다를 수 있습니다.</p>
      </div>
    </div>
  );
}
