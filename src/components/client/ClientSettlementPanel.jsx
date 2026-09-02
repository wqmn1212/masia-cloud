import React from 'react';
import { Badge } from '@/components/ui/badge';

const STAGE_LABEL = {
  DOWN_PAYMENT: '선금',
  INTERIM_PAYMENT: '중도금',
  BALANCE_PAYMENT: '잔금',
};

const STATUS_META = {
  PENDING: { label: '확인 대기', cls: 'bg-muted text-muted-foreground' },
  APPROVED: { label: '입금 확인', cls: 'bg-primary/15 text-primary' },
  REJECTED: { label: '보류', cls: 'bg-destructive/15 text-destructive' },
};

export default function ClientSettlementPanel({ stages }) {
  if (stages.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">등록된 결제 단계가 없습니다</p>;
  }
  const collected = stages
    .filter((s) => s.approval_status === 'APPROVED')
    .reduce((sum, s) => sum + s.percentage, 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">입금 확인 비율</p>
        <p className="text-2xl font-bold mt-0.5">{collected}%</p>
        <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(collected, 100)}%` }} />
        </div>
      </div>
      <div className="space-y-2">
        {stages.map((s) => {
          const m = STATUS_META[s.approval_status] || STATUS_META.PENDING;
          return (
            <div key={s.id} className="flex items-center gap-3 border rounded-lg px-3 py-2.5">
              <span className="text-sm font-medium">{STAGE_LABEL[s.stage_type] || s.stage_type}</span>
              <span className="text-sm text-muted-foreground">{s.percentage}%</span>
              <Badge className={`${m.cls} border-0 ml-auto`}>{m.label}</Badge>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">* 금액 상세는 발행된 견적서 PDF 를 확인해 주세요.</p>
    </div>
  );
}