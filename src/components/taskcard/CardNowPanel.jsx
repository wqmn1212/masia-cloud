import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2, CheckCircle2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MeetingBriefDialog from './MeetingBriefDialog';
import CardProtoPanel from './CardProtoPanel';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { SECTIONS, SECTION_LABEL } from '@/lib/opsDigest';
import { signalTarget, STAGE_GUIDE, CARD_TABS } from '@/lib/cardTabs';

const TONE = { due_today: 'text-primary', risk: 'text-destructive', client_wait: 'text-warning-text', factory_wait: 'text-warning-text', to_check: 'text-primary', opportunity: 'text-primary' };
const STAGES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'PRODUCTION', 'DONE'];
const STAGE_LABEL = { TODO: ['대기', '待处理'], IN_PROGRESS: ['소싱', '寻源'], REVIEW: ['견적 검토', '报价审核'], PRODUCTION: ['발주·제작', '下单·生产'], DONE: ['완료', '完成'] };

// '지금' 탭 맨 위: 이 카드의 단계, 지금 챙길 일(아침 요약과 같은 계산, 책임자와 상관없이), 관련 시제품. 줄을 누르면 그 일을 하는 탭으로 간다
export default function CardNowPanel({ card, isStaff, onGo }) {
  const { lang } = useLanguage();
  const [brief, setBrief] = useState(false);
  const zh = lang === 'zh';
  const { data, isLoading } = useQuery({ queryKey: ['card-now', card.id], queryFn: async () => (await base44.functions.invoke('getOpsDigest', { card_id: card.id })).data, enabled: isStaff, staleTime: 30_000 });
  const digest = data?.digest;
  const rows = digest ? SECTIONS.flatMap((k) => (digest.sections[k] || []).map((r) => ({ ...r, k }))) : [];
  const stage = STAGES.includes(card.status) ? card.status : 'TODO';
  const guide = STAGE_GUIDE[stage];
  const tabLabel = (v) => { const t = CARD_TABS.find((x) => x.key === v.split('#')[0]); return t ? t[zh ? 'cn' : 'ko'] : ''; };
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" aria-label={zh ? '当前' : '지금'}>
      <div className="flex flex-wrap items-start gap-2">
      <ol className="flex flex-1 flex-wrap gap-1" aria-label={zh ? '阶段' : '단계'}>
        {STAGES.map((s, i) => (
          <li key={s} className={`rounded-full px-2.5 py-0.5 text-caption ${s === stage ? 'bg-primary text-primary-foreground font-semibold' : i < STAGES.indexOf(stage) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{STAGE_LABEL[s][zh ? 1 : 0]}</li>
        ))}
      </ol>
      {isStaff && <Button size="sm" variant="outline" className="h-7" onClick={() => setBrief(true)}><ClipboardList className="h-3.5 w-3.5" />{zh ? '会议准备' : '미팅 준비'}</Button>}
      </div>
      <button type="button" onClick={() => onGo(guide.tab)} className="flex w-full items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-left text-label hover:bg-primary/10">
        <span className="flex-1"><span className="font-semibold">{zh ? '这一阶段：' : '이 단계: '}</span>{zh ? guide.cn : guide.ko}</span>
        <span className="flex items-center gap-0.5 text-caption text-primary">{tabLabel(guide.tab)}<ArrowRight className="h-3.5 w-3.5" /></span>
      </button>
      {isStaff && (
        <div className="space-y-1">
          <p className="text-label font-semibold">{zh ? '现在要处理' : '지금 챙길 일'}{rows.length ? ` ${rows.length}` : ''}</p>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : rows.length === 0 ? (
            <p className="flex items-center gap-1.5 text-caption text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success-text" />{zh ? '没有逾期、等待或待确认的事项。' : '지난 기한·기다리는 회신·확인할 것이 없습니다.'}</p>
          ) : (
            <ul className="space-y-0.5">
              {rows.map((r, n) => {
                const to = signalTarget(r.k, r.ko);
                return (
                  <li key={n}>
                    <button type="button" onClick={() => onGo(to)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-label hover:bg-muted">
                      <span className={`shrink-0 text-caption font-semibold ${TONE[r.k]}`}>{SECTION_LABEL[r.k][zh ? 'cn' : 'ko'].replace(/ \(.*\)$/, '')}</span>
                      <span className="min-w-0 flex-1 truncate">{zh ? r.cn : r.ko}</span>
                      <span className="shrink-0 text-caption text-muted-foreground">{tabLabel(to)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {isStaff && <CardProtoPanel card={card} />}
      {isStaff && brief && <MeetingBriefDialog card={card} signals={rows} open={brief} onOpenChange={setBrief} onGo={onGo} />}
    </section>
  );
}
