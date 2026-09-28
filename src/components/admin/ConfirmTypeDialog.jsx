import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// 확인 문구를 그대로 입력해야 실행되는 위험 작업 확인 창
export default function ConfirmTypeDialog({ open, onOpenChange, title, expected, children, onConfirm, pending }) {
  const [value, setValue] = useState('');
  useEffect(() => { if (open) setValue(''); }, [open]);
  const matches = value.trim().toLowerCase() === String(expected || '').trim().toLowerCase();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="text-red-600">{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          {children}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">확인을 위해 <b className="text-foreground">{expected}</b> 를 그대로 입력하세요.</p>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={expected} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button variant="destructive" disabled={!matches || pending} onClick={() => onConfirm(value.trim())}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}삭제
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}