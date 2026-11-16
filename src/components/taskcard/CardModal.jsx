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
import LandedCostSection from './landedcost/LandedCostSection';
import TaskItemsTab from './TaskItemsTab';
import QCReportPanel from './QCReportPanel';
import ClaimPanel from './ClaimPanel';
import GoldenSamplePanel from './GoldenSamplePanel';
import MoldRegistryPanel from './MoldRegistryPanel';
import ImportRequirementsPanel from './ImportRequirementsPanel';
import QualitySpecPanel from './QualitySpecPanel';
import QCPrecheckPanel from './qcprecheck/QCPrecheckPanel';
import FactoryRequestPanel from '@/components/taskcard/factoryrequest/FactoryRequestPanel';
import QCPrecheckSummary from './QCPrecheckSummary';
import PaymentGatePanel from './PaymentGatePanel';
import ProcessControlPanel from './ProcessControlPanel';
import AIProposalPanel from './AIProposalPanel';
import MeetingLogPanel from './MeetingLogPanel';
import TaskInsightPanel from './TaskInsightPanel';
import DecisionsTab from './DecisionsTab';
import BomTab from './BomTab';
import ProductionTab from './ProductionTab';
import ClientVisibilityToggle from './ClientVisibilityToggle';
import QuotationPublishPanel from './QuotationPublishPanel';
import ClientApprovalBanner from './client/ClientApprovalBanner';
import CardSchedulePanel from '@/components/taskcard/CardSchedulePanel';
import TradeDocumentsTab from '@/components/taskcard/TradeDocumentsTab';
import { useLanguage } from '@/lib/LanguageContext';
import MilestoneTab from '@/components/taskcard/milestones/MilestoneTab';
import CardOwnerBar from '@/components/taskcard/CardOwnerBar';
import ReorderDialog from '@/components/taskcard/ReorderDialog';
import DesignRoomsPanel from '@/components/design/DesignRoomsPanel';
import ClientRequestPanel from '@/components/requests/ClientRequestPanel';
import CardNowPanel from '@/components/taskcard/CardNowPanel';
import { CARD_TABS, resolveCardTab } from '@/lib/cardTabs';
import { Button } from '@/components/ui/button';
import { Repeat } from 'lucide-react';

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

// 탭 안의 묶음 제목 (구역으로 바로 갈 수 있게 id 를 단다)
const Section = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-4 space-y-2">
    <h3 className="border-b pb-1 text-label font-semibold text-muted-foreground">{title}</h3>
    {children}
  </section>
);

