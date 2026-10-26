import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSignature, Loader2, Lock, MailCheck, PenLine, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import PdfViewer from '@/components/signature/PdfViewer';
import SignaturePad, { typedSignaturePng } from '@/components/signature/SignaturePad';

const STEPS = [['read', '계약서 확인'], ['verify', '본인 확인'], ['sign', '서명']];
const METHODS = [['DRAW', '직접 그리기'], ['TYPE', '이름 입력'], ['SEAL', '직인 이미지']];
const kstDate = (iso) => (iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '.') : '');
const kstTime = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }) : '');
const errText = (e) => e?.response?.data?.error || e?.message || '처리하지 못했습니다';
const fileToDataUrl = (f) => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(f); });

async function download(requestId) {
  const res = await base44.functions.invoke('getSignatureRequest', withClientView({ request_id: requestId, purpose: 'download' }));
  window.open(res.data.url, '_blank', 'noopener');
}

// 고객 계약서 서명: ① 끝까지 읽기 → ② 계정 이메일 인증번호 → ③ 이름·직책·서명·동의 → 체결
export default function SignatureDialog({ requestId, open, onOpenChange }) {
  const qc = useQueryClient();
  const key = ['client-signature', requestId];
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: key, enabled: open && !!requestId, staleTime: 0,
    queryFn: async () => (await base44.functions.invoke('getSignatureRequest', withClientView({ request_id: requestId }))).data,
  });
  const r = data?.request;
  const [step, setStep] = useState('read');
  const [readEnd, setReadEnd] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState('');
  const [f, setF] = useState(null);
  const [method, setMethod] = useState('DRAW');
  const [drawn, setDrawn] = useState(false);
  const [seal, setSeal] = useState(null);
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(null);
  const pad = useRef(null);

  // 서버 상태로 단계 맞추기 (처음 한 번)
  const [synced, setSynced] = useState(null);
  if (r && synced !== r.id) {
    setSynced(r.id);
    setReadEnd(!!r.read_to_end);
    setStep(r.otp?.verified ? 'sign' : r.read_to_end ? 'verify' : 'read');
    setF({ name: r.my?.name || '', title: '', company: r.company_name || '' });
  }

  const act = async (action, payload = {}) => (await base44.functions.invoke('signatureAction', { request_id: requestId, action, ...payload })).data;
  const run = async (label, fn) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast({ title: errText(e), variant: 'destructive' }); } finally { setBusy(''); }
  };
  const close = () => { onOpenChange(false); qc.invalidateQueries({ queryKey: ['client-todos'] }); qc.invalidateQueries({ queryKey: ['client-signatures'] }); };

  const onReachEnd = () => {
    setReadEnd(true);
    if (r?.is_signer && !r.block && !r.read_to_end) act('read_to_end').catch(() => {});
  };
  const sendOtp = () => run('otp', async () => { const res = await act('send_otp'); setSentTo(res.email_masked); toast({ title: '인증번호를 보냈습니다', description: `${res.email_masked} 메일함을 확인해 주세요 (10분 유효)` }); });
  const verify = () => run('verify', async () => { await act('verify_otp', { code }); setStep('sign'); });
  const decline = () => run('decline', async () => { await act('decline', { reason }); toast({ title: '수정 요청을 보냈습니다', description: '담당자가 고친 계약서를 다시 보내 드립니다.' }); close(); });
  const sign = () => run('sign', async () => {
    let png = null;
    if (method === 'DRAW') png = pad.current?.toPng();
    if (method === 'TYPE') png = typedSignaturePng(f.name.trim());
    if (method === 'SEAL') png = seal;
    if (!png) throw new Error('서명을 넣어 주세요');
    const res = await act('sign', { version: r.version, original_sha256: r.original_sha256, name: f.name, title: f.title, company: f.company, method, signature_png: png, consent, consent_text: r.consent_text });
    setDone(res);
    qc.invalidateQueries({ queryKey: key });
  });
  const pickSeal = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { toast({ title: 'PNG 또는 JPG 이미지만 올릴 수 있습니다', variant: 'destructive' }); return; }
    if (file.size > 600 * 1024) { toast({ title: '600KB 이하 이미지만 올릴 수 있습니다', variant: 'destructive' }); return; }
    setSeal(await fileToDataUrl(file));
  };

  const canSign = consent && f?.name.trim() && f?.company.trim() && (method === 'DRAW' ? drawn : method === 'SEAL' ? !!seal : !!f?.name.trim());
  const stepIdx = STEPS.findIndex(([k]) => k === step);

  const body = () => {
    if (isLoading || !r) return isError ? <p className="py-10 text-center text-sm text-destructive">계약서를 불러오지 못했습니다. <button type="button" className="underline" onClick={() => refetch()}>다시 시도</button></p> : <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (done) {
      return (
        <div className="space-y-4 py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <div><p className="text-lg font-semibold">{done.completed ? '계약이 체결되었습니다' : '서명을 마쳤습니다'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{done.completed ? '서명 확인서와 감사 추적이 붙은 완료본을 내려받아 보관하세요. 담당자에게도 알림이 갔습니다.' : '완료본을 만드는 중입니다. 잠시 뒤 다시 열어 주세요.'}</p></div>
          {done.completed && <Button className="gap-1.5" onClick={() => download(requestId).catch((e) => toast({ title: errText(e), variant: 'destructive' }))}><Download className="h-4 w-4" />완료본 내려받기</Button>}
          <p className="text-xs text-muted-foreground">다음 단계: 프로젝트의 결제 탭에서 선금 안내를 확인해 주세요.</p>
        </div>
      );
    }
    if (r.status === 'COMPLETED') {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" /><span className="font-medium">체결됨</span><span className="text-muted-foreground">{kstTime(r.completed_at)}</span>
            <Button size="sm" className="ml-auto h-8 gap-1" onClick={() => download(requestId).catch((e) => toast({ title: errText(e), variant: 'destructive' }))}><Download className="h-3.5 w-3.5" />완료본 내려받기</Button>
          </div>
          <PdfViewer url={data.file_url} className="h-[60vh]" />
        </div>
      );
    }
    if (r.block) {
      return (
        <div className="space-y-3">
          <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm"><Lock className="h-4 w-4 shrink-0 text-muted-foreground" />{r.block_text}</p>
          {['NOT_SIGNER', 'VIEW_ONLY'].includes(r.block) && <PdfViewer url={data.file_url} className="h-[60vh]" />}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <ol className="flex gap-1">
          {STEPS.map(([k, label], i) => (
            <li key={k} className={`flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${i === stepIdx ? 'bg-primary text-primary-foreground' : i < stepIdx ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <span className="font-semibold">{i + 1}</span>{label}
            </li>
          ))}
        </ol>

        {step === 'read' && (
          <>
            <PdfViewer url={data.file_url} onReachEnd={onReachEnd} className="h-[55vh] sm:h-[60vh]" />
            {declining ? (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">어떤 부분을 고쳐야 하나요?</p>
                <Textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 제5조 선금 비율을 30%로 바꿔 주세요" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDeclining(false)}>취소</Button>
                  <Button size="sm" variant="outline" disabled={busy === 'decline' || reason.trim().length < 2} onClick={decline}>{busy === 'decline' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}수정 요청 보내기</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDeclining(true)}>수정 요청하기</Button>
                {!readEnd && <span className="ml-auto text-xs text-muted-foreground">계약서를 끝까지 내리면 다음으로 넘어갈 수 있습니다</span>}
                <Button className={readEnd ? 'ml-auto' : ''} disabled={!readEnd} onClick={() => setStep('verify')}>다음: 본인 확인</Button>
              </div>
            )}
          </>
        )}

        {step === 'verify' && (
          <div className="mx-auto max-w-sm space-y-3 py-4">
            <div className="text-center"><MailCheck className="mx-auto h-9 w-9 text-primary" /><p className="mt-2 font-semibold">계정 이메일로 본인 확인</p>
              <p className="mt-1 text-sm text-muted-foreground">{sentTo || r.my?.email_masked}으로 인증번호 6자리를 보내 드립니다.</p></div>
            <Button variant="outline" className="w-full" disabled={busy === 'otp'} onClick={sendOtp}>{busy === 'otp' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{sentTo || r.otp?.sent_at ? '인증번호 다시 받기' : '인증번호 받기'}</Button>
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="인증번호 6자리" className="text-center text-lg tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <Button className="w-full" disabled={code.length !== 6 || busy === 'verify'} onClick={verify}>{busy === 'verify' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}확인</Button>
            <p className="text-center text-[11px] text-muted-foreground">10분 동안 유효하고, 5번 틀리면 30분 동안 잠깁니다. 이지스 직원은 인증번호를 묻지 않습니다.</p>
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setStep('read')}>계약서 다시 보기</Button>
          </div>
        )}

        {step === 'sign' && f && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 text-xs"><span className="text-muted-foreground">이름</span><Input value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              <label className="space-y-1 text-xs"><span className="text-muted-foreground">직책</span><Input value={f.title} maxLength={40} placeholder="예: 대표, 구매팀장" onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
              <label className="space-y-1 text-xs"><span className="text-muted-foreground">회사명</span><Input value={f.company} maxLength={80} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {METHODS.map(([k, label]) => <button key={k} type="button" onClick={() => setMethod(k)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${method === k ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}
            </div>
            {method === 'DRAW' && <SignaturePad ref={pad} onChange={setDrawn} />}
            {method === 'TYPE' && <div className="flex h-36 items-center justify-center rounded-lg border-2 border-dashed bg-white text-4xl font-bold text-gray-900">{f.name.trim() || <span className="text-sm font-normal text-muted-foreground">이름을 입력하면 서명으로 쓰입니다</span>}</div>}
            {method === 'SEAL' && (
              <label className="flex h-36 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed bg-white">
                {seal ? <img src={seal} alt="직인" className="max-h-32 object-contain" /> : <span className="text-sm text-muted-foreground">회사 직인 이미지 올리기 (PNG·JPG, 600KB 이하)</span>}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pickSeal(e.target.files?.[0])} />
              </label>
            )}
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{r.consent_text}</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />본인 확인 완료 · 15분 안에 서명해 주세요</span>
              <Button className="ml-auto gap-1.5" disabled={!canSign || busy === 'sign'} onClick={sign}>{busy === 'sign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}서명 완료</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[96vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 text-base"><FileSignature className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{r?.document_title || '계약서'}</span></DialogTitle>
          <DialogDescription asChild><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {r ? <>
              <span>{r.document_no}{r.version > 1 ? ` · ${r.version}번째 버전` : ''}</span>
              {r.status === 'OUT' && <span>서명 기한 {kstDate(r.due_at)}</span>}
              {r.aegis_company && <span>보낸 곳 {r.aegis_company}</span>}
              {r.status === 'COMPLETED' && <Badge className="border-0 bg-primary/10 text-[10px] text-primary">체결</Badge>}
            </> : <span>계약서를 불러오는 중입니다</span>}
          </div></DialogDescription>
        </DialogHeader>
        {body()}
      </DialogContent>
    </Dialog>
  );
}
