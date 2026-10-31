import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Link2, Eye, Check, RotateCcw, Ban, CalendarPlus, KeyRound, Factory, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { KIND_LABEL, STATUS_LABEL, REQUEST_LABEL, effectiveStatus, counts, factoryLink } from '@/lib/factoryRequest';
import FactoryRequestDialog from './FactoryRequestDialog';
import FactoryInviteDialog from './FactoryInviteDialog';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' }) : '');
const STATUS_CLS = { WAITING: 'text-muted-foreground', SUBMITTED: 'border-primary/40 text-primary', ACCEPTED: 'border-0 bg-primary/10 text-primary', REDO: 'border-warning/40 text-warning-text' };

// 카드 업무 탭: 공장 업로드 링크. 공장이 링크 + PIN으로 올린 사진·서류·답을 항목마다 채택하거나 재요청한다.
export default function FactoryRequestPanel({ card }) {
  const { lang } = useLanguage();
  const L = (ko, zh) => (lang === 'zh' ? zh : ko);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState(null);
  const key = ['factory-requests', card.id];
  const { data: requests = [] } = useQuery({ queryKey: key, queryFn: () => base44.entities.FactoryRequest.filter({ card_id: card.id }, '-created_date', 20) });
  const act = useMutation({
    mutationFn: async (body) => (await base44.functions.invoke('manageFactoryRequest', body)).data,
    onSuccess: (data, body) => {
      qc.invalidateQueries({ queryKey: key });
      if (body.action === 'review') {
        qc.invalidateQueries({ queryKey: ['card_attachments', card.id] });
        qc.invalidateQueries({ queryKey: ['qc-precheck', card.id] });
        qc.invalidateQueries({ queryKey: ['card-milestones', card.id] });
      }
      if (data?.token) {
        const req = requests.find((r) => r.id === (body.request_id || data.request_id));
        setInvite({ link: factoryLink(window.location.origin, data.token), pin: data.pin, product: card.title_cn || card.title, expires_at: data.expires_at, items: data.items || req?.items || [] });
      }
    },
    onError: (e) => toast({ title: L('처리하지 못했습니다', '处理失败'), description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  const waiting = requests.reduce((n, r) => n + counts(r).submitted, 0);

  return (
    <section className="mt-6 space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex flex-1 items-center gap-1.5 text-body font-semibold"><Factory className="h-4 w-4 text-primary" />{L('공장 업로드 링크', '工厂上传链接')}
          {waiting > 0 && <Badge className="border-0 bg-primary text-micro text-primary-foreground">{L(`확인 대기 ${waiting}건`, `待确认 ${waiting} 项`)}</Badge>}
        </h3>
        <Button size="sm" className="h-8 gap-1" onClick={() => setCreating(true)}><Link2 className="h-3.5 w-3.5" />{L('공장에 요청', '向工厂索取')}</Button>
      </div>
      {!requests.length && <p className="text-caption text-muted-foreground">{L('공장이 계정 없이 링크와 PIN으로 진행 사진·출하 서류·질문 답을 올리게 합니다. 채택한 것만 카드 파일·일정·사전 QC에 들어갑니다.', '工厂无需账号，通过链接和验证码上传进度照片、出货文件和问题回答。只有确认的内容才会进入卡片文件、进度和QC事前检查。')}</p>}
      {requests.map((r) => <RequestCard key={r.id} r={r} L={L} lang={lang} busy={act.isPending} run={(body) => act.mutate({ request_id: r.id, ...body })} onShowInvite={() => setInvite({ link: '', pin: '', product: card.title_cn || card.title, expires_at: r.expires_at, items: r.items, reissueOnly: true, requestId: r.id })} />)}
      <FactoryRequestDialog card={card} open={creating} onClose={() => setCreating(false)} pending={act.isPending} onCreate={(body) => act.mutate({ action: 'create', card_id: card.id, ...body }, { onSuccess: () => setCreating(false) })} />
      <FactoryInviteDialog invite={invite} onClose={() => setInvite(null)} onReissue={(id) => act.mutate({ action: 'reissue', request_id: id })} />
    </section>
  );
}

function RequestCard({ r, L, lang, busy, run, onShowInvite }) {
  const status = effectiveStatus(r);
  const c = counts(r);
  const live = status === 'OPEN';
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-caption">
        {r.factory_name && <span className="font-medium">{r.factory_name}</span>}
        <Badge variant="outline" className={status === 'OPEN' ? 'text-primary' : 'text-muted-foreground'}>{L(REQUEST_LABEL[status], { OPEN: '进行中', DONE: '已完成', EXPIRED: '已过期', REVOKED: '已收回' }[status])}</Badge>
        <span className="text-muted-foreground">{fmt(r.created_date)} · {r.created_by_name} · {L(`기한 ${fmt(r.expires_at)}`, `截止 ${fmt(r.expires_at)}`)}</span>
        <span className={r.last_opened_at ? 'text-muted-foreground' : 'text-warning-text'}>· {r.last_opened_at ? L(`공장 열람 ${fmt(r.last_opened_at)}`, `工厂查看 ${fmt(r.last_opened_at)}`) : L('공장이 아직 열어 보지 않음', '工厂尚未打开')}</span>
        <span className="ml-auto text-muted-foreground">{L(`채택 ${c.accepted}/${c.total}`, `已确认 ${c.accepted}/${c.total}`)}</span>
      </div>
      <ul className="divide-y">
        {r.items.map((i) => <ItemRow key={i.key} r={r} item={i} L={L} lang={lang} busy={busy} run={run} />)}
      </ul>
      {status !== 'DONE' && (
        <div className="flex flex-wrap justify-end gap-1.5 border-t pt-2">
          {status !== 'REVOKED' && <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={busy} onClick={() => run({ action: 'extend', days: 7 })}><CalendarPlus className="h-3.5 w-3.5" />{L('7일 연장', '延长7天')}</Button>}
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={busy} onClick={onShowInvite}><KeyRound className="h-3.5 w-3.5" />{L('링크·PIN 다시 만들기', '重新生成链接和验证码')}</Button>
          {live && <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" disabled={busy} onClick={() => window.confirm(L('링크를 회수할까요? 공장은 더 이상 올릴 수 없습니다.', '确定收回链接吗？工厂将无法再上传。')) && run({ action: 'revoke' })}><Ban className="h-3.5 w-3.5" />{L('회수', '收回')}</Button>}
        </div>
      )}
    </div>
  );
}

function ItemRow({ r, item, L, lang, busy, run }) {
  const [redo, setRedo] = useState(false);
  const [reason, setReason] = useState('');
  const [visible, setVisible] = useState(false);
  const subs = (r.submissions || []).filter((s) => s.item_key === item.key);
  const fresh = subs.filter((s) => !s.review);
  const shown = item.status === 'SUBMITTED' ? fresh : subs.filter((s) => s.review === 'ACCEPTED');
  const open = async (s) => {
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: s.file_uri, expires_in: 300 });
      window.open(signed_url, '_blank', 'noopener');
    } catch (e) { toast({ title: L('파일을 열지 못했습니다', '无法打开文件'), description: e.message, variant: 'destructive' }); }
  };
  const label = lang === 'zh' ? item.label_cn : item.label_ko;
  return (
    <li className="space-y-1.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 text-micro text-muted-foreground">{KIND_LABEL[item.kind]?.[lang === 'zh' ? 'cn' : 'ko']}</span>
        <span className="min-w-0 flex-1 truncate text-label font-medium">{label}</span>
        <Badge variant="outline" className={`text-micro ${STATUS_CLS[item.status]}`}>{STATUS_LABEL[item.status]?.[lang === 'zh' ? 'cn' : 'ko']}</Badge>
      </div>
      {item.status === 'REDO' && item.redo_reason && <p className="text-caption text-warning-text">{L('재요청', '已要求重新提交')}: {item.redo_reason}</p>}
      {shown.length > 0 && (
        <div className="space-y-1 rounded-md bg-muted/40 p-2">
          {shown.map((s, n) => (
            <div key={n} className="flex flex-wrap items-center gap-1.5 text-caption">
              <span className="text-muted-foreground">{fmt(s.submitted_at)}</span>
              {s.file_uri && <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => open(s)}><Eye className="h-3 w-3" />{s.file_name}</button>}
              {s.answer && <span className="whitespace-pre-line">{s.answer}</span>}
              {item.kind === 'QUOTE' && s.file_uri && <QuoteImportState r={r} s={s} L={L} />}
            </div>
          ))}
        </div>
      )}
      {item.status === 'SUBMITTED' && (
        redo ? (
          <div className="flex gap-1.5">
            <Input className="h-8 text-xs" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={L('재요청 사유 (공장에 보입니다. 중국어로 쓰면 좋습니다)', '重新提交原因（工厂可见）')} />
            <Button size="sm" variant="outline" className="h-8" disabled={busy || !reason.trim()} onClick={() => run({ action: 'review', item_key: item.key, decision: 'REDO', reason })}>{L('보내기', '发送')}</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setRedo(false)}>{L('취소', '取消')}</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {fresh.some((s) => s.file_uri) && <label className="flex items-center gap-1.5 text-caption text-muted-foreground"><Switch checked={visible} onCheckedChange={setVisible} aria-label={L('고객에게 공개', '对客户公开')} />{L('파일 고객 공개', '文件对客户公开')}</label>}
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busy} onClick={() => setRedo(true)}><RotateCcw className="h-3.5 w-3.5" />{L('재요청', '要求重新提交')}</Button>
            <Button size="sm" className="h-7 gap-1 text-xs" disabled={busy} onClick={() => run({ action: 'review', item_key: item.key, decision: 'ACCEPT', client_visible: visible })}><Check className="h-3.5 w-3.5" />{L('채택', '确认')}</Button>
          </div>
        )
      )}
    </li>
  );
}


