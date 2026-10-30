import React, { useEffect, useRef, useState } from 'react';
import { Camera, FileUp, Loader2, CheckCircle2, AlertTriangle, Send, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MAX_FILE_BYTES, shrinkImage, fileToBase64 } from '@/lib/factoryRequest';

// 공장 업로드 화면 (/f/<토큰>) — 로그인 없이 휴대폰에서 연다. 중국어가 기본이고 한국어로 바꿀 수 있다.
// PIN은 이 탭의 sessionStorage 에만 두어 새로 고침해도 다시 묻지 않는다 (탭을 닫으면 사라짐).
const T = {
  zh: {
    title: '资料上传', pinTitle: '请输入验证码', pinHint: '验证码（6位数字）在微信消息里', open: '打开', notFound: '找不到此链接，请联系AEGIS负责人。', expired: '链接已过期，请联系AEGIS负责人重新发送。', revoked: '此链接已失效，请联系AEGIS负责人。',
    product: '产品', due: '截止日期', status: { WAITING: '未提交', SUBMITTED: '已提交，待确认', ACCEPTED: '已确认', REDO: '需要重新提交' },
    photo: '拍照', file: '选择文件', answer: '填写回答', submit: '提交', uploading: '上传中', done: '已提交，谢谢！', allDone: '全部资料已确认，谢谢配合！', redo: '重新提交原因', sent: '已提交', tooBig: '文件不能超过10MB', note: '完成情况（例如：10月31日印刷完成）', failed: '提交失败', retry: '可以分多次上传，用同一个链接继续即可。', lang: '한국어',
  },
  ko: {
    title: '자료 올리기', pinTitle: 'PIN을 넣어 주세요', pinHint: 'PIN(6자리)은 위챗 메시지에 있습니다', open: '열기', notFound: '링크를 찾을 수 없습니다. AEGIS 담당자에게 문의하세요.', expired: '링크 기한이 지났습니다. AEGIS 담당자에게 다시 요청하세요.', revoked: '더 이상 쓸 수 없는 링크입니다. AEGIS 담당자에게 문의하세요.',
    product: '제품', due: '기한', status: { WAITING: '미제출', SUBMITTED: '제출함 · 확인 대기', ACCEPTED: '확인됨', REDO: '다시 올려 주세요' },
    photo: '사진 찍기', file: '파일 고르기', answer: '답 적기', submit: '보내기', uploading: '올리는 중', done: '보냈습니다. 감사합니다!', allDone: '모든 자료가 확인됐습니다. 감사합니다!', redo: '다시 요청한 이유', sent: '보낸 것', tooBig: '파일은 10MB 이하여야 합니다', note: '완료 내용 (예: 10월 31일 인쇄 완료)', failed: '보내지 못했습니다', retry: '여러 번에 나눠 올려도 됩니다. 같은 링크로 이어서 올리세요.', lang: '中文',
  },
};
const STATUS_CLS = { WAITING: 'bg-muted text-muted-foreground', SUBMITTED: 'bg-primary/10 text-primary', ACCEPTED: 'bg-primary text-primary-foreground', REDO: 'bg-destructive/10 text-destructive' };
// 공장은 중국에 있으므로 시각·날짜는 중국 시간으로 보여 준다
const cn = (iso) => new Date(Date.parse(iso) + 8 * 3600000).toISOString();
const cnTime = (iso) => (iso ? cn(iso).slice(5, 16).replace('T', ' ') : '');
const cnDate = (iso) => (iso ? cn(iso).slice(0, 10) : '');
const errOf = (e) => ({ status: e?.response?.status || e?.status || 0, data: e?.response?.data || e?.data || {} });
const store = { get: (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* 저장이 막혀도 동작 */ } } };

