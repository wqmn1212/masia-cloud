import { useState } from 'react';
import { Download, Loader2, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const fmtSize = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export default function LeadAttachmentList({ attachments = [] }) {
  const [busy, setBusy] = useState(null);

  const open = async (a, i) => {
    setBusy(i);
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: a.url, expires_in: 300 });
    window.open(signed_url, '_blank', 'noopener');
    setBusy(null);
  };

  if (!attachments.length) return <p className="text-sm text-muted-foreground">첨부 없음</p>;
  return (
    <ul className="space-y-1.5">
      {attachments.map((a, i) => (
        <li key={i} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate flex-1">{a.name}</span>
          <span className="text-xs text-muted-foreground">{fmtSize(a.size || 0)}</span>
          {a.url ? (
            <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy === i} onClick={() => open(a, i)}>
              {busy === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            </Button>
          ) : <span className="text-xs text-destructive">업로드 실패</span>}
        </li>
      ))}
    </ul>
  );
}