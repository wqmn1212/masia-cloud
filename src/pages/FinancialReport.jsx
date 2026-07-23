import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import FinancialSummaryCards from '@/components/reports/FinancialSummaryCards';
import RevenueTrendChart from '@/components/reports/RevenueTrendChart';
import { buildMonthlyTrend, quoteAmounts } from '@/lib/financialReport';

export default function FinancialReport() {
  const [currency, setCurrency] = useState('CNY');
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['financial-report-quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date', 500),
  });
  const processed = useMemo(() => quotations.filter((quote) => quote.status && quote.status !== 'DRAFT'), [quotations]);
  const totals = useMemo(() => processed.reduce((sum, quote) => {
    const amount = quoteAmounts(quote, currency);
    return { revenue: sum.revenue + amount.revenue, margin: sum.margin + amount.margin };
  }, { revenue: 0, margin: 0 }), [processed, currency]);
  const trend = useMemo(() => buildMonthlyTrend(processed, currency), [processed, currency]);

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><BarChart3 className="w-5 h-5" /></div><div><h1 className="text-2xl font-bold">재무 리포트</h1><p className="text-sm text-muted-foreground">처리 견적, 누적 마진과 통화별 매출 추이를 확인합니다</p></div></div>
      <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CNY">CNY · 위안</SelectItem><SelectItem value="USD">USD · 달러</SelectItem><SelectItem value="KRW">KRW · 원</SelectItem></SelectContent></Select>
    </div>
    {isLoading ? <div className="py-24 text-center text-sm text-muted-foreground">재무 데이터를 집계하는 중...</div> : <><FinancialSummaryCards count={processed.length} revenue={totals.revenue} margin={totals.margin} currency={currency} /><RevenueTrendChart data={trend} currency={currency} /></>}
  </div>;
}