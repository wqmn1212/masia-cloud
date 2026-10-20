import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Check, ImagePlus, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import { MAX_FILES, mergeFiles, toAttachmentPayload } from '@/lib/clientFileUpload';
import { CLAIM_RESOLUTION, CLAIM_STATUS, CLAIM_STEPS } from '@/lib/claims';

const EMPTY = { title: '', description: '', defect_qty: '', received_qty: '', lot_note: '' };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');

function NewClaimDialog({ cardId, open, onClose, onDone }) {
  const [f, setF] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const addFiles = (list) => {
    const { files: next, rejected } = mergeFiles(files, list);
    if (rejected.length) toast({ title: '일부 사진 제외', description: `${rejected.join(', ')} (최대 ${MAX_FILES}장 · 10MB)`, variant: 'destructive' });
    setFiles(next);
  };
  const submit = useMutation({
    mutationFn: async () => base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'claim_create', claim: f, attachments: await toAttachmentPayload(files) }),
    onSuccess: () => {
      toast({ title: '불량 신고를 접수했습니다', description: '담당자가 확인 후 공장에 전달하고, 처리 상황을 여기에서 알려드립니다.' });
      setF(EMPTY); setFiles([]); onDone(); onClose();
    },
    onError: (e) => toast({ title: '접수하지 못했습니다', description: e.response?.data?.error || e.message, variant: 'destructive' }),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="text-base">불량 신고</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1 text-xs"><span className="font-semibold">무엇이 문제인가요? *</span><Input value={f.title} onChange={set('title')} placeholder="예: 버튼이 눌린 채로 돌아오지 않음" /></label>
          <label className="block space-y-1 text-xs"><span className="font-semibold">자세한 내용 *</span><Textarea rows={4} value={f.description} onChange={set('description')} placeholder="언제·어떻게 발견했는지, 어떤 상태인지 적어 주세요. 사진과 함께 보내면 공장에 바로 전달할 수 있습니다." /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs"><span className="font-semibold">불량 수량</span><Input type="number" min="0" inputMode="numeric" value={f.defect_qty} onChange={set('defect_qty')} /></label>
            <label className="space-y-1 text-xs"><span className="font-semibold">받은 수량</span><Input type="number" min="0" inputMode="numeric" value={f.received_qty} onChange={set('received_qty')} /></label>
          </div>
          <label className="block space-y-1 text-xs"><span className="font-semibold">입고일·박스 번호 (선택)</span><Input value={f.lot_note} onChange={set('lot_note')} placeholder="예: 10/30 입고, 12번·15번 박스" /></label>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold">사진 (최대 {MAX_FILES}장)</p>
            <div className="flex flex-wrap gap-1.5">
              {files.map((file, i) => (
                <span key={`${file.name}-${i}`} className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]">{file.name}<button type="button" aria-label={`${file.name} 빼기`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></span>
              ))}
              {files.length < MAX_FILES && <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => inputRef.current?.click()}><ImagePlus className="h-3.5 w-3.5" />사진 추가</Button>}
            </div>
            <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = ''; }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button disabled={submit.isPending || !f.title.trim() || !f.description.trim()} onClick={() => submit.mutate()}>{submit.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />접수 중…</> : '신고 접수'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClaimItem({ c }) {
  const at = CLAIM_STEPS.indexOf(c.status);
  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{c.title}</p>
        <Badge className={`border-0 ${c.status === 'RESOLVED' ? 'bg-primary/10 text-primary' : c.status === 'REJECTED' ? 'bg-muted text-muted-foreground' : 'bg-chart-3/15 text-chart-3'}`}>{CLAIM_STATUS[c.status]}</Badge>
      </div>
      {c.status !== 'REJECTED' && (
        <ol className="flex items-center gap-1" aria-label="처리 단계">
          {CLAIM_STEPS.map((k, i) => (
            <li key={k} className="flex flex-1 flex-col items-center gap-1">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < at || (i === at && k === 'RESOLVED') ? 'bg-primary text-primary-foreground' : i === at ? 'border-2 border-primary text-primary' : 'border text-muted-foreground'}`}>{i < at || (i === at && k === 'RESOLVED') ? <Check className="h-3 w-3" /> : i + 1}</span>
              <span className={`text-center text-[10px] ${i === at ? 'font-semibold' : 'text-muted-foreground'}`}>{CLAIM_STATUS[k]}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{c.description}</p>
      <p className="text-[11px] text-muted-foreground">{fmtDate(c.submitted_at)} {c.submitted_by_name} 님 접수{c.defect_qty != null ? ` · 불량 ${c.defect_qty}개${c.received_qty ? ` / ${c.received_qty}개` : ''}` : ''}{c.lot_note ? ` · ${c.lot_note}` : ''}</p>
      {!!c.photos.length && (
        <div className="flex flex-wrap items-center gap-1">
          {c.photos.map((p) => <span key={p.id} className="flex items-center rounded-md border pl-2 text-[11px]">{p.file_name}<DocumentOpenButton document={{ ...p, document_kind: 'attachment' }} /></span>)}
        </div>
      )}
      {(c.client_message || c.resolution) && (
        <div className="rounded-md bg-muted/50 p-2 text-xs">
          {c.resolution && <p className="font-semibold">처리 방법: {CLAIM_RESOLUTION[c.resolution]}</p>}
          {c.client_message && <p className="mt-0.5 whitespace-pre-wrap">{c.client_message}</p>}
        </div>
      )}
    </li>
  );
}

// 고객 검수 탭: 받은 물건의 불량을 사진과 함께 신고하고 처리 단계를 본다
export default function ClientClaimPanel({ cardId, claims = [], onChanged }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const isClient = user?.account_tier === 'client';
  return (
    <section className="mt-6 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <AlertOctagon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">불량 신고</h3>
        {isClient && <Button size="sm" variant="outline" className="ml-auto h-8" onClick={() => setOpen(true)}>불량 신고하기</Button>}
      </div>
      {claims.length === 0 ? (
        <p className="text-xs text-muted-foreground">받은 물건에 불량이 있으면 사진과 함께 신고해 주세요. 품질 기준서와 검수 기록을 근거로 공장에 처리를 요구하고, 진행 상황을 여기에서 알려드립니다.</p>
      ) : <ul className="space-y-2">{claims.map((c) => <ClaimItem key={c.id} c={c} />)}</ul>}
      <NewClaimDialog cardId={cardId} open={open} onClose={() => setOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] }); onChanged?.(); }} />
    </section>
  );
}
