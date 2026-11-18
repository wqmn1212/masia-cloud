import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Link2, Loader2, Plus, AlertTriangle, Lock, Box, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { actorName } from '@/lib/prototypeApi';
import { protoSummary, protoAttention, protoLinks, WORKBENCH_SHEET } from '@/lib/protoCard';
import { linkProtoCard } from '@/lib/protoCardApi';

const day = (iso) => (iso ? String(iso).slice(0, 10) : '');

function ProtoRow({ project, units }) {
  const { data: concepts = [] } = useQuery({ queryKey: ['proto-concepts-card', project.id], queryFn: () => base44.entities.ProtoConcept.filter({ project_id: project.id }, '-version_no', 30), staleTime: 60_000 });
  const sum = protoSummary(project, { concepts, units });
  const todo = protoAttention(sum);
  return (
    <li className="space-y-1.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <Link to={`/prototypes/${project.id}/develop`} className="text-label font-semibold hover:underline">{project.title}</Link>
        {sum.device && <span className="font-mono text-micro text-muted-foreground">{sum.device}</span>}
        {sum.stage && <span className="rounded-full bg-muted px-2 py-0.5 text-micro">{sum.stage}</span>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption">
        <span className="flex items-center gap-1"><Box className="h-3.5 w-3.5 text-muted-foreground" />{sum.concept ? `컨셉 v${sum.concept.version}${sum.concept.parts ? ` · 부품 ${sum.concept.parts}` : ''}` : '컨셉 없음'}</span>
        {sum.freeze && <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-success-text" />설계 확정 v{sum.freeze.version} · {day(sum.freeze.at)}</span>}
        {sum.ecoTotal > 0 && <span className={sum.ecoOpen ? 'text-warning-text' : 'text-muted-foreground'}>설계 변경 {sum.ecoOpen ? `진행 ${sum.ecoOpen}` : '모두 처리'} / {sum.ecoTotal}</span>}
        {sum.mold && <span>금형 형상 {sum.mold.label}{sum.mold.dia ? ` Ø${sum.mold.dia}` : ''}</span>}
        {sum.tests.total > 0 && <span className="flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />공장 시험 합격 {sum.tests.pass}/{sum.tests.total}</span>}
      </div>
      {todo.length > 0 && <ul className="space-y-0.5">{todo.map((t) => <li key={t} className="flex items-center gap-1.5 text-caption text-warning-text"><AlertTriangle className="h-3.5 w-3.5" />{t}</li>)}</ul>}
      <div className="flex flex-wrap gap-1">
        {protoLinks(project.id).map((l) => <Link key={l.key} to={l.to} className="rounded border px-2 py-0.5 text-micro hover:bg-muted">{l.label}</Link>)}
      </div>
    </li>
  );
}

// 카드 '지금' 탭: 연결된 시제품 개발 현황 (직원). 연결 안 된 시제품을 이 카드에 붙일 수 있다
export default function CardProtoPanel({ card }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const { data: protos = [] } = useQuery({ queryKey: ['card-protos', card.id], queryFn: () => base44.entities.ProtoProject.filter({ card_id: card.id }, '-updated_date', 10), staleTime: 60_000 });
  const { data: units = [] } = useQuery({ queryKey: ['card-proto-units', card.id], queryFn: () => base44.entities.ProductionUnit.filter({ card_id: card.id, sheet: WORKBENCH_SHEET }, '-created_date', 500).catch(() => []), enabled: protos.length > 0, staleTime: 60_000 });
  const { data: free = [], isLoading } = useQuery({ queryKey: ['protos-unlinked'], queryFn: async () => (await base44.entities.ProtoProject.list('-updated_date', 100)).filter((p) => !p.card_id), enabled: open, staleTime: 30_000 });
  const attach = async (p) => {
    setBusy(p.id);
    try {
      await linkProtoCard(p, card.id, actorName(user));
      await Promise.all([qc.invalidateQueries({ queryKey: ['card-protos', card.id] }), qc.invalidateQueries({ queryKey: ['protos-unlinked'] })]);
      toast({ title: `“${p.title}” 을 이 카드에 연결했습니다` });
      setOpen(false);
    } catch (e) { toast({ title: `연결하지 못했습니다: ${e.message || e}`, variant: 'destructive' }); }
    setBusy('');
  };
  return (
    <div className="space-y-2 border-t pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-label font-semibold"><Cpu className="h-4 w-4 text-muted-foreground" />시제품 개발{protos.length ? ` ${protos.length}` : ''}</p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild><Button size="sm" variant="ghost" className="ml-auto h-7"><Link2 className="h-3.5 w-3.5" />시제품 연결</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-1 p-2">
            <p className="px-1 text-micro text-muted-foreground">아직 카드에 묶이지 않은 시제품</p>
            {isLoading ? <Loader2 className="m-1 h-4 w-4 animate-spin text-muted-foreground" /> : free.length === 0 ? <p className="px-1 py-1 text-caption text-muted-foreground">없습니다.</p> : (
              <div className="max-h-60 overflow-y-auto">{free.map((p) => (
                <button key={p.id} type="button" disabled={!!busy} onClick={() => attach(p)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-caption hover:bg-secondary disabled:opacity-50">
                  {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5 text-muted-foreground" />}<span className="truncate">{p.title}</span>
                </button>
              ))}</div>
            )}
          </PopoverContent>
        </Popover>
        <Button asChild size="sm" variant="ghost" className="h-7"><Link to="/prototypes"><Plus className="h-3.5 w-3.5" />새 시제품</Link></Button>
      </div>
      {protos.length === 0
        ? <p className="text-caption text-muted-foreground">연결된 시제품이 없습니다. 개발 워크벤치 머리의 “카드 연결” 이나 위 “시제품 연결” 로 묶으면 컨셉·설계 확정·설계 변경·공장 시험 현황이 여기에 모입니다.</p>
        : <ul className="space-y-2">{protos.map((p) => <ProtoRow key={p.id} project={p} units={units} />)}</ul>}
    </div>
  );
}
