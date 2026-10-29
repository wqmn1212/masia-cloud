import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Undo2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';

// 결재 요청 하나에 대한 버튼: 결재권자는 승인·반려(사유), 요청자는 거두기.
// approval: listClientTodos.approvals 또는 getClientCardDetail.approvals 의 한 줄 ({ approval_id|id, card_id, can_approve, mine })
export default function ClientApprovalActions({ approval, cardId, compact = false }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const id = approval.approval_id || approval.id;
  const card = cardId || approval.card_id;
  const act = useMutation({
    mutationFn: async ({ action, decision, note }) => (await base44.functions.invoke('clientCardAction', { card_id: card, action, approval_id: id, decision, note })).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      qc.invalidateQueries({ queryKey: ['client-card-detail', card] });
      qc.invalidateQueries({ queryKey: ['client-quotations', card] });
      setRejecting(false); setReason('');
      toast({ title: v.action === 'approval_cancel' ? '결재 요청을 거두었습니다' : v.decision === 'APPROVE' ? '결재를 승인해 담당자에게 전달했습니다' : '반려했습니다. 요청한 분에게 사유가 전달됩니다' });
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      toast({ title: '처리하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    },
  });
  const busy = act.isPending;

  if (rejecting) {
    return (
      <form className="flex w-full flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); act.mutate({ action: 'approval_decide', decision: 'REJECT', note: reason }); }}>
        <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="반려 사유 (요청한 분에게 전달됩니다)" className="h-8 min-w-[180px] flex-1 text-label" disabled={busy} />
        <Button type="submit" size="sm" variant="destructive" className="h-8" disabled={busy || !reason.trim()}>{busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}반려</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setRejecting(false)} disabled={busy}>취소</Button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {approval.can_approve && (
        <>
          <Button type="button" size="sm" className="h-8 gap-1" disabled={busy}
            onClick={() => window.confirm(`${approval.target_label || '이 결정'}을 결재할까요?\n승인하면 담당자에게 바로 전달되며 되돌릴 수 없습니다.`) && act.mutate({ action: 'approval_decide', decision: 'APPROVE' })}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}승인
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => setRejecting(true)}><X className="h-3.5 w-3.5" />반려</Button>
        </>
      )}
      {approval.mine && approval.status !== 'REJECTED' && approval.status !== 'STALE' && (
        <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" disabled={busy} onClick={() => act.mutate({ action: 'approval_cancel' })}>
          <Undo2 className="h-3.5 w-3.5" />{compact ? '거두기' : '요청 거두기'}
        </Button>
      )}
    </div>
  );
}
