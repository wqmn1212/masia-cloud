import { useState } from 'react';
import { Mail, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PendingInviteRow({ invite, isClientTeam }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/join?email=${encodeURIComponent(invite.email)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return <div className="flex items-center gap-3 p-3">
    <Mail className="h-4 w-4 text-muted-foreground" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{invite.email}</p>
      <p className="text-xs text-muted-foreground">{isClientTeam ? '고객사 팀원' : (invite.team_role_name || '팀원')} · 참여 링크에서 비밀번호 설정</p>
    </div>
    <span className="rounded-full bg-chart-3/15 px-2 py-0.5 text-xs font-medium text-chart-3">비밀번호 설정 대기</span>
    <Button type="button" variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '복사됨' : '참여 링크'}</Button>
  </div>;
}