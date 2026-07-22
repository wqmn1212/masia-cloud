import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { KeyRound, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UserAccountRow({ user, onToggle, onPermissions, disabled }) {
  const active = user.is_active !== false;
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{user.full_name || user.email}</span>
          {user.account_label && (
            <Badge variant="outline" className="text-[10px]">{user.account_label}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      {onPermissions && (
        <Button variant="outline" size="sm" onClick={onPermissions}>
          <KeyRound className="w-3.5 h-3.5" /> 메뉴 권한
        </Button>
      )}
      <Badge
        variant="outline"
        className={active
          ? 'bg-green-50 text-green-700 border-green-200 text-[10px]'
          : 'bg-red-50 text-red-700 border-red-200 text-[10px]'}
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