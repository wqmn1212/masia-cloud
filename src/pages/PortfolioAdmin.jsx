import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2 } from 'lucide-react';
import PortfolioRow from '@/components/portfolio/PortfolioRow';
import PortfolioFormDialog from '@/components/portfolio/PortfolioFormDialog';
import { canPublish } from '@/lib/portfolioMeta';
import { toast } from '@/components/ui/use-toast';

export default function PortfolioAdmin() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['portfolio-items'],
    queryFn: () => base44.entities.PortfolioItem.list('sort_order', 300),
  });

  const filtered = items.filter((it) =>
    !search.trim() || `${it.title_ko} ${it.title_en} ${it.slug}`.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setDialogOpen(true); };

  const patch = async (item, data) => {
    await base44.entities.PortfolioItem.update(item.id, data);
    refetch();
  };

  // 발행 흐름: 초안 → 검토 요청 → 발행 (발행/회수는 master·service 만)
  const setStatus = (item, status) => {
    if (!canPublish(user)) return patch(item, { publish_status: status });
    return patch(item, status === 'published'
      ? { publish_status: status, is_published: true, reviewed_by: user.email, published_at: new Date().toISOString() }
      : { publish_status: status, is_published: false });
  };

  // sub: 발행된 항목은 직접 수정 대신 담당자에게 수정 요청
  const requestEdit = async (item) => {
    const message = window.prompt(`"${item.title_ko}" 수정 요청 내용을 적어 주세요.`);
    if (message === null) return;
    await base44.functions.invoke('requestPortfolioEdit', { id: item.id, message });
    toast({ title: '수정 요청을 보냈습니다.' });
  };

  const remove = async (item) => {
    if (!window.confirm(`"${item.title_ko}" 항목을 삭제할까요?`)) return;
    await base44.entities.PortfolioItem.delete(item.id);
    refetch();
  };

  return (
    <div className="p-4 lg:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">포트폴리오 관리</h1>
          <p className="text-sm text-muted-foreground">랜딩 페이지에 노출되는 취급 품목과 상세 자료를 관리합니다.</p>
        </div>
        <Button onClick={openNew}><Plus /> 항목 등록</Button>
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제목 · URL 검색" className="max-w-sm" />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">등록된 포트폴리오 항목이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <PortfolioRow
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={remove}
              canPublish={canPublish(user)}
              onSetStatus={setStatus}
              onToggleFeature={(it, v) => patch(it, { is_featured: v })}
              onPatch={patch}
              onRequestEdit={requestEdit}
            />
          ))}
        </div>
      )}

      <PortfolioFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        tenantId={user?.tenant_id}
        canPublish={canPublish(user)}
        onSaved={refetch}
      />
    </div>
  );
}