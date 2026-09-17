import React, { useState } from 'react';
import PaymentConfirmationDialog from '@/components/taskcard/PaymentConfirmationDialog';
import CollaborationHistory from '@/components/taskcard/CollaborationHistory';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const LABELS = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };
export default function PaymentGatePanel({ card, user }) {
  const client = useQueryClient(); const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const query = useQuery({ queryKey: ['payment-stages', card.id], queryFn: () => base44.entities.PaymentStage.filter({ card_id: card.id }) });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['payment-stages', card.id] });
    client.invalidateQueries({ queryKey: ['payment-stages-all'] });
    client.invalidateQueries({ queryKey: ['card-schedule', card.id] });
    client.invalidateQueries({ queryKey: ['collaboration-history', card.id] });
    client.invalidateQueries({ queryKey: ['client-card-detail', card.id] });
    client.invalidateQueries({ queryKey: ['task-cards'] });
  };
  const initialize = useMutation({ mutationFn: () => base44.functions.invoke('manageCardCollaboration', { action: 'initialize', card_id: card.id }), onSuccess: refresh });
  const approve = useMutation({ mutationFn: ({ stage, reason, paid_date }) => base44.functions.invoke('manageCardCollaboration', { action: 'payment', card_id: card.id, stage_id: stage.id, expected_updated_date: stage.updated_date, confirmed: stage.approval_status !== 'APPROVED', reason, paid_date }), onSuccess: () => { refresh(); setSelected(null); toast({ title: '입금 상태 저장 완료', description: '수금률에 반영되었습니다. 고객 알림은 변경 이력에서 확인하세요.' }); }, onError: refresh });
  const stages = query.data || [];
  const canApprove = ['master', 'service', 'sub'].includes(user?.account_tier);
  return <section className="mb-5 space-y-3 rounded-xl border p-3"><div><h3 className="text-sm font-semibold">선금·잔금 입금 확인</h3><p className="text-xs text-muted-foreground">직원만 확인·취소·재확정할 수 있습니다. 변경 시각과 처리자는 이력에 남습니다.</p></div>
    {query.isLoading ? <p className="text-sm">불러오는 중...</p> : query.isError ? <p role="alert" className="text-sm text-destructive">입금 단계를 불러오지 못했습니다.</p> : !stages.length ? (canApprove ? <Button size="sm" onClick={() => initialize.mutate()} disabled={initialize.isPending}>기본 선금 50% · 잔금 50% 설정</Button> : <p className="text-xs text-muted-foreground">아직 결제 단계가 설정되지 않았습니다.</p>) : stages.map(stage => <div key={stage.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 p-2"><div className="text-xs flex-1"><span className="font-medium">{LABELS[stage.stage_type]}</span> · {stage.percentage}%</div><Badge variant={stage.approval_status === 'APPROVED' ? 'default' : 'secondary'}>{stage.approval_status === 'APPROVED' ? '입금 확인' : '확인 대기'}</Badge>{canApprove && <Button size="sm" variant="outline" className="h-7 text-xs" disabled={approve.isPending} onClick={() => { approve.reset(); setSelected(stage); }}>{stage.approval_status === 'APPROVED' ? '확인 취소' : '입금 확인'}</Button>}</div>)}
    {initialize.isError && <p role="alert" className="text-sm text-destructive">{initialize.error?.response?.data?.error || '결제 단계 설정에 실패했습니다.'}</p>}
    <PaymentConfirmationDialog stage={selected} onClose={() => setSelected(null)} onConfirm={data => approve.mutate(data)} pending={approve.isPending} error={approve.error} />
    <CollaborationHistory cardId={card.id} />
  </section>;
}