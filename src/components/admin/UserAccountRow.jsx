import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { KeyRound, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UserAccountRow({ user, onToggle, onPermissions, onResetPassword, disabled, resetPending }) {
  const active = user.is_active !== false;
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-body truncate">{user.full_name || user.email}</span>
          {user.account_label && (
            <Badge variant="outline" className="text-micro">{user.account_label}</Badge>
          )}
        </div>
        <p className="text-caption text-muted-foreground truncate">{user.email}</p>
      </div>
      {onPermissions && (
        <Button variant="outline" size="sm" onClick={onPermissions}>
          <KeyRound className="w-3.5 h-3.5" /> 메뉴 권한
        </Button>
      )}
      {onResetPassword && (
        <Button variant="outline" size="sm" onClick={onResetPassword} disabled={resetPending}>
          <KeyRound className="w-3.5 h-3.5" /> 비밀번호 설정 메일
        </Button>
      )}
      <Badge
        variant="outline"
        className={active
          ? 'bg-success/10 text-success-text border-success/30 text-micro'
          : 'bg-destructive/10 text-destructive border-destructive/30 text-micro'}
      >
        {active ? '활성' : '비활성'}
      </Badge>
      <Switch
        checked={active}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-label="계정 활성 상태"
      />
    </div>
  );
}