export default function FactoryUpload() {
  const token = window.location.pathname.replace(/^\/f\//, '').split(/[/?#]/)[0];
  const [lang, setLang] = useState('zh');
  const t = T[lang];
  const [phase, setPhase] = useState('loading'); // loading · pin · ready · notFound · expired · revoked
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);

  const openWith = async (p) => {
    setBusy(true); setPinError('');
    try {
      const { data } = await base44.functions.invoke('getFactoryRequest', { token, pin: p });
      setView(data.request); setPhase('ready'); store.set(`fr:${token}`, p);
    } catch (e) {
      const { status, data } = errOf(e);
      if (status === 410) setPhase(data.status === 'REVOKED' ? 'revoked' : 'expired');
      else if (status === 404) setPhase('notFound');
      else { setPhase('pin'); setPinError(data.error || t.failed); store.set(`fr:${token}`, ''); }
    } finally { setBusy(false); }
  };

  useEffect(() => {
    document.title = 'AEGIS · 资料上传';
    (async () => {
      const saved = store.get(`fr:${token}`);
      if (saved) return openWith(saved);
      try {
        await base44.functions.invoke('getFactoryRequest', { token });
        setPhase('pin');
      } catch (e) {
        const { status, data } = errOf(e);
        setPhase(status === 410 ? (data.status === 'REVOKED' ? 'revoked' : 'expired') : 'notFound');
      }
    })();
  }, [token]);

  const pinValue = store.get(`fr:${token}`) || pin;
  const allDone = view?.items?.length && view.items.every((i) => i.status === 'ACCEPTED');

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-3">
        <span className="text-body font-bold text-primary">AEGIS</span>
        <span className="flex-1 text-label text-muted-foreground">{t.title}</span>
        <button type="button" className="rounded-full border px-2.5 py-1 text-caption" onClick={() => setLang(lang === 'zh' ? 'ko' : 'zh')}>{t.lang}</button>
      </header>
      <main className="mx-auto max-w-lg space-y-3 px-4 py-4">
        {phase === 'loading' && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {['notFound', 'expired', 'revoked'].includes(phase) && (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-6 text-center"><AlertTriangle className="h-8 w-8 text-warning-text" /><p className="text-body">{t[phase]}</p></div>
        )}
        {phase === 'pin' && (
          <form className="space-y-3 rounded-xl border bg-background p-5" onSubmit={(e) => { e.preventDefault(); if (/^\d{6}$/.test(pin)) openWith(pin); }}>
            <div className="flex items-center gap-2 text-body font-semibold"><Lock className="h-4 w-4 text-primary" />{t.pinTitle}</div>
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="h-12 text-center font-mono text-2xl tracking-[0.5em]" aria-label="PIN" />
            <p className="text-caption text-muted-foreground">{t.pinHint}</p>
            {pinError && <p role="alert" className="text-caption text-destructive">{pinError}</p>}
            <Button type="submit" className="h-11 w-full" disabled={busy || pin.length !== 6}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t.open}</Button>
          </form>
        )}
        {phase === 'ready' && view && (
          <>
            <div className="space-y-1 rounded-xl border bg-background p-4">
              <p className="text-caption text-muted-foreground">{t.product}</p>
              <p className="text-title font-semibold">{view.product}</p>
              {view.expires_at && <p className="text-caption text-muted-foreground">{t.due} {cnDate(view.expires_at)}</p>}
              {view.message_cn && <p className="whitespace-pre-line rounded-md bg-primary/5 p-2 text-label">{view.message_cn}</p>}
            </div>
            {allDone && <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-label text-primary"><CheckCircle2 className="h-5 w-5" />{t.allDone}</div>}
            {view.items.map((item) => <ItemCard key={item.key} item={item} t={t} lang={lang} token={token} pin={pinValue} onView={setView} />)}
            <p className="px-1 text-caption text-muted-foreground">{t.retry}</p>
          </>
        )}
      </main>
    </div>
  );
}

