import React, { useEffect, useState } from 'react';
import { Loader2, MailX, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

// 콜드메일 받는 사람이 계정 없이 여는 화면: /u/<토큰> 수신거부, /b/<토큰> 회사소개서
const call = async (body) => {
  try { return (await base44.functions.invoke('outreach', body)).data; }
  catch (e) { const d = e?.response?.data; throw new Error(d?.error || e.message); }
};

export default function OutreachPublic() {
  const [, kind, token] = window.location.pathname.split('/');
  const [state, setState] = useState({ busy: kind === 'b', done: false, error: '', data: null });

  useEffect(() => {
    if (kind !== 'b') return;
    call({ action: 'brochure', token })
      .then((d) => { setState({ busy: false, done: true, error: '', data: d }); window.location.replace(d.url); })
      .catch((e) => setState({ busy: false, done: false, error: e.message, data: null }));
  }, [kind, token]);

  const unsubscribe = async () => {
    setState((s) => ({ ...s, busy: true }));
    try { const d = await call({ action: 'unsubscribe', token }); setState({ busy: false, done: true, error: '', data: d }); }
    catch (e) { setState({ busy: false, done: false, error: e.message, data: null }); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-sm">
        {kind === 'u' ? (
          <>
            <MailX className="mx-auto h-8 w-8 text-muted-foreground" />
            {state.done ? (
              <>
                <h1 className="text-h3 font-bold">수신거부되었습니다</h1>
                <p className="text-body text-muted-foreground">{state.data?.sender ? `${state.data.sender}에서 ` : ''}더 이상 광고 메일을 보내지 않습니다. 이미 예약된 메일도 보내지 않습니다.</p>
                <p className="text-caption text-muted-foreground">Unsubscribed. You will not receive further emails from us.</p>
              </>
            ) : (
              <>
                <h1 className="text-h3 font-bold">메일 수신을 거부하시겠습니까?</h1>
                <p className="text-body text-muted-foreground">아래 버튼을 누르면 이 주소로는 더 이상 메일을 보내지 않습니다. 비용은 들지 않습니다.</p>
                <Button className="w-full" onClick={unsubscribe} disabled={state.busy}>{state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}수신거부 (Unsubscribe)</Button>
              </>
            )}
          </>
        ) : (
          <>
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            {state.busy ? <p className="flex items-center justify-center gap-2 text-body"><Loader2 className="h-4 w-4 animate-spin" />회사소개서를 여는 중…</p>
              : state.done ? <p className="text-body">회사소개서가 열리지 않으면 <a className="text-primary underline" href={state.data?.url}>여기</a>를 누르세요.</p> : null}
          </>
        )}
        {state.error && <p className="text-caption text-destructive">{state.error === '링크를 찾을 수 없습니다' ? '링크가 맞지 않거나 만료되었습니다.' : state.error}</p>}
      </div>
    </main>
  );
}
