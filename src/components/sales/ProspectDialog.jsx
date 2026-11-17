import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Loader2, Mail, Trophy, PauseCircle, Send, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { STAGES, ACTIVE, SOURCES, TOUCH_KINDS, defaultFollowUp, kstToday, mailTemplates, stageOf } from '@/lib/salesPipeline';

const FIELDS = [
  ['company', '회사명 *'], ['contact_name', '담당자'], ['contact_title', '직함'], ['email', '이메일'],
  ['phone', '전화'], ['website', '홈페이지'], ['industry', '업종·제품군'], ['product_idea', '만들 만한 제품·관심사'],
];
const PREF = 'masia.sales.pref';
const readPref = () => { try { return JSON.parse(localStorage.getItem(PREF) || '{}'); } catch { return {}; } };
const writePref = (v) => { try { localStorage.setItem(PREF, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } };
const callMail = async (body) => {
  try { return (await base44.functions.invoke('salesMail', body)).data; }
  catch (e) { const d = e?.response?.data; throw new Error(d?.error || e.message); }
};
const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
// 연락을 남기면 단계가 자연히 앞으로 간다 (뒤로는 가지 않는다)
const NEXT = { email: { TARGET: 'SENT' }, call: { TARGET: 'SENT' }, message: { TARGET: 'SENT' }, meeting: { TARGET: 'MEETING', SENT: 'MEETING', REPLIED: 'MEETING' } };

export default function ProspectDialog({ prospect, user, onClose, onSaved }) {
  const navigate = useNavigate();
  const today = kstToday();
  const me = user?.full_name || user?.email || '';
  const [form, setForm] = useState(() => prospect ? { ...prospect } : { company: '', stage: 'TARGET', source: 'cold_email', next_follow_up: today, owner_name: me, owner_email: user?.email || '', touches: [] });
  const [tab, setTab] = useState(prospect ? 'log' : 'info');
  const [busy, setBusy] = useState('');
  const [touch, setTouch] = useState({ kind: 'email', note: '' });
  const [pref, setPref] = useState(() => ({ sender: me, deck: '', ...readPref() }));
  const [tpl, setTpl] = useState('first');
  const templates = useMemo(() => mailTemplates(form, pref), [form, pref]);
  const cur = templates.find((t) => t.key === tpl) || templates[0];
  const [draft, setDraft] = useState(null);
  const subject = draft?.key === cur.key ? draft.subject : cur.subject;
  const bodyText = draft?.key === cur.key ? draft.body : cur.body;
  const [lost, setLost] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (patch = {}, ok = '저장했습니다') => {
    const data = { ...form, ...patch };
    if (!data.company?.trim()) { toast({ title: '회사명을 넣어 주세요' }); return null; }
    setBusy('save');
    try {
      const rest = Object.fromEntries(Object.entries(data).filter(([k]) => !['id', 'created_date', 'updated_date', 'created_by'].includes(k)));
      const saved = prospect ? await base44.entities.SalesProspect.update(prospect.id, rest) : await base44.entities.SalesProspect.create({ tenant_id: user.tenant_id, created_by_name: me, ...rest });
      setForm((f) => ({ ...f, ...patch, ...(saved?.id ? { id: saved.id } : {}) }));
      onSaved?.();
      toast({ title: ok });
      if (!prospect) onClose();
      return saved;
    } catch (e) { toast({ title: `저장하지 못했습니다: ${e.message || e}`, variant: 'destructive' }); return null; }
    finally { setBusy(''); }
  };
  // 연락 기록: 단계를 앞으로, 다음 연락일을 기본값으로
  const addTouch = async (kind = touch.kind, note = touch.note) => {
    const stage = NEXT[kind]?.[form.stage] || form.stage;
    const entry = { at: new Date().toISOString(), kind, note: note.trim(), by: me, stage };
    const patch = { touches: [...(form.touches || []), entry], stage, next_follow_up: defaultFollowUp(stage, today) || form.next_follow_up };
    if (await save(patch, `${TOUCH_KINDS[kind]} 기록을 남겼습니다 · 다음 연락 ${patch.next_follow_up || '없음'}`)) setTouch({ kind: 'email', note: '' });
  };
  const copy = async () => { try { await navigator.clipboard.writeText(`제목: ${subject}\n\n${bodyText}`); toast({ title: '메일 문안을 복사했습니다' }); } catch { toast({ title: '복사하지 못했습니다' }); } };
  const mailto = () => { window.location.href = `mailto:${encodeURIComponent(form.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`; };
  // Gmail: 연결 상태(보내기 권한)는 한 번만 묻는다
  const { data: gmail } = useQuery({ queryKey: ['sales-mail-status'], queryFn: () => callMail({ action: 'status' }).catch((e) => ({ connected: false, error: e.message })), staleTime: 10 * 60_000, enabled: !!prospect });
  const sendGmail = async () => {
    if (!window.confirm(`${form.email} 로 지금 보냅니다.\n보내는 계정: ${gmail?.email || '연결된 Gmail'}`)) return;
    setBusy('gmail');
    try {
      const r = await callMail({ action: 'send', prospect_id: prospect.id, subject, body: bodyText });
      setForm((f) => ({ ...f, ...r.prospect })); setDraft(null); onSaved?.();
      toast({ title: '보냈습니다', description: `다음 연락 ${r.prospect.next_follow_up || '없음'} · 회신이 오면 자동으로 기록됩니다` });
    } catch (e) { toast({ title: '보내지 못했습니다', description: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  const checkReplies = async () => {
    setBusy('reply');
    try {
      const r = await callMail({ action: 'check_replies', prospect_id: prospect.id });
      if (r.found) { const fresh = await base44.entities.SalesProspect.get(prospect.id); setForm((f) => ({ ...f, ...fresh })); onSaved?.(); }
      toast({ title: r.found ? `회신 ${r.found}건을 기록했습니다` : '새 회신이 없습니다' });
    } catch (e) { toast({ title: '회신을 확인하지 못했습니다', description: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  // 수주: 고객사와 업무 카드를 만들고 연결한다 (이미 같은 이름의 고객사가 있으면 그 고객사)
  const win = async () => {
    setBusy('win');
    try {
      const same = (await base44.entities.Company.filter({ company_type: 'CLIENT', company_name: form.company.trim() }, '-created_date', 5))[0];
      const company = same || await base44.entities.Company.create({ company_type: 'CLIENT', company_name: form.company.trim(), tenant_id: user.tenant_id, ...(form.contact_name ? { contact_person: form.contact_name } : {}), ...(form.email ? { email: form.email } : {}), ...(form.phone ? { phone: form.phone } : {}) });
      const card = await base44.entities.TaskCard.create({
        tenant_id: user.tenant_id, title: form.product_idea ? `${form.company} · ${form.product_idea}` : form.company, status: 'TODO', priority: 'MEDIUM', source: 'sales',
        client_id: company.id, client_name: company.company_name, owner_id: user.id, owner_name: me,
        hq_requirements: [form.product_idea && `관심 제품: ${form.product_idea}`, form.industry && `업종: ${form.industry}`, form.notes && `영업 메모: ${form.notes}`].filter(Boolean).join('\n'),
      });
      await save({ stage: 'WON', won_at: new Date().toISOString(), company_id: company.id, task_card_id: card.id, next_follow_up: '', touches: [...(form.touches || []), { at: new Date().toISOString(), kind: 'note', note: '수주 · 고객사와 업무 카드를 만들었습니다', by: me, stage: 'WON' }] }, `${form.company} 수주! 고객사와 업무 카드를 만들었습니다`);
      onClose();
      navigate(`/task-board?card=${card.id}`);
    } catch (e) { toast({ title: `전환하지 못했습니다: ${e.message || e}`, variant: 'destructive' }); }
    setBusy('');
  };

  const s = stageOf(form.stage);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-title">{prospect ? form.company : '영업 대상 추가'}{prospect && <span className={`rounded px-2 py-0.5 text-caption font-semibold ${s.tone}`}>{s.label}</span>}</DialogTitle>
        </DialogHeader>
        {prospect && (
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-label" role="tablist">
            {[['log', '연락 기록'], ['mail', '메일 문안'], ['info', '정보']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-md px-3 py-1.5 ${tab === k ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'}`}>{l}</button>)}
          </div>
        )}

        {tab === 'info' && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELDS.map(([k, l]) => <label key={k} className="space-y-1 text-caption">{l}<Input aria-label={l} value={form[k] || ''} onChange={set(k)} className="h-9" /></label>)}
              <label className="space-y-1 text-caption">찾은 경로<select aria-label="찾은 경로" value={form.source || 'cold_email'} onChange={set('source')} className="h-9 w-full rounded-md border bg-background px-2 text-label">{Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="space-y-1 text-caption">담당 직원<Input aria-label="담당 직원" value={form.owner_name || ''} onChange={set('owner_name')} className="h-9" /></label>
            </div>
            <label className="block space-y-1 text-caption">메모<Textarea aria-label="메모" rows={3} value={form.notes || ''} onChange={set('notes')} /></label>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>닫기</Button><Button onClick={() => save()} disabled={!!busy}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}저장</Button></div>
          </div>
        )}

        {tab === 'log' && prospect && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-caption">단계<select aria-label="단계" value={form.stage} onChange={(e) => save({ stage: e.target.value, next_follow_up: ACTIVE.includes(e.target.value) ? form.next_follow_up : '' }, '단계를 바꿨습니다')} className="h-9 w-full rounded-md border bg-background px-2 text-label" disabled={form.stage === 'WON'}>{STAGES.filter((x) => x.key !== 'WON' || form.stage === 'WON').map((x) => <option key={x.key} value={x.key}>{x.label} — {x.hint}</option>)}</select></label>
              <label className="space-y-1 text-caption">다음 연락일<Input type="date" aria-label="다음 연락일" value={form.next_follow_up || ''} onChange={(e) => save({ next_follow_up: e.target.value }, '다음 연락일을 바꿨습니다')} className="h-9" disabled={!ACTIVE.includes(form.stage)} /></label>
            </div>
            {ACTIVE.includes(form.stage) && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-label font-semibold">연락 기록 남기기</p>
                <div className="flex flex-wrap gap-1">{Object.entries(TOUCH_KINDS).map(([k, l]) => <button key={k} type="button" onClick={() => setTouch((t) => ({ ...t, kind: k }))} className={`rounded-full border px-3 py-1 text-caption ${touch.kind === k ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{l}</button>)}</div>
                <Textarea aria-label="연락 내용" rows={2} value={touch.note} onChange={(e) => setTouch((t) => ({ ...t, note: e.target.value }))} placeholder="예: 첫 메일 보냄 / 다음 주 화요일 2시 미팅 잡힘 / 샘플 단가 궁금해함" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => addTouch()} disabled={!!busy}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}기록</Button>
                  <span className="text-micro text-muted-foreground">기록하면 단계가 앞으로 가고 다음 연락일이 정해집니다 (첫 메일 4영업일 · 회신·미팅 2영업일 · 견적 3영업일)</span>
                </div>
              </div>
            )}
            {gmail?.can_read && form.email && (form.touches || []).some((t) => t.kind === 'email') && ACTIVE.includes(form.stage) && (
              <Button size="sm" variant="ghost" className="h-7" onClick={checkReplies} disabled={!!busy}>{busy === 'reply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Gmail 에서 회신 찾기</Button>
            )}
            <ul className="space-y-1.5">{[...(form.touches || [])].reverse().map((t, i) => (
              <li key={i} className="rounded-lg bg-secondary px-3 py-2 text-caption"><span className="font-semibold">{t.direction === 'in' ? '받은 메일' : TOUCH_KINDS[t.kind] || t.kind}{t.gmail_id && t.direction !== 'in' ? ' (Gmail)' : ''}</span> <span className="text-muted-foreground">{when(t.at)} · {t.by}{t.stage ? ` · ${stageOf(t.stage).label}` : ''}</span>{t.note && <span className="block text-foreground">{t.note}</span>}</li>
            ))}{!(form.touches || []).length && <li className="text-caption text-muted-foreground">아직 연락 기록이 없습니다.</li>}</ul>
            {form.stage === 'WON' ? (
              <p className="rounded-lg bg-success/10 px-3 py-2 text-caption text-success-text">수주 · <button type="button" className="underline" onClick={() => { onClose(); navigate(`/task-board?card=${form.task_card_id}`); }}>업무 카드 열기</button></p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Button size="sm" variant="outline" onClick={win} disabled={!!busy}>{busy === 'win' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}수주 → 고객사·업무 카드 만들기</Button>
                {form.stage !== 'LOST' && <>
                  <Input aria-label="보류 이유" value={lost} onChange={(e) => setLost(e.target.value)} placeholder="보류 이유 (예: 내년 상반기 다시)" className="h-8 min-w-0 flex-1 text-caption" />
                  <Button size="sm" variant="ghost" onClick={() => save({ stage: 'LOST', lost_reason: lost.trim(), next_follow_up: '' }, '보류로 옮겼습니다')} disabled={!!busy || !lost.trim()}><PauseCircle className="h-4 w-4" />보류</Button>
                </>}
              </div>
            )}
          </div>
        )}

        {tab === 'mail' && prospect && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">{templates.map((t) => <button key={t.key} type="button" onClick={() => setTpl(t.key)} className={`rounded-full border px-3 py-1 text-caption ${tpl === t.key ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{t.label}</button>)}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-caption">보내는 사람 (메일 서명)<Input aria-label="보내는 사람" value={pref.sender} onChange={(e) => { const v = { ...pref, sender: e.target.value }; setPref(v); writePref(v); }} className="h-9" /></label>
              <label className="space-y-1 text-caption">소개 자료 링크<Input aria-label="소개 자료 링크" value={pref.deck} onChange={(e) => { const v = { ...pref, deck: e.target.value }; setPref(v); writePref(v); }} placeholder="공유를 켠 소개서 링크" className="h-9" /></label>
            </div>
            <label className="block space-y-1 text-caption">제목<Input aria-label="메일 제목" value={subject} onChange={(e) => setDraft({ key: cur.key, subject: e.target.value, body: bodyText })} className="h-9" /></label>
            <label className="block space-y-1 text-caption">본문<Textarea aria-label="메일 본문" rows={11} value={bodyText} onChange={(e) => setDraft({ key: cur.key, subject, body: e.target.value })} className="text-label" /></label>
            <div className="flex flex-wrap gap-2">
              {gmail?.can_send && <Button size="sm" onClick={sendGmail} disabled={!!busy || !form.email}>{busy === 'gmail' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Gmail 로 보내기</Button>}
              <Button size="sm" variant="outline" onClick={copy}><Copy className="h-4 w-4" />복사</Button>
              <Button size="sm" variant="outline" onClick={mailto} disabled={!form.email}><Mail className="h-4 w-4" />메일 앱으로 열기</Button>
              <Button size="sm" variant={gmail?.can_send ? 'ghost' : 'default'} onClick={() => addTouch('email', `${cur.label} 보냄 — ${subject}`)} disabled={!!busy}>{!gmail?.can_send && <Send className="h-4 w-4" />}다른 곳에서 보냈다고 기록</Button>
            </div>
            <p className="text-micro text-muted-foreground">
              {gmail?.can_send
                ? `“Gmail 로 보내기”는 ${gmail.email || '연결된 Gmail'} 계정으로 바로 보내고 연락 기록·다음 연락일을 남깁니다. 회신은 평일 9·13·17시에 자동으로 찾아 기록합니다.`
                : gmail?.connected
                  ? 'Gmail 이 읽기 권한으로만 연결되어 있어 여기서 보낼 수는 없습니다. 관리자가 Gmail 연결을 다시 하면 “Gmail 로 보내기”가 생깁니다. 지금은 메일 앱에서 보내고 기록하세요 — 회신은 자동으로 찾습니다.'
                  : '메일 앱에서 보내고 “다른 곳에서 보냈다고 기록”을 누르세요.'}
              {' '}보내는 사람·자료 링크는 이 브라우저에 기억됩니다.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