function ItemCard({ item, t, lang, token, pin, onView }) {
  const [answer, setAnswer] = useState('');
  const [progress, setProgress] = useState('');
  const [msg, setMsg] = useState(null);
  const camRef = useRef(null);
  const fileRef = useRef(null);
  const closed = item.status === 'ACCEPTED';
  const wantsFile = item.kind !== 'ANSWER';
  const wantsText = item.kind === 'ANSWER' || item.kind === 'MILESTONE';
  const accept = item.kind === 'DOC' ? 'image/*,.pdf,.xls,.xlsx,.csv' : 'image/*';

  const send = async (payload) => {
    const { data } = await base44.functions.invoke('submitFactoryRequest', { token, pin, item_key: item.key, ...payload });
    onView(data.request);
  };
  const upload = async (files) => {
    const list = [...(files || [])];
    if (!list.length) return;
    setMsg(null);
    try {
      for (let n = 0; n < list.length; n++) {
        setProgress(`${t.uploading} ${n + 1}/${list.length}`);
        const f = await shrinkImage(list[n]);
        if (f.size > MAX_FILE_BYTES) throw new Error(t.tooBig);
        await send({ file: { name: f.name, type: f.type || 'application/octet-stream', data: await fileToBase64(f) }, ...(n === 0 && answer.trim() ? { answer } : {}) });
      }
      setAnswer('');
      setMsg({ ok: true, text: t.done });
    } catch (e) {
      setMsg({ ok: false, text: errOf(e).data.error || e.message || t.failed });
    } finally {
      setProgress('');
      if (camRef.current) camRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const sendText = async () => {
    setMsg(null); setProgress(t.uploading);
    try { await send({ answer }); setAnswer(''); setMsg({ ok: true, text: t.done }); }
    catch (e) { setMsg({ ok: false, text: errOf(e).data.error || t.failed }); }
    finally { setProgress(''); }
  };

  return (
    <section className={`space-y-2.5 rounded-xl border bg-background p-4 ${item.status === 'REDO' ? 'border-destructive/40' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold">{lang === 'zh' ? item.label_cn : item.label_ko}</p>
          {lang === 'zh' && item.label_ko !== item.label_cn && <p className="text-caption text-muted-foreground">{item.label_ko}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ${STATUS_CLS[item.status]}`}>{t.status[item.status]}</span>
      </div>
      {item.note_cn && <p className="text-label text-muted-foreground">{item.note_cn}</p>}
      {item.status === 'REDO' && item.redo_reason && <p className="rounded-md bg-destructive/10 p-2 text-label text-destructive">{t.redo}: {item.redo_reason}</p>}
      {item.submitted?.length > 0 && (
        <div className="space-y-0.5 text-caption text-muted-foreground">
          <p>{t.sent}</p>
          {item.submitted.map((s, n) => <p key={n} className="truncate">· {cnTime(s.at)} {s.name || s.answer}</p>)}
        </div>
      )}
      {!closed && (
        <div className="space-y-2">
          {wantsText && <Textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={item.kind === 'MILESTONE' ? t.note : t.answer} className="text-body" />}
          <div className="grid grid-cols-2 gap-2">
            {wantsFile && (
              <>
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
                <input ref={fileRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => upload(e.target.files)} />
                <Button type="button" variant="outline" className="h-11 gap-1.5" disabled={!!progress} onClick={() => camRef.current?.click()}><Camera className="h-4 w-4" />{t.photo}</Button>
                <Button type="button" variant="outline" className="h-11 gap-1.5" disabled={!!progress} onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" />{t.file}</Button>
              </>
            )}
            {wantsText && <Button type="button" className="col-span-2 h-11 gap-1.5" disabled={!!progress || !answer.trim()} onClick={sendText}><Send className="h-4 w-4" />{t.submit}</Button>}
          </div>
          {progress && <p className="flex items-center gap-1.5 text-caption text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{progress}</p>}
          {msg && <p role="status" className={`text-caption ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</p>}
        </div>
      )}
    </section>
  );
}
