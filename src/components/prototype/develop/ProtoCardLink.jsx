import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Link2, Loader2, Plus, Unlink, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { protoKeys, actorName } from '@/lib/prototypeApi';
import { linkProtoCard } from '@/lib/protoCardApi';

const STATUS = { TODO: '대기', IN_PROGRESS: '소싱', REVIEW: '견적 검토', PRODUCTION: '발주·제작', DONE: '완료' };

// 워크벤치 머리: 이 시제품이 묶인 업무 카드. 고르기·새 카드 만들기·연결 풀기. 바꾸면 카드 소통 탭에 기록이 남는다
export default function ProtoCardLink({ project, user }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const { data: card } = useQuery({ queryKey: ['task-card', project.card_id], queryFn: () => base44.entities.TaskCard.get(project.card_id), enabled: !!project.card_id, staleTime: 60_000 });
  const { data: cards = [], isLoading } = useQuery({ queryKey: ['task-cards-pick'], queryFn: () => base44.entities.TaskCard.list('-updated_date', 200), enabled: open, staleTime: 30_000 });
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cards.filter((c) => c.id !== project.card_id && (!t || `${c.title} ${c.client_name || ''}`.toLowerCase().includes(t))).slice(0, 30);
  }, [cards, q, project.card_id]);
  const by = actorName(user);
  const apply = async (key, cardId, ok) => {
    setBusy(key);
    try {
      await linkProtoCard(project, cardId, by);
      await Promise.all([qc.invalidateQueries({ queryKey: protoKeys.project(project.id) }), qc.invalidateQueries({ queryKey: ['card-protos'] })]);
      toast({ title: ok });
      setOpen(false); setQ('');
    } catch (e) { toast({ title: `바꾸지 못했습니다: ${e.message || e}`, variant: 'destructive' }); }
    setBusy('');
  };
  const create = async () => {
    setBusy('new');
    try {
      const c = await base44.entities.TaskCard.create({ tenant_id: project.tenant_id, title: q.trim() || project.title, status: 'TODO', priority: 'MEDIUM', source: 'manual', owner_id: user?.id, owner_name: by });
      await apply('new', c.id, `새 업무 카드 “${c.title}” 를 만들어 연결했습니다`);
    } catch (e) { toast({ title: `카드를 만들지 못했습니다: ${e.message || e}`, variant: 'destructive' }); setBusy(''); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-1">
        {project.card_id ? (
          <Link to={`/task-board?card=${project.card_id}`} className="inline-flex max-w-[240px] items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-label hover:bg-secondary" title="업무 카드 열기">
            <ClipboardList className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{card?.title || '업무 카드'}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Link>
        ) : <span className="text-caption text-muted-foreground">업무 카드 없음</span>}
        <PopoverTrigger asChild><Button variant="ghost" size="sm" aria-label="업무 카드 연결 바꾸기"><Link2 className="h-4 w-4" />{project.card_id ? '바꾸기' : '카드 연결'}</Button></PopoverTrigger>
      </div>
      <PopoverContent align="end" className="w-80 space-y-2 p-3">
        <p className="text-label font-semibold">업무 카드 연결</p>
        <p className="text-micro text-muted-foreground">연결하면 카드 “지금” 탭에 개발 현황이 보이고, 컨셉 버전·설계 확정·설계 변경이 카드 소통 탭에 기록됩니다 (고객 비공개).</p>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="카드 제목·고객사로 찾기" aria-label="카드 찾기" className="h-8" />
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : list.length === 0 ? <p className="py-2 text-caption text-muted-foreground">맞는 카드가 없습니다.</p> : list.map((c) => (
            <button key={c.id} type="button" disabled={!!busy} onClick={() => apply(c.id, c.id, `“${c.title}” 카드에 연결했습니다`)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-caption hover:bg-secondary disabled:opacity-50">
              {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{c.title}{c.client_name ? <span className="text-muted-foreground"> · {c.client_name}</span> : null}</span>
              <span className="shrink-0 text-micro text-muted-foreground">{STATUS[c.status] || ''}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 border-t pt-2">
          <Button size="sm" variant="outline" onClick={create} disabled={!!busy}>{busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}새 카드{q.trim() ? ` “${q.trim().slice(0, 14)}”` : ''} 만들기</Button>
          {project.card_id && <Button size="sm" variant="ghost" onClick={() => apply('off', null, '업무 카드 연결을 풀었습니다')} disabled={!!busy}><Unlink className="h-4 w-4" />연결 풀기</Button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
