import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AgreementForm from './AgreementForm';
import AgreementProjects from './AgreementProjects';
import AgreementInvoices from './AgreementInvoices';
import AgreementReports from './AgreementReports';

// 월 계약 상세: 기본 정보 · 연결 프로젝트 · 청구 · 월간 리포트. 새 계약은 저장한 뒤에 나머지 탭이 열린다.
export default function AgreementDialog({ open, agreement, initialTab, companies, team, onClose, onSaved }) {
  const [current, setCurrent] = useState(agreement);
  const [tab, setTab] = useState('info');
  useEffect(() => { if (open) { setCurrent(agreement); setTab(agreement?.id ? initialTab || 'info' : 'info'); } }, [open, agreement, initialTab]);
  const saved = (a) => { setCurrent(a); onSaved?.(a); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{current?.id ? `${current.company_name || ''} · ${current.title || current.agreement_no || '월 계약'}` : '새 월 계약'}</DialogTitle>
          <DialogDescription>계약 기간·월 계약료·담당 팀을 관리하고, 프로젝트를 묶어 청구와 월간 리포트를 만듭니다.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">기본 정보</TabsTrigger>
            <TabsTrigger value="projects" disabled={!current?.id}>프로젝트</TabsTrigger>
            <TabsTrigger value="invoices" disabled={!current?.id}>청구</TabsTrigger>
            <TabsTrigger value="reports" disabled={!current?.id}>월간 리포트</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="mt-4"><AgreementForm agreement={current} companies={companies} team={team} onSaved={saved} /></TabsContent>
          {current?.id && <>
            <TabsContent value="projects" className="mt-4"><AgreementProjects agreement={current} /></TabsContent>
            <TabsContent value="invoices" className="mt-4"><AgreementInvoices agreement={current} /></TabsContent>
            <TabsContent value="reports" className="mt-4"><AgreementReports agreement={current} /></TabsContent>
          </>}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
