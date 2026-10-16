import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Handshake, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MonthlyReportView from '@/components/reports/MonthlyReportView';
import { AGREEMENT_STATUS, INVOICE_STATUS, daysLeft, monthLabel } from '@/lib/agreements';

// 고객 대시보드: 진행 중인 월 계약(기간·담당 팀·청구 상태)과 발행된 월간 리포트.
export default function ClientContractCard() {
  const { data } = useQuery({
    queryKey: ['client-contracts'],
    queryFn: async () => (await base44.functions.invoke('getClientContracts', withClientView())).data,
  });
  const [openId, setOpenId] = useState(null);
  const agreements = data?.agreements || [];
  const reports = data?.reports || [];

  // 알림 링크(/client/dashboard?report=ID)로 들어오면 해당 리포트를 연다
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('report');
    if (id && reports.some((r) => r.id === id)) setOpenId(id);
  }, [reports]);

  if (!agreements.length && !reports.length) return null;
  const open = reports.find((r) => r.id === openId);
  return (
    <Card className="grid gap-5 p-5 md:grid-cols-2">
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Handshake className="h-4 w-4 text-primary" />계약 정보</h2>
        <ul className="mt-2 space-y-3">
          {agreements.map((a) => {
            const d = daysLeft(a.end_date);
            const st = AGREEMENT_STATUS[a.status] || AGREEMENT_STATUS.ACTIVE;
            return (
              <li key={a.id} className="space-y-1.5 rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{a.title || a.agreement_no || '월 계약'}</span>
                  <Badge className={`${st.cls} border-0`}>{st.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.start_date} ~ {a.end_date}{a.status === 'ACTIVE' && d != null && d >= 0 ? ` · 종료까지 ${d}일` : ''} · 프로젝트 {a.project_count}건
                </p>
                {!!a.team.length && <p className="text-xs">담당 팀: {a.team.join(', ')}</p>}
                {!!a.invoices.length && (
                  <div className="flex flex-wrap gap-1">
                    {a.invoices.slice(0, 6).map((i) => {
                      const s = INVOICE_STATUS[i.status] || INVOICE_STATUS.ISSUED;
                      return <Badge key={i.id} className={`${s.cls} border-0 text-[10px]`}>{monthLabel(i.billing_month).replace(/^\d+년 /, '')} {s.label}</Badge>;
                    })}
                  </div>
                )}
              </li>
            );
          })}
          {!agreements.length && <p className="py-2 text-sm text-muted-foreground">진행 중인 계약이 없습니다.</p>}
        </ul>
      </section>
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" />월간 업무 리포트</h2>
        {reports.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">첫 리포트는 계약 다음 달 초에 발행됩니다.</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            {reports.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setOpenId(r.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
                  <span className="font-medium">{monthLabel(r.month)}</span>
                  <span className="text-xs text-muted-foreground">단계 {r.metrics?.steps_done ?? 0}개 완료 · 검수 {r.metrics?.qc_reports ?? 0}건</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="sr-only">월간 업무 리포트</DialogTitle></DialogHeader>
          {open && <MonthlyReportView report={open} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
