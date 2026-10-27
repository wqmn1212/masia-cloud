import React, { useState } from 'react';
import { CheckCircle2, FileSearch, Loader2, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// 문서 확인: PDF 의 SHA-256 을 브라우저에서 계산해 지문값만 서버로 보낸다 (파일은 올리지 않는다).
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const kstTime = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function VerifyDocumentDialog({ open, onOpenChange, client = false }) {
  const [state, setState] = useState(null); // { busy } | { sha, match } | { error }
  const check = async (file) => {
    if (!file) return;
    setState({ busy: true, name: file.name });
    try {
      const sha = hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      const payload = client ? withClientView({ sha256: sha }) : { sha256: sha };
      const res = await base44.functions.invoke('verifySignedDocument', payload);
      setState({ sha, name: file.name, match: res.data.match });
    } catch (e) {
      setState({ error: e?.response?.data?.error || e.message });
    }
  };
  const m = state?.match;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setState(null); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-primary" />문서 확인</DialogTitle>
          <DialogDescription>가지고 있는 계약서 PDF 가 이지스 클라우드에서 서명·발급한 파일과 같은지 확인합니다. 파일은 서버로 보내지 않고, 이 기기에서 계산한 지문값만 비교합니다.</DialogDescription>
        </DialogHeader>
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 text-body hover:bg-muted/50">
          {state?.busy ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <FileSearch className="h-5 w-5 text-muted-foreground" />}
          <span>{state?.name || 'PDF 파일 고르기'}</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => check(e.target.files?.[0])} />
        </label>
        {state?.error && <p className="text-body text-destructive">{state.error}</p>}
        {state?.sha && (m ? (
          <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-body">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">{m.kind === 'COMPLETED' ? '이지스가 발급한 완료본과 같습니다' : '서명 요청 때 고정한 원본과 같습니다'}</p>
              <p className="mt-0.5 text-label text-muted-foreground">{m.document_title} · {m.document_no}{m.version > 1 ? ` (${m.version}번째 버전)` : ''}{m.completed_at ? ` · ${kstTime(m.completed_at)} 체결` : ''}{m.signed_name ? ` · 서명 ${m.signed_name}` : ''}</p>
              {m.kind === 'ORIGINAL' && <p className="mt-1 text-label text-muted-foreground">서명 페이지가 붙은 체결본은 따로 발급됩니다.</p>}
            </div>
          </div>
        ) : (
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-body">
            <XCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div><p className="font-semibold">일치하는 문서가 없습니다</p><p className="mt-0.5 text-label text-muted-foreground">한 글자라도 바뀌었거나, 다른 회사의 문서이거나, 이지스 클라우드에서 서명하지 않은 파일입니다.</p></div>
          </div>
        ))}
        {state?.sha && <p className="break-all font-mono text-micro text-muted-foreground">SHA-256 {state.sha}</p>}
      </DialogContent>
    </Dialog>
  );
}
