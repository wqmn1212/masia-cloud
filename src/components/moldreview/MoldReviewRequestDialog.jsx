import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { MAX_FILE_BYTES, toAttachmentPayload } from '@/lib/clientFileUpload';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';

const LEVEL = { hi: '높음', mid: '주의' };

// 고객이 자동 검토 결과를 이지스 담당자에게 넘겨 검토를 요청한다. 기존 고객 문의(submitClientInquiry) 경로로 카드가 만들어진다.
export function moldReviewSummary({ partName, fileName, result, report }) {
  const s = result.summary, c = report.calc;
  const issues = report.items.filter((it) => it.level === 'hi' || it.level === 'mid');
  return [
    '[금형 사전 검토 자동 결과]',
    `부품: ${partName || '-'}${fileName ? ` (${fileName})` : ''}`,
    `크기: ${s.size.map((v) => Math.round(v * 10) / 10).join(' × ')} mm · 재질: ${report.material.name} · 기본 살 두께: ${Math.round(s.nominal * 100) / 100} mm`,
    `빼기 방향: ${result.pull.label} · 언더컷 ${result.undercuts.length}곳 · 추천 사출기: ${c.machine}톤급 이상`,
    `판정: 높음 ${report.counts.hi}건 · 주의 ${report.counts.mid}건`,
    ...issues.map((it) => `- [${LEVEL[it.level]}] ${it.title.ko}`),
  ].join('\n');
}

export default function MoldReviewRequestDialog({ open, onOpenChange, partName, sourceFile, summary }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [quantity, setQuantity] = useState('');
  const [attach, setAttach] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentCardId, setSentCardId] = useState(null);
  const tooBig = !!sourceFile && sourceFile.size > MAX_FILE_BYTES;
  const canAttach = !!sourceFile && !tooBig;

  useEffect(() => {
    if (!open) return;
    setTitle(`금형 사전 검토 요청 · ${partName || '부품'}`.slice(0, 200));
    setMessage('');
    setQuantity('');
    setAttach(true);
    setSentCardId(null);
  }, [open, partName]);

  const send = async () => {
    setSending(true);
    try {
      const files = attach && canAttach ? await toAttachmentPayload([sourceFile]) : [];
      const detail = [message.trim(), summary].filter(Boolean).join('\n\n');
      const res = await base44.functions.invoke('submitClientInquiry', { title: title.trim(), detail, quantity: quantity.trim(), categories: [], attachments: files });
      setSentCardId(res.data?.card_id || 'sent');
      toast({ title: '검토 요청을 보냈습니다', description: '영업일 기준 1일 안에 담당자가 회신드립니다.' });
    } catch (e) {
      toast({ title: '요청을 보내지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>이지스 담당자에게 검토 요청</DialogTitle>
          <DialogDescription>자동 검토 결과를 담당자가 다시 확인하고, 공장 금형 설계자와 함께 보완점을 정리해 드립니다.</DialogDescription>
        </DialogHeader>
        {sentCardId ? (
          <div className="space-y-3 py-2 text-sm">
            <p>요청을 접수했습니다. 진행 상황은 소싱 보드의 새 카드에서 확인하실 수 있습니다.</p>
            <Button asChild variant="outline" className="w-full">
              <Link to={sentCardId === 'sent' ? '/client/board' : `/client/board?card=${sentCardId}`}>소싱 보드에서 보기</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label className="text-xs">제목</Label><Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label className="text-xs">예상 수량 (선택)</Label><Input value={quantity} maxLength={200} placeholder="예: 초도 3,000개" onChange={(e) => setQuantity(e.target.value)} /></div>
            <div><Label className="text-xs">요청 사항 (선택)</Label><Textarea rows={3} value={message} maxLength={2000} placeholder="예: 외관면은 무광, 언더컷 없이 가능한지 봐 주세요" onChange={(e) => setMessage(e.target.value)} /></div>
            <div>
              <Label className="text-xs">함께 보내는 자동 검토 요약</Label>
              <pre className="mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-2 text-[11px] leading-relaxed">{summary}</pre>
            </div>
            <label className={`flex items-start gap-2 text-sm ${canAttach ? '' : 'opacity-60'}`}>
              <Checkbox checked={attach && canAttach} disabled={!canAttach} onCheckedChange={(v) => setAttach(!!v)} className="mt-0.5" />
              <span>
                원본 도면 파일 함께 보내기{sourceFile ? ` (${sourceFile.name})` : ''}
                <span className="block text-[11px] text-muted-foreground">
                  {!sourceFile ? '샘플 부품은 보낼 파일이 없습니다.' : tooBig ? '10MB를 넘는 파일은 접수 후 문의 탭으로 보내 주세요.' : '비공개 저장소에 올라가며 담당자만 열어 봅니다.'}
                </span>
              </span>
            </label>
          </div>
        )}
        {!sentCardId && (
          <DialogFooter>
            <Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>취소</Button>
            <Button disabled={sending || !title.trim()} onClick={send} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}검토 요청 보내기
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
