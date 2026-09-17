import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { CLIENT_STATUS_LABEL, CLIENT_PRIORITY } from './clientBoardMeta';
import ScheduleSummary from '@/components/taskcard/ScheduleSummary';
import BilingualField from '@/components/language/BilingualField';
import { editBilingual } from '@/lib/saveBilingual';

// 고객이 편집 가능한 필드는 요구사항(hq_requirements) 하나뿐이다. 나머지는 읽기 전용.
export default function ClientOverviewPanel({ card }) {
  const [draft, setDraft] = useState({ hq_requirements: card.hq_requirements || '', hq_requirements_cn: card.hq_requirements_cn || '', __bilingualDirty: {} });
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => setDraft({ hq_requirements: card.hq_requirements || '', hq_requirements_cn: card.hq_requirements_cn || '', __bilingualDirty: {} }), [card.id, card.hq_requirements, card.hq_requirements_cn]);

  const save = useMutation({
    mutationFn: () => base44.functions.invoke('clientCardAction', {
      card_id: card.id, action: 'update_requirements',
      ...Object.fromEntries(Object.keys(draft.__bilingualDirty).map(key => [key, draft[key]])),
    }),
    onError: error => toast({ title: '저장 실패 / 保存失败', description: error.message, variant: 'destructive' }),
    onSuccess: (res) => {
      if (res.data?.translation_failed) { window.dispatchEvent(new CustomEvent('translation-unavailable')); toast({ title: '원문 저장됨 / 原文已保存', description: '자동 번역 미완료 / 自动翻译未完成' }); }
      qc.invalidateQueries({ queryKey: ['client-card-detail', card.id] });
      qc.invalidateQueries({ queryKey: ['client-cards'] });
      if (!res.data?.translation_failed) toast({ title: '요구사항이 저장되었습니다' });
    },
  });

  const p = CLIENT_PRIORITY[card.priority] || CLIENT_PRIORITY.MEDIUM;

  return (
    <div className="space-y-4">
      <ScheduleSummary card={card} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{CLIENT_STATUS_LABEL[card.status] || card.status}</Badge>
        <Badge className={`${p.className} border-0`}>{p.label}</Badge>
        {card.due_date && <span className="text-xs text-muted-foreground">목표일 {card.due_date}</span>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold">요구사항</label>
          <span className="text-[11px] text-muted-foreground">이 항목만 수정할 수 있습니다</span>
        </div>
        <BilingualField record={draft} field="hq_requirements" multiline rows={10} disabled={save.isPending} onChange={(key, value) => setDraft(prev => editBilingual(prev, key, value))} />
        <div className="flex justify-end mt-2">
          <Button size="sm" disabled={save.isPending || !Object.keys(draft.__bilingualDirty).length} onClick={() => save.mutate()}>
            {save.isPending ? '저장 중...' : '요구사항 저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}