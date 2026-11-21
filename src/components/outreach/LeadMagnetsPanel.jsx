import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, FileUp, Instagram, Loader2, Plus, RefreshCw, Send, ShieldCheck, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { callOutreach, EMPTY_CAMPAIGN } from '@/lib/outreachApi';
import { callLead, publicUrl, TEMPLATES, NURTURE_STEPS } from '@/lib/leadMagnetApi';
import { decodeLeadFile, parseTable, guessColumns, rowsFromTable } from '@/lib/leadImport';

const sel = 'h-9 w-full rounded-md border bg-background px-2 text-label';
const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const Field = ({ label, hint, children, className = '' }) => (
  <label className={`block space-y-1 ${className}`}><span className="text-caption font-medium">{label}</span>{children}{hint && <span className="block text-micro text-muted-foreground">{hint}</span>}</label>
);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function MagnetForm({ value, campaigns, onSaved, onCancel }) {
  const [m, setM] = useState(() => ({ ...TEMPLATES.checklist, ...value, operator: { ...TEMPLATES.checklist.operator, ...(value?.operator || {}) }, ask: { ...TEMPLATES.checklist.ask, ...(value?.ask || {}) }, file: { ...TEMPLATES.checklist.file, ...(value?.file || {}) } }));
  const [busy, setBusy] = useState('');
  const set = (patch) => setM((x) => ({ ...x, ...patch }));
  const setO = (k, v) => setM((x) => ({ ...x, operator: { ...x.operator, [k]: v } }));
  const linked = campaigns.find((c) => c.id === m.campaign_id);
  const upload = async (file) => {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) { toast({ title: '30 MB 이하 파일만 올릴 수 있습니다', variant: 'destructive' }); return; }
    setBusy('upload');
    try { const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file }); set({ file: { file_uri, file_name: file.name, size: file.size } }); toast({ title: '자료를 비공개로 올렸습니다', description: '신청한 사람만 전용 링크로 받을 수 있습니다' }); }
    catch (e) { toast({ title: `올리지 못했습니다: ${e.message}`, variant: 'destructive' }); }
    setBusy('');
  };
  const save = async (status) => {
    setBusy('save');
    try { const r = await callLead({ action: 'save', magnet: { ...m, status: status || m.status } }); toast({ title: status === 'LIVE' ? '공개했습니다' : status === 'CLOSED' ? '마감했습니다' : '저장했습니다' }); onSaved(r.magnet); }
    catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  // 신청자 후속 메일용 캠페인을 만든다 (보낸 사람 정보는 처리자 정보로)
  const makeCampaign = async () => {
    setBusy('camp');
    try {
      const o = m.operator;
      const r = await callOutreach({ action: 'save_campaign', campaign: { ...EMPTY_CAMPAIGN, name: `자료 신청자 후속 — ${m.title.slice(0, 30)}`, status: 'DRAFT', target: '자료 신청 페이지에서 광고 수신에 동의한 신청자', offer: '아이디어 단계부터 3D 컨셉·회로·금형·중국 공장 견적 비교·출하 검사까지 한 곳에서 진행', sender: { ...EMPTY_CAMPAIGN.sender, company: o.company, phone: o.phone, email: o.email, address: o.address }, brochure: { mode: 'none', file_uri: '', file_name: '', size: 0 }, steps: NURTURE_STEPS, daily_limit: 30 } });
      set({ campaign_id: r.campaign.id });
      toast({ title: '후속 메일 캠페인을 만들었습니다', description: '콜드메일 탭에서 문구를 확인하고 ‘자동 발송 시작’을 눌러 주세요' });
      onSaved(null, true);
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="미끼 종류">
          <select className={sel} value={m.kind} onChange={(e) => set({ kind: e.target.value })}><option value="file">파일 (체크리스트·가이드 PDF 등)</option><option value="report">아이디어를 받아 AI 양산 진단 리포트</option></select>
        </Field>
        <Field label="공개 주소" hint={m.slug ? publicUrl(m.slug) : '영문 소문자·숫자·-'}><Input value={m.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} placeholder="checklist" /></Field>
        <Field label="제목" className="md:col-span-2"><Input value={m.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="부제" className="md:col-span-2"><Textarea rows={2} value={m.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
        <Field label="받는 것 (한 줄에 하나)" className="md:col-span-2"><Textarea rows={4} value={(m.bullets || []).join('\n')} onChange={(e) => set({ bullets: e.target.value.split('\n') })} /></Field>
        <Field label="버튼 글자"><Input value={m.button_label} onChange={(e) => set({ button_label: e.target.value })} /></Field>
        <Field label="더 받을 칸">
          <div className="flex h-9 flex-wrap items-center gap-3 text-label">
            {[['company', '회사명'], ['phone', '전화'], ['idea', '만들고 싶은 제품']].map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={!!m.ask[k] || (k === 'idea' && m.kind === 'report')} disabled={k === 'idea' && m.kind === 'report'} onChange={(e) => set({ ask: { ...m.ask, [k]: e.target.checked } })} />{l}</label>)}
          </div>
        </Field>
      </div>
      {m.kind === 'file' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-label ${busy === 'upload' ? 'opacity-60' : ''}`}>
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{m.file.file_uri ? '다른 파일로 바꾸기' : '보낼 자료 올리기 (PDF)'}
            <input type="file" accept=".pdf,.xlsx,.zip,application/pdf" className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {m.file.file_uri && <span className="text-caption text-muted-foreground">{m.file.file_name} · {(m.file.size / 1024 / 1024).toFixed(1)} MB (비공개)</span>}
        </div>
      )}
      <div className="space-y-2">
        <p className="text-caption font-semibold">개인정보 처리자 (동의 문구와 메일 아래에 표시)</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[['company', '회사 이름 *'], ['email', '문의 이메일'], ['phone', '전화'], ['privacy_url', '개인정보 처리방침 주소'], ['address', '주소']].map(([k, l]) => <Field key={k} label={l} className={k === 'address' ? 'sm:col-span-2' : ''}><Input value={m.operator[k] || ''} onChange={(e) => setO(k, e.target.value)} /></Field>)}
          <Field label="보관 기간 (개월)"><Input type="number" min="1" max="60" value={m.retention_months} onChange={(e) => set({ retention_months: Number(e.target.value) || 24 })} /></Field>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="광고 수신 동의자 후속 메일" hint={linked ? (linked.status === 'ACTIVE' ? '이 캠페인의 후속 메일이 자동으로 이어집니다' : '캠페인이 아직 시작 전입니다 — 콜드메일 탭에서 시작해야 후속 메일이 나갑니다') : '고르지 않으면 자료만 보냅니다'}>
          <div className="flex gap-2">
            <select className={sel} value={m.campaign_id} onChange={(e) => set({ campaign_id: e.target.value })}><option value="">후속 메일 없음</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={makeCampaign} disabled={!!busy || !m.operator.company}>{busy === 'camp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}새로</Button>
          </div>
        </Field>
        <Field label="신청이 오면 알릴 직원 이메일"><Input type="email" value={m.notify_email} onChange={(e) => set({ notify_email: e.target.value })} /></Field>
        <Field label="신청 뒤 안내 문구" className="md:col-span-2"><Input value={m.thanks} onChange={(e) => set({ thanks: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save()} disabled={!!busy}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}저장</Button>
        {m.status !== 'LIVE' && <Button variant="outline" onClick={() => save('LIVE')} disabled={!!busy}>저장하고 공개</Button>}
        {m.status === 'LIVE' && <Button variant="outline" onClick={() => save('CLOSED')} disabled={!!busy}>마감</Button>}
        {onCancel && <Button variant="ghost" onClick={onCancel}>닫기</Button>}
      </div>
    </div>
  );
}

// 인스타그램·페이스북 리드 광고 신청자 가져오기: CSV 파일 또는 Graph API 자동
function MetaImport({ magnet, onDone }) {
  const [table, setTable] = useState(null);
  const [map, setMap] = useState(null);
  const [label, setLabel] = useState('');
  const [send, setSend] = useState(false);
  const [busy, setBusy] = useState('');
  const [forms, setForms] = useState((magnet.meta?.form_ids || []).join(', '));
  const [key, setKey] = useState(magnet.meta?.marketing_key || '');
  const [autoSend, setAutoSend] = useState(!!magnet.meta?.send_material);
  const rows = useMemo(() => (table && map ? rowsFromTable(table, map) : []), [table, map]);
  const read = async (file) => {
    if (!file) return;
    try { const t = parseTable(decodeLeadFile(await file.arrayBuffer())); setTable(t); setMap(guessColumns(t.headers)); setLabel(file.name.replace(/\.[^.]+$/, '').slice(0, 40)); }
    catch (e) { toast({ title: `파일을 읽지 못했습니다: ${e.message}`, variant: 'destructive' }); }
  };
  const doImport = async () => {
    setBusy('import');
    try { const r = await callLead({ action: 'import_leads', magnet_id: magnet.id, rows, label, send_material: send }); toast({ title: `${r.added}명을 넣었습니다`, description: `광고 수신 동의 ${r.opt_ins}명${r.sent ? ` · 자료 메일 ${r.sent}통` : ''}${r.skipped ? ` · 건너뜀 ${r.skipped}` : ''}` }); setTable(null); onDone(); }
    catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  const saveMeta = async (pull) => {
    setBusy(pull ? 'pull' : 'meta');
    try {
      await callLead({ action: 'save', magnet: { ...magnet, meta: { form_ids: forms, marketing_key: key, send_material: autoSend } } });
      if (pull) { const r = await callLead({ action: 'meta_pull', magnet_id: magnet.id }); toast({ title: `새 신청자 ${r.added}명`, description: r.error || '' }); }
      else toast({ title: '저장했습니다', description: '매시 15분에 새 신청자를 가져옵니다' });
      onDone();
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy('');
  };
  const colSel = (k, l) => (
    <Field key={k} label={l}><select className={sel} value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}><option value={-1}>없음</option>{table.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></Field>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="flex items-center gap-1.5 font-semibold"><Upload className="h-4 w-4" />신청자 파일(CSV) 가져오기</p>
        <p className="text-caption text-muted-foreground">Meta 광고 관리자 → 리드 센터(또는 페이지 ‘인스턴트 양식’) → 리드 다운로드한 파일을 그대로 올리면 됩니다. 광고 수신 동의 칸이 ‘예·true·동의’ 인 사람만 후속 메일 대상이 됩니다.</p>
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-label"><FileUp className="h-4 w-4" />파일 고르기<input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} /></label>
        {table && map && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">{colSel('email', '이메일 *')}{colSel('name', '이름')}{colSel('company', '회사')}{colSel('phone', '전화')}{colSel('created', '신청 시각')}{colSel('marketing', '광고 수신 동의')}</div>
            <p className="text-caption">이메일이 있는 {rows.length}명 · 광고 수신 동의 <b>{rows.filter((r) => r.marketing).length}명</b>{map.marketing < 0 && <span className="text-warning-text"> — 동의 칸을 고르지 않으면 모두 ‘동의 안 함’으로 넣습니다</span>}</p>
            <div className="grid gap-2 sm:grid-cols-2"><Field label="이름표 (기록용)"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field><label className="flex items-end gap-2 pb-2 text-label"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />지금 자료 메일도 보내기</label></div>
            <Button onClick={doImport} disabled={!!busy || !rows.length}>{busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{rows.length}명 넣기</Button>
          </div>
        )}
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="flex items-center gap-1.5 font-semibold"><Instagram className="h-4 w-4" />리드 광고 자동 연결 (매시)</p>
        <p className="text-caption text-muted-foreground">인스턴트 양식 ID 를 넣으면 매시 15분(8~21시)에 새 신청자를 가져와 동의를 기록하고, 고르면 자료 메일까지 보냅니다. 서버 비밀값 <code>META_LEAD_TOKEN</code>(페이지 액세스 토큰, leads_retrieval 권한)이 있어야 합니다.</p>
        <Field label="양식 ID (여러 개는 쉼표로)"><Input value={forms} onChange={(e) => setForms(e.target.value)} placeholder="예: 1234567890123456" /></Field>
        <Field label="광고 수신 동의 체크박스 key" hint="비우면 key 에 marketing·광고·소식 등이 들어간 체크박스를 동의로 봅니다"><Input value={key} onChange={(e) => setKey(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-label"><input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />가져온 신청자에게 자료 메일 보내기 (양식 완료 화면에 자료 링크가 없을 때)</label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => saveMeta(false)} disabled={!!busy}>{busy === 'meta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}저장</Button>
          <Button variant="outline" onClick={() => saveMeta(true)} disabled={!!busy || !forms.trim()}>{busy === 'pull' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}지금 가져오기</Button>
        </div>
        {magnet.meta?.last_pull_at && <p className="text-micro text-muted-foreground">마지막 가져오기 {when(magnet.meta.last_pull_at)} · 지금까지 {magnet.meta.pulled || 0}명</p>}
        {magnet.meta?.last_error && <p className="text-micro text-destructive">{magnet.meta.last_error}</p>}
      </div>
    </div>
  );
}

export default function LeadMagnetsPanel({ campaigns }) {
  const qc = useQueryClient();
  const [id, setId] = useState(() => new URLSearchParams(window.location.search).get('m') || '');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const { data: magnets = [], isLoading } = useQuery({ queryKey: ['lead-magnets'], queryFn: () => base44.entities.LeadMagnet.list('-updated_date', 50) });
  const m = magnets.find((x) => x.id === id) || magnets[0] || null;
  const { data: people = [] } = useQuery({
    queryKey: ['lead-people', m?.id],
    enabled: !!m?.id,
    queryFn: async () => (await base44.entities.SalesProspect.filter({ source: { $in: ['lead_magnet', 'meta_lead'] } }, '-updated_date', 2000)).filter((p) => p.outreach?.magnet_id === m.id),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lead-magnets'] }); qc.invalidateQueries({ queryKey: ['lead-people'] }); qc.invalidateQueries({ queryKey: ['outreach-campaigns'] }); };
  const st = m?.stats || {};
  const optIns = people.filter((p) => p.outreach?.consent?.marketing).length;
  const overdue = m ? people.filter((p) => { const at = p.outreach?.consent?.privacy_at; if (!at || !['TARGET', 'SENT'].includes(p.stage)) return false; const d = new Date(at); d.setMonth(d.getMonth() + (m.retention_months || 24)); return d < new Date(); }).length : 0;
  const copy = async (url) => { try { await navigator.clipboard.writeText(url); toast({ title: '주소를 복사했습니다' }); } catch { toast({ title: url }); } };
  const resend = async (p) => { setBusy(p.id); try { await callLead({ action: 'resend', prospect_id: p.id }); toast({ title: '자료 메일을 다시 보냈습니다' }); refresh(); } catch (e) { toast({ title: e.message, variant: 'destructive' }); } setBusy(''); };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const form = (value) => <MagnetForm key={value?.id || value?.slug || 'new'} value={value} campaigns={campaigns} onCancel={magnets.length ? () => setEditing(null) : null} onSaved={(saved, keep) => { if (saved) { setId(saved.id); if (!keep) setEditing(null); } refresh(); }} />;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-caption">
        <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />무료 자료로 이메일과 수신 동의를 받습니다</p>
        <p className="mt-1 text-muted-foreground">광고·인스타 프로필·카드뉴스·전시회 QR 에서 공개 주소로 보내면, 신청자는 [필수] 개인정보 동의와 [선택] 광고 수신 동의를 따로 체크합니다. 자료는 바로 메일로 가고, 광고 수신에 동의한 사람만 연결한 캠페인의 후속 메일을 받습니다. 동의 시각·경로·문구는 지워지지 않는 기록으로 남고, 처리 결과 통지와 2년마다 확인 안내는 자동으로 보냅니다.</p>
      </div>

      {(!m || editing === 'new' || editing?.tpl) && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">새 자료 신청 페이지</p><span className="text-micro text-muted-foreground">틀 고르기:</span>
            {Object.entries({ checklist: '양산 체크리스트 PDF', report: 'AI 양산 진단 리포트' }).map(([k, l]) => <Button key={k} size="sm" variant={editing?.tpl === k ? 'default' : 'outline'} onClick={() => setEditing({ tpl: k })}>{l}</Button>)}
          </div>
          {form({ ...TEMPLATES[editing?.tpl || 'checklist'], operator: { ...TEMPLATES.checklist.operator, ...(campaigns[0]?.sender ? { company: campaigns[0].sender.company, email: campaigns[0].sender.email, phone: campaigns[0].sender.phone, address: campaigns[0].sender.address } : {}) } })}
        </div>
      )}

      {m && editing !== 'new' && !editing?.tpl && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="자료 신청 페이지" className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-label sm:w-auto sm:max-w-md" value={m.id} onChange={(e) => { setId(e.target.value); setEditing(null); }}>{magnets.map((x) => <option key={x.id} value={x.id}>{x.title} · {({ DRAFT: '준비', LIVE: '공개 중', CLOSED: '마감' })[x.status]}</option>)}</select>
            <Button size="sm" variant="outline" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />새 페이지</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(editing === m.id ? null : m.id)}>{editing === m.id ? '설정 닫기' : '설정'}</Button>
            {m.status === 'LIVE' && <><Button size="sm" variant="ghost" onClick={() => copy(publicUrl(m.slug))}><Copy className="h-4 w-4" />주소 복사</Button><a className="inline-flex items-center gap-1 text-caption text-primary underline" href={publicUrl(m.slug)} target="_blank" rel="noopener noreferrer">열어 보기<ExternalLink className="h-3 w-3" /></a></>}
          </div>
          {editing === m.id && <div className="rounded-xl border bg-card p-4">{form(m)}</div>}
          {m.status === 'LIVE' && <p className="break-all text-micro text-muted-foreground">경로별로 나눠 보려면 주소 끝에 ?ref= 를 붙이세요 — 인스타 광고 {publicUrl(m.slug, 'ig_ad')} · 프로필 {publicUrl(m.slug, 'ig_bio')} · 전시회 QR {publicUrl(m.slug, 'expo')}</p>}

          <div className="grid gap-2 sm:grid-cols-4">
            {[['페이지 조회', st.views || 0, ''], ['신청', st.signups || 0, `조회 대비 ${pct(st.signups || 0, st.views || 0)}`], ['광고 수신 동의', optIns, `신청 대비 ${pct(optIns, people.length)}`], ['자료 열람', st.opened || 0, `신청 대비 ${pct(st.opened || 0, st.signups || 0)}`]].map(([k, v, s]) => (
              <div key={k} className="rounded-xl border bg-card p-3"><p className="text-micro text-muted-foreground">{k}</p><p className="text-h3 font-bold">{v}</p>{s && <p className="text-micro text-muted-foreground">{s}</p>}</div>
            ))}
          </div>
          {overdue > 0 && <p className="rounded-lg bg-warning/10 p-3 text-caption text-warning-text">보관 기간({m.retention_months || 24}개월)이 지난 신청자 {overdue}명이 있습니다. 거래로 이어지지 않았다면 개인정보를 파기해야 합니다 (자동으로 지우지는 않습니다).</p>}

          <MetaImport key={m.id} magnet={m} onDone={refresh} />

          <div className="rounded-xl border bg-card">
            <p className="border-b p-3 font-semibold">신청자 {people.length}명</p>
            {people.length === 0 ? <p className="p-8 text-center text-caption text-muted-foreground">아직 신청자가 없습니다. 공개 주소를 광고·프로필·카드뉴스에 걸어 보세요.</p> : (
              <ul className="divide-y">
                {people.map((p) => {
                  const o = p.outreach || {};
                  return (
                    <li key={p.id} className="flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2"><span className="font-semibold">{p.contact_name || p.email}</span><span className="text-caption text-muted-foreground">{p.company}</span>
                          <span className={`rounded-full px-2 py-0.5 text-micro font-semibold ${o.consent?.marketing ? 'bg-success/15 text-success-text' : 'bg-secondary text-muted-foreground'}`}>{o.consent?.marketing ? '광고 수신 동의' : o.status === 'UNSUBSCRIBED' ? '수신거부' : '자료만'}</span>
                          {p.source === 'meta_lead' && <span className="rounded-full bg-secondary px-2 py-0.5 text-micro">리드 광고</span>}
                        </p>
                        <p className="truncate text-caption text-muted-foreground">{[p.email, p.phone].filter(Boolean).join(' · ')}</p>
                        {p.product_idea && <p className="mt-0.5 line-clamp-2 text-micro text-muted-foreground">{p.product_idea}</p>}
                        {o.error && <p className="text-micro text-destructive">{o.error}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-micro text-muted-foreground">
                        <span>신청 {when(o.consent?.privacy_at)}</span>
                        <span>{o.material_sent_at ? `자료 보냄 ${when(o.material_sent_at)}` : '자료 안 보냄'}{o.material_opened_at ? ' · 열람' : ''}</span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => resend(p)} disabled={!!busy || o.status === 'UNSUBSCRIBED'}>{busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}자료 다시</Button>
                          <a href={`/sales?p=${p.id}`} className="inline-flex items-center px-2 text-caption text-primary underline">영업</a>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="flex items-center gap-1 text-micro text-muted-foreground"><ShieldCheck className="h-3 w-3" />동의 기록(누가·언제·어떤 문구에 동의·철회)은 서버에만 쌓이며 고칠 수 없습니다. 분쟁이 생기면 관리자에게 기록 조회를 요청하세요.</p>
        </>
      )}
    </div>
  );
}
