import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OverviewTab from './OverviewTab';
import FilesTab from './FilesTab';
import ChatTab from './ChatTab';
import QuotationTab from './QuotationTab';
import SettlementTab from './SettlementTab';
import TaskItemsTab from './TaskItemsTab';
import QCReportPanel from './QCReportPanel';
import PaymentGatePanel from './PaymentGatePanel';
import ProcessControlPanel from './ProcessControlPanel';
import AIProposalPanel from './AIProposalPanel';
import MeetingLogPanel from './MeetingLogPanel';
import TaskInsightPanel from './TaskInsightPanel';
import DecisionsTab from './DecisionsTab';
import BomTab from './BomTab';
import ClientVisibilityToggle from './ClientVisibilityToggle';
import QuotationPublishPanel from './QuotationPublishPanel';

const STATUS_META = {
  TODO:        { label: '대기 중',    color: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { label: '소싱 중',    color: 'bg-chart-3/15 text-chart-3' },
  REVIEW:      { label: '견적 검토',  color: 'bg-accent/15 text-accent' },
  PRODUCTION:  { label: '발주·제작', color: 'bg-chart-4/15 text-chart-4' },
  DONE:        { label: '완료',       color: 'bg-primary/15 text-primary' },
};

const CAT_LABEL = {
  DRIP_BAG: '드립백', SLEEVE: '슬리브', DESKTOP_LABELER: '탁상 라벨러', TUBE_SEALER: '튜브 실링기',
};

export default function CardModal({ card, open, onClose, initialTab = 'overview' }) {
  const [user, setUser] = useState(null);
  const [viewLang, setViewLang] = useState('KR');
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => { if (open) setActiveTab(initialTab); }, [open, card?.id, initialTab]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: kbAlerts = [] } = useQuery({
    queryKey: ['kb-alerts', card?.target_machine_category],
    queryFn: () => base44.entities.QCKnowledgeLog.filter({ target_category: card.target_machine_category }),
    enabled: !!card?.target_machine_category,
  });

  if (!card) return null;
  const st = STATUS_META[card.status] || STATUS_META.TODO;

  return (
    <Dialog open={open} onOpenChange={value => { if (!value && !recordingBusy) onClose(); }}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-0">
          <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
            <DialogTitle className="text-base sm:text-lg flex-1 min-w-0 pr-6">
              {viewLang === 'CN' ? (card.title_cn || card.title) : card.title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewLang(l => l === 'KR' ? 'CN' : 'KR')}
                className="text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-muted transition-colors font-medium"
                title="한국어 / 중국어 보기 전환"
              >
                {viewLang === 'KR' ? '中文 보기' : '한국어 보기'}
              </button>
              {card.target_machine_category && (
                <Badge variant="outline" className="text-[10px]">{CAT_LABEL[card.target_machine_category]}</Badge>
              )}
              <Badge className={`${st.color} border-0 text-[10px]`}>{st.label}</Badge>
            </div>
          </div>
          {(card.client_name || card.factory_name) && (
            <p className="text-xs text-muted-foreground mt-1">
              {card.client_name && `🏢 ${card.client_name}`}
              {card.client_name && card.factory_name && '  ·  '}
              {card.factory_name && `🏭 ${card.factory_name}`}
            </p>
          )}
        </DialogHeader>

        {recordingBusy && <p className="mt-3 text-xs text-primary" role="status">녹음·전사가 완료될 때까지 이 카드를 유지해 주세요.</p>}
        <Tabs value={activeTab} onValueChange={value => { if (!recordingBusy) setActiveTab(value); }} className="mt-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-9 h-auto gap-0.5">
            <TabsTrigger disabled={recordingBusy} value="overview" className="text-xs sm:text-sm py-1.5">오버뷰</TabsTrigger>
            <TabsTrigger disabled={recordingBusy} value="tasks" className="text-xs sm:text-sm py-1.5">업무</TabsTrigger>
            <TabsTrigger disabled={recordingBusy} value="meetings" className="text-xs sm:text-sm py-1.5">미팅·분석</TabsTrigger>
            <TabsTrigger disabled={recordingBusy} value="quotation" className="text-xs sm:text-sm py-1.5">견적</TabsTrigger>
            <TabsTrigger disabled={recordingBusy} value="bom" className="text-xs sm:text-sm py-1.5">BOM</TabsTrigger>
            <TabsTrigger disabled={recordingBusy} value="files" className="text-xs sm:text-sm py-1.5">파일</TabsTrigger>
            <TabsTrigger disabled={recordingBusy} value="chat" className="text-xs sm:text-sm py-1.5">채팅</TabsTrigger>
            <TabsTrigger disabled={recordingBusy} value="settlement" className="text-xs sm:text-sm py-1.5">정산</TabsTrigger>
            <TabsTrigger disabled={recordingBusy} value="decisions" className="text-xs sm:text-sm py-1.5">결정</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            <AIProposalPanel card={card} user={user} />
            <TaskItemsTab card={card} viewLang={viewLang} />
            <QCReportPanel card={card} user={user} />
          </TabsContent>
          <TabsContent value="overview" className="mt-4">
            <OverviewTab card={card} kbAlerts={kbAlerts} viewLang={viewLang} />
            <div className="mt-4"><ClientVisibilityToggle card={card} /></div>
            <ProcessControlPanel card={card} user={user} />
          </TabsContent>
          <TabsContent value="meetings" className="mt-4 space-y-6">
            <MeetingLogPanel card={card} user={user} onRecordingBusy={setRecordingBusy} />
            <div className="border-t pt-4">
              <TaskInsightPanel card={card} user={user} />
            </div>
          </TabsContent>
          <TabsContent value="quotation" className="mt-4">
            <QuotationPublishPanel card={card} />
            <QuotationTab card={card} user={user} />
          </TabsContent>
          <TabsContent value="bom" className="mt-4">
            <BomTab card={card} />
          </TabsContent>
          <TabsContent value="files" className="mt-4">
            <FilesTab card={card} user={user} />
          </TabsContent>
          <TabsContent value="chat" className="mt-4">
            <ChatTab card={card} user={user} viewLang={viewLang} />
          </TabsContent>
          <TabsContent value="settlement" className="mt-4">
            <PaymentGatePanel card={card} user={user} />
            <SettlementTab card={card} user={user} />
          </TabsContent>
          <TabsContent value="decisions" className="mt-4">
            <DecisionsTab card={card} user={user} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}