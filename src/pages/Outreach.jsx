import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MailPlus, Search, Sparkles, Send, Loader2, Plus, ShieldCheck, FileUp, ExternalLink, Check, PauseCircle, Play, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { BASIS, SENDABLE, STATUS, STATUS_ORDER, EMPTY_CAMPAIGN, callOutreach, previewMail } from '@/lib/outreachApi';

const sel = 'h-9 w-full rounded-md border bg-background px-2 text-label';
const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const Field = ({ label, hint, children, className = '' }) => (
  <label className={`block space-y-1 ${className}`}><span className="text-caption font-medium">{label}</span>{children}{hint && <span className="block text-micro text-muted-foreground">{hint}</span>}</label>
);
const Pill = ({ s }) => { const [l, c] = STATUS[s] || STATUS.CANDIDATE; return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold ${c}`}>{l}</span>; };

// 법규 안내 (정보통신망법 제50조·제50조의2)
function LawNote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-caption">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left font-semibold" aria-expanded={open}>
        <ShieldCheck className="h-4 w-4 text-warning-text" />광고 메일 법규를 지키도록 만들어져 있습니다<span className="ml-auto text-micro font-normal text-primary">{open ? '접기' : '자세히'}</span>
      </button>
      {open && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li><b className="text-foreground">사전 동의 원칙(제50조):</b> 받는 사람의 수신 동의나 거래·문의 관계 같은 ‘보낼 근거’를 골라야 승인·발송됩니다. 근거가 없는 주소로는 보내지 않습니다.</li>
          <li><b className="text-foreground">주소 자동 수집 금지(제50조의2):</b> AI 는 회사만 찾고 이메일 주소는 찾지 않습니다. 명함·문의·전시회 명단처럼 정당하게 받은 주소를 넣고 출처를 적어 주세요.</li>
          <li><b className="text-foreground">표시 의무:</b> 제목 앞 (광고), 보낸 회사·연락처·주소, 무료 수신거부 링크가 자동으로 붙습니다. 수신거부한 주소는 모든 캠페인에서 빠집니다.</li>
          <li><b className="text-foreground">보내는 시간:</b> 평일 9~18시(한국 시간)에만 보냅니다. 회신이 오면 후속 메일은 자동으로 멈춥니다.</li>
          <li>이 장치는 기본 요건을 지키기 위한 것이며 법률 자문이 아닙니다. 해외 수신자는 그 나라 규정을 따로 확인하세요.</li>
        </ul>
      )}
    </div>
  );
}

function CampaignForm({ value, onSaved, onCancel, bare = false }) {
  const [c, setC] = useState(() => ({ ...EMPTY_CAMPAIGN, ...value, sender: { ...EMPTY_CAMPAIGN.sender, ...(value?.sender || {}) }, brochure: { ...EMPTY_CAMPAIGN.brochure, ...(value?.brochure || {}) }, steps: value?.steps?.length ? value.steps : EMPTY_CAMPAIGN.steps }));
  const [busy, setBusy] = useState('');
  const set = (patch) => setC((x) => ({ ...x, ...patch }));
  const setS = (k, v) => setC((x) => ({ ...x, sender: { ...x.sender, [k]: v } }));
  const setStep = (i, patch) => setC((x) => ({ ...x, steps: x.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast({ title: '20 MB 이하 파일만 올릴 수 있습니다', variant: 'destructive' }); return; }
    setBusy('upload');
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setC((x) => ({ ...x, brochure: { ...x.brochure, file_uri, file_name: file.name, size: file.size, mode: x.brochure.mode === 'none' ? 'link' : x.brochure.mode === 'attach' && file.size > 4 * 1024 * 1024 ? 'link' : x.brochure.mode } }));
      toast({ title: '회사소개서를 비공개로 올렸습니다', description: file.size > 4 * 1024 * 1024 ? '4 MB 가 넘어 첨부 대신 링크로 보냅니다' : '' });
    } catch (e) { toast({ title: `올리지 못했습니다: ${e.message}`, variant: 'destructive' }); }
    setBusy('');
  };
  const save = async (status) => {
    setBusy('save');
    try {
      const r = await callOutreach({ action: 'save_campaign', campaign: { ...c, status: status || c.status } });
      toast({ title: status === 'ACTIVE' ? '캠페인을 시작했습니다' : '저장했습니다' });
      onSaved(r.campaign);
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  return (
    <div className={bare ? 'space-y-4' : 'space-y-4 rounded-xl border bg-card p-4'}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="캠페인 이름"><Input value={c.name} onChange={(e) => set({ name: e.target.value })} placeholder="예: 국내 조명·소형 가전 브랜드 2026 겨울" /></Field>
        <Field label="메일 언어"><select className={sel} value={c.language} onChange={(e) => set({ language: e.target.value })}><option value="ko">한국어</option><option value="en">영어</option><option value="zh">중국어</option></select></Field>
        <Field label="찾을 고객사" hint="AI 가 이 설명으로 인터넷에서 회사를 찾습니다. 업종·제품·규모·최근 움직임(신제품·투자) 등을 적을수록 정확합니다." className="md:col-span-2">
          <Textarea rows={3} value={c.target} onChange={(e) => set({ target: e.target.value })} placeholder="예: 자체 브랜드로 조명·소형 가전을 파는 국내 중소기업. 최근 1~2년 안에 신제품을 냈거나 와디즈·크라우드펀딩을 한 곳. 직원 10~200명." />
        </Field>
        <Field label="지역"><Input value={c.region} onChange={(e) => set({ region: e.target.value })} /></Field>
        <Field label="제외할 회사·조건"><Input value={c.exclude} onChange={(e) => set({ exclude: e.target.value })} placeholder="예: 대기업 계열사, 이미 거래 중인 곳" /></Field>
        <Field label="우리가 제안하는 것" hint="AI 가 메일 본문을 쓸 때 근거로 씁니다. 실제로 할 수 있는 것만 적어 주세요." className="md:col-span-2">
          <Textarea rows={3} value={c.offer} onChange={(e) => set({ offer: e.target.value })} placeholder="예: 아이디어 한 줄에서 3D 컨셉·회로·금형·양산까지 한 곳에서. 중국 공장 30곳과 함께 견적 비교, 시제품 4주." />
        </Field>
      </div>
      <div className="space-y-2">
        <p className="text-caption font-semibold">보낸 사람 (메일 아래에 표시 — 법정 표시 사항)</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[['company', '회사 이름 *'], ['name', '보내는 사람'], ['title', '직함'], ['phone', '전화'], ['email', '회신 받을 이메일'], ['website', '홈페이지'], ['address', '주소 *']].map(([k, l]) => (
            <Field key={k} label={l} className={k === 'address' ? 'sm:col-span-2' : ''}><Input value={c.sender[k] || ''} onChange={(e) => setS(k, e.target.value)} /></Field>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-caption font-semibold">회사소개서</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-label ${busy === 'upload' ? 'opacity-60' : ''}`}>
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{c.brochure.file_uri ? '다른 파일로 바꾸기' : 'PDF 올리기'}
            <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {c.brochure.file_uri && <span className="text-caption text-muted-foreground">{c.brochure.file_name} · {(c.brochure.size / 1024 / 1024).toFixed(1)} MB (비공개 저장)</span>}
          <select aria-label="보내는 방법" className="h-9 rounded-md border bg-background px-2 text-label" value={c.brochure.mode} onChange={(e) => set({ brochure: { ...c.brochure, mode: e.target.value } })}>
            <option value="link">링크로 (열람 시각 기록, 권장)</option>
            <option value="attach">첫 메일에 첨부 (4 MB 이하)</option>
            <option value="none">보내지 않음</option>
          </select>
        </div>
        <p className="text-micro text-muted-foreground">링크는 받는 사람마다 따로 만들어져서, 누가 언제 소개서를 열었는지 영업 기록에 남습니다. 첨부는 스팸으로 분류될 가능성이 조금 높습니다.</p>
      </div>
      <div className="space-y-2">
        <p className="text-caption font-semibold">후속 메일 (회신이 없을 때만)</p>
        <p className="text-micro text-muted-foreground">첫 메일은 대상마다 AI 가 따로 씁니다. 후속 메일은 아래 틀에 {'{회사}'} {'{담당자}'} {'{제품}'} {'{보낸사람}'} 을 채워 보냅니다. 제목을 비우면 첫 메일 제목 그대로 보냅니다.</p>
        {c.steps.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[150px_1fr]">
            <Field label={`후속 ${i + 1} — 앞 메일 뒤`}><div className="flex items-center gap-1.5"><Input type="number" min="1" max="20" value={s.after_days} onChange={(e) => setStep(i, { after_days: Number(e.target.value) || 1 })} className="w-20" /><span className="text-caption">영업일</span></div></Field>
            <div className="space-y-1.5">
              <Input aria-label={`후속 ${i + 1} 제목`} value={s.subject} onChange={(e) => setStep(i, { subject: e.target.value })} placeholder="제목 (비우면 첫 메일 제목)" />
              <Textarea aria-label={`후속 ${i + 1} 본문`} rows={3} value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} />
              <Button size="sm" variant="ghost" onClick={() => set({ steps: c.steps.filter((_, j) => j !== i) })}>이 후속 메일 빼기</Button>
            </div>
          </div>
        ))}
        {c.steps.length < 3 && <Button size="sm" variant="outline" onClick={() => set({ steps: [...c.steps, { after_days: 4, subject: '', body: '' }] })}><Plus className="h-4 w-4" />후속 메일 더하기</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="하루 최대 발송 수" hint="처음 2주는 10~20통을 권합니다. 한꺼번에 많이 보내면 Gmail 이 스팸으로 볼 수 있습니다."><Input type="number" min="1" max="50" value={c.daily_limit} onChange={(e) => set({ daily_limit: Number(e.target.value) || 1 })} /></Field>
        <Field label="제목 앞 광고 표시" hint="국내 수신자에게는 법정 표시입니다. 끄지 마세요."><label className="flex h-9 items-center gap-2 text-label"><input type="checkbox" checked={c.ad_label !== false} onChange={(e) => set({ ad_label: e.target.checked })} />(광고) 붙이기</label></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save()} disabled={!!busy}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}저장</Button>
        {c.status !== 'ACTIVE' && <Button variant="outline" onClick={() => save('ACTIVE')} disabled={!!busy}><Play className="h-4 w-4" />저장하고 자동 발송 시작</Button>}
        {c.status === 'ACTIVE' && <Button variant="outline" onClick={() => save('PAUSED')} disabled={!!busy}><PauseCircle className="h-4 w-4" />일시정지</Button>}
        {onCancel && <Button variant="ghost" onClick={onCancel}>닫기</Button>}
      </div>
    </div>
  );
}

