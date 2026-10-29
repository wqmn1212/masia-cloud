import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const kstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

// 고객 확인 요청: 디자인·도면 파일을 고객에게 공개하고 질문·기한과 함께 확인을 요청한다.
// 비교할 이전 판은 이 파일이 대체한 승인본이 기본이고, 다른 파일을 고를 수도 있다.
export default function FileReviewRequestDialog({ file, files, open, pending, onClose, onSend }) {
  const [question, setQuestion] = useState('');
  const [due, setDue] = useState('');
  const [previous, setPrevious] = useState(file?.supersedes_id || '');
  if (!file) return null;
  const candidates = files.filter((f) => f.id !== file.id && f.document_type !== 'CLAIM_PHOTO');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">고객 확인 요청</DialogTitle>
          <DialogDescription className="text-label">
            <b>{file.file_name}</b> 을 고객에게 공개하고 확인을 요청합니다. 고객은 이전 판과 나란히 보고, 고칠 위치에 핀 의견을 남겨 승인 또는 수정 요청을 고릅니다.
          </DialogDescription>
        </DialogHeader>
        <form id="file-review-request" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSend({ question, due_date: due, previous_attachment_id: previous }); }}>
          <label className="block text-label">확인받을 내용
            <Textarea className="mt-1 text-label" rows={3} maxLength={1000} required value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="예: 박스 인쇄 색상(PANTONE 186C)과 로고 위치를 확인해 주세요" disabled={pending} />
          </label>
          <label className="block text-label">회신 기한 (선택)
            <Input className="mt-1 text-label" type="date" min={kstToday()} value={due} onChange={(e) => setDue(e.target.value)} disabled={pending} />
          </label>
          <label className="block text-label">비교할 이전 판 (선택)
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-label" value={previous} onChange={(e) => setPrevious(e.target.value)} disabled={pending}>
              <option value="">없음</option>
              {candidates.map((f) => <option key={f.id} value={f.id}>{f.file_name}{f.revision ? ` · 승인본 v${f.revision}` : ''}</option>)}
            </select>
            <span className="mt-0.5 block text-caption text-muted-foreground">고른 이전 판은 고객이 볼 수 있도록 공개 상태여야 나란히 보입니다.</span>
          </label>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>취소</Button>
          <Button type="submit" form="file-review-request" disabled={pending || !question.trim()}>{pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}요청 보내기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
