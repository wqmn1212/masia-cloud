import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProtoStageBar from '@/components/prototype/ProtoStageBar';
import ProtoSummary from '@/components/prototype/ProtoSummary';
import RequirementsTab from '@/components/prototype/RequirementsTab';
import DesignTab from '@/components/prototype/DesignTab';
import BomTab from '@/components/prototype/BomTab';
import BuildTab from '@/components/prototype/BuildTab';
import ViewerTab from '@/components/prototype/ViewerTab';
import TestsTab from '@/components/prototype/TestsTab';
import { protoKeys, useProtoProject, useProtoTests, useProtoVersions, openRiskCount } from '@/lib/prototypeApi';
import { fmtDate } from '@/lib/prototype';

const TABS = [['req', '요구사항'], ['design', '설계 초안'], ['bom', '부품표'], ['build', '제작'], ['viewer', '3D 검토'], ['tests', '시험·개선']];

export default function PrototypeDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('req');
  const { data: project, isLoading, error } = useProtoProject(projectId);
  const { data: versions = [] } = useProtoVersions(projectId);
  const { data: tests = [] } = useProtoTests(projectId);

  const refresh = () => ['project', 'versions', 'tests'].forEach((k) => qc.invalidateQueries({ queryKey: protoKeys[k](projectId) })) || qc.invalidateQueries({ queryKey: protoKeys.list });

  // 목록에 보이는 미해결 위험 수를 최신 상태로 맞춘다
  useEffect(() => {
    if (!project) return;
    const n = openRiskCount(versions.find((v) => v.id === project.current_version_id) || versions[0], tests);
    if ((project.open_risk_count || 0) !== n) base44.entities.ProtoProject.update(project.id, { open_risk_count: n }).then(() => qc.invalidateQueries({ queryKey: protoKeys.list }));
  }, [project, versions, tests]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (error || !project) return <div className="py-24 text-center text-body text-muted-foreground">시제품을 찾을 수 없습니다. <Link to="/prototypes" className="text-primary">목록으로</Link></div>;

  const setStage = async (stage) => { await base44.entities.ProtoProject.update(project.id, { stage }); refresh(); };
  const props = { project, versions, tests, user, onChanged: refresh };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <Link to="/prototypes" className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />시제품 목록</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{project.title}</h1>
        <p className="text-caption text-muted-foreground">담당 {project.owner_name || '-'} · 최근 변경 {fmtDate(project.updated_date)}</p>
      </div>
      <div className="rounded-xl border bg-card p-4"><ProtoStageBar stage={project.stage} onSelect={setStage} /></div>
      <ProtoSummary project={project} versions={versions} tests={tests} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">{TABS.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList>
        <TabsContent value="req" className="mt-4"><RequirementsTab {...props} /></TabsContent>
        <TabsContent value="design" className="mt-4"><DesignTab {...props} /></TabsContent>
        <TabsContent value="bom" className="mt-4"><BomTab {...props} /></TabsContent>
        <TabsContent value="build" className="mt-4"><BuildTab {...props} /></TabsContent>
        <TabsContent value="viewer" className="mt-4"><ViewerTab {...props} /></TabsContent>
        <TabsContent value="tests" className="mt-4"><TestsTab {...props} /></TabsContent>
      </Tabs>
    </div>
  );
}