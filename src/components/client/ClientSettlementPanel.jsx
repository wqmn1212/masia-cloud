import React from 'react';
import { AlertTriangle, CheckCircle2, Landmark } from 'lucide-react';
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

const fmtMoney = (amount, currency) => `${currency || ''} ${Number(amount).toLocaleString('ko-KR')}`.trim();

// 고객이 공장에 직접 송금하는 프로젝트: 이지스가 공장에 직접 확인한 계좌만 보여 준다
function FactoryPaymentBox({ payment }) {
  if (payment.pending_change) {
    return (
      <div className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <div><p className="font-semibold text-destructive">송금을 잠시 멈춰 주세요</p><p className="mt-1 text-xs text-muted-foreground">공장 측에서 받는 계좌를 바꾸겠다는 요청이 들어와 이지스가 공장에 직접 확인하고 있습니다. 확인되면 알림으로 알려드립니다. 그 사이 메신저·이메일로 받은 계좌로는 송금하지 마세요.</p></div>
      </div>
    );
  }
  if (!payment.verified) {
    return <p className="rounded-xl border p-4 text-xs text-muted-foreground">이지스가 공장 계좌를 확인하고 있습니다. 확인된 계좌가 여기에 표시되기 전에는 송금하지 마세요.</p>;
  }
  const a = payment.verified;
  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Landmark className="h-4 w-4 text-primary" />공장 대금 송금 계좌</p>
      <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        <dt className="text-muted-foreground">예금주</dt><dd className="break-all font-medium">{a.beneficiary_name}</dd>
        <dt className="text-muted-foreground">은행</dt><dd className="break-all">{a.bank_name}</dd>
        <dt className="text-muted-foreground">계좌</dt><dd className="break-all font-mono">{a.account_no} <span className="font-sans text-muted-foreground">({a.currency || 'CNY'})</span></dd>
        {a.swift_code && <><dt className="text-muted-foreground">SWIFT</dt><dd className="font-mono">{a.swift_code}</dd></>}
        {a.bank_address && <><dt className="text-muted-foreground">은행 주소</dt><dd className="break-all">{a.bank_address}</dd></>}
      </dl>
      <p className="flex items-center gap-1 text-[11px] text-primary"><CheckCircle2 className="h-3 w-3" />이지스 {a.verify_method} · {a.verified_at ? new Date(a.verified_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : ''}</p>
      <p className="text-[11px] text-muted-foreground">공장이 메신저·이메일로 다른 계좌를 알려 오면 송금하지 말고 담당자에게 먼저 알려 주세요. 계좌 변경 사기는 이렇게 시작됩니다.</p>
    </div>
  );
}

export default function ClientSettlementPanel({ stages, factoryPayment }) {
  if (stages.length === 0) {
    return (
      <div className="space-y-3">
        {factoryPayment && <FactoryPaymentBox payment={factoryPayment} />}
        <p className="text-sm text-muted-foreground text-center py-8">등록된 결제 단계가 없습니다</p>
      </div>
    );
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
              <span className="text-sm text-muted-foreground">{s.percentage}%{s.amount ? ` · ${fmtMoney(s.amount, s.currency)}` : ''}{s.paid_date ? ` · 입금일 ${s.paid_date}` : ''}</span>
              <Badge className={`${m.cls} border-0 ml-auto`}>{m.label}</Badge>
            </div>
          );
        })}
      </div>
      {factoryPayment && <FactoryPaymentBox payment={factoryPayment} />}
      <p className="text-[11px] text-muted-foreground">* 금액 상세는 발행된 견적서 PDF 를 확인해 주세요.</p>
    </div>
  );
}