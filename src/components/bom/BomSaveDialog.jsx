import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

/** BOM 을 기존 태스크카드에 추가하거나 새 카드를 만들어 저장 */
export default function BomSaveDialog({ open, onOpenChange, onConfirm, isSaving, partCount }) {
  const [mode, setMode] = useState('existing');
  const [cardId, setCardId] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['taskcards-for-bom'],
    queryFn: () => base44.entities.TaskCard.list('-created_date', 100),
    enabled: open,
  });

  const canSubmit = mode === 'existing' ? !!cardId : newTitle.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-base">BOM 저장 · 태스크카드 연결</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">{partCount}개 부품을 아래 업무 카드에 연결합니다.</p>

        <RadioGroup value={mode} onValueChange={setMode} className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="existing" id="bom-existing" />
              <Label htmlFor="bom-existing" className="text-sm">기존 카드에 추가</Label>
            </div>
            {mode === 'existing' && (
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={isLoading ? '불러오는 중...' : '업무 카드 선택'} />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}{c.client_name ? ` · ${c.client_name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="new" id="bom-new" />
              <Label htmlFor="bom-new" className="text-sm">새 카드 생성</Label>
            </div>
            {mode === 'new' && (
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="새 업무 카드 제목"
                className="h-9 text-xs"
              />
            )}
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            disabled={!canSubmit || isSaving}
            onClick={() => onConfirm(mode === 'existing' ? { cardId } : { newTitle: newTitle.trim() })}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}