import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

export default function MemberAccessCard({ member, onEdit }) {
  return (
    <div className="flex items-center gap-3 border-b p-4 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{member.full_name || member.account_label || member.email}</p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <Badge variant="secondary">{member.team_role_name || '역할 미배정'}</Badge>
      <span className="hidden sm:block text-xs text-muted-foreground">메뉴 {(member.allowed_tabs || []).length}개</span>
      <Button size="sm" variant="outline" onClick={onEdit}>
        <ShieldCheck className="w-3.5 h-3.5" /> 권한 설정
      </Button>
    </div>
  );
}