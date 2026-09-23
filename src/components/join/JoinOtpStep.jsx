import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// 가입 직후 이메일로 받은 인증 코드 입력
export default function JoinOtpStep({ email, busy, onSubmit, onResend }) {
  const [code, setCode] = useState('');
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(code.trim()); }}>
      <p className="text-sm text-muted-foreground"><strong className="text-foreground">{email}</strong> 으로 보낸 인증 코드를 입력하세요.</p>
      <div className="space-y-1.5"><Label>인증 코드</Label><Input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className="tracking-[0.4em] text-center text-lg" /></div>
      <Button type="submit" className="w-full" disabled={busy || !code.trim()}>{busy && <Loader2 className="animate-spin" />}인증하고 로그인</Button>
      <button type="button" onClick={onResend} disabled={busy} className="w-full text-xs text-muted-foreground hover:text-foreground">코드 다시 보내기</button>
    </form>
  );
}