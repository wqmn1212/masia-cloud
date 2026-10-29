import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import useClientOverview from '@/lib/useClientOverview';
import ClientTeamPanel, { ClientApprovalRulesPanel } from '@/components/client/team/ClientTeamPanel';
import ClientApprovalInbox from '@/components/client/team/ClientApprovalInbox';

const TABS = ['approvals', 'team', 'rules'];

// 고객 포털 '팀·결재': 결재함 · 우리 회사 계정과 역할 · 결재 규칙
export default function ClientTeam() {
  const { data } = useClientOverview();
  const [tab, setTab] = useState(() => { const t = new URLSearchParams(window.location.search).get('tab'); return TABS.includes(t) ? t : 'approvals'; });
  const waiting = (data?.approvals || []).filter((a) => a.can_approve).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">팀·결재</h1>
        <p className="mt-1 text-sm text-muted-foreground">동료를 초대하고 역할을 나누면, 실무자가 고른 결정을 결재권자가 승인한 뒤 이지스에 전달할 수 있습니다.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="approvals" className="gap-1.5">결재함{waiting > 0 && <Badge className="h-4 border-0 bg-destructive px-1.5 text-micro text-destructive-foreground">{waiting}</Badge>}</TabsTrigger>
          <TabsTrigger value="team">계정과 역할</TabsTrigger>
          <TabsTrigger value="rules">결재 규칙</TabsTrigger>
        </TabsList>
        <TabsContent value="approvals" className="mt-4"><ClientApprovalInbox /></TabsContent>
        <TabsContent value="team" className="mt-4"><ClientTeamPanel /></TabsContent>
        <TabsContent value="rules" className="mt-4"><ClientApprovalRulesPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
