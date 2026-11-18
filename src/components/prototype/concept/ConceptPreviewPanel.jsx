import React, { useMemo, useRef, useState } from 'react';
import { Box, Boxes, Image, Layers, Move3d, RotateCw, Info, Loader2, Wand2, AlertTriangle, PenLine, Camera, Brush, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';
import ConceptCanvas from '@/components/prototype/concept/ConceptCanvas';
import ConceptImageFit from '@/components/prototype/concept/ConceptImageFit';
import ConceptEditor from '@/components/prototype/concept/ConceptEditor';
import ConceptLocksPanel from '@/components/prototype/concept/ConceptLocksPanel';
import { RenderEditor, RenderHistory } from '@/components/prototype/concept/RenderEditPanel';
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
// '3D 편집' 으로 부품을 직접 고치거나 고른 부품만 AI 로 바꾸고, 요구 치수를 고정하고, 렌더 이미지를 3D 화면 기준으로 만들거나 일부만 고친다
export default function ConceptPreviewPanel({ preview, version, conceptId, onChanged, highlightId, onHighlight, sketch, locks, onLocksSaved }) {
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
  const [editing, setEditing] = useState(null); // null 또는 { initial: 시작 부품(치수 맞추기에서 열면 맞춘 부품) }
  const [editRender, setEditRender] = useState(false);
  const [notice, setNotice] = useState('');
  const canvasApi = useRef(null);
  const renderVersion = preview.render_url ? (preview.render_version ?? version) : null;
  const outdated = renderVersion != null && version != null && renderVersion !== version;
  // fromView: 지금 3D 화면을 캡처해 그 모양·각도대로 사진처럼 렌더
  const render = async (fromView = false) => {
    setRendering(true); setRenderError('');
    try {
      const view_image = fromView ? canvasApi.current?.capture?.() : undefined;
      if (fromView && !view_image) throw new Error('3D 화면을 캡처하지 못했습니다. 3D 보기에서 다시 눌러 주세요.');
      const res = await runConcept('render', { concept_id: conceptId, ...(view_image ? { view_image } : {}) });
      onChanged?.(res.concept); setMode('render');
    } catch (e) { setRenderError(errorText(e)); }
    setRendering(false);
  };
  const saved = (c, misses) => {
    setEditing(null);
    setNotice(misses?.length ? `v${c.version_no} 을 만들었습니다. 요구 치수 ${misses.length}개가 아직 어긋나 있습니다.` : `v${c.version_no} 을 만들었습니다.`);
    onChanged?.(c);
  };

  if (editing && conceptId) {
    return <ConceptEditor conceptId={conceptId} version={version} preview={preview} locks={locks} initialParts={editing.initial} onSaved={saved} onLocksSaved={onLocksSaved} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="relative min-h-[420px] lg:min-h-[600px] overflow-hidden rounded-2xl border bg-gradient-to-b from-secondary to-card">
        {show3d
          ? <ConceptCanvas key={view} parts={preview.parts} xray={xray} explode={!isHull && explode} autoRotate={spin && !highlightId} highlightId={highlightId}
              hull={isHull ? hull : null} overall={preview.overall_mm} onHull={setHullInfo} apiRef={canvasApi} />
          : <img src={preview.render_url} alt="컨셉 렌더 이미지" className="absolute inset-0 h-full w-full object-contain" />}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {hullOk && <Chip active={isHull} onClick={() => setMode('hull')} icon={Box}>외형 3D</Chip>}
          <Chip active={view === '3d'} onClick={() => setMode('3d')} icon={hullOk ? Boxes : Box}>{hullOk ? '부품 3D' : '3D'}</Chip>
          {preview.render_url && <Chip active={!show3d} onClick={() => setMode('render')} icon={Image}>렌더 이미지</Chip>}
          {conceptId && <Chip active={false} onClick={() => setEditing({})} icon={PenLine}>3D 편집</Chip>}
        </div>
        {!show3d && conceptId && !editRender && <Button size="sm" variant="outline" className="absolute bottom-4 right-4 bg-card/90" onClick={() => setEditRender(true)}><Brush className="w-4 h-4" />이미지 고치기</Button>}
        {!show3d && editRender && <RenderEditor conceptId={conceptId} url={preview.render_url} onChanged={(c) => onChanged?.(c)} onClose={() => setEditRender(false)} />}
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
          {conceptId && (
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => render(true)} disabled={rendering || !show3d} title={show3d ? '' : '3D 보기에서 누르세요'}>
                  {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}지금 3D 화면으로 렌더
                </Button>
                {(!preview.render_url || outdated) && (
                  <Button size="sm" variant="outline" onClick={() => render(false)} disabled={rendering}>
                    <Wand2 className="w-4 h-4" />{preview.render_url ? '이 버전으로 다시 만들기' : '렌더 이미지 만들기'}
                  </Button>
                )}
              </div>
              <p className="text-micro text-muted-foreground">“지금 3D 화면으로 렌더” 는 돌려 놓은 각도·모양 그대로 사진처럼 만들어 3D 와 어긋나지 않습니다. {outdated ? `지금 렌더 이미지는 v${renderVersion} 형상 기준입니다. ` : ''}이미지 생성 크레딧이 듭니다. (약 20~40초)</p>
              {preview.render_note && preview.render_url && <p className="text-micro text-muted-foreground">지금 렌더: {preview.render_note}</p>}
              {(renderError || preview.render_error) && <p className="text-caption text-destructive">{renderError || `지난 렌더 실패: ${preview.render_error}`}</p>}
              <RenderHistory conceptId={conceptId} history={preview.render_history} onChanged={(c) => { onChanged?.(c); setMode('render'); }} />
            </div>
          )}
          {notice && <p className="rounded-lg bg-success/10 px-3 py-2 text-caption text-success-text">{notice}</p>}
          {preview.lock_fit?.changes?.length > 0 && <p className="flex items-start gap-1.5 rounded-lg bg-secondary px-3 py-2 text-caption"><Ruler className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />요구 치수에 맞춰 조정: {preview.lock_fit.changes.join(' · ')}</p>}
          {preview.scoped && <p className="text-caption text-muted-foreground">이 버전은 고른 부품만 바꿨습니다. 나머지 부품은 이전 버전 그대로입니다.</p>}
        </div>
        <ConceptImageFit fit={preview.image_fit} />
        {conceptId && <ConceptLocksPanel conceptId={conceptId} locks={locks} parts={preview.parts} onSaved={onLocksSaved} onFit={(fitted) => setEditing({ initial: fitted })} />}
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