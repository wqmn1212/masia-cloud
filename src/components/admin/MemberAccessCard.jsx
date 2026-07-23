import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

const ROLE_LABELS = { manager: '관리자', member: '일반 멤버', viewer: '조회 전용' };

export default function MemberAccessCard({ member, onEdit }) {
  return (
    <div className="flex items-center gap-3 border-b p-4 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{member.full_name || member.account_label || member.email}</p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <Badge variant="secondary">{ROLE_LABELS[member.team_role || 'member']}</Badge>
      <span className="hidden sm:block text-xs text-muted-foreground">메뉴 {(member.allowed_tabs || []).length}개</span>
      <Button size="sm" variant="outline" onClick={onEdit}>
        <ShieldCheck className="w-3.5 h-3.5" /> 권한 설정
      </Button>
    </div>
  );
}