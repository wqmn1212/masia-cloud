import React, { useState } from 'react';
import PaymentConfirmationDialog from '@/components/taskcard/PaymentConfirmationDialog';
import PaymentRequestDialog from '@/components/taskcard/PaymentRequestDialog';
import CollaborationHistory from '@/components/taskcard/CollaborationHistory';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import PaymentTermsEditor from '@/components/taskcard/PaymentTermsEditor';
import CardFactoryPayment from '@/components/taskcard/CardFactoryPayment';
import useCardAttachments from '@/components/files/useCardAttachments';
import DocChips from '@/components/files/DocChips';
import { REMITTANCE_FOR_STAGE } from '@/components/files/documentTypes';

const LABELS = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };
const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const daysLeft = (ymd) => Math.round((Date.parse(ymd) - Date.parse(kstToday())) / 86400000);
// 결제 요청 상태 한 줄: 요청 전에는 비우고, 요청됨(기한)·고객 송금 알림을 보여 준다
function RequestLine({ stage }) {
  if (stage.approval_status === 'APPROVED' || !stage.requested_at) return null;
  if (stage.client_reported_paid_at) {
    return <p className="w-full text-[11px] text-primary">고객 송금 알림 · 송금일 {stage.client_reported_paid_date} ({stage.client_reported_by_name}){stage.client_report_note ? ` · ${stage.client_report_note}` : ''} — 통장 입금을 확인한 뒤 입금 확인을 누르세요</p>;
  }
  const left = stage.due_date ? daysLeft(stage.due_date) : null;
  return <p className={`w-full text-[11px] ${left != null && left < 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>결제 요청 보냄 · {stage.currency} {Number(stage.amount).toLocaleString('ko-KR')} · 기한 {stage.due_date}{left != null ? (left < 0 ? ` (${-left}일 지남)` : left === 0 ? ' (오늘)' : ` (${left}일 남음)`) : ''} · {stage.payee === 'FACTORY' ? '공장 계좌' : '이지스 계좌'}{stage.requested_by_name ? ` · ${stage.requested_by_name}` : ''}</p>;
}
export default function PaymentGatePanel({ card, user }) {
  const client = useQueryClient(); const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const [requesting, setRequesting] = useState(null);
  const query = useQuery({ queryKey: ['payment-stages', card.id], queryFn: () => base44.entities.PaymentStage.filter({ card_id: card.id }) });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['payment-stages', card.id] });
    client.invalidateQueries({ queryKey: ['payment-stages-all'] });
    client.invalidateQueries({ queryKey: ['card-schedule', card.id] });
    client.invalidateQueries({ queryKey: ['collaboration-history', card.id] });
    client.invalidateQueries({ queryKey: ['client-card-detail', card.id] });
    client.invalidateQueries({ queryKey: ['task-cards'] });
    client.invalidateQueries({ queryKey: ['ledgers'] });
    client.invalidateQueries({ queryKey: ['ledger-by-card', card.id] });
    client.invalidateQueries({ queryKey: ['admin-inbox'] });
  };
  const initialize = useMutation({ mutationFn: () => base44.functions.invoke('manageCardCollaboration', { action: 'initialize', card_id: card.id }), onSuccess: refresh });
  const approve = useMutation({ mutationFn: ({ stage, reason, paid_date }) => base44.functions.invoke('manageCardCollaboration', { action: 'payment', card_id: card.id, stage_id: stage.id, expected_updated_date: stage.updated_date, confirmed: stage.approval_status !== 'APPROVED', reason, paid_date }), onSuccess: () => { refresh(); setSelected(null); toast({ title: '입금 상태 저장 완료', description: '수금률과 정산 대시보드에 반영되었습니다. 고객 알림은 변경 이력에서 확인하세요.' }); }, onError: refresh });
  const stages = query.data || [];
  // 단계별 송금확인증 (무역서류 '송금확인증 (선금/잔금)' 또는 고객이 직접 올린 것)
  const { data: attachments = [] } = useCardAttachments(card.id);
  const receiptsOf = (stage) => attachments.filter(a => a.document_type === REMITTANCE_FOR_STAGE[stage.stage_type]);
  const canApprove = ['master', 'service', 'sub'].includes(user?.account_tier);
  return <section className="mb-5 space-y-3 rounded-xl border p-3"><div><h3 className="text-sm font-semibold">결제 요청·입금 확인</h3><p className="text-xs text-muted-foreground">결제 요청은 금액·기한·받는 계좌를 고객 포털 결제 탭에 보냅니다. 입금 확인은 직원만 확인·취소·재확정할 수 있고, 변경 시각과 처리자는 이력에 남습니다.</p></div>
    {query.isLoading ? <p className="text-sm">불러오는 중...</p> : query.isError ? <p role="alert" className="text-sm text-destructive">입금 단계를 불러오지 못했습니다.</p> : !stages.length ? (canApprove ? <Button size="sm" onClick={() => initialize.mutate()} disabled={initialize.isPending}>기본 선금 50% · 잔금 50% 설정</Button> : <p className="text-xs text-muted-foreground">아직 결제 단계가 설정되지 않았습니다.</p>) : <><PaymentTermsEditor stages={stages} onSaved={() => { refresh(); toast({ title: '선금·잔금 비율 저장 완료' }); }} />{stages.map(stage => <div key={stage.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 p-2"><div className="text-xs flex-1"><span className="font-medium">{LABELS[stage.stage_type]}</span> · {stage.percentage}%{stage.amount ? ` · ${stage.currency || ''} ${Number(stage.amount).toLocaleString('ko-KR')}` : ''}{stage.paid_date && <span className="ml-2 text-muted-foreground">입금일 {stage.paid_date}</span>}</div>{REMITTANCE_FOR_STAGE[stage.stage_type] && (receiptsOf(stage).length ? <DocChips docs={receiptsOf(stage)} max={2} /> : <span className={`text-[11px] ${stage.approval_status === 'APPROVED' ? 'text-chart-3' : 'text-muted-foreground'}`}>송금확인증 없음</span>)}<Badge variant={stage.approval_status === 'APPROVED' ? 'default' : 'secondary'}>{stage.approval_status === 'APPROVED' ? '입금 확인' : stage.client_reported_paid_at ? '고객 송금 알림' : stage.requested_at ? '결제 요청 중' : '확인 대기'}</Badge>{canApprove && stage.approval_status !== 'APPROVED' && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRequesting(stage)}>{stage.requested_at ? '요청 고치기' : '결제 요청'}</Button>}{canApprove && <Button size="sm" variant="outline" className="h-7 text-xs" disabled={approve.isPending} onClick={() => { approve.reset(); setSelected(stage); }}>{stage.approval_status === 'APPROVED' ? '확인 취소' : '입금 확인'}</Button>}<RequestLine stage={stage} /></div>)}</>}
    {initialize.isError && <p role="alert" className="text-sm text-destructive">{initialize.error?.response?.data?.error || '결제 단계 설정에 실패했습니다.'}</p>}
    <PaymentConfirmationDialog stage={selected} onClose={() => setSelected(null)} onConfirm={data => approve.mutate(data)} pending={approve.isPending} error={approve.error} />
    <PaymentRequestDialog card={card} stage={requesting} onClose={() => setRequesting(null)} onSaved={(action, data) => { refresh(); toast({ title: action === 'payment_request_cancel' ? '결제 요청을 취소했습니다' : '결제 요청을 보냈습니다', description: action === 'payment_request_cancel' ? '고객 화면에서 요청이 사라집니다.' : data?.skipped === 'not_shared' ? '고객에게 공개되지 않은 카드라 알림은 가지 않았습니다.' : `고객 ${data?.sent ?? 0}명에게 메일·앱 알림을 보냈습니다.` }); }} />
    <CardFactoryPayment card={card} />
    <CollaborationHistory cardId={card.id} />
  </section>;
}