// 견적서 제출물: 견적 초안을 만들었는지, 읽는 중인지, 실패했는지. 실패하거나 10분 넘게 멈추면 다시 읽기
function QuoteImportState({ r, s, L }) {
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: async () => (await base44.functions.invoke('importFactoryQuote', { request_id: r.id, retry: true })).data,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['factory-requests', r.card_id] });
      qc.invalidateQueries({ queryKey: ['quotations-by-card', r.card_id] });
      qc.invalidateQueries({ queryKey: ['card-quotations-publish', r.card_id] });
      toast({ title: d?.created ? L('견적 초안을 만들었습니다', '已生成报价草稿') : L('읽지 못했습니다', '读取失败'), description: d?.errors?.[0] || '', variant: d?.created ? undefined : 'destructive' });
    },
    onError: (e) => toast({ title: L('읽지 못했습니다', '读取失败'), description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  if (s.quotation_id) {
    return <Link to={`/task-board?card=${r.card_id}&tab=quotation`} className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary hover:underline"><FileSpreadsheet className="h-3 w-3" />{L('견적 초안 만듦 · 견적 탭에서 보기', '已生成报价草稿')}</Link>;
  }
  const stuck = !s.import_error && Date.now() - Date.parse(s.import_started_at || s.submitted_at) > 10 * 60000;
  if (!s.import_error && !stuck) return <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{L('견적서 읽는 중', '正在读取报价单')}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-warning-text">
      <AlertTriangle className="h-3 w-3" />{s.import_error ? `${L('읽지 못함', '读取失败')}: ${s.import_error}` : L('읽기가 멈췄습니다', '读取中断')}
      <Button size="sm" variant="outline" className="h-6 px-2 text-micro" disabled={retry.isPending} onClick={() => retry.mutate()}>{retry.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : L('다시 읽기', '重新读取')}</Button>
    </span>
  );
}
