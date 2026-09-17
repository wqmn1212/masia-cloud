import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ScheduleFields from '@/components/taskcard/ScheduleFields';
import CollaborationHistory from '@/components/taskcard/CollaborationHistory';
import { useToast } from '@/components/ui/use-toast';
export default function CardSchedulePanel({ card, user }) {
  const qc = useQueryClient(), { toast } = useToast();
  const query = useQuery({ queryKey: ['card-schedule', card.id], queryFn: () => base44.entities.TaskCard.get(card.id) });
  const [form, setForm] = React.useState(null), [reason, setReason] = React.useState(''), [version, setVersion] = React.useState('');
  React.useEffect(() => { if (!query.data || form) return; const c = query.data; setForm({ quote_deadline: c.quote_deadline || '', advance_paid_date: c.advance_paid_date || '', delivery_business_days: c.delivery_business_days ?? 5, delivery_date: c.delivery_date || '', delivery_date_mode: c.delivery_date_mode || 'AUTO' }); setVersion(c.updated_date); }, [query.data, form]);
  const save = useMutation({ mutationFn: () => base44.functions.invoke('manageCardCollaboration', { action: 'schedule', card_id: card.id, data: form, reason, expected_updated_date: version }), onSuccess: async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['card-schedule', card.id] }), qc.invalidateQueries({ queryKey: ['task-cards'] }), qc.invalidateQueries({ queryKey: ['collaboration-history', card.id] }), qc.invalidateQueries({ queryKey: ['client-card-detail', card.id] })]); setForm(null); setReason(''); toast({ title: '일정 저장 완료', description: '고객 공개 카드의 변경 메일은 발송 대기열에 기록됩니다.' }); } });
  const allowed = ['master', 'service', 'sub'].includes(user?.account_tier);
  return <section className="space-y-4"><h3 className="text-sm font-semibold">견적·납품 일정 관리</h3>
    {query.isError ? <p className="text-destructive" role="alert">일정을 불러오지 못했습니다.</p> : !form ? <p>불러오는 중...</p> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <ScheduleFields form={form} setForm={setForm} disabled={!allowed || save.isPending} />
      <label className="block text-sm">변경 사유<Input value={reason} onChange={e => setReason(e.target.value)} required maxLength={1000} disabled={save.isPending || !allowed} placeholder="예: 고객 요청 납기 변경" /></label>
      <p className="text-xs text-muted-foreground">고객 공개가 켜진 카드만 해당 고객사 담당자에게 변경 전·후 날짜와 사유를 알립니다.</p>
      {save.isError && <p role="alert" className="text-sm text-destructive">{save.error?.response?.data?.error || '저장에 실패했습니다.'}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={async () => { await query.refetch(); setForm(null); save.reset(); }}>최신 내용 다시 불러오기</Button><Button type="submit" disabled={!allowed || save.isPending}>{save.isPending ? '저장 중...' : '일정 저장'}</Button></div>
    </form>}
    <CollaborationHistory cardId={card.id} />
  </section>;
}