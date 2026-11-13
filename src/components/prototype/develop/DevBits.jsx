import React, { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { downloadText } from '@/lib/devkit/conceptExport';

export function Card({ title, icon: Icon, tag, children, actions, className = '' }) {
  return (
    <section className={`rounded-xl border bg-card p-5 space-y-3 min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
          <p className="text-title font-semibold">{title}</p>
          {tag && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-semibold text-primary">{tag}</span>}
          <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export async function copyText(text, label = '복사했습니다') {
  try { await navigator.clipboard.writeText(text); toast({ title: label }); return true; }
  catch { toast({ title: '복사하지 못했습니다. 직접 선택해 복사해 주세요.', variant: 'destructive' }); return false; }
}

export function CopyButton({ text, label = '복사', size = 'sm' }) {
  const [done, setDone] = useState(false);
  return (
    <Button size={size} variant="outline" onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1500); } }}>
      {done ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{label}
    </Button>
  );
}

export const DownloadButton = ({ text, name, type, label = '내려받기', variant = 'outline' }) => (
  <Button size="sm" variant={variant} onClick={() => downloadText(text, name, type)}><Download className="w-4 h-4" />{label}</Button>
);

/** 명령 한 줄 (복사 버튼 포함) */
export const CommandLine = ({ label, cmd }) => (
  <div className="space-y-1">
    {label && <p className="text-caption text-muted-foreground">{label}</p>}
    <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
      <code className="flex-1 min-w-0 break-all font-mono text-caption">{cmd}</code>
      <button type="button" onClick={() => copyText(cmd)} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="명령 복사"><Copy className="w-3.5 h-3.5" /></button>
    </div>
  </div>
);

/** 긴 글·코드 미리 보기 */
export const CodeView = ({ text, maxH = 'max-h-80' }) => (
  <pre className={`${maxH} overflow-auto rounded-lg border bg-secondary/60 p-3 font-mono text-micro leading-relaxed whitespace-pre`}>{text}</pre>
);

export const Field = ({ label, children, hint }) => (
  <label className="block space-y-1 min-w-0">
    <span className="block text-caption font-medium text-muted-foreground">{label}</span>
    {children}
    {hint && <span className="block text-micro text-muted-foreground">{hint}</span>}
  </label>
);
