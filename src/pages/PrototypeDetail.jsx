import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProtoStageBar from '@/components/prototype/ProtoStageBar';
import ProtoSummary from '@/components/prototype/ProtoSummary';
import RequirementsTab from '@/components/prototype/RequirementsTab';
import DesignTab from '@/components/prototype/DesignTab';
import BomTab from '@/components/prototype/BomTab';
import PcbTab from '@/components/prototype/PcbTab';
import BuildTab from '@/components/prototype/BuildTab';
import ViewerTab from '@/components/prototype/ViewerTab';
import TestsTab from '@/components/prototype/TestsTab';
import { protoKeys, useProtoProject, useProtoTests, useProtoVersions } from '@/lib/prototypeApi';
import { fmtDate } from '@/lib/prototype';

const TABS = [['req', '요구사항'], ['design', '설계 초안'], ['bom', '부품표'], ['pcb', 'PCB 부품'], ['build', '제작'], ['viewer', '3D 검토'], ['tests', '시험·개선']];

export default function PrototypeDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('req');
  const { data: project, isLoading, error } = useProtoProject(projectId);
  const { data: versions = [] } = useProtoVersions(projectId);
  const { data: tests = [] } = useProtoTests(projectId);

  const refresh = () => ['project', 'versions', 'tests'].forEach((k) => qc.invalidateQueries({ queryKey: protoKeys[k](projectId) })) || qc.invalidateQueries({ queryKey: protoKeys.list });

  if (isLoading) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (error || !project) return <div className="py-24 text-center text-body text-muted-foreground">시제품을 찾을 수 없습니다. <Link to="/prototypes" className="text-primary">목록으로</Link></div>;

  const setStage = async (stage) => { await base44.entities.ProtoProject.update(project.id, { stage }); refresh(); };
  const props = { project, versions, tests, user, onChanged: refresh };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <Link to="/prototypes" className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />시제품 목록</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
            <p className="text-caption text-muted-foreground">담당 {project.owner_name || '-'} · 최근 변경 {fmtDate(project.updated_date)}</p>
          </div>
          <Button asChild><Link to={`/prototypes/${project.id}/review`}><ClipboardCheck className="w-4 h-4" />설계 검토 워크스페이스</Link></Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4"><ProtoStageBar stage={project.stage} onSelect={setStage} /></div>
      <ProtoSummary project={project} versions={versions} tests={tests} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">{TABS.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList>
        <TabsContent value="req" className="mt-4"><RequirementsTab {...props} /></TabsContent>
        <TabsContent value="design" className="mt-4"><DesignTab {...props} /></TabsContent>
        <TabsContent value="bom" className="mt-4"><BomTab {...props} /></TabsContent>
        <TabsContent value="pcb" className="mt-4"><PcbTab {...props} /></TabsContent>
        <TabsContent value="build" className="mt-4"><BuildTab {...props} /></TabsContent>
        <TabsContent value="viewer" className="mt-4"><ViewerTab {...props} /></TabsContent>
        <TabsContent value="tests" className="mt-4"><TestsTab {...props} /></TabsContent>
      </Tabs>
    </div>
  );
}