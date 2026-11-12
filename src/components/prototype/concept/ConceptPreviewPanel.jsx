import React, { useMemo, useState } from 'react';
import { Box, Boxes, Image, Layers, Move3d, RotateCw, Info, Loader2, Wand2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';
import ConceptCanvas from '@/components/prototype/concept/ConceptCanvas';
import ConceptImageFit from '@/components/prototype/concept/ConceptImageFit';
import { CONCEPT_LAYERS, CONCEPT_DISCLAIMER } from '@/lib/concept';
import { hullSources } from '@/lib/conceptHullScene';

const Chip = ({ active, onClick, icon: Icon, children }) => (
  <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-label font-medium backdrop-blur transition-all duration-300 ${active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card/80 text-foreground hover:border-primary/50'}`}>
    <Icon className="w-3.5 h-3.5" />{children}
  </button>
);

// 고객 미팅용 프리뷰: 돌려 보는 3D + 렌더 이미지 + 구성 부품
// 렌더 이미지는 처음 만들 때와 사진을 첨부한 변경 때 자동으로 이어서 만들고, 글로만 바꾼 버전은 '이 버전으로 렌더'를 눌러야 다시 만든다 (이미지 생성 비용)
// 스케치 정리를 마친 컨셉은 '외형 3D'(고른 시안 정면·측면 윤곽으로 만든 겉모양)를 먼저 보여 주고,
// '부품 3D'(기본 도형 조립)는 내부 배치·분해·금형 검토용으로 남겨 둔다.
export default function ConceptPreviewPanel({ preview, version, conceptId, onChanged, highlightId, onHighlight, sketch }) {
  const src = hullSources(sketch);
  const hull = useMemo(() => src, [src?.front, src?.side]);
  const [hullInfo, setHullInfo] = useState(null);
  const hullOk = !!hull && !hullInfo?.error;
  const [mode, setMode] = useState(hull ? 'hull' : '3d');
  const [xray, setXray] = useState(false);
  const [explode, setExplode] = useState(false);
  const [spin, setSpin] = useState(true);
  // 부품을 강조하면(목록·금형 검토에서 선택) 부품이 보이는 부품 3D 로 보여 준다
  const view = !preview.render_url && mode === 'render' ? '3d' : mode === 'hull' && (!hullOk || highlightId) ? '3d' : mode;
  const show3d = view !== 'render';
  const isHull = view === 'hull';
  const size = isHull && hullInfo?.size ? hullInfo.size : preview.overall_mm;
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState('');
  const renderVersion = preview.render_url ? (preview.render_version ?? version) : null;
  const outdated = renderVersion != null && version != null && renderVersion !== version;
  const render = async () => {
    setRendering(true); setRenderError('');
    try { const res = await runConcept('render', { concept_id: conceptId }); onChanged?.(res.concept); setMode('render'); }
    catch (e) { setRenderError(errorText(e)); }
    setRendering(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="relative min-h-[420px] lg:min-h-[600px] overflow-hidden rounded-2xl border bg-gradient-to-b from-secondary to-card">
        {show3d
          ? <ConceptCanvas key={view} parts={preview.parts} xray={xray} explode={!isHull && explode} autoRotate={spin && !highlightId} highlightId={highlightId}
              hull={isHull ? hull : null} overall={preview.overall_mm} onHull={setHullInfo} />
          : <img src={preview.render_url} alt="컨셉 렌더 이미지" className="absolute inset-0 h-full w-full object-contain" />}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {hullOk && <Chip active={isHull} onClick={() => setMode('hull')} icon={Box}>외형 3D</Chip>}
          <Chip active={view === '3d'} onClick={() => setMode('3d')} icon={hullOk ? Boxes : Box}>{hullOk ? '부품 3D' : '3D'}</Chip>
          {preview.render_url && <Chip active={!show3d} onClick={() => setMode('render')} icon={Image}>렌더 이미지</Chip>}
        </div>
        {show3d && (
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
            <Chip active={xray} onClick={() => setXray(!xray)} icon={Layers}>내부 보기</Chip>
            {!isHull && <Chip active={explode} onClick={() => setExplode(!explode)} icon={Move3d}>분해</Chip>}
            <Chip active={spin} onClick={() => setSpin(!spin)} icon={RotateCw}>자동 회전</Chip>
          </div>
        )}
        {isHull && !hullInfo && <p className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-caption text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />시안 윤곽으로 외형을 만드는 중…</p>}
        {isHull && hullInfo?.warning && <p className="absolute bottom-16 left-4 right-4 flex items-start gap-1.5 rounded-xl bg-warning/15 px-3 py-2 text-caption text-warning-text backdrop-blur"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{hullInfo.warning}</p>}
        {!show3d && outdated && <p className="absolute bottom-4 left-4 rounded-full bg-warning/15 px-3 py-1.5 text-caption text-warning-text backdrop-blur">v{renderVersion} 형상 기준 렌더입니다</p>}
        {size && <p className="absolute right-4 top-4 rounded-full bg-card/80 px-3 py-1.5 text-caption tabular-nums backdrop-blur">약 {size.x} × {size.z} × {size.y} mm</p>}
      </div>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <p className="text-title font-semibold">{preview.title || '컨셉'}</p>
          <p className="text-body text-muted-foreground">{preview.summary}</p>
          <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning-text"><Info className="w-4 h-4 shrink-0 mt-0.5" />{CONCEPT_DISCLAIMER.preview}</p>
          {hullOk && <p className="text-caption text-muted-foreground">외형 3D 는 고른 시안의 정면·측면 윤곽을 높이마다 따라 만들고 시안 이미지를 입힌 겉모양입니다. 내부 배치·분해·금형 검토는 부품 3D 로 확인하세요.</p>}
          {hull && hullInfo?.error && <p className="text-caption text-warning-text">외형 3D 를 만들지 못해 부품 3D 로 보여 줍니다. ({hullInfo.error})</p>}
          {conceptId && (!preview.render_url || outdated) && (
            <div className="space-y-1 pt-1">
              <Button size="sm" variant="outline" onClick={render} disabled={rendering}>
                {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}{preview.render_url ? '이 버전으로 렌더 이미지 다시 만들기' : '렌더 이미지 만들기'}
              </Button>
              <p className="text-micro text-muted-foreground">{outdated ? `지금 렌더 이미지는 v${renderVersion} 형상 기준입니다. ` : ''}이미지 생성 크레딧이 듭니다. (약 20~40초)</p>
              {(renderError || preview.render_error) && <p className="text-caption text-destructive">{renderError || `지난 렌더 실패: ${preview.render_error}`}</p>}
            </div>
          )}
        </div>
        <ConceptImageFit fit={preview.image_fit} />
        <div className="rounded-2xl border bg-card p-3 flex-1 max-h-[420px] overflow-y-auto">
          <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">구성 부품 {preview.parts?.length || 0}</p>
          {(preview.parts || []).map((p) => (
            <button key={p.id} type="button" onClick={() => onHighlight(highlightId === p.id ? null : p.id)} className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${highlightId === p.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: p.color }} />
                <span className={`text-label font-medium truncate ${highlightId === p.id ? 'text-primary' : ''}`}>{p.name}</span>
                <span className="ml-auto shrink-0 text-micro text-muted-foreground">{CONCEPT_LAYERS[p.layer] || '기타'}</span>
              </span>
              {p.role && <span className="mt-0.5 block pl-5 text-caption text-muted-foreground line-clamp-2">{p.role}{p.material ? ` · ${p.material}` : ''}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}