import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Inbox } from 'lucide-react';
import EmailProposalRow from './EmailProposalRow';
import { applyProposalToCard, rejectProposal } from '@/lib/applyProposal';

export default function EmailProposalDialog({ open, onClose, cards = [], user }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['ai-proposals', 'pending-all'],
    queryFn: () => base44.entities.AIProposal.filter({ status: 'PENDING' }, '-created_date', 100),
    enabled: open,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ai-proposals'] });
    queryClient.invalidateQueries({ queryKey: ['task-cards'] });
    queryClient.invalidateQueries({ queryKey: ['task-items-all'] });
  };

  const apply = useMutation({
    mutationFn: ({ proposal, cardId }) => applyProposalToCard({ proposal, cardId, user }),
    onSuccess: () => { refresh(); toast({ title: '선택한 카드에 반영되었습니다' }); },
  });

  const reject = useMutation({
    mutationFn: (proposal) => rejectProposal({ proposal, user }),
    onSuccess: () => { refresh(); toast({ title: '추천을 거절했습니다' }); },
  });

  const busy = apply.isPending || reject.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>가져온 이메일 · 카드 연동 ({proposals.length}건 대기)</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">불러오는 중…</p>
        ) : proposals.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-3">대기 중인 이메일 추천이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <EmailProposalRow
                key={p.id}
                proposal={p}
                cards={cards}
                busy={busy}
                onApply={(proposal, cardId) => apply.mutate({ proposal, cardId })}
                onReject={(proposal) => reject.mutate(proposal)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}