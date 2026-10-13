import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const NO_CARD = 'none';

/** 검토 결과를 저장한다. 업무 카드 연결은 선택 */
export default function MoldReviewSaveDialog({ open, onOpenChange, onConfirm, isSaving, partName }) {
  const [cardId, setCardId] = useState(NO_CARD);
  const [note, setNote] = useState('');
  const [withSnapshot, setWithSnapshot] = useState(true);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['taskcards-for-mold-review'],
    queryFn: () => base44.entities.TaskCard.list('-created_date', 100),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-base">금형 검토 저장</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{partName} 검토 결과와 지시서(한·중)를 저장합니다.</p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">업무 카드 연결 (선택)</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={isLoading ? '불러오는 중...' : '업무 카드 선택'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CARD}>연결하지 않음</SelectItem>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}{c.client_name ? ` · ${c.client_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">비고</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="text-xs" placeholder="예: 고객 협의 전 1차 검토" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={withSnapshot} onCheckedChange={(v) => setWithSnapshot(!!v)} />
            지금 보이는 3D 화면을 함께 저장
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            disabled={isSaving}
            onClick={() => onConfirm({ cardId: cardId === NO_CARD ? null : cardId, note: note.trim(), withSnapshot })}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
