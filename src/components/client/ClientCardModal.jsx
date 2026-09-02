import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ClientOverviewPanel from './ClientOverviewPanel';
import ClientQuotationTab from './ClientQuotationTab';
import ClientChatPanel from './ClientChatPanel';
import ClientSettlementPanel from './ClientSettlementPanel';

// 고객 전용 카드 모달 — 오버뷰 · 견적 · 채팅 · 정산 4개 탭만 존재한다.
// 어드민 CardModal 에 조건 분기를 넣지 않고 별도 컴포넌트로 분리해 원가 노출 경로를 원천 차단한다.
export default function ClientCardModal({ cardId, open, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['client-card-detail', cardId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getClientCardDetail', { card_id: cardId });
      return res.data;
    },
    enabled: !!cardId && open,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[92vh] overflow-y-auto">
        {isLoading || !data?.card ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base pr-6">{data.card.title}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="overview" className="mt-3">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">진행 정보</TabsTrigger>
                <TabsTrigger value="quotation" className="text-xs sm:text-sm">견적서</TabsTrigger>
                <TabsTrigger value="chat" className="text-xs sm:text-sm">문의</TabsTrigger>
                <TabsTrigger value="settlement" className="text-xs sm:text-sm">결제</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <ClientOverviewPanel card={data.card} />
              </TabsContent>
              <TabsContent value="quotation" className="mt-4">
                <ClientQuotationTab cardId={data.card.id} />
              </TabsContent>
              <TabsContent value="chat" className="mt-4">
                <ClientChatPanel cardId={data.card.id} chats={data.chats || []} />
              </TabsContent>
              <TabsContent value="settlement" className="mt-4">
                <ClientSettlementPanel stages={data.payment_stages || []} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}