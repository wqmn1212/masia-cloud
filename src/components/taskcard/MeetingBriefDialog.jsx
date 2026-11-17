import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Printer, CalendarPlus, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { buildMeetingBrief, briefAgenda, briefHtml, BRIEF_GROUPS } from '@/lib/meetingBrief';
import { callRequest } from '@/components/requests/ClientRequestPanel';

const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// 고객 미팅 전에 카드 한 장의 현황을 브리프 한 장으로: 물어볼 것·답할 것·지난 결정·다가오는 일정
export default function MeetingBriefDialog({ card, signals = [], open, onOpenChange, onGo }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);
  const today = kstToday();
  const { data, isLoading } = useQuery({
    queryKey: ['meeting-brief', card.id],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const E = base44.entities;
      const safe = (p) => p.catch(() => []);
      const [logs, tasks, decisions, milestones, requests] = await Promise.all([
        safe(E.MeetingLog.filter({ card_id: card.id }, '-meeting_date', 5)),
        safe(E.TaskItem.filter({ card_id: card.id }, 'due_date', 100)),
        safe(E.DecisionLog.filter({ card_id: card.id }, '-decided_at', 20)),
        safe(E.CardMilestone.filter({ card_id: card.id }, 'seq', 50)),
        callRequest({ action: 'list', card_id: card.id }).then((r) => r.requests || []).catch(() => []),
      ]);
      return { logs, tasks, decisions, milestones, requests };
    },
  });
  const brief = useMemo(() => (data ? buildMeetingBrief({ card, ...data, signals, today }) : null), [data, card, signals, today]);
  const by = user?.full_name || user?.email || '';

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) { toast({ title: '새 창이 막혔습니다', description: '팝업을 허용한 뒤 다시 눌러 주세요', variant: 'destructive' }); return; }
    w.document.write(briefHtml(brief, { date: today, by }));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`미팅 준비 · ${brief.title}\n\n${briefAgenda(brief)}`); toast({ title: '안건을 복사했습니다' }); }
    catch { toast({ title: '복사하지 못했습니다', variant: 'destructive' }); }
  };
  const start = async () => {
    setStarting(true);
    try {
      await base44.entities.MeetingLog.create({ tenant_id: card.tenant_id, card_id: card.id, meeting_date: today, meeting_type: 'OFFLINE', title: `${card.client_name ? `${card.client_name} ` : ''}미팅 · ${today}`, notes: briefAgenda(brief), created_by_name: by });
      await qc.invalidateQueries({ queryKey: ['meeting-logs', card.id] });
      toast({ title: '미팅 기록을 만들었습니다', description: '안건이 논의 내용에 들어가 있습니다. 미팅 중에 바로 고쳐 쓰세요.' });
      onOpenChange(false);
      onGo?.('talk#card-meetings');
    } catch (e) { toast({ title: '만들지 못했습니다', description: e.message, variant: 'destructive' }); }
    setStarting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>미팅 준비 · {card.title}</DialogTitle></DialogHeader>
        {isLoading || !brief ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <div className="space-y-4">
            <p className="text-caption text-muted-foreground">
              {[brief.client && `고객 ${brief.client}`, brief.due && `납기 ${brief.due}`, brief.last ? `지난 미팅 ${brief.last.date} · ${brief.last.title || ''}` : '지난 미팅 기록 없음'].filter(Boolean).join(' · ')}
            </p>
            {brief.requirements && <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-caption">{brief.requirements}</p>}
            {brief.empty && <p className="text-body text-muted-foreground">챙길 안건이 없습니다. 업무·자료 요청·일정이 쌓이면 여기에 모입니다.</p>}
            {BRIEF_GROUPS.map((g) => (
              <section key={g.key} aria-label={g.label} className="space-y-1">
                <h3 className="text-label font-semibold">{g.label} <span className="font-normal text-muted-foreground">{brief[g.key].length}</span></h3>
                {brief[g.key].length === 0 ? <p className="text-caption text-muted-foreground">없음</p> : (
                  <ul className="divide-y rounded-lg border">
                    {brief[g.key].map((x, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-body">
                        <span className={x.late ? 'text-destructive' : ''}>{x.text}{x.required && <span className="text-destructive"> *</span>}</span>
                        {x.note && <span className="text-caption text-muted-foreground">{x.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <Button variant="outline" size="sm" onClick={copy}><Copy className="h-4 w-4" />안건 복사</Button>
              <Button variant="outline" size="sm" onClick={print}><Printer className="h-4 w-4" />인쇄·PDF</Button>
              <Button size="sm" onClick={start} disabled={starting}>{starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}이 안건으로 미팅 기록 시작</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
