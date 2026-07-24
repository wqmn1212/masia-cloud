import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const LABELS = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };
export default function PaymentGatePanel({ card, user }) {
  const client = useQueryClient(); const { toast } = useToast();
  const query = useQuery({ queryKey: ['payment-stages', card.id], queryFn: () => base44.entities.PaymentStage.filter({ card_id: card.id }) });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['payment-stages', card.id] });
    client.invalidateQueries({ queryKey: ['payment-stages-all'] });
  };
  const initialize = useMutation({ mutationFn: () => base44.entities.PaymentStage.bulkCreate([
    { card_id: card.id, stage_type: 'DOWN_PAYMENT', percentage: 50, approval_status: 'PENDING' },
    { card_id: card.id, stage_type: 'BALANCE_PAYMENT', percentage: 50, approval_status: 'PENDING' },
  ]), onSuccess: refresh });
  const approve = useMutation({ mutationFn: async stage => { await base44.entities.PaymentStage.update(stage.id, { approval_status: 'APPROVED', approved_at: new Date().toISOString(), approved_by_id: user?.id || '', approved_by_name: user?.full_name || user?.email || '' }); await base44.entities.ProjectAuditLog.create({ card_id: card.id, event_type: 'PAYMENT_APPROVED', actor_id: user?.id || '', actor_name: user?.full_name || user?.email || '', details: `${LABELS[stage.stage_type]} ${stage.percentage}% 입금 승인` }); }, onSuccess: () => { refresh(); toast({ title: '입금 승인 완료 — 공정 잠금에 즉시 반영됩니다' }); } });
  const stages = query.data || [];
  return <section className="mb-5 space-y-3 rounded-xl border p-3"><div><h3 className="text-sm font-semibold">공정 잠금용 수금 승인</h3><p className="text-xs text-muted-foreground">이번 단계에서는 선금·잔금 승인 상태를 공정 제어에 연결합니다.</p></div>
    {!query.isLoading && !stages.length ? <Button size="sm" onClick={() => initialize.mutate()} disabled={initialize.isPending}>기본 선금 50% · 잔금 50% 설정</Button> : stages.map(stage => <div key={stage.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-2"><div className="text-xs"><span className="font-medium">{LABELS[stage.stage_type]}</span> · {stage.percentage}%</div>{stage.approval_status === 'APPROVED' ? <Badge className="border-0 bg-accent/15 text-accent">승인 완료</Badge> : <Button size="sm" className="h-7 text-xs" onClick={() => approve.mutate(stage)} disabled={approve.isPending}>입금 승인</Button>}</div>)}
  </section>;
}