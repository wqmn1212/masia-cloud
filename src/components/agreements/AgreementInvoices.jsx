import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { INVOICE_STATUS, kstMonth, money, monthLabel, monthsBetween } from '@/lib/agreements';

// 월별 청구 기록. 계약 시작 달부터 이번 달(또는 종료 달)까지 빠진 달을 한 번에 만든다.
export default function AgreementInvoices({ agreement }) {
  const qc = useQueryClient();
  const key = ['agreement-invoices', agreement.id];
  const { data: invoices = [], isLoading } = useQuery({ queryKey: key, queryFn: () => base44.entities.ServiceInvoice.filter({ agreement_id: agreement.id }, '-billing_month', 100) });
  const lastMonth = [kstMonth(), (agreement.end_date || '').slice(0, 7)].filter(Boolean).sort()[0];
  const missing = agreement.start_date ? monthsBetween(agreement.start_date.slice(0, 7), lastMonth).filter((m) => !invoices.some((i) => i.billing_month === m)) : [];
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['agreement-invoices-all'] }); };

  const fill = useMutation({
    mutationFn: () => base44.entities.ServiceInvoice.bulkCreate(missing.map((m) => ({
      agreement_id: agreement.id, company_id: agreement.company_id, company_name: agreement.company_name || '', billing_month: m,
      amount: agreement.monthly_fee ?? null, currency: agreement.currency || 'KRW', status: 'PENDING',
    }))),
    onSuccess: () => { refresh(); toast({ title: `청구 ${missing.length}건을 만들었습니다` }); },
    onError: (e) => toast({ title: '만들지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  const setStatus = useMutation({
    mutationFn: ({ inv, status }) => {
      const now = new Date().toISOString();
      return base44.entities.ServiceInvoice.update(inv.id, { status, ...(status === 'ISSUED' && !inv.issued_at ? { issued_at: now } : {}), ...(status === 'PAID' ? { paid_at: now, issued_at: inv.issued_at || now } : {}) });
    },
    onSuccess: refresh,
    onError: (e) => toast({ title: '변경하지 못했습니다', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">고객 포털에는 월별 청구 상태만 보이고 금액은 보이지 않습니다.</p>
        {missing.length > 0 && <Button size="sm" variant="outline" className="ml-auto" disabled={fill.isPending} onClick={() => fill.mutate()}>빠진 달 {missing.length}건 만들기</Button>}
      </div>
      {invoices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">청구 기록이 없습니다.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {invoices.map((inv) => {
            const s = INVOICE_STATUS[inv.status] || INVOICE_STATUS.PENDING;
            return (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="w-24 font-medium">{monthLabel(inv.billing_month)}</span>
                <span className="text-muted-foreground">{money(inv.amount, inv.currency)}</span>
                <Badge className={`${s.cls} border-0`}>{s.label}</Badge>
                <select aria-label={`${inv.billing_month} 청구 상태`} className="ml-auto h-8 rounded-md border bg-background px-2 text-xs" value={inv.status || 'PENDING'} disabled={setStatus.isPending}
                  onChange={(e) => setStatus.mutate({ inv, status: e.target.value })}>
                  {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
