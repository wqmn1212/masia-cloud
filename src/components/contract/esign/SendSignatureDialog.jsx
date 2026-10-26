import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { generateContractPDF } from '@/lib/generateContractPDF';
import { hasEsignClause } from '@/lib/esignContracts';

// 서명 요청 보내기 전 확인 창: 서명자(고객사 계정), 기한, 전자서명 조항·금액·당사자명을 한 번 더 보여 주고
// 지금 본문으로 PDF 를 만들어 서버에 올린다. 서버가 지문값을 계산해 원본으로 고정한다.
export default function SendSignatureDialog({ open, onOpenChange, contract, clientName, onSent }) {
  const [signer, setSigner] = useState('');
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['signature-signers', contract?.id], enabled: open && !!contract?.id,
    queryFn: async () => (await base44.functions.invoke('sendSignatureRequest', { mode: 'signers', contract_id: contract.id })).data,
  });
  const signers = data?.signers || [];
  useEffect(() => { if (open && signers.length && !signer) setSigner(signers.find((s) => !s.shared)?.id || signers[0].id); }, [open, signers, signer]);

  const checks = [
    { ok: hasEsignClause(contract?.body), text: '전자서명 조항 (제○조 (전자서명))' },
    { ok: !!contract?.client_id, text: `고객사 연결${clientName ? `: ${clientName}` : ''}` },
    { ok: !!contract?.amount_usd || contract?.contract_type === 'SERVICE', text: contract?.amount_usd ? `계약 금액 USD ${Number(contract.amount_usd).toLocaleString()}` : '계약 금액 (월 구독은 본문의 이용료)' },
    { ok: !/_{4,}/.test(contract?.body || ''), text: '본문의 빈칸(____) 채움', warn: true },
  ];
  const blocking = checks.some((c) => !c.ok && !c.warn);
  const sel = signers.find((s) => s.id === signer);

  const send = async () => {
    setBusy(true);
    try {
      const file = await generateContractPDF(contract, { returnFile: true });
      const res = await base44.functions.invoke('sendSignatureRequest', { mode: 'send', contract_id: contract.id, signer_user_id: signer, due_days: days, pdf_base64: file.base64, page_count: file.pages });
      toast({ title: '서명 요청을 보냈습니다', description: `${res.data.document_no} · 고객에게 앱 알림과 메일이 갔습니다` });
      onSent?.(res.data);
      onOpenChange(false);
    } catch (e) {
      toast({ title: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" />전자서명 요청</DialogTitle>
          <DialogDescription>지금 저장된 본문으로 PDF 를 만들어 고정합니다. 보낸 뒤에는 본문을 고칠 수 없고, 고치려면 회수한 뒤 새 버전으로 보냅니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">{contract?.contract_title}</p>
            <ul className="mt-2 space-y-1">
              {checks.map((c) => (
                <li key={c.text} className="flex items-center gap-1.5 text-xs">
                  {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <AlertTriangle className={`h-3.5 w-3.5 ${c.warn ? 'text-chart-3' : 'text-destructive'}`} />}
                  <span className={c.ok ? '' : c.warn ? 'text-chart-3' : 'text-destructive'}>{c.text}{!c.ok && !c.warn ? ' — 필요' : !c.ok ? ' — 확인하세요' : ''}</span>
                </li>
              ))}
            </ul>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">서명자 (고객사 계정)</span>
            {isLoading ? <div className="flex h-9 items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              : signers.length === 0 ? <p className="text-xs text-destructive">이 고객사에 활성 계정이 없습니다. 고객 계정을 먼저 만들어 주세요.</p>
              : <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={signer} onChange={(e) => setSigner(e.target.value)}>
                  {signers.map((s) => <option key={s.id} value={s.id}>{s.name || '이름 없음'} · {s.email}</option>)}
                </select>}
            {sel?.shared && <span className="flex items-center gap-1 text-[11px] text-chart-3"><AlertTriangle className="h-3 w-3" />공용 메일 계정입니다. 누가 서명했는지 남기려면 결재권자 개인 계정을 만들어 보내는 편이 좋습니다.</span>}
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">서명 기한</span>
            <div className="flex items-center gap-2"><Input type="number" min={1} max={60} className="w-24" value={days} onChange={(e) => setDays(e.target.value)} /><span className="text-sm text-muted-foreground">일 뒤까지 (기본 14일)</span></div>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>취소</Button>
          <Button disabled={busy || blocking || !signer} onClick={send} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}서명 요청 보내기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
