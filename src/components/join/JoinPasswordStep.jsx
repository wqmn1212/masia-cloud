import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// 비밀번호 설정(가입) 또는 기존 계정 로그인 입력
export default function JoinPasswordStep({ email, setEmail, mode, busy, onSubmit }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const isSignup = mode === 'signup';
  const mismatch = isSignup && confirm && password !== confirm;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!mismatch) onSubmit(password); }}>
      <div className="space-y-1.5"><Label>이메일</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>{isSignup ? '새 비밀번호' : '비밀번호'}</Label><Input type="password" required minLength={isSignup ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSignup ? '8자 이상' : ''} /></div>
      {isSignup && <div className="space-y-1.5"><Label>비밀번호 확인</Label><Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />{mismatch && <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>}</div>}
      <Button type="submit" className="w-full" disabled={busy || mismatch}>{busy && <Loader2 className="animate-spin" />}{isSignup ? '비밀번호 설정하고 시작하기' : '로그인'}</Button>
    </form>
  );
}