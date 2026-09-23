import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import JoinPasswordStep from '@/components/join/JoinPasswordStep';
import JoinOtpStep from '@/components/join/JoinOtpStep';

const errText = (e) => e?.response?.data?.detail || e?.response?.data?.message || e?.data?.detail || e?.message || '다시 시도해주세요.';
const isExists = (e) => /exist|already|registered/i.test(errText(e)) || e?.status === 409 || e?.response?.status === 409;

// 초대 참여 링크: 이메일이 채워진 비밀번호 설정 화면 → 인증 코드 → 자동 로그인
export default function JoinSetPassword() {
  const [email, setEmail] = useState(new URLSearchParams(window.location.search).get('email') || '');
  const [mode, setMode] = useState('signup'); // signup | otp | login
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async (fn) => { setBusy(true); setError(''); setInfo(''); try { await fn(); } catch (e) { setError(errText(e)); } finally { setBusy(false); } };
  const finishLogin = async (pw) => { await base44.auth.loginViaEmailPassword(email.trim().toLowerCase(), pw); window.location.replace('/'); };

  const signup = (pw) => run(async () => {
    setPassword(pw);
    try { await base44.auth.register({ email: email.trim().toLowerCase(), password: pw }); setMode('otp'); }
    catch (e) { if (!isExists(e)) throw e; setMode('login'); setInfo('이미 계정이 있는 이메일입니다. 비밀번호로 로그인하세요.'); }
  });
  const verify = (code) => run(async () => { await base44.auth.verifyOtp({ email: email.trim().toLowerCase(), otpCode: code }); await finishLogin(password); });
  const resend = () => run(async () => { await base44.auth.resendOtp(email.trim().toLowerCase()); setInfo('인증 코드를 다시 보냈습니다.'); });
  const login = (pw) => run(() => finishLogin(pw));
  const forgot = () => run(async () => { await base44.auth.resetPasswordRequest(email.trim().toLowerCase()); setInfo('비밀번호 재설정 메일을 보냈습니다. 메일의 링크에서 새 비밀번호를 설정하세요.'); });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 space-y-5">
          <div><h1 className="text-xl font-bold tracking-tight">{mode === 'login' ? '로그인' : '비밀번호 설정'}</h1><p className="mt-1 text-sm text-muted-foreground">{mode === 'login' ? '초대받은 계정으로 로그인하세요.' : '초대받은 이메일로 사용할 비밀번호를 정하면 바로 시작할 수 있습니다.'}</p></div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          {info && <p className="rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">{info}</p>}
          {mode === 'otp'
            ? <JoinOtpStep email={email} busy={busy} onSubmit={verify} onResend={resend} />
            : <JoinPasswordStep key={mode} email={email} setEmail={setEmail} mode={mode} busy={busy} onSubmit={mode === 'login' ? login : signup} />}
          <div className="flex justify-between text-xs text-muted-foreground">
            {mode === 'login' ? <button type="button" onClick={() => setMode('signup')} className="hover:text-foreground">처음이신가요? 비밀번호 설정</button> : <button type="button" onClick={() => setMode('login')} className="hover:text-foreground">이미 비밀번호가 있어요</button>}
            {mode === 'login' && <button type="button" onClick={forgot} disabled={busy || !email} className="hover:text-foreground">비밀번호 재설정</button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}