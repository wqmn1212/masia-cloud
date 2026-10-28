import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Repeat, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import PdfButton from '@/components/reports/PdfButton';
import { generateProjectSummaryPDF } from '@/lib/reportPdf';
import ClientReorderDialog from './ClientReorderDialog';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ClientOverviewPanel from './ClientOverviewPanel';
import ClientMilestonePanel from './ClientMilestonePanel';
import ClientQuotationTab from './ClientQuotationTab';
import ClientChatPanel from './ClientChatPanel';
import ClientSettlementPanel from './ClientSettlementPanel';
import ClientQCPanel from './ClientQCPanel';
import ClientShipmentPanel from './ClientShipmentPanel';
import ClientFactoryCheck from './ClientFactoryCheck';
import ClientClaimPanel from './ClientClaimPanel';
import ClientGoldenSample from './ClientGoldenSample';
import ClientImportRequirements from './ClientImportRequirements';
import ClientSharedFiles from '@/components/client/ClientSharedFiles';

const TABS = ['overview', 'quotation', 'qc', 'chat', 'settlement', 'files'];

// 고객 전용 카드 모달 — 진행 정보 · 견적 · 검수 · 문의 · 결제 · 파일 탭만 존재한다.
// 어드민 CardModal 에 조건 분기를 넣지 않고 별도 컴포넌트로 분리해 원가 노출 경로를 원천 차단한다.
export default function ClientCardModal({ cardId, open, onClose, initialTab, onOpenCard }) {
  const { user } = useAuth();
  const [reorderOpen, setReorderOpen] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['client-card-detail', cardId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getClientCardDetail', withClientView({ card_id: cardId }));
      return res.data;
    },
    enabled: !!cardId && open,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[92vh] overflow-y-auto grid-cols-[minmax(0,1fr)]">
        {isError ? <div className="py-8 space-y-3"><p role="alert" className="text-sm text-destructive">카드 정보를 불러오지 못했습니다.</p><button type="button" onClick={() => refetch()} disabled={isFetching} className="text-sm text-primary">다시 불러오기</button></div> : isLoading || !data?.card ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base pr-6">{data.card.title}</DialogTitle>
              {data.pm && (
                <p className="flex flex-wrap items-center gap-x-1.5 text-label text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />담당 PM <span className="font-medium text-foreground">{data.pm.name}</span>{data.pm.reply_hours && <span>· 답변 {data.pm.reply_hours}</span>}<span>· 문의 탭에 남기시면 담당 PM이 답합니다</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="mr-auto text-xs text-primary" disabled={isFetching} onClick={() => refetch()}>{isFetching ? '불러오는 중...' : '최신 일정·입금 상태 새로고침'}</button>
                <PdfButton generate={() => generateProjectSummaryPDF(data)} label="보고용 PDF" className="h-8" />
                {user?.account_tier === 'client' && ['PRODUCTION', 'DONE'].includes(data.card.status) && (
                  <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => setReorderOpen(true)}><Repeat className="h-3.5 w-3.5" />재주문 요청</Button>
                )}
              </div>
            </DialogHeader>
            <ClientReorderDialog open={reorderOpen} onOpenChange={setReorderOpen} card={data.card} onOpenCard={onOpenCard} />
            <Tabs key={`${cardId}-${initialTab || ''}`} defaultValue={TABS.includes(initialTab) ? initialTab : 'overview'} className="mt-3">
              <TabsList className="flex w-full justify-start overflow-x-auto sm:grid sm:grid-cols-6">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">진행 정보</TabsTrigger>
                <TabsTrigger value="quotation" className="text-xs sm:text-sm">견적서</TabsTrigger>
                <TabsTrigger value="qc" className="relative text-xs sm:text-sm">
                  검수
                  {((data.qc_reports || []).some((r) => r.decision !== 'APPROVED') || data.quality_spec?.decision === 'PENDING') && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" aria-label="확인할 검수 결과 있음" />}
                </TabsTrigger>
                <TabsTrigger value="chat" className="text-xs sm:text-sm">문의</TabsTrigger>
                <TabsTrigger value="settlement" className="relative text-xs sm:text-sm">
                  결제
                  {(data.payment_stages || []).some((st) => st.request_state === 'REQUESTED') && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" aria-label="결제 요청 있음" />}
                </TabsTrigger>
                <TabsTrigger value="files" className="text-xs sm:text-sm">파일</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <ClientShipmentPanel cardId={data.card.id} shipments={data.shipments || []} onChanged={refetch} />
                <ClientMilestonePanel milestones={data.milestones} />
                <ClientFactoryCheck check={data.factory_check || null} />
                <ClientImportRequirements list={data.import_requirements || []} />
                <ClientOverviewPanel card={data.card} />
              </TabsContent>
              <TabsContent value="quotation" className="mt-4">
                <ClientQuotationTab cardId={data.card.id} cardTitle={data.card.title} clientName={data.card.client_name || ''} />
              </TabsContent>
              <TabsContent value="qc" className="mt-4">
                <ClientGoldenSample sample={data.card.golden_sample || null} />
                <ClientQCPanel cardId={data.card.id} reports={data.qc_reports || []} spec={data.quality_spec || null} />
                <ClientClaimPanel cardId={data.card.id} claims={data.claims || []} onChanged={refetch} />
              </TabsContent>
              <TabsContent value="chat" className="mt-4">
                <ClientChatPanel cardId={data.card.id} chats={data.chats || []} />
              </TabsContent>
              <TabsContent value="files" className="mt-4"><ClientSharedFiles cardId={data.card.id} /></TabsContent>
              <TabsContent value="settlement" className="mt-4">
                <ClientSettlementPanel cardId={data.card.id} stages={data.payment_stages || []} factoryPayment={data.factory_payment || null} receipts={(data.attachments || []).filter((a) => a.document_type?.startsWith('REMITTANCE_'))} canReport={user?.account_tier === 'client'} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}