function ProspectEditor({ p, campaign, onClose, onChanged }) {
  const [f, setF] = useState(() => ({ contact_name: p.contact_name || '', contact_title: p.contact_title || '', email: p.email || '', email_source: p.outreach?.email_source || '', consent_basis: p.outreach?.consent_basis || 'none' }));
  const [d, setD] = useState(() => ({ subject: p.outreach?.draft?.subject || '', body: p.outreach?.draft?.body || '' }));
  const [busy, setBusy] = useState('');
  const o = p.outreach || {};
  const started = ['SENDING', 'DONE'].includes(o.status) || Number.isFinite(o.step);
  const run = async (key, body, msg) => {
    setBusy(key);
    try { const r = await callOutreach(body); if (r.prospect) { onChanged(r.prospect); if (r.prospect.outreach?.draft) setD({ subject: r.prospect.outreach.draft.subject, body: r.prospect.outreach.draft.body }); } if (msg) toast({ title: typeof msg === 'function' ? msg(r) : msg }); return r; }
    catch (e) { toast({ title: e.message, variant: 'destructive' }); return null; }
    finally { setBusy(''); }
  };
  const saveContact = () => run('contact', { action: 'update_contact', prospect_id: p.id, ...f }, '저장했습니다');
  const approve = async () => {
    const r1 = await run('contact', { action: 'update_contact', prospect_id: p.id, ...f });
    if (!r1) return;
    if (d.subject !== (o.draft?.subject || '') || d.body !== (o.draft?.body || '')) { if (!(await run('save', { action: 'save_draft', prospect_id: p.id, ...d }))) return; }
    const r = await run('approve', { action: 'approve', prospect_ids: [p.id] });
    if (r?.approved) { toast({ title: '승인했습니다', description: '보내는 시간(평일 9~18시)에 자동으로 보냅니다' }); onChanged({ ...p, outreach: { ...(p.outreach || {}), status: 'APPROVED' } }); onClose(); }
    else if (r) toast({ title: r.problems?.[0]?.reason || '승인하지 못했습니다', variant: 'destructive' });
  };
  const pv = previewMail(campaign, { ...p, outreach: { ...o, draft: d } });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{p.company}<Pill s={o.status} /></DialogTitle></DialogHeader>
        <div className="space-y-4">
          {(o.fit_reason || p.product_idea) && <div className="rounded-lg bg-secondary p-3 text-caption"><p><b>고른 이유:</b> {o.fit_reason || '—'}</p>{p.product_idea && <p className="mt-1"><b>제안할 만한 것:</b> {p.product_idea}</p>}</div>}
          <div className="flex flex-wrap gap-2 text-caption">
            {p.website && <a className="inline-flex items-center gap-1 text-primary underline" href={p.website} target="_blank" rel="noopener noreferrer">홈페이지<ExternalLink className="h-3 w-3" /></a>}
            {o.contact_page && <a className="inline-flex items-center gap-1 text-primary underline" href={o.contact_page} target="_blank" rel="noopener noreferrer">문의 페이지<ExternalLink className="h-3 w-3" /></a>}
            {o.brochure_opened_at && <span className="rounded-full bg-success/15 px-2 py-0.5 text-micro font-semibold text-success-text">소개서 열람 {when(o.brochure_opened_at)}</span>}
            {o.error && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-micro text-destructive">{o.error}</span>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="담당자"><Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></Field>
            <Field label="직함"><Input value={f.contact_title} onChange={(e) => setF({ ...f, contact_title: e.target.value })} /></Field>
            <Field label="이메일"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@company.com" /></Field>
            <Field label="주소를 어디서 받았나" hint="예: 2026 조명박람회 명함, 회사로 온 문의 메일"><Input value={f.email_source} onChange={(e) => setF({ ...f, email_source: e.target.value })} /></Field>
            <Field label="보낼 근거" className="sm:col-span-2" hint={SENDABLE.includes(f.consent_basis) ? '' : '근거가 없으면 승인·발송되지 않습니다. 문의 페이지·전화로 먼저 연락해 수신 동의를 받으세요.'}>
              <select className={sel} value={f.consent_basis} onChange={(e) => setF({ ...f, consent_basis: e.target.value })}>{BASIS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-caption font-semibold">첫 메일</p>
              {!started && <Button size="sm" variant="outline" className="ml-auto" disabled={!!busy} onClick={() => run('draft', { action: 'draft', prospect_id: p.id }, 'AI 가 초안을 썼습니다. 읽어 보고 고치세요')}>{busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{d.body ? 'AI 로 다시 쓰기' : 'AI 로 초안 쓰기'}</Button>}
            </div>
            <Input aria-label="제목" value={d.subject} disabled={started} onChange={(e) => setD({ ...d, subject: e.target.value })} placeholder="제목 ((광고) 는 보낼 때 자동으로 붙습니다)" />
            <Textarea aria-label="본문" rows={8} value={d.body} disabled={started} onChange={(e) => setD({ ...d, body: e.target.value })} placeholder="AI 초안을 만들거나 직접 쓰세요. 서명·회사 정보·수신거부 문구는 자동으로 붙습니다." />
          </div>
          {d.body && (
            <details className="rounded-lg border p-3 text-caption">
              <summary className="cursor-pointer font-semibold">받는 사람이 보게 될 메일</summary>
              <p className="mt-2 font-semibold">{pv.subject}</p>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-caption text-muted-foreground">{pv.body}</pre>
            </details>
          )}
          {(p.touches || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-caption font-semibold">기록</p>
              {(p.touches || []).slice(-8).reverse().map((t, i) => <p key={i} className="text-micro text-muted-foreground">{when(t.at)} · {t.direction === 'in' ? '받음' : '보냄'} · {t.note}</p>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {!started && <Button onClick={approve} disabled={!!busy}>{busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}확인했고 보내기 승인</Button>}
            <Button variant="outline" onClick={async () => { await saveContact(); if (!started && d.body && (d.subject !== (o.draft?.subject || '') || d.body !== (o.draft?.body || ''))) await run('save', { action: 'save_draft', prospect_id: p.id, ...d }); }} disabled={!!busy}>저장만</Button>
            {['APPROVED', 'SENDING'].includes(o.status) && <Button variant="ghost" onClick={() => run('stop', { action: 'stop', prospect_id: p.id }, '자동 발송을 멈췄습니다')} disabled={!!busy}><PauseCircle className="h-4 w-4" />자동 발송 멈추기</Button>}
            <Link to={`/sales?p=${p.id}`} className="ml-auto inline-flex items-center text-caption text-primary underline">영업 파이프라인에서 보기</Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 콜드메일 자동화: AI 가 고객사를 찾고 → 담당자가 주소·근거를 넣고 → AI 초안을 확인·승인하면 → 평일 낮에 자동으로 보내고 후속 메일까지
export default function Outreach() {
  useAuth();
  const qc = useQueryClient();
  const [campaignId, setCampaignId] = useState(() => new URLSearchParams(window.location.search).get('c') || '');
  const [editing, setEditing] = useState(null); // 'new' | campaign
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState('');
  const [picked, setPicked] = useState([]);
  const { data: campaigns = [], isLoading } = useQuery({ queryKey: ['outreach-campaigns'], queryFn: () => base44.entities.OutreachCampaign.list('-updated_date', 100) });
  const campaign = campaigns.find((c) => c.id === campaignId) || campaigns[0] || null;
  useEffect(() => { if (!campaignId && campaigns[0]) setCampaignId(campaigns[0].id); }, [campaigns, campaignId]);
  const { data: prospects = [], isLoading: loadingP } = useQuery({ queryKey: ['outreach-prospects', campaign?.id], queryFn: () => base44.entities.SalesProspect.filter({ campaign_id: campaign.id }, '-created_date', 1000), enabled: !!campaign?.id });
  const { data: gmail } = useQuery({ queryKey: ['sales-gmail-status'], queryFn: async () => { try { return (await base44.functions.invoke('salesMail', { action: 'status' })).data; } catch (e) { return { connected: false, error: e?.response?.data?.error || e.message }; } }, staleTime: 5 * 60 * 1000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['outreach-prospects', campaign?.id] }); qc.invalidateQueries({ queryKey: ['outreach-campaigns'] }); };
  const setOne = (p) => qc.setQueryData(['outreach-prospects', campaign?.id], (rows = []) => rows.map((r) => (r.id === p.id ? { ...r, ...p } : r)));

  const counts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((s) => [s, prospects.filter((p) => (p.outreach?.status || 'CANDIDATE') === s).length])), [prospects]);
  const shown = prospects.filter((p) => (filter === 'all' || (p.outreach?.status || 'CANDIDATE') === filter) && (!q || `${p.company} ${p.contact_name || ''} ${p.email || ''} ${p.industry || ''}`.toLowerCase().includes(q.toLowerCase())));
  const open = prospects.find((p) => p.id === openId) || null;

  const discover = async () => {
    setBusy('discover');
    try {
      const r = await callOutreach({ action: 'discover', campaign_id: campaign.id, count });
      toast({ title: r.found ? `고객사 ${r.found}곳을 찾았습니다` : '새로 찾은 회사가 없습니다', description: r.found ? '홈페이지·문의 페이지를 보고 담당자 주소와 보낼 근거를 넣어 주세요' : '‘찾을 고객사’ 설명을 바꿔 보세요' });
      refresh();
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  const draftAll = async () => {
    const targets = prospects.filter((p) => p.outreach?.status === 'READY');
    setBusy('drafts');
    let made = 0;
    for (const p of targets) { try { const r = await callOutreach({ action: 'draft', prospect_id: p.id }); setOne(r.prospect); made += 1; } catch { /* 다음 */ } }
    toast({ title: `초안 ${made}통을 썼습니다`, description: '하나씩 열어 읽어 보고 승인하세요' });
    setBusy('');
  };
  const approvePicked = async () => {
    setBusy('approve');
    try {
      const r = await callOutreach({ action: 'approve', prospect_ids: picked });
      toast({ title: `${r.approved}곳 승인`, description: r.problems?.length ? `승인 못 함 ${r.problems.length}곳: ${r.problems.slice(0, 3).map((x) => `${x.company} (${x.reason})`).join(', ')}` : '보내는 시간에 자동으로 보냅니다' });
      setPicked([]); refresh();
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  const runNow = async () => {
    setBusy('run');
    try {
      const r = await callOutreach({ action: 'run', campaign_id: campaign.id });
      toast({ title: r.note || `${r.sent}통 보냈습니다`, description: r.errors?.length ? r.errors.slice(0, 2).join(' / ') : r.skipped ? `건너뜀 ${r.skipped}곳 (한도·근거·시간)` : '' });
      refresh();
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy('');
  };

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-caption font-semibold text-primary"><MailPlus className="h-4 w-4" />영업</p>
          <h1 className="text-h2 font-bold">콜드메일 자동화</h1>
          <p className="text-caption text-muted-foreground">AI 가 고객사를 찾고 맞춤 메일을 씁니다. 사람이 확인하고 승인하면 회사소개서와 함께 보내고, 회신이 없으면 후속 메일까지 보냅니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-micro font-semibold ${gmail?.can_send ? 'bg-success/15 text-success-text' : 'bg-destructive/10 text-destructive'}`}>{gmail?.can_send ? `Gmail 연결됨${gmail.email ? ` · ${gmail.email}` : ''}` : gmail?.connected ? 'Gmail 보내기 권한 없음' : 'Gmail 연결 필요'}</span>
          {campaigns.length > 0 && <select aria-label="캠페인" className="h-9 rounded-md border bg-background px-2 text-label" value={campaign?.id || ''} onChange={(e) => { setCampaignId(e.target.value); setEditing(null); setPicked([]); }}>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {({ DRAFT: '준비', ACTIVE: '진행 중', PAUSED: '일시정지', DONE: '끝' })[c.status]}</option>)}</select>}
          <Button variant="outline" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />새 캠페인</Button>
        </div>
      </div>

      <LawNote />

      {(editing === 'new' || (!campaign && !isLoading)) && (
        <CampaignForm value={null} onCancel={campaign ? () => setEditing(null) : null} onSaved={(c) => { setEditing(null); setCampaignId(c.id); refresh(); }} />
      )}

      {campaign && editing !== 'new' && (
        <>
          <div className="rounded-xl border bg-card">
            <button type="button" onClick={() => setEditing(editing ? null : campaign)} className="flex w-full flex-wrap items-center gap-2 p-4 text-left" aria-expanded={!!editing}>
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{campaign.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-micro font-semibold ${campaign.status === 'ACTIVE' ? 'bg-success/15 text-success-text' : 'bg-secondary text-muted-foreground'}`}>{({ DRAFT: '준비 — 아직 보내지 않음', ACTIVE: '자동 발송 중', PAUSED: '일시정지', DONE: '끝' })[campaign.status]}</span>
              <span className="text-micro text-muted-foreground">하루 {campaign.daily_limit || 20}통 · 후속 {campaign.steps?.length || 0}통 · 소개서 {campaign.brochure?.file_uri ? (campaign.brochure.mode === 'attach' ? '첨부' : campaign.brochure.mode === 'link' ? '링크' : '안 보냄') : '없음'}</span>
              {campaign.last_run?.at && <span className="text-micro text-muted-foreground">마지막 자동 발송 {when(campaign.last_run.at)} · {campaign.last_run.sent}통</span>}
              <span className="ml-auto text-micro text-primary">{editing ? <ChevronUp className="h-4 w-4" /> : <span className="inline-flex items-center gap-1">설정<ChevronDown className="h-4 w-4" /></span>}</span>
            </button>
            {editing && editing !== 'new' && <div className="border-t p-4"><CampaignForm bare key={campaign.id} value={campaign} onSaved={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} /></div>}
          </div>

          <div className="flex flex-wrap gap-2">
            {[['all', '전체', prospects.length], ...STATUS_ORDER.map((s) => [s, STATUS[s][0], counts[s]])].filter(([k, , n]) => k === 'all' || n > 0).map(([k, l, n]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`rounded-full border px-3 py-1.5 text-caption ${filter === k ? 'border-primary bg-primary/10 font-semibold text-primary' : 'hover:bg-secondary'}`}>{l} {n}</button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
            <select aria-label="찾을 회사 수" className="h-9 rounded-md border bg-background px-2 text-label" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 20].map((n) => <option key={n} value={n}>{n}곳</option>)}</select>
            <Button onClick={discover} disabled={!!busy}>{busy === 'discover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{busy === 'discover' ? '인터넷에서 찾는 중… (30초~1분)' : 'AI 로 고객사 찾기'}</Button>
            {counts.READY > 0 && <Button variant="outline" onClick={draftAll} disabled={!!busy}>{busy === 'drafts' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}초안 필요 {counts.READY}곳 한꺼번에 쓰기</Button>}
            {picked.length > 0 && <Button variant="outline" onClick={approvePicked} disabled={!!busy}><Check className="h-4 w-4" />고른 {picked.length}곳 승인</Button>}
            {campaign.status === 'ACTIVE' && <Button variant="outline" onClick={runNow} disabled={!!busy || !gmail?.can_send}>{busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}지금 보낼 것 보내기</Button>}
            <div className="relative ml-auto w-full sm:w-56"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="검색" value={q} onChange={(e) => setQ(e.target.value)} placeholder="회사·담당자 검색" className="pl-8" /></div>
          </div>

          {loadingP ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : shown.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-caption text-muted-foreground">
              {prospects.length ? '이 상태의 대상이 없습니다.' : <>아직 영업 대상이 없습니다. 위의 <b>AI 로 고객사 찾기</b>를 누르면 ‘찾을 고객사’ 설명에 맞는 회사를 찾아 여기에 넣습니다.</>}
            </div>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {shown.map((p) => {
                const o = p.outreach || {};
                const canPick = o.status === 'DRAFTED';
                return (
                  <li key={p.id} className="flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap">
                    <input type="checkbox" aria-label={`${p.company} 고르기`} className="mt-1.5 h-4 w-4" disabled={!canPick} checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((id) => id !== p.id)))} />
                    <button type="button" onClick={() => setOpenId(p.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{p.company}</span><Pill s={o.status || 'CANDIDATE'} />{o.brochure_opened_at && <span className="text-micro text-success-text">소개서 열람</span>}{o.error && isLiveErr(o) && <span className="text-micro text-destructive">{o.error}</span>}</span>
                      <span className="block truncate text-caption text-muted-foreground">{[p.industry, p.contact_name, p.email].filter(Boolean).join(' · ') || '담당자 주소를 넣어 주세요'}</span>
                      {o.fit_reason && <span className="mt-0.5 block line-clamp-2 text-micro text-muted-foreground">{o.fit_reason}</span>}
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-micro text-muted-foreground">
                      {o.last_sent_at && <span>보냄 {when(o.last_sent_at)}{Number.isFinite(o.step) ? ` · ${o.step === 0 ? '첫 메일' : `후속 ${o.step}`}` : ''}</span>}
                      <Button size="sm" variant="outline" onClick={() => setOpenId(p.id)}>{o.status === 'CANDIDATE' ? '주소 넣기' : o.status === 'READY' ? '초안 쓰기' : o.status === 'DRAFTED' ? '읽고 승인' : '열기'}</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {open && campaign && <ProspectEditor key={open.id} p={open} campaign={campaign} onClose={() => setOpenId(null)} onChanged={(p) => setOne(p)} />}
    </div>
  );
}

// 보내는 중인 대상의 오류만 목록에 보여 준다 (후보 단계의 ‘근거 없음’ 같은 안내는 열었을 때)
function isLiveErr(o) { return ['APPROVED', 'SENDING'].includes(o.status); }
