import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
const statusLabels = { PENDING: '메일 발송 대기', SENDING: '메일 발송 중', SENT: '메일 발송 완료', FAILED: '메일 발송 보류', SKIPPED: '메일 발송 제외' };
export default function CollaborationHistory({ cardId }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['collaboration-history', cardId], queryFn: () => base44.entities.CollaborationChange.filter({ card_id: cardId }, '-created_date', 20) });
  const retry = useMutation({ mutationFn: id => base44.functions.invoke('manageCardCollaboration', { action: 'retry_email', card_id: cardId, change_id: id }), onSuccess: () => qc.invalidateQueries({ queryKey: ['collaboration-history', cardId] }) });
  React.useEffect(() => base44.entities.CollaborationChange.subscribe(event => { if (event.data?.card_id === cardId) qc.invalidateQueries({ queryKey: ['collaboration-history', cardId] }); }), [cardId, qc]);
  return <section className="mt-4 space-y-3 border-t pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">일정·입금 변경 이력 (최근 20건)</h3><Button type="button" size="sm" variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>새로고침</Button></div>
    <p className="text-xs text-muted-foreground">저장과 이메일 발송은 별도로 처리됩니다. 크레딧 부족 등으로 보류된 메일은 복구 후 재발송하세요. 이미 발송된 수신자는 제외합니다.</p>
    {query.isLoading ? <p className="text-sm">불러오는 중...</p> : query.isError ? <p role="alert" className="text-sm text-destructive">변경 이력을 불러오지 못했습니다.</p> : !query.data?.length ? <p className="text-sm text-muted-foreground">변경 이력이 없습니다.</p> : query.data.map(change => <article key={change.id} className="rounded-lg border p-3 space-y-1">
      <p className="text-xs text-muted-foreground">{new Date(change.created_date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · {change.actor_name}</p><p className="whitespace-pre-wrap text-sm">{change.body}</p><p className="text-xs">사유: {change.reason || '미입력'}</p>
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{statusLabels[change.email_status]}</span>{['PENDING', 'FAILED'].includes(change.email_status) && <Button type="button" size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(change.id)}>메일 발송 재시도</Button>}</div>
      {change.email_error && <p className="text-xs text-muted-foreground break-words">{change.email_error}</p>}
    </article>)}
    {retry.isError && <p role="alert" className="text-xs text-destructive">{retry.error?.response?.data?.error || '재발송 요청에 실패했습니다.'}</p>}
  </section>;
}