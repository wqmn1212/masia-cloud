import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import CardModal from '@/components/taskcard/CardModal';
import MyWorkCardRow from '@/components/mywork/MyWorkCardRow';

import { todayStr as today } from '@/lib/milestones';
import { useWorkT } from '@/lib/workI18n';

export default function MyWork() {
  const { tr } = useWorkT();
  const [user, setUser] = useState(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser); }, []);
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['task-cards', 'mine', user?.id],
    queryFn: () => base44.entities.TaskCard.filter({ owner_id: user.id }, 'next_action_due', 200),
    enabled: !!user,
  });
  const active = cards.filter((c) => !['DONE', 'CANCELLED'].includes(c.status));
  const t = today();
  const overdue = active.filter((c) => (c.next_action_due && c.next_action_due < t) || c.delay_days > 0 || c.overdue_steps > 0);
  const rest = active.filter((c) => !overdue.includes(c));

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold">{tr('내 업무')}</h1>
        <p className="text-sm text-muted-foreground">{tr('내가 책임자인 진행 중 카드')} {active.length}{tr('건')}</p>
      </div>
      {isLoading || !user ? (
        <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : !active.length ? (
        <p className="text-sm text-muted-foreground text-center py-12 border rounded-lg">{tr('맡은 카드가 없습니다. 카드 상세에서 책임자로 지정되면 여기에 보입니다.')}</p>
      ) : (
        <>
          {overdue.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-destructive">{tr('기한 지남 · 지연')} {overdue.length}</p>
              {overdue.map((c) => <MyWorkCardRow key={c.id} card={c} onOpen={setSelected} />)}
            </section>
          )}
          <section className="space-y-2">
            <p className="text-sm font-semibold">{tr('진행 중')} {rest.length}</p>
            {rest.map((c) => <MyWorkCardRow key={c.id} card={c} onOpen={setSelected} />)}
          </section>
        </>
      )}
      {selected && <CardModal card={selected} open onClose={() => setSelected(null)} />}
    </div>
  );
}