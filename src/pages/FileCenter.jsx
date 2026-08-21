import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Sparkles, Loader2, Inbox, Search } from 'lucide-react';
import ClientFileGroup from '@/components/files/ClientFileGroup';
import SmartUploadDialog from '@/components/files/SmartUploadDialog';

export default function FileCenter() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['task-cards'],
    queryFn: () => base44.entities.TaskCard.list('-created_date', 200),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }, 'company_name', 200),
  });
  const { data: attachments = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['all-attachments'],
    queryFn: () => base44.entities.CardAttachment.list('-created_date', 500),
  });

  const cardsById = useMemo(() => Object.fromEntries(cards.map(c => [c.id, c])), [cards]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map();
    attachments.forEach((file) => {
      const card = cardsById[file.card_id];
      const clientName = card?.client_name || '고객사 미지정';
      if (term && !(
        file.file_name?.toLowerCase().includes(term) ||
        clientName.toLowerCase().includes(term) ||
        card?.title?.toLowerCase().includes(term)
      )) return;
      if (!map.has(clientName)) map.set(clientName, []);
      map.get(clientName).push(file);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [attachments, cardsById, search]);

  const isLoading = loadingCards || loadingFiles;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">파일 센터</h1>
          <p className="text-xs text-muted-foreground mt-0.5">모든 태스크 카드의 파일을 고객사별로 모아 봅니다.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Sparkles className="w-4 h-4" /> AI 파일 자동 분류
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="파일명 · 고객사 · 카드 검색" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 font-semibold">표시할 파일이 없습니다</p>
          <p className="text-sm text-muted-foreground mt-1">AI 파일 자동 분류로 파일을 업로드해 보세요.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(([clientName, files], i) => (
            <ClientFileGroup
              key={clientName}
              clientName={clientName}
              files={files}
              cardsById={cardsById}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}

      <SmartUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        cards={cards}
        clients={clients}
        user={user}
      />
    </div>
  );
}