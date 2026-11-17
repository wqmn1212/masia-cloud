import React, { useEffect, useState } from 'react';
import { Check, Circle, Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const call = async (body) => {
  try { return (await base44.functions.invoke('protoShare', body)).data; }
  catch (e) { return e?.response?.data || { error: e?.message || '열지 못했습니다' }; }
};

// 고객용 개발 미팅 화면 (/m/<토큰>): 계정 없이 링크 + PIN 으로 연다. 진행 단계·요약·결정 사항·할 일을 보고 결정 사항에 확인을 남긴다.
export default function MeetingShare() {
  const token = window.location.pathname.split('/')[2] || '';
  const [pin, setPin] = useState('');
  const [state, setState] = useState({ loading: true });
  const [share, setShare] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(-1);
  useEffect(() => { call({ action: 'open', token }).then((r) => setState(r.needs_pin ? { pin: true } : { error: r.error || '링크를 찾을 수 없습니다' })); }, [token]);
  const open = async (e) => {
    e?.preventDefault();
    setState({ pin: true, loading: true });
    const r = await call({ action: 'open', token, pin });
    if (r.ok) { setShare(r.share); setState({}); } else setState({ pin: true, error: r.error });
  };
  const confirm = async (index) => {
    setBusy(index);
    const r = await call({ action: 'confirm', token, pin, index, name });
    if (r.ok) setShare(r.share); else setState({ error: r.error });
    setBusy(-1);
  };

  if (!share) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-sm space-y-4 rounded-xl border bg-card p-6">
          <p className="flex items-center gap-2 text-title font-semibold"><Lock className="w-5 h-5 text-primary" />개발 미팅 내용</p>
          {state.loading && !state.pin ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : state.pin ? (
            <form onSubmit={open} className="space-y-3">
              <label className="block space-y-1 text-label">받으신 PIN 6자리<Input aria-label="PIN" inputMode="numeric" autoFocus maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="text-center font-mono text-xl tracking-[0.4em]" /></label>
              <Button type="submit" className="w-full" disabled={pin.length !== 6 || state.loading}>{state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}열기</Button>
            </form>
          ) : null}
          {state.error && <p className="text-caption text-destructive" role="alert">{state.error}</p>}
        </div>
      </div>
    );
  }
  const done = new Map((share.confirmations || []).map((c) => [c.index, c]));
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-label font-semibold text-primary">개발 미팅 내용</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{share.title}</h1>
          <p className="mt-1 text-caption text-muted-foreground">{share.date}{share.attendees ? ` · 참석: ${share.attendees}` : ''}{share.device ? ` · 모델 ${share.device}` : ''}</p>
        </header>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-title font-semibold">진행 상황</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {share.steps.map((s) => (
              <li key={s.label} className="flex items-start gap-2 rounded-lg border px-3 py-2">
                {s.done ? <Check className="mt-0.5 w-4 h-4 shrink-0 text-success-text" /> : <Circle className="mt-0.5 w-4 h-4 shrink-0 text-muted-foreground" />}
                <span><span className="block text-label font-semibold">{s.label} <span className="font-normal text-muted-foreground">{s.done ? '완료' : '남음'}</span></span><span className="block text-caption text-muted-foreground">{s.detail}</span></span>
              </li>
            ))}
          </ol>
        </section>
        {share.summary.length > 0 && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-title font-semibold">지금 설계</h2>
            <ul className="mt-2 space-y-1 text-label">{share.summary.map((x) => <li key={x}>· {x}</li>)}</ul>
          </section>
        )}
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="text-title font-semibold">결정 사항 <span className="text-caption font-normal text-muted-foreground">{done.size}/{share.decisions.length} 확인</span></h2>
          {share.decisions.length === 0 && <p className="text-caption text-muted-foreground">아직 적힌 결정 사항이 없습니다.</p>}
          {share.decisions.length > done.size && <label className="block space-y-1 text-caption">확인하는 분 이름<Input aria-label="확인하는 분 이름" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동 (구매팀)" className="max-w-xs" /></label>}
          <ul className="space-y-2">
            {share.decisions.map((d, i) => {
              const c = done.get(i);
              return (
                <li key={i} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${c ? 'border-success/40 bg-success/5' : ''}`}>
                  <span className="min-w-[200px] flex-1 text-label">{d}</span>
                  {c ? <span className="flex items-center gap-1 text-caption text-success-text"><CheckCircle2 className="w-4 h-4" />{c.name} · {String(c.at).slice(0, 10)}</span>
                    : <Button size="sm" onClick={() => confirm(i)} disabled={!name.trim() || busy >= 0}>{busy === i ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}확인</Button>}
                </li>
              );
            })}
          </ul>
        </section>
        {share.actions.length > 0 && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-title font-semibold">다음 할 일</h2>
            <ul className="mt-2 space-y-1 text-label">{share.actions.map((x) => <li key={x}>· {x}</li>)}</ul>
          </section>
        )}
        {state.error && <p className="text-caption text-destructive" role="alert">{state.error}</p>}
        <p className="text-micro text-muted-foreground">이 화면은 {String(share.expires_at).slice(0, 10)} 까지 열립니다. 수치와 일정은 미팅 시점 기준이며 이후 바뀔 수 있습니다.</p>
      </div>
    </div>
  );
}
