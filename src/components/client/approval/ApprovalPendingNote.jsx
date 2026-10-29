import React from 'react';
import { Stamp } from 'lucide-react';
import ClientApprovalActions from './ClientApprovalActions';

const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// 결정 자리에 보이는 '사내 결재 중' 안내. 결재권자에게는 그 자리에서 승인·반려 버튼을 보여 준다.
export default function ApprovalPendingNote({ approval, cardId }) {
  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-label">
        <Stamp className="h-4 w-4 text-primary" />
        <span className="font-semibold text-primary">사내 결재 중</span>
        <span className="text-muted-foreground">{approval.requested_by_name} 요청 · {when(approval.requested_at)}</span>
      </p>
      <p className="text-label">{approval.target_label}</p>
      {approval.request_note && <p className="whitespace-pre-wrap text-caption text-muted-foreground">메모: {approval.request_note}</p>}
      {!approval.can_approve && !approval.mine && <p className="text-caption text-muted-foreground">결재권자가 승인하면 담당자에게 전달됩니다.</p>}
      <ClientApprovalActions approval={approval} cardId={cardId} />
    </div>
  );
}
