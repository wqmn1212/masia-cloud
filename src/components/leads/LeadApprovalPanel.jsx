import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

// 문의 승인 → 소싱 칸반 보드(TaskCard) 등록. 문의 접수 시점이 아니라 담당자 승인 시점에 카드가 생긴다.
// 이미 온보딩된 고객사의 재문의(lead.client_id 존재)는 승인과 동시에 고객 포털에도 바로 공개한다.
export default function LeadApprovalPanel({ lead }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const approve = useMutation({
    mutationFn: async () => {
      const card = await base44.entities.TaskCard.create({
        tenant_id: lead.tenant_id,
        title: `[문의] ${lead.company} · ${lead.categories?.[0] || '미분류'}`,
        status: 'TODO',
        priority: 'MEDIUM',
        source: 'landing_lead',
        lead_id: lead.id,
        client_name: lead.company,
        client_id: lead.client_id || '',
        client_visible: !!lead.client_id,
        hq_requirements: [
          `유형: ${lead.intent === 'purchase' ? '구매 문의' : '견적 문의'}${lead.product_name ? ` · ${lead.product_name}` : ''}`,
          `담당자: ${lead.contact_name} · ${lead.phone} · ${lead.email}`,
          `카테고리: ${(lead.categories || []).join(', ') || '-'}`,
          `수량: ${lead.quantity || '-'} / 희망 단가: ${lead.target_price || '-'}`,
          `첨부: ${lead.attachments?.length || 0}건 (문의 접수 메뉴에서 다운로드)`,
          ``,
          lead.detail || '',
        ].join('\n'),
      });
      await base44.entities.ManufacturingLead.update(lead.id, { status: 'approved', task_card_id: card.id });
      return card;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manufacturing-leads'] });
      qc.invalidateQueries({ queryKey: ['task-cards'] });
      toast({ title: '승인되었습니다', description: '소싱 칸반 보드에 카드가 등록되었습니다' });
    },
    onError: (err) => toast({ title: '승인 실패', description: err.message, variant: 'destructive' }),
  });

  if (lead.task_card_id) {
    return (
      <div className="border-t pt-4 flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="w-4 h-4" />
        승인 완료 · 소싱 칸반 보드에 등록되었습니다
        {lead.client_id && <Badge variant="secondary" className="text-[10px]">고객 포털 공개됨</Badge>}
      </div>
    );
  }

  return (
    <div className="border-t pt-4 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">문의 승인</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        승인하면 이 문의 내용으로 소싱 칸반 보드에 업무 카드가 생성됩니다. 신규 고객사는 승인 후 아래에서 팀을 발급해야 고객 포털에 노출됩니다.
      </p>
      <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}>
        {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
        승인하고 카드 등록
      </Button>
    </div>
  );
}
