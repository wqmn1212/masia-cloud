import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

// 내부 카드: 생산 기간과 겹친 휴무 목록 + 확인 후 고객 안내
export default function HolidayConflictPanel({ card }) {
  const qc = useQueryClient(), { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const conflicts = card.holiday_conflicts || [];
  if (!conflicts.length) return null;
  const pending = conflicts.filter((c) => c.kind === 'holiday' && !c.client_notified_at);
  const notify = async () => {
    if (!window.confirm(`예정 납품일 ${card.delivery_date || '미정'} 기준으로 고객에게 안내합니다. 납기 조정을 먼저 저장하셨나요?`)) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('manageCardCollaboration', { action: 'notify_holiday', card_id: card.id });
      toast({ title: '고객 안내 완료', description: `${res.data.sent}명에게 알림을 보냈습니다.` });
      await qc.invalidateQueries({ queryKey: ['card-schedule', card.id] });
    } catch (e) {
      toast({ title: '안내 실패', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    }
    setBusy(false);
  };
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
      <p className="text-sm font-semibold text-amber-800">생산 기간 휴무 겹침</p>
      {conflicts.map((c) => (
        <div key={c.source_id} className="flex flex-wrap items-center gap-2 text-sm text-amber-900">
          <Badge variant="outline">{c.kind === 'holiday' ? '중국 공휴일' : '공장 휴무(고객 비공개)'}</Badge>
          <span>{c.name} {c.start} ~ {c.end}</span>
          {c.client_notified_at && <span className="text-xs text-muted-foreground">고객 안내 완료</span>}
        </div>
      ))}
      {pending.length > 0 && <div className="flex justify-end"><Button size="sm" onClick={notify} disabled={busy || card.client_visible !== true}>{busy ? '보내는 중...' : '고객에게 안내'}</Button></div>}
      {pending.length > 0 && card.client_visible !== true && <p className="text-xs text-muted-foreground">고객 공개 카드만 안내할 수 있습니다.</p>}
    </div>
  );
}