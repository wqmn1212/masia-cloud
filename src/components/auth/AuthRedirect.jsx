import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function AuthRedirect({ to, onComplete }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (to) {
      navigate(to, { replace: true });
      onComplete?.();
    } else {
      // Keep invitation parameters in the return address; the platform owns signup/passwords.
      base44.auth.redirectToLogin(window.location.href);
    }
  }, [to, navigate, onComplete]);
  return <div className="fixed inset-0 flex items-center justify-center" role="status" aria-label="로그인 및 초대 정보를 확인하는 중">
    <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
  </div>;
}