export default function CardModal({ card: initialCard, open, onClose, initialTab = 'overview' }) {
  const { data: card = initialCard } = useQuery({ queryKey: ['task-cards', 'detail', initialCard?.id], queryFn: () => base44.entities.TaskCard.get(initialCard.id), enabled: !!initialCard?.id && open });
  const [user, setUser] = useState(null);
  const { lang, content } = useLanguage();
  const viewLang = lang === 'zh' ? 'CN' : 'KR';
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => resolveCardTab(initialTab).tab);
  const isStaff = ['master', 'service', 'sub'].includes(user?.account_tier);
  // 'quality#qc-precheck' 처럼 탭과 그 안의 구역으로 간다 (예전 탭 이름도 받는다)
  const go = (value) => {
    const { tab, section } = resolveCardTab(value);
    setActiveTab(tab);
    if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };
  const openPrecheck = () => go('quality#qc-precheck');
  useEffect(() => { if (open) go(initialTab); }, [open, card?.id, initialTab]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);


  if (!card) return null;
  const st = STATUS_META[card.status] || STATUS_META.TODO;

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-0">
          <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
            <DialogTitle className="text-title sm:text-title flex-1 min-w-0 pr-6">
              {content(card, 'title')}
            </DialogTitle>
            <div className="flex items-center gap-2">

              {card.target_machine_category && (
                <Badge variant="outline" className="text-micro">{CAT_LABEL[card.target_machine_category]}</Badge>
              )}
              <Badge className={`${st.color} border-0 text-micro`}>{st.label}</Badge>
              {isStaff && (
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-caption" onClick={() => setReorderOpen(true)}><Repeat className="h-3 w-3" />재주문</Button>
              )}
            </div>
          </div>
          {card.reorder_of && (
            <p className="mt-1 text-caption text-muted-foreground">🔁 재주문 프로젝트 · <a className="text-primary underline-offset-2 hover:underline" href={`/task-board?card=${card.reorder_of}`}>원 프로젝트 보기 (이전 견적·검수 기록)</a></p>
          )}
          {(card.client_name || card.factory_name) && (
            <p className="text-caption text-muted-foreground mt-1">
              {card.client_name && `🏢 ${card.client_name}`}
              {card.client_name && card.factory_name && '  ·  '}
              {card.factory_name && `🏭 ${card.factory_name}`}
            </p>
          )}
          <CardOwnerBar card={card} user={user} />
          {card.client_id && <ClientApprovalBanner cardId={card.id} />}
        </DialogHeader>
        <ReorderDialog open={reorderOpen} onOpenChange={setReorderOpen} card={card} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto gap-0.5">
            {CARD_TABS.map((tb) => <TabsTrigger key={tb.key} value={tb.key} className="text-caption sm:text-body py-1.5">{lang === 'zh' ? tb.cn : tb.ko}</TabsTrigger>)}
          </TabsList>

          {/* 지금: 단계·챙길 일 → 할 일 → 기본 정보 */}
          <TabsContent value="now" className="mt-4 space-y-5">
            <CardNowPanel card={card} isStaff={isStaff} onGo={go} />
            <Section id="card-tasks" title={lang === 'zh' ? '任务' : '할 일'}><TaskItemsTab card={card} viewLang={viewLang} /></Section>
            <Section id="card-overview" title={lang === 'zh' ? '基本信息' : '기본 정보'}>
              <OverviewTab card={card} viewLang={viewLang} user={user} onOpenTab={openPrecheck} />
              <div className="mt-4"><ClientVisibilityToggle card={card} /></div>
            </Section>
          </TabsContent>

          {/* 견적: 사전 점검 요약 → 승인·발송 → 견적서·비교 → BOM */}
          <TabsContent value="quote" className="mt-4 space-y-5">
            <QCPrecheckSummary card={card} onOpen={openPrecheck} />
            <QuotationPublishPanel card={card} />
            <QuotationTab card={card} user={user} />
            <Section id="card-bom" title="BOM"><BomTab card={card} /></Section>
          </TabsContent>

          {/* 생산: 일정 → 공정·출고 → 금형 → 품질 기준·기준 샘플 */}
          <TabsContent value="make" className="mt-4 space-y-5">
            <Section id="card-milestones" title={lang === 'zh' ? '进度' : '일정'}>
              <MilestoneTab card={card} user={user} />
              <div className="mt-5"><CardSchedulePanel key={card.id} card={card} user={user} /></div>
            </Section>
            <ProcessControlPanel card={card} user={user} />
            <MoldRegistryPanel card={card} />
            <QualitySpecPanel card={card} user={user} />
            <GoldenSamplePanel card={card} user={user} />
          </TabsContent>

          {/* 품질: 사전 점검 → 출고 전 검수 → 고객 불량 → 양산 시리얼·불량 분석 */}
          <TabsContent value="quality" className="mt-4 space-y-5">
            <QCPrecheckPanel card={card} user={user} />
            <QCReportPanel card={card} user={user} />
            <section id="card-claims"><ClaimPanel card={card} user={user} /></section>
            {isStaff && <Section id="card-production" title={lang === 'zh' ? '量产序列号·不良' : '양산 시리얼·불량'}><ProductionTab card={card} /></Section>}
          </TabsContent>

          {/* 선적·정산: 무역서류·수입 요건 → 결제 → 도착 원가 → 정산 */}
          <TabsContent value="ship" className="mt-4 space-y-5">
            <TradeDocumentsTab card={card} user={user} />
            <ImportRequirementsPanel card={card} user={user} />
            <PaymentGatePanel card={card} user={user} />
            <LandedCostSection card={card} user={user} />
            <section id="card-settlement"><SettlementTab card={card} user={user} /></section>
          </TabsContent>

          {/* 소통: 고객 채팅 → 공장 업로드 링크 → 미팅·분석·AI 제안 → 결정 기록 */}
          <TabsContent value="talk" className="mt-4 space-y-5">
            <ChatTab card={card} user={user} viewLang={viewLang} />
            <section id="card-factory-request"><FactoryRequestPanel card={card} /></section>
            {isStaff && <section id="card-client-request"><ClientRequestPanel card={card} /></section>}
            <Section id="card-meetings" title={lang === 'zh' ? '会议·分析' : '미팅·분석'}>
              <MeetingLogPanel card={card} user={user} onRecordingBusy={setRecordingBusy} />
              <div className="mt-4 border-t pt-4"><TaskInsightPanel card={card} user={user} /></div>
              <AIProposalPanel card={card} user={user} />
            </Section>
            <Section id="card-decisions" title={lang === 'zh' ? '决定记录' : '결정 기록'}><DecisionsTab card={card} user={user} /></Section>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            {isStaff && <DesignRoomsPanel cardId={card.id} staff />}
            <FilesTab card={card} user={user} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}