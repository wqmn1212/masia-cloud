import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Cpu, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import ProtoStageBar from '@/components/prototype/ProtoStageBar';
import NewPrototypeDialog from '@/components/prototype/NewPrototypeDialog';
import { protoKeys } from '@/lib/prototypeApi';
import { fmtDate } from '@/lib/prototype';

export default function Prototypes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: projects = [], isLoading } = useQuery({ queryKey: protoKeys.list, queryFn: () => base44.entities.ProtoProject.list('-updated_date', 100) });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary"><Cpu className="w-5 h-5" /><span className="text-label font-semibold">시제품 개발</span></div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">요구사항부터 시험·개선까지 한 곳에서</h1>
          <p className="mt-1 text-body text-muted-foreground">도면·사양을 올리면 AI가 부품표·회로·펌웨어·금형 초안을 만들고, 담당자가 검토·승인합니다.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" />새 시제품</Button>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card py-16 text-center">
          <Cpu className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-title font-semibold">아직 시제품이 없습니다</p>
          <p className="mt-1 text-body text-muted-foreground">제품 목표와 전원·입출력 요구사항부터 등록해 보세요.</p>
          <Button className="mt-5" onClick={() => setOpen(true)}><Plus className="w-4 h-4" />첫 시제품 만들기</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} to={`/prototypes/${p.id}`} className="rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-title font-semibold">{p.title}</p>
                {p.open_risk_count > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-micro font-medium text-warning-text"><AlertTriangle className="w-3 h-3" />위험 {p.open_risk_count}</span>
                )}
              </div>
              <p className="mt-1 text-caption text-muted-foreground line-clamp-1">{p.goal || '목표 미입력'}</p>
              <p className="mt-1 text-caption text-muted-foreground">{p.owner_name || '-'} · 최근 변경 {fmtDate(p.updated_date)}</p>
              <div className="mt-4"><ProtoStageBar stage={p.stage} /></div>
            </Link>
          ))}
        </div>
      )}

      <NewPrototypeDialog
        open={open}
        onOpenChange={setOpen}
        user={user}
        onCreated={(p) => { setOpen(false); qc.invalidateQueries({ queryKey: protoKeys.list }); navigate(`/prototypes/${p.id}`); }}
      />
    </div>
  );
}