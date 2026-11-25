import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, ArrowUpRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import GroupEditDialog from '@/components/cardgroup/GroupEditDialog';

// 프로젝트 그룹 목록: 업무 카드를 제품·프로젝트 단위로 묶어 함께 관리한다
export default function CardGroups() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: groups = [], isLoading } = useQuery({ queryKey: ['card-groups'], queryFn: () => base44.entities.CardGroup.list('-updated_date', 200) });
  const { data: issues = [] } = useQuery({ queryKey: ['card-groups-issues'], queryFn: () => base44.entities.GroupIssue.list('-updated_date', 2000) });
  useEffect(() => {
    const unsubs = ['CardGroup', 'GroupIssue'].map((n) => base44.entities[n].subscribe(() => qc.invalidateQueries({ queryKey: n === 'CardGroup' ? ['card-groups'] : ['card-groups-issues'] })));
    return () => unsubs.forEach((u) => u?.());
  }, [qc]);

  const stat = (g) => {
    const mine = issues.filter((i) => i.group_id === g.id);
    const open = mine.filter((i) => i.status !== 'DONE');
    return { total: mine.length, open: open.length, high: open.filter((i) => i.severity === 'HIGH').length };
  };
  const active = groups.filter((g) => g.status !== 'ARCHIVED');
  const archived = groups.filter((g) => g.status === 'ARCHIVED');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><FolderKanban className="h-5 w-5" />프로젝트 그룹</h1>
          <p className="mt-1 max-w-2xl text-body text-muted-foreground">여러 업무 카드를 한 제품·프로젝트로 묶어, 이슈·회의·결정·불량·시리얼·파일을 한 화면에서 함께 봅니다. 누가 고치면 같은 화면을 보고 있는 모든 사람에게 바로 반영됩니다.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />새 그룹</Button>
      </div>

      {isLoading && <p className="text-body text-muted-foreground">불러오는 중…</p>}
      {!isLoading && !groups.length && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-body font-medium">아직 그룹이 없습니다</p>
          <p className="mt-1 text-caption text-muted-foreground">예: 'N30 미샤 RF써마 프로' 그룹을 만들고 메인 카드와 부품 카드(배터리·LCD·트랜스포머…)를 묶어 보세요.</p>
          <Button className="mt-4" onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />첫 그룹 만들기</Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {active.map((g) => {
          const s = stat(g);
          return (
            <Link key={g.id} to={`/groups/${g.id}`} className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-title font-semibold">{g.name}</p>
                  <p className="text-caption text-muted-foreground">{g.client_name || '고객사 없음'} · 카드 {(g.card_ids || []).length}장</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
              {g.description && <p className="mt-2 line-clamp-2 text-label text-muted-foreground">{g.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5 text-micro font-semibold">
                <span className="rounded-md bg-muted px-2 py-0.5">이슈 {s.total}</span>
                <span className={`rounded-md px-2 py-0.5 ${s.open ? 'bg-warning/15 text-warning-text' : 'bg-success/15 text-success-text'}`}>미완료 {s.open}</span>
                {s.high > 0 && <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive">높음 {s.high}</span>}
              </div>
            </Link>
          );
        })}
      </div>
      {archived.length > 0 && (
        <div>
          <p className="mb-2 text-label font-semibold text-muted-foreground">보관한 그룹</p>
          <div className="flex flex-wrap gap-2">{archived.map((g) => <Link key={g.id} to={`/groups/${g.id}`} className="rounded-lg border px-3 py-1.5 text-label text-muted-foreground hover:text-foreground">{g.name}</Link>)}</div>
        </div>
      )}
      {creating && <GroupEditDialog open user={user} onClose={() => setCreating(false)} onSaved={(g) => { qc.invalidateQueries({ queryKey: ['card-groups'] }); if (g?.id) navigate(`/groups/${g.id}`); }} />}
    </div>
  );
}
