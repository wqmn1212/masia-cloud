import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Repeat } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

// 고객 재주문 요청: 지난 프로젝트의 도면·품질 기준·공장 정보를 그대로 가져와 새 프로젝트로 접수한다.
export default function ClientReorderDialog({ open, onOpenChange, card, onOpenCard }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ quantity: '', target_date: '', changes: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => { if (open) { setF({ quantity: '', target_date: '', changes: '' }); setDone(null); } }, [open]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const send = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke('reorderCard', { card_id: card.id, ...f });
      setDone(res.data.card_id);
      qc.invalidateQueries({ queryKey: ['client-cards'] });
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      toast({ title: '재주문을 접수했습니다', description: '담당자가 공장 일정과 단가를 확인해 회신드립니다.' });
    } catch (e) {
      toast({ title: '접수하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" />재주문 요청</DialogTitle>
          <DialogDescription>&lsquo;{card.title}&rsquo;의 도면·품질 기준서·공장 정보를 그대로 가져와 새 프로젝트로 시작합니다. 수량과 날짜만 알려 주세요.</DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="space-y-3 text-sm">
            <p>재주문 프로젝트를 만들었습니다. 담당자가 공장 일정·단가를 확인한 뒤 견적과 일정을 올려 드립니다.</p>
            {onOpenCard && <Button className="w-full" onClick={() => { onOpenChange(false); onOpenCard(done); }}>새 프로젝트 열기</Button>}
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label className="text-xs">수량</Label><Input value={f.quantity} maxLength={200} placeholder="예: 5,000개 (지난번 3,000개)" onChange={(e) => set('quantity', e.target.value)} /></div>
            <div><Label className="text-xs">희망 입고일 (선택)</Label><Input type="date" value={f.target_date} onChange={(e) => set('target_date', e.target.value)} /></div>
            <div><Label className="text-xs">바뀌는 점 (선택)</Label><Textarea rows={3} maxLength={3000} value={f.changes} placeholder="예: 색상 1종 추가(민트), 단상자 문구 변경. 바뀌는 게 없으면 비워 두세요." onChange={(e) => set('changes', e.target.value)} /></div>
            <p className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">단가와 납기는 원자재 가격·공장 일정에 따라 지난번과 달라질 수 있어, 담당자가 확인 후 새 견적으로 안내드립니다.</p>
          </div>
        )}
        {!done && (
          <DialogFooter>
            <Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>취소</Button>
            <Button disabled={sending || !f.quantity.trim()} onClick={send} className="gap-1.5">{sending && <Loader2 className="h-4 w-4 animate-spin" />}재주문 접수</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
