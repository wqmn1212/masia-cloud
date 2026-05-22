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

export default function CardModal({ card, open, onClose }) {
  const [user, setUser] = useState(null);
  const [viewLang, setViewLang] = useState('KR');

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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <div className="flex items-start gap-3 flex-wrap">
            <DialogTitle className="text-lg flex-1">
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

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">오버뷰</TabsTrigger>
            <TabsTrigger value="tasks">업무 목록</TabsTrigger>
            <TabsTrigger value="quotation">견적</TabsTrigger>
            <TabsTrigger value="files">파일</TabsTrigger>
            <TabsTrigger value="chat">채팅</TabsTrigger>
            <TabsTrigger value="settlement">정산</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            <TaskItemsTab card={card} viewLang={viewLang} />
          </TabsContent>
          <TabsContent value="overview" className="mt-4">
            <OverviewTab card={card} kbAlerts={kbAlerts} viewLang={viewLang} />
          </TabsContent>
          <TabsContent value="quotation" className="mt-4">
            <QuotationTab card={card} user={user} />
          </TabsContent>
          <TabsContent value="files" className="mt-4">
            <FilesTab card={card} user={user} />
          </TabsContent>
          <TabsContent value="chat" className="mt-4">
            <ChatTab card={card} user={user} viewLang={viewLang} />
          </TabsContent>
          <TabsContent value="settlement" className="mt-4">
            <SettlementTab card={card} user={user} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}