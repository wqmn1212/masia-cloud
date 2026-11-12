import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import ConceptPreviewPanel from '@/components/prototype/concept/ConceptPreviewPanel';
import ConceptBriefPanel from '@/components/prototype/concept/ConceptBriefPanel';
import ConceptVersionBar from '@/components/prototype/concept/ConceptVersionBar';
import ConceptStartForm from '@/components/prototype/concept/ConceptStartForm';
import ConceptCircuitPanel from '@/components/prototype/concept/ConceptCircuitPanel';
import ConceptMoldPanel from '@/components/prototype/concept/ConceptMoldPanel';
import ConceptNotes from '@/components/prototype/concept/ConceptNotes';
import ConceptHistoryPanel from '@/components/prototype/concept/history/ConceptHistoryPanel';
import PdfButton from '@/components/reports/PdfButton';
import { useProtoProject } from '@/lib/prototypeApi';
import { conceptKey, useProtoConcepts } from '@/lib/conceptApi';

// 컨셉 스튜디오: 미팅용 3D 프리뷰를 맨 위에, 회로·사출 검토를 그 아래 나란히
export default function PrototypeConcept() {
  const { projectId } = useParams();
  const qc = useQueryClient();
  const { data: project, isLoading, error } = useProtoProject(projectId);
  const { data: concepts = [], isLoading: loadingConcepts } = useProtoConcepts(projectId);
  const [selectedId, setSelectedId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const concept = concepts.find((c) => c.id === selectedId) || concepts[0];

  const select = (id) => { setSelectedId(id); setHighlightId(null); };
  const refresh = (c) => { qc.invalidateQueries({ queryKey: conceptKey(projectId) }); if (c?.id) select(c.id); };
  // 검토 결과에서 위치를 누르면 위쪽 3D 로 올라가 그 부품을 강조한다
  const focusPart = (id) => { setHighlightId(id); if (id) window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (isLoading || loadingConcepts) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (error || !project) return <div className="py-24 text-center text-body text-muted-foreground">시제품을 찾을 수 없습니다. <Link to="/prototypes" className="text-primary">목록으로</Link></div>;
  const ready = concept?.preview?.parts?.length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to={`/prototypes/${project.id}`} className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />{project.title}</Link>
          <div className="mt-2 flex items-center gap-2 text-primary"><Sparkles className="w-5 h-5" /><span className="text-label font-semibold">컨셉 스튜디오</span></div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{concept?.title || '아이디어를 미팅에서 바로 보여 주는 3D 프리뷰'}</h1>
        </div>
        {ready && <PdfButton label="미팅용 PDF로 저장" size="default" generate={async () => {
          const { generateConceptPDF, conceptClientName } = await import('@/lib/conceptPdf');
          await generateConceptPDF(concept, project, await conceptClientName(project));
        }} />}
      </div>

      {concepts.length > 0 && <ConceptVersionBar concepts={concepts} concept={concept} onSelect={select} onChanged={refresh} />}

      {!concept && (
        <div className="rounded-2xl border bg-card p-6 max-w-3xl">
          <p className="text-title font-semibold">아이디어부터 적어 주세요</p>
          <p className="mb-4 text-caption text-muted-foreground">AI가 확인할 조건을 묻고, 확인한 뒤 미팅용 3D 프리뷰를 만듭니다. 이어서 회로와 사출·금형 검토 초안을 실행할 수 있습니다.</p>
          <ConceptStartForm projectId={project.id} defaultIdea={project.goal || ''} onCreated={(res) => refresh(res.concept)} />
        </div>
      )}
      {concept && !ready && <ConceptBriefPanel key={concept.id} concept={concept} onChanged={refresh} />}
      {ready && (
        <>
          <ConceptPreviewPanel key={concept.id} preview={concept.preview} version={concept.version_no} conceptId={concept.id} onChanged={refresh} highlightId={highlightId} onHighlight={setHighlightId} sketch={concept.sketch} />
          <ConceptNotes groups={[
            { title: '형상에 둔 가정', kind: 'assume', items: concept.preview.assumptions },
            { title: '실제 설계에서 확인할 것', kind: 'unverified', items: concept.preview.unverified },
          ]} />
          <div className="grid gap-4 xl:grid-cols-2 items-start">
            <ConceptCircuitPanel key={`c-${concept.id}`} concept={concept} project={project} onChanged={refresh} />
            <ConceptMoldPanel key={`m-${concept.id}`} concept={concept} project={project} onChanged={refresh} highlightId={highlightId} onHighlight={focusPart} />
          </div>
        </>
      )}

      <ConceptHistoryPanel concepts={concepts} concept={concept} onSelect={select} onChanged={refresh} />
    </div>
  );
}