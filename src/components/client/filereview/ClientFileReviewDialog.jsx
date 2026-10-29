import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Columns2, ExternalLink, Loader2, MapPin, PenLine, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import PdfViewer from '@/components/signature/PdfViewer';
import { REVIEW_LABEL, MAX_PINS, viewKind } from '@/lib/fileReview';
import { useDecisionGate, decisionToast, financeOnlyText, viaApprovalText } from '../approval/ClientDecisionContext';
import ApprovalPendingNote from '../approval/ApprovalPendingNote';

// 디자인·도면 고객 확인: 이번 판(과 이전 판)을 보고, 고칠 위치를 눌러 핀 의견을 남긴 뒤 승인 또는 수정 요청.
// 이미지·PDF 는 화면에서 바로 보고, 그 밖의 파일(ai 등)은 내려받아 확인한 뒤 의견을 글로 남긴다.
const STATUS_CLS = { PENDING: 'bg-warning/15 text-warning-text', APPROVED: 'bg-primary/15 text-primary', REVISION_REQUESTED: 'bg-destructive/15 text-destructive' };
// 휴대폰에서는 이번 판만 먼저 보여 준다 (나란히 보면 세로로 길어진다)
const wideScreen = () => (typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia('(min-width: 640px)').matches);
const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

function useFileUrl(cardId, attachmentId, enabled) {
  return useQuery({
    queryKey: ['client-file-url', attachmentId],
    enabled: !!attachmentId && enabled,
    staleTime: 4 * 60 * 1000, // 서명 주소는 5분
    queryFn: async () => (await base44.functions.invoke('getDocumentAccess', { kind: 'attachment', document_id: attachmentId, card_id: cardId })).data?.url || '',
  });
}

function PinDot({ pin, active, onClick }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={cn('absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none border-2 border-white text-micro font-bold text-white shadow', active ? 'bg-destructive' : 'bg-primary')}
      style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }} aria-label={`의견 ${pin.n}`} title={pin.text}>
      {pin.n}
    </button>
  );
}

