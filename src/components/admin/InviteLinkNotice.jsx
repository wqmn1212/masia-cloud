import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export default function InviteLinkNotice({ email = '' }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/join${email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ''}`;
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
    <p>이 참여 링크를 전달하세요. 링크를 열면 이메일이 채워진 <strong className="text-foreground">비밀번호 설정 화면</strong>이 바로 뜨고, 비밀번호와 메일로 받은 인증 코드를 입력하면 즉시 로그인되어 권한이 적용됩니다.</p>
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded bg-background px-2 py-1 text-foreground">{link}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '복사됨' : '복사'}</Button>
    </div>
  </div>;
}