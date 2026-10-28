import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { mergeFiles, toAttachmentPayload, MAX_FILES } from '@/lib/clientFileUpload';
import { kstToday } from './clientFormat';

// 고객 '송금했어요': 송금일·송금확인증·메모를 담당자에게 알린다. 입금 확인은 이지스가 통장을 확인한 뒤 한다.
const LABELS = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };

export default function ClientPaymentReportDialog({ cardId, stage, onClose }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [date, setDate] = useState(kstToday());
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  useEffect(() => {
    if (!stage) return;
    setDate(stage.reported_paid_date || kstToday());
    setNote(stage.report_note || '');
    setFiles([]);
  }, [stage?.id]);

  const send = useMutation({
    mutationFn: async () => (await base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'payment_reported', stage_id: stage.id, paid_date: date, note, attachments: await toAttachmentPayload(files) })).data,
    onSuccess: () => {
      toast({ title: '담당자에게 알렸습니다', description: '이지스가 통장 입금을 확인하면 "입금 확인"으로 바뀝니다.' });
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      qc.invalidateQueries({ queryKey: ['company-files'] });
      onClose();
    },
  });
  const add = (list) => {
    const { files: next, rejected } = mergeFiles(files, list);
    if (rejected.length) toast({ title: '일부 파일 제외', description: `${rejected.join(', ')} (최대 ${MAX_FILES}건 · 10MB)`, variant: 'destructive' });
    setFiles(next);
  };
  const label = LABELS[stage?.stage_type] || '대금';

  return (
    <Dialog open={!!stage} onOpenChange={(o) => { if (!o && !send.isPending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{label} 송금했어요</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <p className="text-label text-muted-foreground">담당자에게 송금 사실을 알립니다. 이지스가 통장 입금을 확인한 뒤 '입금 확인'으로 바뀝니다.</p>
          <label className="block text-label">송금한 날
            <Input className="mt-1 text-label" type="date" required max={kstToday()} value={date} onChange={(e) => setDate(e.target.value)} disabled={send.isPending} />
          </label>
          <div className="text-label">
            송금확인증 (권장)
            <div className="mt-1 space-y-1.5">
              {files.map((f) => (
                <p key={f.name} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-caption">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <button type="button" aria-label={`${f.name} 빼기`} onClick={() => setFiles((x) => x.filter((y) => y !== f))} disabled={send.isPending}><X className="h-3.5 w-3.5" /></button>
                </p>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-label" onClick={() => inputRef.current?.click()} disabled={send.isPending || files.length >= MAX_FILES}><Paperclip className="h-3.5 w-3.5" />파일 고르기</Button>
              <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { if (e.target.files?.length) add(Array.from(e.target.files)); e.target.value = ''; }} />
            </div>
          </div>
          <label className="block text-label">메모 (선택)
            <Input className="mt-1 text-label" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 기업은행에서 회사 명의로 송금" disabled={send.isPending} />
          </label>
          {send.error && <p role="alert" className="text-label text-destructive">{send.error?.response?.data?.error || '보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.'}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={send.isPending}>닫기</Button>
            <Button type="submit" disabled={send.isPending}>{send.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}담당자에게 알리기</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
