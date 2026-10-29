import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Stamp } from 'lucide-react';
import useClientOverview from '@/lib/useClientOverview';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { APPROVAL_KIND_LABEL, APPROVAL_STATUS_LABEL } from '@/lib/clientRoles';
import ClientApprovalActions from '../approval/ClientApprovalActions';

const KIND_TAB = { comparison_choice: 'quotation', quote_accept: 'quotation', qc_decision: 'qc', spec_decision: 'qc', file_review: 'files' };
const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const STATUS_CLS = { PENDING: 'bg-warning/15 text-warning-text', REJECTED: 'bg-destructive/15 text-destructive', STALE: 'bg-muted text-muted-foreground' };

function ApprovalRow({ a }) {
  return (
    <li className="space-y-1.5 px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant="outline" className="text-micro">{APPROVAL_KIND_LABEL[a.kind]}</Badge>
        <Badge className={cn('border-0 text-micro', STATUS_CLS[a.status])}>{APPROVAL_STATUS_LABEL[a.status]}</Badge>
        <Link to={`/client/dashboard?card=${a.card_id}&tab=${KIND_TAB[a.kind] || 'overview'}`} className="min-w-0 truncate text-label font-semibold hover:text-primary hover:underline">{a.card_title}</Link>
        <span className="ml-auto text-caption text-muted-foreground">{a.requested_by_name} · {when(a.requested_at)}</span>
      </div>
      <p className="text-label">{a.target_label}{a.amount_krw != null && <span className="text-muted-foreground"> · 약 {Math.round(a.amount_krw).toLocaleString('ko-KR')}원</span>}</p>
      {a.request_note && <p className="whitespace-pre-wrap text-caption text-muted-foreground">메모: {a.request_note}</p>}
      {a.status !== 'PENDING' && <p className="text-caption text-destructive">{a.decided_by_name ? `${a.decided_by_name}: ` : ''}{a.reason}</p>}
      {a.status === 'PENDING' && <ClientApprovalActions approval={a} compact />}
    </li>
  );
}

function Group({ title, list, empty }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-label font-semibold">{title} <span className="font-normal text-muted-foreground">{list.length}건</span></h3>
      {list.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-4 text-center text-caption text-muted-foreground">{empty}</p>
        : <ul className="divide-y rounded-lg border">{list.map((a) => <ApprovalRow key={a.approval_id} a={a} />)}</ul>}
    </section>
  );
}

// 결재함: 내가 결재할 것 · 내가 요청한 것(반려·무효 포함 14일) · 동료끼리 진행 중인 것
export default function ClientApprovalInbox() {
  const { data, isLoading } = useClientOverview();
  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const all = data?.approvals || [];
  if (!data?.team?.has_setup) {
    return <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-3 text-label text-muted-foreground"><Stamp className="h-4 w-4" />역할과 결재 규칙을 정하면 여기에서 사내 결재를 주고받습니다.</p>;
  }
  const toMe = all.filter((a) => a.can_approve);
  const mine = all.filter((a) => a.mine && !a.can_approve);
  const others = all.filter((a) => !a.mine && !a.can_approve && a.status === 'PENDING');
  return (
    <div className="space-y-5">
      {!data.team.rules_on?.length && <p className="rounded-lg bg-muted/50 px-3 py-2 text-label text-muted-foreground">켜진 결재 규칙이 없어 지금은 모든 결정이 바로 전달됩니다.</p>}
      {(data.team.my_roles || []).includes('APPROVER') && <Group title="내가 결재할 것" list={toMe} empty="결재할 요청이 없습니다." />}
      <Group title="내가 요청한 것" list={mine} empty="요청한 결재가 없습니다." />
      {others.length > 0 && <Group title="동료가 결재 중인 것" list={others} empty="" />}
    </div>
  );
}
