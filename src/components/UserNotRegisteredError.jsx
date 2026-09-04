import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

const UserNotRegisteredError = () => {
  const { logout } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 px-4">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
          <AlertTriangle className="w-8 h-8 text-orange-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">이용 권한이 없습니다</h1>
        <p className="text-slate-600 mb-6 leading-relaxed">
          담당자 승인 후 이용 가능합니다. 아직 계정 권한이 배정되지 않았습니다.
        </p>
        <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600 text-left mb-6">
          <ul className="list-disc list-inside space-y-1">
            <li>올바른 계정으로 로그인했는지 확인해 주세요</li>
            <li>승인까지 영업일 기준 1일 이내 소요됩니다</li>
            <li>문의는 담당자에게 연락해 주세요</li>
          </ul>
        </div>
        <Button variant="outline" className="w-full" onClick={() => logout(true)}>
          로그아웃
        </Button>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;