import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Kanban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import useClientCards from '@/lib/useClientCards';
import ClientStatusSummary from '@/components/client/ClientStatusSummary';
import ClientCardTile from '@/components/client/ClientCardTile';
import ClientSupportCard from '@/components/client/ClientSupportCard';
import ClientCardModal from '@/components/client/ClientCardModal';

export default function ClientPortalDashboard() {
  const { data: cards = [], isLoading } = useClientCards();
  const [selectedId, setSelectedId] = useState(null);

  const active = cards.filter((c) => !['DONE', 'CANCELLED'].includes(c.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">진행 현황</h1>
        <p className="text-sm text-muted-foreground mt-1">담당자가 공개한 프로젝트의 진행 단계와 견적서를 확인하실 수 있습니다</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <ClientStatusSummary cards={cards} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">진행 중인 프로젝트 {active.length}건</h2>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/client/board"><Kanban className="w-3.5 h-3.5" />보드로 보기</Link>
                </Button>
              </div>
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  아직 공개된 프로젝트가 없습니다. 담당자가 검토를 마치면 여기에 표시됩니다.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {active.map((c) => <ClientCardTile key={c.id} card={c} onClick={() => setSelectedId(c.id)} />)}
                </div>
              )}
            </Card>
            <ClientSupportCard />
          </div>
        </>
      )}

      <ClientCardModal cardId={selectedId} open={!!selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}