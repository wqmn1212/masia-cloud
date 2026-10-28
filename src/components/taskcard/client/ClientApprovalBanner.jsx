import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Stamp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { APPROVAL_KIND_LABEL } from '@/lib/clientRoles';

const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// 직원 카드 머리: 고객사 안에서 결재 중인 결정. 고객 실무자가 고른 결정이 고객 결재권자 승인을 기다리는 동안 보인다.
export default function ClientApprovalBanner({ cardId }) {
  const { data: list = [] } = useQuery({
    queryKey: ['client-approvals-staff', cardId],
    enabled: !!cardId,
    refetchInterval: 60000,
    queryFn: () => base44.entities.ClientApproval.filter({ card_id: cardId, status: 'PENDING' }, '-requested_at', 10),
  });
  if (!list.length) return null;
  return (
    <div className="mt-2 space-y-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      {list.map((a) => (
        <p key={a.id} className="flex flex-wrap items-center gap-x-1.5 text-xs">
          <Stamp className="h-3.5 w-3.5 text-primary" />
          <b className="text-primary">고객사 결재 중</b>
          <span>{APPROVAL_KIND_LABEL[a.kind]} · {a.target_label}</span>
          <span className="text-muted-foreground">· {a.requested_by_name} 요청 {when(a.requested_at)} · 고객 결재권자가 승인하면 알림이 옵니다</span>
        </p>
      ))}
    </div>
  );
}
