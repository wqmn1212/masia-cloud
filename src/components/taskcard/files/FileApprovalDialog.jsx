import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isCurrentApproved } from '@/lib/fileApproval';

// 승인본 지정: 이 파일이 대체하는 이전 승인본을 고르면 그 파일은 '사용 안 함'이 되고 판 번호가 올라간다
export default function FileApprovalDialog({ file, files, open, onClose, onConfirm, pending }) {
  const candidates = files.filter((f) => f.id !== file?.id && isCurrentApproved(f));
  const [replace, setReplace] = useState('');
  if (!file) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-base">공장 전달 승인본으로 지정</DialogTitle></DialogHeader>
        <p className="text-sm"><b>{file.file_name}</b></p>
        <p className="text-xs text-muted-foreground">공장은 승인본으로만 만들어야 합니다. 이 파일이 예전 승인본을 고친 것이라면 그 파일을 고르세요. 예전 파일은 &lsquo;사용 안 함 · 已作废&rsquo;으로 바뀝니다.</p>
        <fieldset className="space-y-1.5 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="replace" checked={replace === ''} onChange={() => setReplace('')} />새 문서 (1판)</label>
          {candidates.map((c) => (
            <label key={c.id} className="flex items-center gap-2"><input type="radio" name="replace" checked={replace === c.id} onChange={() => setReplace(c.id)} /><span className="min-w-0 truncate">대체: {c.file_name} <span className="text-muted-foreground">v{c.revision || 1}</span></span></label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button disabled={pending} onClick={() => onConfirm(candidates.find((c) => c.id === replace) || null)}>승인본으로 지정</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
