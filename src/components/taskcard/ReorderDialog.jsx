import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Repeat } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

const COPY = [
  ['docs', '제품 서류', '도면 등 일반 파일, UN38.3·MSDS·배터리 사양서 (선적 건별 서류는 제외)'],
  ['spec', '품질 기준서', '고객 승인본을 새 초안(v1)으로 가져옵니다. 고객에게 다시 보내야 합니다'],
  ['bom', 'BOM', '부품표를 그대로 복사합니다'],
];

// 직원 재주문(프로젝트 복제): 공장·요구사항·담당을 이어받은 새 카드를 만든다. 견적·결제·일정·검수·선적은 새로 시작.
export default function ReorderDialog({ open, onOpenChange, card }) {
  const qc = useQueryClient();
  const [f, setF] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => {
    if (!open) return;
    setF({ quantity: '', target_date: '', changes: '', client_visible: card.client_visible === true, copy: { docs: true, spec: true, bom: true } });
    setDone(null);
  }, [open, card.client_visible]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const send = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke('reorderCard', { card_id: card.id, ...f });
      setDone(res.data);
      qc.invalidateQueries({ queryKey: ['task-cards'] });
    } catch (e) {
      toast({ title: '복제하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="h-4 w-4 text-primary" />재주문 (프로젝트 복제)</DialogTitle>
          <DialogDescription>공장·요구사항·책임자를 이어받은 새 카드를 만듭니다. 견적·결제·일정·검수·선적은 새로 시작합니다.</DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="space-y-3 text-sm">
            <p>새 카드를 만들었습니다. 서류 {done.copied?.docs ?? 0}건{done.copied?.spec ? ', 품질 기준서 초안' : ''}{done.copied?.bom ? `, BOM ${done.copied.bom}개` : ''}를 복사했습니다.</p>
            <Button className="w-full" onClick={() => window.location.assign(`/task-board?card=${done.card_id}`)}>새 카드 열기</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">수량</Label><Input value={f.quantity || ''} maxLength={200} onChange={(e) => set('quantity', e.target.value)} /></div>
              <div><Label className="text-xs">희망 납기</Label><Input type="date" value={f.target_date || ''} onChange={(e) => set('target_date', e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">바뀌는 점</Label><Textarea rows={2} maxLength={3000} value={f.changes || ''} onChange={(e) => set('changes', e.target.value)} /></div>
            <div className="space-y-2 rounded-lg border p-2.5">
              <p className="text-xs font-semibold">함께 복사</p>
              {COPY.map(([k, label, hint]) => (
                <label key={k} className="flex items-start gap-2 text-sm">
                  <Checkbox className="mt-0.5" checked={!!f.copy?.[k]} onCheckedChange={(v) => set('copy', { ...f.copy, [k]: !!v })} />
                  <span>{label}<span className="block text-[11px] text-muted-foreground">{hint}</span></span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!f.client_visible} onCheckedChange={(v) => set('client_visible', !!v)} />고객 포털에 바로 공개</label>
          </div>
        )}
        {!done && (
          <DialogFooter>
            <Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>취소</Button>
            <Button disabled={sending} onClick={send} className="gap-1.5">{sending && <Loader2 className="h-4 w-4 animate-spin" />}새 카드 만들기</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
