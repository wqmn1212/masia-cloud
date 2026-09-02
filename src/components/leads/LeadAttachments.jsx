import React, { useState } from 'react';
import { Download, Loader2, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatBytes } from './leadMeta';

export default function LeadAttachments({ attachments = [] }) {
  const [loading, setLoading] = useState(null);

  const open = async (a, i) => {
    if (!a.url) return;
    setLoading(i);
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: a.url, expires_in: 300 });
    setLoading(null);
    window.open(signed_url, '_blank');
  };

  if (attachments.length === 0) return <p className="text-sm text-muted-foreground">첨부 없음</p>;
  return (
    <ul className="space-y-1.5">
      {attachments.map((a, i) => (
        <li key={i} className="flex items-center gap-2 text-sm border rounded-md px-3 py-2">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate flex-1">{a.name}</span>
          <span className="text-xs text-muted-foreground">{formatBytes(a.size)}</span>
          {a.url ? (
            <button type="button" onClick={() => open(a, i)} className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
              {loading === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}열기
            </button>
          ) : (
            <span className="text-xs text-destructive">업로드 실패</span>
          )}
        </li>
      ))}
    </ul>
  );
}