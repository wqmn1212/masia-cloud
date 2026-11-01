import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PerformanceReportView from '@/components/reports/PerformanceReportView';
import PdfButton from '@/components/reports/PdfButton';
import { generatePerformanceReportPDF } from '@/lib/reportPdf';

// 고객 대시보드: 발행된 성과 리포트 (분기·반기·연간). 사내 보고용 PDF로 저장할 수 있다.
export default function ClientPerformanceCard() {
  const { data } = useQuery({
    queryKey: ['client-performance-reports'],
    queryFn: async () => (await base44.functions.invoke('getClientPerformanceReports', withClientView())).data,
  });
  const reports = data?.reports || [];
  const [openId, setOpenId] = useState(null);
  // 알림 링크(/client/dashboard?perf=ID)로 들어오면 해당 리포트를 연다
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('perf');
    if (id && reports.some((r) => r.id === id)) setOpenId(id);
  }, [reports]);
  if (!reports.length) return null;
  const open = reports.find((r) => r.id === openId);
  const headline = (m = {}) => [m.projects_active != null && `품목 ${m.projects_active}개`, m.quotes_sent ? `견적 ${m.quotes_sent}건` : '', m.qc_reports ? `검수 ${m.qc_reports}회` : '', m.savings_pct_avg ? `절감 평균 ${m.savings_pct_avg}%` : ''].filter(Boolean).join(' · ');

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" />성과 리포트</h2>
      <ul className="mt-2 space-y-0.5">
        {reports.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
              <span className="shrink-0 font-medium">{r.period_label}</span>
              <span className="min-w-0 truncate text-xs text-muted-foreground">{headline(r.metrics)}</span>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="sr-only">성과 리포트</DialogTitle></DialogHeader>
          {open && <>
            <div className="flex justify-end"><PdfButton generate={() => generatePerformanceReportPDF(open)} label="보고용 PDF로 저장" /></div>
            <PerformanceReportView report={open} />
          </>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
