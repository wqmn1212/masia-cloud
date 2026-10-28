import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import useClientCards from '@/lib/useClientCards';
import useClientOverview from '@/lib/useClientOverview';
import ClientStatusSummary from '@/components/client/ClientStatusSummary';
import ClientOrderBoard from '@/components/client/ClientOrderBoard';
import ClientSupportCard from '@/components/client/ClientSupportCard';
import ClientCardModal from '@/components/client/ClientCardModal';
import ChinaHolidayNotice from '@/components/client/ChinaHolidayNotice';
import ClientTodoCard from '@/components/client/ClientTodoCard';
import ClientContractCard from '@/components/client/ClientContractCard';
import ClientSignatureCard from '@/components/client/signature/ClientSignatureCard';
import SignatureDialog from '@/components/client/signature/SignatureDialog';

export default function ClientPortalDashboard() {
  const { data: cards = [], isLoading } = useClientCards();
  const overview = useClientOverview();
  const [selectedId, setSelectedId] = useState(null);
  const [initialTab, setInitialTab] = useState(null);
  const open = (id, tab = null) => { setInitialTab(tab); setSelectedId(id); };
  // 알림 링크(/client/dashboard?sign=ID)로 들어오면 서명 창을 연다
  const [signId, setSignId] = useState(() => new URLSearchParams(window.location.search).get('sign'));

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
          <ClientTodoCard onOpen={open} onSign={setSignId} />
          <ClientStatusSummary cards={cards} />
          <ClientOrderBoard cards={cards} overview={overview.data} loading={overview.isLoading} onOpen={open} />
          <ClientSignatureCard onOpen={setSignId} />
          <ClientContractCard />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2"><ChinaHolidayNotice /></div>
            <ClientSupportCard />
          </div>
        </>
      )}

      <ClientCardModal cardId={selectedId} initialTab={initialTab} open={!!selectedId} onClose={() => setSelectedId(null)} onOpenCard={(id) => open(id)} />
      {signId && <SignatureDialog requestId={signId} open={!!signId} onOpenChange={(o) => !o && setSignId(null)} />}
    </div>
  );
}