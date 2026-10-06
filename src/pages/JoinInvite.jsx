import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getHomePath } from '@/lib/menuPermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// 로그인된 브라우저에서 초대 링크를 연 경우: 같은 계정이면 홈, 다른 계정이면 전환 안내
export default function JoinInvite() {
  const { user } = useAuth();
  const invited = (new URLSearchParams(window.location.search).get('email') || '').trim().toLowerCase();
  const current = (user?.email || '').toLowerCase();
  if (!invited || invited === current) return <Navigate to={user ? getHomePath(user) : '/'} replace />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm"><CardContent className="p-6 space-y-4">
        <h1 className="text-lg font-bold">다른 계정으로 로그인되어 있습니다</h1>
        <p className="text-sm text-muted-foreground">현재 {current}로 로그인되어 있습니다. 초대받은 {invited}으로 계속하려면 로그아웃하세요.</p>
        <Button className="w-full" onClick={() => base44.auth.logout(`/join${window.location.search}`)}>로그아웃하고 계속</Button>
      </CardContent></Card>
    </div>
  );
}