import { ShieldX } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function AccessDenied() {
  return (
    <Card className="max-w-md mx-auto mt-16 p-10 text-center">
      <ShieldX className="w-10 h-10 mx-auto text-muted-foreground" />
      <h2 className="mt-4 font-semibold">접근 권한이 없습니다</h2>
      <p className="mt-1 text-sm text-muted-foreground">팀 마스터에게 이 메뉴의 권한을 요청하세요.</p>
    </Card>
  );
}