// 파일 한 판을 그린다. onPin 이 있으면 눌러서 핀을 꽂는다
function FileView({ url, loading, kind, pins = [], activeN, onPin, onSelect, label }) {
  const dots = (page) => pins.filter((p) => p.page === page).map((p) => <PinDot key={p.n} pin={p} active={p.n === activeN} onClick={() => onSelect?.(p.n)} />);
  return (
    <div className="min-w-0 space-y-1">
      {label && <p className="text-caption font-medium text-muted-foreground">{label}</p>}
      {loading || !url ? <div className="flex h-60 items-center justify-center rounded-lg bg-muted/60"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : kind === 'image' ? (
          <div className="rounded-lg bg-muted/60 p-2">
            <div className={cn('relative mx-auto w-fit', onPin && 'cursor-crosshair')}
              onClick={onPin ? (e) => { const b = e.currentTarget.getBoundingClientRect(); onPin(1, (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height); } : undefined}>
              <img src={url} alt={label || '디자인 파일'} className="block max-h-[60vh] max-w-full select-none" draggable={false} />
              {dots(1)}
            </div>
          </div>
        )
        : <PdfViewer url={url} className="max-h-[60vh]" maxWidth={640} endLabel="파일 끝" errorText="파일을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요." overlay={dots} onPageClick={onPin} />}
    </div>
  );
}

export default function ClientFileReviewDialog({ cardId, review, onClose }) {
  const qc = useQueryClient();
  const open = !!review;
  const kind = viewKind(review?.file_type);
  const gate = useDecisionGate('file_review', review?.id);
  const answerable = review?.status === 'PENDING' && gate.canDecide;
  const [pins, setPins] = useState([]);
  const [note, setNote] = useState('');
  const [activeN, setActiveN] = useState(null);
  const [compare, setCompare] = useState(wideScreen);
  useEffect(() => { setPins([]); setNote(''); setActiveN(null); setCompare(wideScreen()); }, [review?.id]);

  const current = useFileUrl(cardId, review?.attachment_id, open);
  const previous = useFileUrl(cardId, review?.previous_attachment_id, open && compare && kind !== 'other');
  const shownPins = review?.status === 'PENDING' ? pins : review?.pins || [];

  const addPin = (page, x, y) => {
    if (pins.length >= MAX_PINS) { toast({ title: `의견은 ${MAX_PINS}개까지 남길 수 있습니다` }); return; }
    const n = (pins.at(-1)?.n || 0) + 1;
    setPins((list) => [...list, { n, page, x, y, text: '' }]);
    setActiveN(n);
  };
  const editPin = (n, text) => setPins((list) => list.map((p) => (p.n === n ? { ...p, text } : p)));
  const removePin = (n) => setPins((list) => list.filter((p) => p.n !== n));
  const filled = pins.filter((p) => p.text.trim());

  const decide = useMutation({
    mutationFn: async (decision) => (await base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'file_review_decision', review_id: review.id, decision, note, pins: filled })).data,
    onSuccess: (data, decision) => {
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      decisionToast(data, { title: decision === 'APPROVED' ? '이 판을 승인했습니다' : '수정을 요청했습니다', description: '담당자에게 바로 알림이 갑니다.' });
      onClose();
    },
    onError: (e) => toast({ title: '보내지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  const approve = () => window.confirm(gate.viaApproval ? '이 판의 승인을 결재권자에게 요청할까요?' : '이 판으로 확정할까요? 승인한 판이 인쇄·제작 기준이 됩니다.') && decide.mutate('APPROVED');
  const canCompare = !!review?.previous_attachment_id && kind !== 'other';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !decide.isPending) onClose(); }}>
      <DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-y-auto grid-cols-[minmax(0,1fr)]">
        {review && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-base">
                {review.file_name}
                <Badge className={cn('border-0', STATUS_CLS[review.status])}>{REVIEW_LABEL[review.status]}</Badge>
              </DialogTitle>
              <DialogDescription className="whitespace-pre-wrap text-label">
                {review.question}
                {review.due_date ? `\n회신 기한 ${review.due_date}` : ''} · {review.requested_by_name} 요청 {when(review.requested_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              {canCompare && (
                <Button type="button" size="sm" variant={compare ? 'secondary' : 'outline'} className="h-8 gap-1 text-label" aria-pressed={compare} onClick={() => setCompare((v) => !v)}>
                  <Columns2 className="h-3.5 w-3.5" />이전 판과 나란히
                </Button>
              )}
              {current.data && <Button asChild size="sm" variant="ghost" className="h-8 gap-1 text-label"><a href={current.data} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />새 창에서 열기</a></Button>}
              {answerable && kind !== 'other' && <p className="text-caption text-muted-foreground"><MapPin className="mr-0.5 inline h-3.5 w-3.5" />고칠 곳을 누르면 번호 핀이 생기고, 오른쪽(아래)에 의견을 적습니다.</p>}
            </div>

            <div className={cn('grid gap-3', canCompare && compare ? 'lg:grid-cols-2' : '', answerable || shownPins.length ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : '')}>
              {kind === 'other' ? (
                <p className="rounded-lg bg-muted/60 p-6 text-center text-label text-muted-foreground">이 파일은 화면에서 바로 볼 수 없습니다. '새 창에서 열기'로 내려받아 확인한 뒤 의견을 글로 남겨 주세요.</p>
              ) : (
                <div className={cn('grid gap-3', canCompare && compare && 'sm:grid-cols-2')}>
                  {canCompare && compare && <FileView label="이전 판" url={previous.data} loading={previous.isLoading} kind={kind} />}
                  <FileView label={canCompare && compare ? '이번 판' : ''} url={current.data} loading={current.isLoading} kind={kind} pins={shownPins} activeN={activeN}
                    onPin={answerable ? addPin : undefined} onSelect={setActiveN} />
                </div>
              )}

              {(answerable || shownPins.length > 0) && (
                <aside className="space-y-2">
                  <p className="text-label font-semibold">위치 의견 {shownPins.length}개</p>
                  {shownPins.length === 0 && <p className="text-caption text-muted-foreground">파일에서 고칠 곳을 눌러 의견을 남기세요. 글로만 남기셔도 됩니다.</p>}
                  <ol className="space-y-1.5">
                    {shownPins.map((p) => (
                      <li key={p.n} className={cn('flex items-start gap-1.5 rounded-md border p-1.5', activeN === p.n && 'border-destructive/50 bg-destructive/5')}>
                        <button type="button" onClick={() => setActiveN(p.n)} className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-micro font-bold text-primary-foreground">{p.n}</button>
                        {review.status === 'PENDING' ? (
                          <>
                            <Input autoFocus={activeN === p.n && !p.text} value={p.text} maxLength={500} onFocus={() => setActiveN(p.n)} onChange={(e) => editPin(p.n, e.target.value)} placeholder={`${kind === 'pdf' ? `${p.page}쪽 · ` : ''}고칠 내용`} className="h-8 text-label" disabled={decide.isPending} />
                            <button type="button" onClick={() => removePin(p.n)} className="mt-1.5 text-muted-foreground hover:text-destructive" aria-label={`의견 ${p.n} 지우기`}><Trash2 className="h-3.5 w-3.5" /></button>
                          </>
                        ) : <p className="min-w-0 text-label">{kind === 'pdf' && <span className="text-muted-foreground">{p.page}쪽 · </span>}{p.text}</p>}
                      </li>
                    ))}
                  </ol>
                </aside>
              )}
            </div>

            {review.status !== 'PENDING' ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-label">
                <b>{REVIEW_LABEL[review.status]}</b> · {review.decided_by_name} · {when(review.decided_at)}
                {review.decision_note && <span className="mt-0.5 block whitespace-pre-wrap">{review.decision_note}</span>}
              </p>
            ) : gate.pending ? (
              <ApprovalPendingNote approval={gate.pending} cardId={cardId} />
            ) : (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} disabled={!answerable || decide.isPending}
                  placeholder="전체 의견 (선택) · 예: 색상은 좋고, 로고만 위치를 옮겨 주세요" className="text-body" />
                <div className="flex flex-wrap gap-2">
                  <Button className="flex-1 gap-1" disabled={!answerable || decide.isPending} onClick={approve}>
                    {decide.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}이 판으로 승인
                  </Button>
                  <Button variant="outline" className="flex-1 gap-1" disabled={!answerable || decide.isPending || (!note.trim() && !filled.length)} onClick={() => decide.mutate('REVISION_REQUESTED')}>
                    <PenLine className="h-4 w-4" />수정 요청{filled.length ? ` (의견 ${filled.length}개)` : ''}
                  </Button>
                </div>
                {gate.financeOnly ? <p className="text-caption text-muted-foreground">{financeOnlyText}</p>
                  : !gate.canDecide ? <p className="text-caption text-muted-foreground">승인·수정 요청은 고객사 계정에서만 선택할 수 있습니다.</p>
                  : gate.viaApproval && <p className="text-caption text-muted-foreground">승인: {viaApprovalText} 수정 요청은 바로 전달됩니다.</p>}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
