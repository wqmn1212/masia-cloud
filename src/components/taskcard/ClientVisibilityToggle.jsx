import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

// 카드별 고객 공개 수동 토글. 켜는 순간 고객에게 card_shared 알림이 발송된다.
export default function ClientVisibilityToggle({ card }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const toggle = useMutation({
    mutationFn: async (next) => {
      await base44.entities.TaskCard.update(card.id, { client_visible: next });
      if (next) await base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'card_shared' });
    },
    onSuccess: (_d, next) => {
      qc.invalidateQueries({ queryKey: ['task-cards'] });
      toast({ title: next ? '고객에게 공개되었습니다' : '고객 공개를 해제했습니다' });
    },
  });

  const on = card.client_visible === true;
  const linked = !!card.client_id;

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      {on ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">고객 포털 공개</p>
        <p className="text-[11px] text-muted-foreground">
          {linked
            ? '켜면 고객사 담당자가 이 카드의 진행 단계 · 견적서 · 문의를 볼 수 있습니다'
            : '고객사가 연결되지 않았습니다. 문의 접수에서 고객사 팀을 먼저 발급하세요'}
        </p>
      </div>
      <Switch checked={on} disabled={!linked || toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} />
    </div>
  );
}