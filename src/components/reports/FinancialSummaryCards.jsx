import { Card, CardContent } from '@/components/ui/card';
import { FileCheck2, TrendingUp, Wallet } from 'lucide-react';
import { formatMoney } from '@/lib/financialReport';

export default function FinancialSummaryCards({ count, revenue, margin, currency }) {
  const cards = [
    { label: '처리 견적', value: `${count.toLocaleString()}건`, icon: FileCheck2 },
    { label: '총 매출', value: formatMoney(revenue, currency), icon: Wallet },
    { label: '누적 마진', value: formatMoney(margin, currency), icon: TrendingUp },
  ];
  return <div className="grid gap-4 sm:grid-cols-3">{cards.map((item) => (
    <Card key={item.label}><CardContent className="flex items-center gap-4 p-5">
      <div className="rounded-xl bg-primary/10 p-3 text-primary"><item.icon className="w-5 h-5" /></div>
      <div><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-xl font-bold mt-1">{item.value}</p></div>
    </CardContent></Card>
  ))}</div>;
}