import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

// 보고용 PDF 저장 버튼. generate 는 PDF 를 만들어 저장하는 async 함수.
export default function PdfButton({ generate, label = 'PDF로 저장', size = 'sm', variant = 'outline', className = '' }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await generate(); }
    catch (e) { toast({ title: 'PDF를 만들지 못했습니다', description: e?.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <Button type="button" size={size} variant={variant} className={`gap-1.5 ${className}`} disabled={busy} onClick={run}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}{busy ? 'PDF 만드는 중…' : label}
    </Button>
  );
}
