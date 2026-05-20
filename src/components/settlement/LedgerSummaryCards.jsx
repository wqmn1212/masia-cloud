import React from 'react';
import { Card } from '@/components/ui/card';
import { DollarSign, TrendingUp, Crown, AlertCircle } from 'lucide-react';

export default function LedgerSummaryCards({ ledgers }) {
  const totalExpectedKickback = ledgers.reduce((s, l) => s + (Number(l.expected_kickback_usd) || 0), 0);
  const totalActualRmb = ledgers.reduce((s, l) => s + (Number(l.actual_kickback_rmb) || 0), 0);
  const totalHQShare = ledgers.reduce((s, l) => s + (Number(l.hq_final_share_rmb) || 0), 0);
  const pendingCount = ledgers.filter(l => l.status === 'PENDING' || l.status === 'KICKBACK_RECEIVED').length;

  const cards = [
    {
      label: '예상 마진 합계',
      value: `$${totalExpectedKickback.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: 'USD 기준',
      icon: DollarSign,
      bg: 'bg-orange-50',
      iconColor: 'text-orange-500',
      valueColor: 'text-orange-600',
    },
    {
      label: '실수금 커미션 합계',
      value: `¥${totalActualRmb.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: 'RMB 기준',
      icon: TrendingUp,
      bg: 'bg-accent/10',
      iconColor: 'text-accent',
      valueColor: 'text-accent',
    },
    {
      label: '본사 누적 수령액',
      value: `¥${totalHQShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: 'RMB 기준',
      icon: Crown,
      bg: 'bg-primary/10',
      iconColor: 'text-primary',
      valueColor: 'text-primary',
    },
    {
      label: '미정산 프로젝트',
      value: `${pendingCount}건`,
      sub: '처리 대기',
      icon: AlertCircle,
      bg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      valueColor: 'text-destructive',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className={`p-4 ${c.bg} border-0`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className={`text-xl font-extrabold font-mono mt-1 ${c.valueColor}`}>{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
            <c.icon className={`w-5 h-5 ${c.iconColor}`} />
          </div>
        </Card>
      ))}
    </div>
  );
}