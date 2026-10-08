import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { UserRound } from 'lucide-react';
import { todayStr } from '@/lib/milestones';
import { useWorkT } from '@/lib/workI18n';

// 카드 책임자(대표·팀 관리자만 지정) · 다음 할 일 · 기한
export default function CardOwnerBar({ card, user }) {
  const qc = useQueryClient();
  const { tr } = useWorkT();
  const canAssign = ['master', 'service'].includes(user?.account_tier);
  const [next, setNext] = useState(card.next_action || '');
  const [due, setDue] = useState(card.next_action_due || '');
  useEffect(() => { setNext(card.next_action || ''); setDue(card.next_action_due || ''); }, [card.id, card.next_action, card.next_action_due]);
  const { data: team = [] } = useQuery({
    queryKey: ['milestone-team', card.id], enabled: canAssign,
    queryFn: async () => (await base44.functions.invoke('cardMilestoneAction', { action: 'team', card_id: card.id })).data.users || [],
  });
  const save = async (patch) => {
    await base44.entities.TaskCard.update(card.id, patch);
    qc.invalidateQueries({ queryKey: ['task-cards'] });
  };
  const setOwner = async (owner_id) => {
    await base44.functions.invoke('cardMilestoneAction', { action: 'set_card_owner', card_id: card.id, owner_id: owner_id || null });
    qc.invalidateQueries({ queryKey: ['task-cards'] });
  };
  const overdue = due && due < todayStr();
  return (
    <div className="border rounded-lg p-2.5 mt-3 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2 text-xs">
        <UserRound className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{tr('책임자')}</span>
        {canAssign ? (
          <select value={card.owner_id || ''} onChange={(e) => setOwner(e.target.value)} className="h-7 rounded-md border border-input bg-transparent text-xs px-1">
            <option value="">{tr('미지정')}</option>
            {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        ) : <span className="font-medium">{card.owner_name || tr('미지정')}</span>}
      </div>
      <div className="flex gap-2">
        <Input value={next} onChange={(e) => setNext(e.target.value)} onBlur={() => next !== (card.next_action || '') && save({ next_action: next })} placeholder={tr('다음 할 일')} className="h-8 text-xs flex-1" />
        <Input type="date" value={due} onChange={(e) => { setDue(e.target.value); save({ next_action_due: e.target.value || null }); }} className={`h-8 text-xs w-36 ${overdue ? 'text-destructive' : ''}`} />
      </div>
    </div>
  );
}