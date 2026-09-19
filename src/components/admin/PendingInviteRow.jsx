import { useState } from 'react';
import { Mail, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PendingInviteRow({ invite, isClientTeam }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/join`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return <div className="flex items-center gap-3 p-3">
    <Mail className="h-4 w-4 text-muted-foreground" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{invite.email}</p>
      <p className="text-xs text-muted-foreground">{isClientTeam ? '참여 링크로 접속해 가입하면 권한이 적용됩니다' : (invite.team_role_name || '팀원')}</p>
    </div>
    <span className="text-xs font-medium text-amber-600">가입 대기 중</span>
    <Button type="button" variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '복사됨' : '참여 링크'}</Button>
  </div>;
}