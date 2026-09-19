import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export default function InviteLinkNotice() {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/join`;
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
    <p>초대받은 사람은 아래 참여 링크로 접속해야 로그인 화면이 먼저 열리고, 로그인 후 권한이 자동 적용됩니다.</p>
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-background px-2 py-1 text-foreground">{link}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '복사됨' : '복사'}</Button>
    </div>
  </div>;
}