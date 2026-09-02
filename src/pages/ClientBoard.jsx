import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import useClientCards from '@/lib/useClientCards';
import { CLIENT_COLUMNS } from '@/components/client/clientBoardMeta';
import ClientCardTile from '@/components/client/ClientCardTile';
import ClientCardModal from '@/components/client/ClientCardModal';

export default function ClientBoard() {
  const { data: cards = [], isLoading } = useClientCards();
  const [selectedId, setSelectedId] = useState(null);

  // 알림 링크(/client/board?card=xxx)로 진입한 경우 해당 카드를 바로 연다
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('card');
    if (id) setSelectedId(id);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">소싱 보드</h1>
        <p className="text-sm text-muted-foreground mt-1">단계는 담당자가 업데이트하며, 카드를 눌러 상세 내용을 확인하실 수 있습니다</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '520px' }}>
          {CLIENT_COLUMNS.map((col) => {
            const colCards = cards.filter((c) => c.status === col.id);
            return (
              <div key={col.id} className="flex-shrink-0 w-64">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${col.color} border border-border border-b-0`}>
                  <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className="text-xs font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">{colCards.length}</Badge>
                </div>
                <div className={`min-h-[460px] p-2 rounded-b-xl border border-border border-t-0 space-y-2 ${col.color}`}>
                  {colCards.map((c) => <ClientCardTile key={c.id} card={c} onClick={() => setSelectedId(c.id)} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClientCardModal cardId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}