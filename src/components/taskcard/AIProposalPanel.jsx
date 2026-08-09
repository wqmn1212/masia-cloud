import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Sparkles, Mail, Check, X } from 'lucide-react';

export default function AIProposalPanel({ card, user }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: proposals = [] } = useQuery({
    queryKey: ['ai-proposals', card.id],
    queryFn: () => base44.entities.AIProposal.filter({ card_id: card.id, status: 'PENDING' }, '-created_date', 20),
  });

  const decide = useMutation({
    mutationFn: async ({ proposal, approve }) => {
      if (approve) {
        const tasks = proposal.suggested_tasks || [];
        if (tasks.length > 0) {
          await base44.entities.TaskItem.bulkCreate(
            tasks.map((t) => ({
              card_id: card.id,
              title: t.title,
              description: t.description || '',
              status: 'TODO',
              priority: t.priority || 'MEDIUM',
              ...(t.due_date ? { due_date: t.due_date } : {}),
            }))
          );
        }
        const block = [
          `\n\n### 📧 ${proposal.email_subject || '이메일'} (${proposal.email_date || ''})`,
          proposal.client_requirements ? `**고객 요구사항**\n${proposal.client_requirements}` : '',
          proposal.our_commitments ? `**회신/약속 내용**\n${proposal.our_commitments}` : '',
        ].filter(Boolean).join('\n');
        await base44.entities.TaskCard.update(card.id, {
          hq_requirements: `${card.hq_requirements || ''}${block}`,
        });
      }
      return base44.entities.AIProposal.update(proposal.id, {
        status: approve ? 'APPROVED' : 'REJECTED',
        reviewed_by_name: user?.full_name || user?.email || '',
      });
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ai-proposals', card.id] });
      queryClient.invalidateQueries({ queryKey: ['task-items', card.id] });
      queryClient.invalidateQueries({ queryKey: ['task-cards'] });
      toast({ title: vars.approve ? 'AI 추천 작업이 반영되었습니다' : '추천을 거절했습니다' });
    },
  });

  if (proposals.length === 0) return null;

  return (
    <Card className="mt-4 border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI 추천 작업 (이메일 기반)
          <Badge variant="secondary" className="text-[10px]">{proposals.length}건 승인 대기</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {proposals.map((p) => (
          <div key={p.id} className="rounded-xl border p-3 space-y-2 bg-muted/30">
            <div className="flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{p.email_subject || '(제목 없음)'}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.email_from} · {p.email_date}</p>
              </div>
            </div>

            {p.summary && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{p.summary}</p>}

            {p.client_requirements && (
              <div>
                <p className="text-[11px] font-semibold">고객 요구사항</p>
                <p className="text-[11px] whitespace-pre-wrap text-muted-foreground">{p.client_requirements}</p>
              </div>
            )}
            {p.our_commitments && (
              <div>
                <p className="text-[11px] font-semibold">회신/약속 내용</p>
                <p className="text-[11px] whitespace-pre-wrap text-muted-foreground">{p.our_commitments}</p>
              </div>
            )}

            {(p.suggested_tasks || []).length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold">추천 세부 작업 {p.suggested_tasks.length}개</p>
                {p.suggested_tasks.map((t, i) => (
                  <div key={i} className="text-[11px] rounded-md bg-background border px-2 py-1">
                    <span className="font-medium">{t.title}</span>
                    {t.due_date && <span className="text-muted-foreground"> · {t.due_date}</span>}
                    {t.description && <p className="text-muted-foreground">{t.description}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={decide.isPending}
                onClick={() => decide.mutate({ proposal: p, approve: false })}>
                <X className="w-3.5 h-3.5" /> 거절
              </Button>
              <Button size="sm" disabled={decide.isPending}
                onClick={() => decide.mutate({ proposal: p, approve: true })}>
                <Check className="w-3.5 h-3.5" /> 승인 후 반영
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}