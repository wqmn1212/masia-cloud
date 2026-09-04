import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formTags } from '@/lib/landingContent';
import { cn } from '@/lib/utils';

const EMPTY = { detail: '', quantity: '', target_price: '', phone: '' };

// 이미 온보딩된 고객사가 소싱 보드 안에서 바로 올리는 추가 문의.
// 담당자 승인을 거쳐야 카드로 등록되므로, 등록 직후에는 아직 이 보드에 나타나지 않는다.
export default function ClientNewInquiryDialog({ open, onClose }) {
  const [values, setValues] = useState(EMPTY);
  const [tags, setTags] = useState([]);
  const qc = useQueryClient();
  const { toast } = useToast();

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const toggleTag = (val) => setTags((t) => (t.includes(val) ? t.filter((x) => x !== val) : [...t, val]));

  const submit = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('submitClientInquiry', { ...values, categories: tags, intent: 'quote' });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-cards'] });
      toast({ title: '문의가 접수되었습니다', description: '담당자 확인 후 이 보드에 카드로 등록됩니다.' });
      setValues(EMPTY);
      setTags([]);
      onClose();
    },
    onError: (err) => toast({ title: '접수 실패', description: err.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-[95vw]">
        <DialogHeader>
          <DialogTitle>새 문의 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs">품목 카테고리</Label>
            <div className="flex flex-wrap gap-1.5">
              {formTags.map((t) => {
                const on = tags.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleTag(t.value)}
                    className={cn(
                      'text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors',
                      on ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'
                    )}
                  >
                    {t.label[0]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">발주 예정 수량</Label>
              <Input value={values.quantity} onChange={set('quantity')} placeholder="예) 500개" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">희망 단가</Label>
              <Input value={values.target_price} onChange={set('target_price')} placeholder="선택 입력" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">연락처</Label>
            <Input value={values.phone} onChange={set('phone')} placeholder="010-0000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">요청 내용</Label>
            <Textarea rows={4} value={values.detail} onChange={set('detail')} placeholder="사양, 참고 링크, 희망 납기 등을 적어주세요." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button disabled={submit.isPending || !values.detail.trim()} onClick={() => submit.mutate()}>
            {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
            문의 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
