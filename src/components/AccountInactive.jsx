import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AccountInactive() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4 z-50">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">계정이 비활성화되었습니다</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          현재 계정은 관리자에 의해 비활성화 상태입니다.<br />
          서비스 사용이 필요하다면 담당 관리자에게 문의해 주세요.
        </p>
        <Button variant="outline" onClick={() => base44.auth.logout()}>
          로그아웃
        </Button>
      </div>
    </div>
  );
}