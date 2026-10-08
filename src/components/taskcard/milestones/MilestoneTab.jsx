import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import useCardMilestones from './useCardMilestones';
import MilestonePlanCreator from './MilestonePlanCreator';
import MilestoneRow from './MilestoneRow';
import MilestoneCompleteDialog from './MilestoneCompleteDialog';
import { MILESTONE_TEMPLATES, delayDays, deliveryMilestone } from '@/lib/milestones';
import { useWorkT } from '@/lib/workI18n';

export default function MilestoneTab({ card, user }) {
  const { list, isLoading, create, update, confirm, complete, reset, team } = useCardMilestones(card);
  const { tr } = useWorkT();
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(null);
  const { toast } = useToast();
  const canManage = ['master', 'service'].includes(user?.account_tier);
  const run = async (fn) => { setBusy(true); await fn(); setBusy(false); };

  if (isLoading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!list.length) return canManage
    ? <MilestonePlanCreator busy={busy} onCreate={(t, s, opt) => run(() => create(t, s, opt))} />
    : <p className="text-sm text-muted-foreground text-center py-8">{tr('아직 마일스톤 계획이 없습니다.')}</p>;

  const confirmed = !!card.plan_confirmed_at;
  const delay = Math.max(0, delayDays(deliveryMilestone(list)));
  const doneCount = list.filter((m) => m.status === 'done').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-semibold">{tr(MILESTONE_TEMPLATES[list[0].template_key]?.name || '마일스톤')}</p>
        <span className="text-xs text-muted-foreground">{doneCount}/{list.length} {tr('완료')}</span>
        {delay > 0 && <span className="text-xs font-semibold text-destructive">{tr('납품')} +{delay}{tr('일')}</span>}
        <div className="flex-1" />
        {canManage && !confirmed && <Button size="sm" className="h-7 text-xs gap-1" disabled={busy} onClick={() => run(async () => { await confirm(); toast({ title: tr('계획을 확정했습니다') }); })}><Lock className="w-3 h-3" />{tr('계획 확정')}</Button>}
        {canManage && <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" disabled={busy} onClick={() => window.confirm(tr(confirmed ? '확정된 계획은 고객에게 이미 보인 일정입니다. 지우면 고객 화면에서도 사라지고, 예정 납품일은 계획 전 값으로 되돌아가며 변경 이력이 남습니다. 계속할까요?' : '마일스톤을 모두 지우고 다시 만들까요?')) && run(reset)}><RotateCcw className="w-3 h-3" />{tr('다시 만들기')}</Button>}
      </div>
      {!confirmed && <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">{tr('계획 확정 전입니다. 날짜·담당자를 조정한 뒤 확정하면 기준일이 잠기고 지연이 계산됩니다.')}</p>}
      <div className="space-y-2">
        {list.map((m) => <MilestoneRow key={m.id} m={m} confirmed={confirmed} onChange={update} onComplete={setCompleting} canManage={canManage} userId={user?.id} team={team} />)}
      </div>
      <MilestoneCompleteDialog milestone={completing} cardId={card.id} onClose={() => setCompleting(null)}
        onConfirm={async (actual, shift, qcId) => { if (await complete(completing, actual, shift, qcId)) setCompleting(null); }} />
    </div>
  );
}