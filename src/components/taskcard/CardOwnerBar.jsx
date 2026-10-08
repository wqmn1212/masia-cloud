import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserRound } from 'lucide-react';

// 카드 책임자 · 다음 할 일 · 기한
export default function CardOwnerBar({ card, user }) {
  const qc = useQueryClient();
  const [next, setNext] = useState(card.next_action || '');
  const [due, setDue] = useState(card.next_action_due || '');
  useEffect(() => { setNext(card.next_action || ''); setDue(card.next_action_due || ''); }, [card.id, card.next_action, card.next_action_due]);
  const save = async (patch) => {
    await base44.entities.TaskCard.update(card.id, patch);
    qc.invalidateQueries({ queryKey: ['task-cards'] });
  };
  const overdue = due && due < new Date().toISOString().slice(0, 10);
  const isMine = user && card.owner_id === user.id;
  return (
    <div className="border rounded-lg p-2.5 mt-3 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2 text-xs">
        <UserRound className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">책임자</span>
        <span className="font-medium">{card.owner_name || '미지정'}</span>
        {user && !isMine && <Button size="sm" variant="outline" className="h-6 text-[11px] ml-auto" onClick={() => save({ owner_id: user.id, owner_name: user.full_name || user.email })}>내가 맡기</Button>}
        {isMine && <Button size="sm" variant="ghost" className="h-6 text-[11px] ml-auto" onClick={() => save({ owner_id: null, owner_name: null })}>해제</Button>}
      </div>
      <div className="flex gap-2">
        <Input value={next} onChange={(e) => setNext(e.target.value)} onBlur={() => next !== (card.next_action || '') && save({ next_action: next })} placeholder="다음 할 일" className="h-8 text-xs flex-1" />
        <Input type="date" value={due} onChange={(e) => { setDue(e.target.value); save({ next_action_due: e.target.value || null }); }} className={`h-8 text-xs w-36 ${overdue ? 'text-destructive' : ''}`} />
      </div>
    </div>
  );
}