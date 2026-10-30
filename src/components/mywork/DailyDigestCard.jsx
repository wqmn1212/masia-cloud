import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sun, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { SECTIONS, SECTION_LABEL } from '@/lib/opsDigest';

const TONE = { due_today: 'text-primary', risk: 'text-destructive', client_wait: 'text-warning-text', factory_wait: 'text-warning-text', to_check: 'text-primary', opportunity: 'text-primary' };

// 내 업무 맨 위: 아침 메일과 같은 오늘 요약 (getOpsDigest). 줄을 누르면 그 카드가 열린다. 아침 메일 받기를 여기서 끈다.
export default function DailyDigestCard({ user, cards, onOpen }) {
  const { lang } = useLanguage();
  const zh = lang === 'zh';
  const qc = useQueryClient();
  const [all, setAll] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['ops-digest', user.id], queryFn: async () => (await base44.functions.invoke('getOpsDigest', {})).data, staleTime: 60_000 });
  if (isLoading || !data?.digest) return null;
  const { digest } = data;
  const setEmail = async (on) => {
    try {
      await base44.auth.updateMe({ notification_prefs: { ...(user.notification_prefs || {}), daily: { email: on } } });
      qc.invalidateQueries({ queryKey: ['ops-digest', user.id] });
      toast({ title: on ? (zh ? '每天早上8:30发送摘要' : '매일 아침 8:30에 요약을 보내 드립니다') : (zh ? '已关闭早间摘要' : '아침 요약을 끕니다') });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };
  const open = (id) => { const c = cards.find((x) => x.id === id); if (c) onOpen(c); else base44.entities.TaskCard.get(id).then(onOpen).catch(() => {}); };
  const rows = SECTIONS.filter((k) => digest.sections[k]?.length);
  const t = digest.team;
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex flex-1 items-center gap-1.5 text-body font-semibold"><Sun className="h-4 w-4 text-primary" />{zh ? '今日摘要' : '오늘 요약'}<span className="text-caption font-normal text-muted-foreground">{digest.today}</span></h2>
        <label className="flex items-center gap-1.5 text-caption text-muted-foreground"><Switch checked={data.receives_email} onCheckedChange={setEmail} aria-label={zh ? '接收早间邮件' : '아침 메일 받기'} />{zh ? '早间邮件 08:30' : '아침 메일 08:30'}</label>
      </div>
      {digest.empty && <p className="text-caption text-muted-foreground">{zh ? '今天没有需要特别处理的事项。' : '오늘 따로 챙길 일이 없습니다.'}</p>}
      {rows.map((k) => {
        const list = digest.sections[k];
        const shown = all ? list : list.slice(0, 4);
        return (
          <div key={k} className="space-y-1">
            <p className={`text-label font-semibold ${TONE[k]}`}>{SECTION_LABEL[k][zh ? 'cn' : 'ko']} {list.length}</p>
            <ul className="space-y-0.5">
              {shown.map((r, n) => (
                <li key={n}><button type="button" className="w-full truncate rounded px-1 py-0.5 text-left text-label hover:bg-muted" onClick={() => open(r.card_id)}><span className="text-muted-foreground">{zh ? r.card_title_cn : r.card_title}</span> · {zh ? r.cn : r.ko}</button></li>
              ))}
            </ul>
          </div>
        );
      })}
      {t && (
        <div className="rounded-lg bg-muted/40 p-2.5 text-caption">
          <p className="font-medium">{zh ? `团队：进行中${t.active} · 延误${t.late.length} · 等待客户${t.client_waits} · 工厂提交待确认${t.factory_submissions}${t.no_owner ? ` · 无负责人${t.no_owner}` : ''}` : `팀 전체: 진행 ${t.active} · 지연 카드 ${t.late.length} · 고객 대기 ${t.client_waits} · 공장 제출 확인 대기 ${t.factory_submissions}${t.no_owner ? ` · 책임자 없음 ${t.no_owner}` : ''}`}</p>
          {(all ? t.late : t.late.slice(0, 3)).map((c) => <button key={c.card_id} type="button" className="block w-full truncate text-left hover:underline" onClick={() => open(c.card_id)}>{zh ? c.card_title_cn : c.card_title} · {zh ? `延误${c.days}天` : `${c.days}일 지연`}{c.owner_name ? ` · ${c.owner_name}` : ''}</button>)}
        </div>
      )}
      {(rows.some((k) => digest.sections[k].length > 4) || (t && t.late.length > 3)) && (
        <button type="button" className="flex items-center gap-1 text-caption text-primary" onClick={() => setAll(!all)}>{all ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{all ? (zh ? '收起' : '접기') : (zh ? '全部显示' : '모두 보기')}</button>
      )}
    </section>
  );
}
