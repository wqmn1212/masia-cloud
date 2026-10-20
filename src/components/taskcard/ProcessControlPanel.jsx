import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { FACTORY_CHECK_STATE } from '@/lib/factoryCheck';

export default function ProcessControlPanel({ card, user }) {
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const client = useQueryClient(); const { toast } = useToast();
  const stages = useQuery({ queryKey: ['payment-stages', card.id], queryFn: () => base44.entities.PaymentStage.filter({ card_id: card.id }) });
  const current = useQuery({ queryKey: ['process-card', card.id], queryFn: () => base44.entities.TaskCard.get(card.id) });
  const approved = (stages.data || []).filter(x => x.approval_status === 'APPROVED');
  // 공장이 지정된 카드는 공장 확인 카드가 끝나야 생산 착수 (무역회사·가짜 공장 방지)
  const factory = useQuery({ queryKey: ['card-factory', card.factory_id], queryFn: () => base44.entities.Company.get(card.factory_id), enabled: !!card.factory_id });
  const factoryStatus = factory.data?.verification_status || 'NONE';
  const factoryOk = !card.factory_id || factoryStatus === 'VERIFIED';
  const downPaid = approved.some(x => x.stage_type === 'DOWN_PAYMENT'); const rate = approved.reduce((sum, x) => sum + Number(x.percentage || 0), 0); const shipmentReady = rate >= 100;
  const move = useMutation({ mutationFn: async ({ status, event, details }) => { await base44.entities.TaskCard.update(card.id, { status }); await base44.entities.ProjectAuditLog.create({ card_id: card.id, event_type: event, actor_id: user?.id || '', actor_name: user?.full_name || user?.email || '', details }); base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'card_moved' }).catch(() => {}); }, onSuccess: () => { client.invalidateQueries({ queryKey: ['task-cards'] }); client.invalidateQueries({ queryKey: ['process-card', card.id] }); setReason(''); setError(''); toast({ title: '공정 상태가 업데이트되었습니다' }); } });
  const override = () => { if (!reason.trim()) return setError('강제 출고 사유를 입력하세요.'); move.mutate({ status: 'DONE', event: 'SHIPMENT_OVERRIDDEN', details: `강제 출고 승인: ${reason}` }); };
  const status = current.data?.status || card.status;
  return <section className="mt-5 space-y-3 rounded-xl border p-3"><div><h3 className="text-sm font-semibold">공정 연동 및 출고 제어</h3><p className="text-xs text-muted-foreground">승인 수금률 {Math.min(rate, 100)}%</p></div>
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 p-2"><span className="flex items-center gap-2 text-xs">{factoryOk ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Lock className="w-4 h-4 text-muted-foreground" />}{card.factory_id ? `공장 확인 카드 · ${FACTORY_CHECK_STATE[factoryStatus].label}` : '공장 미지정 (공장 확인 건너뜀)'}</span>{card.factory_id && !factoryOk && <a href={`/factories/${card.factory_id}/dashboard`} className="shrink-0 text-xs text-primary hover:underline">확인하러 가기</a>}</div>
    <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2"><span className="flex items-center gap-2 text-xs">{downPaid && factoryOk ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Lock className="w-4 h-4 text-muted-foreground" />}공장 발주 및 생산 시작</span><Button size="sm" disabled={!downPaid || !factoryOk || status === 'PRODUCTION' || status === 'DONE' || move.isPending} onClick={() => move.mutate({ status: 'PRODUCTION', event: 'PRODUCTION_STARTED', details: card.factory_id ? '선금 승인·공장 확인 후 생산 착수' : '선금 승인 후 생산 착수' })}>{status === 'PRODUCTION' || status === 'DONE' ? '착수 완료' : '생산 시작'}</Button></div>
    <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2"><span className="flex items-center gap-2 text-xs">{shipmentReady ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Lock className="w-4 h-4 text-muted-foreground" />}최종 물품 출고 및 납품 완료</span><Button size="sm" disabled={!shipmentReady || status === 'DONE' || move.isPending} onClick={() => move.mutate({ status: 'DONE', event: 'SHIPMENT_COMPLETED', details: '수금률 100% 확인 후 출고 완료' })}>{status === 'DONE' ? '출고 완료' : '출고 완료 처리'}</Button></div>
    {!shipmentReady && user?.role === 'admin' && <div className="space-y-2 border-t pt-3"><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="강제 출고 승인 사유" className="text-xs" />{error && <p className="text-xs text-destructive">{error}</p>}<Button variant="destructive" size="sm" onClick={override} disabled={move.isPending}>강제 출고 승인</Button></div>}
  </section>;
}