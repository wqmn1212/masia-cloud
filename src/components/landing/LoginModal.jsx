import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, LogIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const COPY = {
  ko: { title: '로그인', email: '이메일', password: '비밀번호', submit: '로그인', submitting: '로그인 중...', error: '이메일 또는 비밀번호가 올바르지 않습니다.', hint: '문의 승인 후 받으신 초대 메일로 계정을 먼저 활성화해 주세요.' },
  en: { title: 'Log in', email: 'Email', password: 'Password', submit: 'Log in', submitting: 'Signing in...', error: 'Incorrect email or password.', hint: 'Activate your account first via the invite email you received after approval.' },
  zh: { title: '登录', email: '邮箱', password: '密码', submit: '登录', submitting: '登录中...', error: '邮箱或密码不正确。', hint: '请先通过审核后收到的邀请邮件激活账号。' },
};

export default function LoginModal({ lang, open, onClose }) {
  const c = COPY[lang] || COPY.ko;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      // 초대를 처음 수락한 계정은 아직 account_tier 가 없으므로 로그인 직후 바로 적용한다
      try { await base44.functions.invoke('claimInvitation', {}); } catch (_e) { /* 초대 없으면 무시 */ }
      const me = await base44.auth.me();
      window.location.href = me?.account_tier === 'client' ? '/client/board' : '/dashboard';
    } catch (_err) {
      setError(c.error);
      setStatus('error');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl p-7 shadow-[0_20px_60px_rgba(23,23,25,.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-landing-ink">{c.title}</h2>
          <button type="button" onClick={onClose} className="text-landing-muted hover:text-landing-ink">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-landing-ink2">{c.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-landing-line3 rounded-[9px] px-[13px] py-[11px] text-[14.5px] outline-none bg-landing-input focus:border-landing-brand focus:bg-white transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-landing-ink2">{c.password}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-landing-line3 rounded-[9px] px-[13px] py-[11px] text-[14.5px] outline-none bg-landing-input focus:border-landing-brand focus:bg-white transition-colors"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full flex items-center justify-center gap-2 bg-landing-ink hover:bg-landing-brand-hover disabled:opacity-60 text-white text-[14.5px] font-bold py-[12px] rounded-[10px] transition-colors"
          >
            {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {status === 'sending' ? c.submitting : c.submit}
          </button>
          {status === 'error' && <p className="text-[13px] text-landing-danger bg-landing-danger-bg rounded-lg px-3 py-2">{error}</p>}
          <p className="text-[11.5px] text-landing-muted2 text-center leading-relaxed">{c.hint}</p>
        </form>
      </div>
    </div>,
    document.body
  );
}
