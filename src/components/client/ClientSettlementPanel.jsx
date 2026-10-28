import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Landmark, Send, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import DocChips from '@/components/files/DocChips';
import { REMITTANCE_FOR_STAGE } from '@/components/files/documentTypes';
import ClientPaymentReportDialog from './ClientPaymentReportDialog';
import { shortDate, dday, money, kstToday } from './clientFormat';

const STAGE_LABEL = {
  DOWN_PAYMENT: '선금',
  INTERIM_PAYMENT: '중도금',
  BALANCE_PAYMENT: '잔금',
};
const daysLeft = (ymd) => (ymd ? Math.round((Date.parse(ymd) - Date.parse(kstToday())) / 86400000) : null);

// 결제 요청 상태 (서버 base44/shared/paymentRequest.ts 의 request_state)
function StateBadge({ s }) {
  if (s.request_state === 'PAID') return <Badge className="border-0 bg-primary/15 text-primary">입금 확인</Badge>;
  if (s.request_state === 'REPORTED') return <Badge className="border-0 bg-primary/10 text-primary">송금 확인 중</Badge>;
  if (s.request_state === 'REQUESTED') {
    const left = daysLeft(s.due_date);
    return <Badge className={cn('border-0', left != null && left <= 3 ? 'bg-warning/15 text-warning-text' : 'bg-primary text-primary-foreground')}>결제 요청{left != null ? ` · ${dday(left)}` : ''}</Badge>;
  }
  return <Badge className="border-0 bg-muted text-muted-foreground">요청 전</Badge>;
}

function CopyRow({ label, value, mono }) {
  if (!value) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast({ title: `${label}를 복사했습니다` }); } catch { toast({ title: '복사하지 못했습니다. 직접 선택해 주세요.', variant: 'destructive' }); }
  };
  return (
    <>
      <dt className="pt-1 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-start gap-1">
        <span className={cn('min-w-0 break-all pt-1', mono && 'font-mono')}>{value}</span>
        <button type="button" onClick={copy} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`${label} 복사`}><Copy className="h-3.5 w-3.5" /></button>
      </dd>
    </>
  );
}

// 이지스 받는 계좌 (마스터가 등록한 계좌만 서버가 보낸다)
function AegisAccountBox({ a }) {
  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-label font-semibold"><Landmark className="h-4 w-4 text-primary" />{a.label || '이지스 받는 계좌'} <span className="font-normal text-muted-foreground">({a.currency})</span></p>
      <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 text-label">
        <CopyRow label="예금주" value={a.account_holder} />
        <CopyRow label="은행" value={a.bank_name} />
        <CopyRow label="계좌" value={a.account_no} mono />
        <CopyRow label="SWIFT" value={a.swift_code} mono />
        <CopyRow label="은행 주소" value={a.bank_address} />
      </dl>
      {a.note && <p className="text-caption text-muted-foreground">{a.note}</p>}
    </div>
  );
}

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

function StageCard({ s, receipts, factoryPayment, canReport, onReport }) {
  const open = s.request_state === 'REQUESTED' || s.request_state === 'REPORTED';
  const mine = receipts.filter((r) => r.document_type === REMITTANCE_FOR_STAGE[s.stage_type]);
  return (
    <div className={cn('space-y-2.5 rounded-xl border p-3', s.request_state === 'REQUESTED' && 'border-primary/40')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-body font-semibold">{STAGE_LABEL[s.stage_type] || s.stage_type}</span>
        <span className="text-label text-muted-foreground tabular-nums">{s.percentage}%{s.amount != null ? ` · ${money(s.amount, s.currency)}` : ''}</span>
        <span className="ml-auto"><StateBadge s={s} /></span>
      </div>
      {s.request_state === 'PAID' && s.paid_date && <p className="text-caption text-muted-foreground">입금일 {s.paid_date}</p>}
      {open && (
        <>
          <p className="text-label">결제 기한 <span className="font-semibold tabular-nums">{shortDate(s.due_date)}</span></p>
          {s.payee === 'FACTORY' ? (factoryPayment ? <FactoryPaymentBox payment={factoryPayment} /> : null)
            : s.payee_account ? <AegisAccountBox a={s.payee_account} />
              : <p className="rounded-xl border p-3 text-caption text-muted-foreground">받는 계좌를 다시 확인하고 있습니다. 계좌가 여기에 보이기 전에는 송금하지 말고 담당자에게 문의해 주세요.</p>}
          {s.request_note && <p className="rounded-lg bg-muted/50 px-3 py-2 text-label">담당자 메모: {s.request_note}</p>}
        </>
      )}
      {s.request_state === 'REPORTED' && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />{shortDate(s.reported_paid_date)} 송금 · {s.reported_by_name}님이 알림. 이지스가 통장 입금을 확인하면 '입금 확인'으로 바뀝니다.
          {canReport && <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => onReport(s)}>송금 정보 고치기</button>}
        </p>
      )}
      {mine.length > 0 && <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">송금확인증<DocChips docs={mine} max={2} /></div>}
      {s.request_state === 'REQUESTED' && canReport && (
        <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => onReport(s)}><Send className="h-3.5 w-3.5" />송금했어요</Button>
      )}
    </div>
  );
}

export default function ClientSettlementPanel({ cardId, stages, factoryPayment, receipts = [], canReport = false }) {
  const [reporting, setReporting] = useState(null);
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
  const anyFactoryRequest = stages.some((s) => s.payee === 'FACTORY' && (s.request_state === 'REQUESTED' || s.request_state === 'REPORTED'));

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
        {stages.map((s) => <StageCard key={s.id} s={s} receipts={receipts} factoryPayment={factoryPayment} canReport={canReport} onReport={setReporting} />)}
      </div>
      {factoryPayment && !anyFactoryRequest && <FactoryPaymentBox payment={factoryPayment} />}
      <p className="flex gap-1.5 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-caption text-warning-text">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />계좌가 바뀌었다는 연락은 이 화면에서만 확인해 주세요. 메일·메신저로 받은 계좌로는 송금하지 말고 담당자에게 먼저 알려 주세요.
      </p>
      <p className="text-[11px] text-muted-foreground">* 결제 요청이 오기 전 금액은 발행된 견적서 PDF의 결제 조건을 참고해 주세요.</p>
      <ClientPaymentReportDialog cardId={cardId} stage={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}
