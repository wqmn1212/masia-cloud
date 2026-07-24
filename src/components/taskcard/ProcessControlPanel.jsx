import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ProcessControlPanel({ card, user }) {
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const client = useQueryClient(); const { toast } = useToast();
  const stages = useQuery({ queryKey: ['payment-stages', card.id], queryFn: () => base44.entities.PaymentStage.filter({ card_id: card.id }) });
  const current = useQuery({ queryKey: ['process-card', card.id], queryFn: () => base44.entities.TaskCard.get(card.id) });
  const approved = (stages.data || []).filter(x => x.approval_status === 'APPROVED');
  const downPaid = approved.some(x => x.stage_type === 'DOWN_PAYMENT'); const rate = approved.reduce((sum, x) => sum + Number(x.percentage || 0), 0); const shipmentReady = rate >= 100;
  const move = useMutation({ mutationFn: async ({ status, event, details }) => { await base44.entities.TaskCard.update(card.id, { status }); await base44.entities.ProjectAuditLog.create({ card_id: card.id, event_type: event, actor_id: user?.id || '', actor_name: user?.full_name || user?.email || '', details }); }, onSuccess: () => { client.invalidateQueries({ queryKey: ['task-cards'] }); client.invalidateQueries({ queryKey: ['process-card', card.id] }); setReason(''); setError(''); toast({ title: '공정 상태가 업데이트되었습니다' }); } });
  const override = () => { if (!reason.trim()) return setError('강제 출고 사유를 입력하세요.'); move.mutate({ status: 'DONE', event: 'SHIPMENT_OVERRIDDEN', details: `강제 출고 승인: ${reason}` }); };
  const status = current.data?.status || card.status;
  return <section className="mt-5 space-y-3 rounded-xl border p-3"><div><h3 className="text-sm font-semibold">공정 연동 및 출고 제어</h3><p className="text-xs text-muted-foreground">승인 수금률 {Math.min(rate, 100)}%</p></div>
    <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2"><span className="flex items-center gap-2 text-xs">{downPaid ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Lock className="w-4 h-4 text-muted-foreground" />}공장 발주 및 생산 시작</span><Button size="sm" disabled={!downPaid || status === 'PRODUCTION' || status === 'DONE' || move.isPending} onClick={() => move.mutate({ status: 'PRODUCTION', event: 'PRODUCTION_STARTED', details: '선금 승인 후 생산 착수' })}>{status === 'PRODUCTION' || status === 'DONE' ? '착수 완료' : '생산 시작'}</Button></div>
    <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2"><span className="flex items-center gap-2 text-xs">{shipmentReady ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Lock className="w-4 h-4 text-muted-foreground" />}최종 물품 출고 및 납품 완료</span><Button size="sm" disabled={!shipmentReady || status === 'DONE' || move.isPending} onClick={() => move.mutate({ status: 'DONE', event: 'SHIPMENT_COMPLETED', details: '수금률 100% 확인 후 출고 완료' })}>{status === 'DONE' ? '출고 완료' : '출고 완료 처리'}</Button></div>
    {!shipmentReady && user?.role === 'admin' && <div className="space-y-2 border-t pt-3"><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="강제 출고 승인 사유" className="text-xs" />{error && <p className="text-xs text-destructive">{error}</p>}<Button variant="destructive" size="sm" onClick={override} disabled={move.isPending}>강제 출고 승인</Button></div>}
  </section>;
}