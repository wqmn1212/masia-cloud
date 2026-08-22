import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function NoTenantError() {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-3">
        <ShieldAlert className="w-10 h-10 mx-auto text-destructive" />
        <h1 className="text-lg font-semibold">소속 팀이 지정되지 않은 계정입니다</h1>
        <p className="text-sm text-muted-foreground">
          데이터 격리 정책에 따라 소속 팀이 없는 계정은 앱을 사용할 수 없습니다.
          팀 관리자에게 소속 팀 배정을 요청해 주세요.
        </p>
      </div>
    </div>
  );
}