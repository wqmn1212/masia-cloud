import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import ProtoFiles from '@/components/prototype/ProtoFiles';
import ReviewRunPanel from '@/components/prototype/review/ReviewRunPanel';
import ReviewHistory from '@/components/prototype/review/ReviewHistory';
import ReviewResult from '@/components/prototype/review/ReviewResult';
import { REVIEW_SECTIONS } from '@/lib/prototype';
import { protoKeys, useProtoProject, useProtoReviews, useProtoVersions } from '@/lib/prototypeApi';

// 시제품별 설계 검토 워크스페이스: 회로도·사출 도면·부품표 등록 + AI 검토 + 지적 사항 처리
export default function PrototypeReview() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const { data: project, isLoading, error } = useProtoProject(projectId);
  const { data: versions = [] } = useProtoVersions(projectId);
  const { data: reviews = [] } = useProtoReviews(projectId);

  const refreshProject = () => qc.invalidateQueries({ queryKey: protoKeys.project(projectId) });
  const refreshReviews = () => qc.invalidateQueries({ queryKey: protoKeys.reviews(projectId) });

  if (isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (error || !project) return <div className="py-24 text-center text-body text-muted-foreground">시제품을 찾을 수 없습니다. <Link to="/prototypes" className="text-primary">목록으로</Link></div>;

  const selected = reviews.find((r) => r.id === selectedId) || reviews[0];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <Link to={`/prototypes/${project.id}`} className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />{project.title}</Link>
        <div className="mt-2 flex items-center gap-2 text-primary"><ClipboardCheck className="w-5 h-5" /><span className="text-label font-semibold">설계 검토 워크스페이스</span></div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{project.title}</h1>
        <p className="text-body text-muted-foreground">회로도·사출 도면·부품표를 등록하고 AI 검토 의견을 받아 하나씩 처리합니다.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4 min-w-0">
          {REVIEW_SECTIONS.map((s) => (
            <div key={s.category} className="space-y-1">
              <ProtoFiles project={project} user={user} categories={[s.category]} onChanged={refreshProject} title={s.title} />
              <p className="px-1 text-micro text-muted-foreground">{s.hint}</p>
            </div>
          ))}
        </div>
        <aside className="space-y-4">
          <ReviewRunPanel project={project} versions={versions} onDone={(r) => { setSelectedId(r.id); refreshReviews(); }} />
          <ReviewHistory reviews={reviews} selectedId={selected?.id} onSelect={setSelectedId} />
        </aside>
      </div>

      {selected ? <ReviewResult review={selected} user={user} onChanged={refreshReviews} /> : (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-body text-muted-foreground">자료를 등록하고 AI 검토를 시작하면 결과가 여기에 나옵니다.</div>
      )}
    </div>
  );
}