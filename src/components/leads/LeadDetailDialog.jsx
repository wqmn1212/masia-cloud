import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { LEAD_STATUS } from './leadMeta';
import LeadAttachments from './LeadAttachments';

const Field = ({ label, children }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm mt-0.5">{children || '-'}</div>
  </div>
);

export default function LeadDetailDialog({ lead, open, onClose, onSave, saving }) {
  const [status, setStatus] = useState('new');
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (lead) {
      setStatus(lead.status || 'new');
      setAssignee(lead.assignee_email || '');
      setNote(lead.internal_note || '');
    }
  }, [lead]);

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.company}
            <span className="text-sm font-normal text-muted-foreground">
              {lead.created_date ? format(new Date(lead.created_date), 'yyyy.MM.dd HH:mm') : ''}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="담당자">{lead.contact_name}</Field>
          <Field label="연락처">{lead.phone}</Field>
          <Field label="이메일"><a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a></Field>
          <Field label="언어 / 유입">{lead.lang?.toUpperCase()} · {lead.source}</Field>
          <Field label="발주 예정 수량">{lead.quantity}</Field>
          <Field label="희망 단가">{lead.target_price}</Field>
        </div>

        <Field label="품목 카테고리">
          <div className="flex flex-wrap gap-1 mt-1">
            {(lead.categories || []).length ? lead.categories.map((c) => <Badge key={c} variant="secondary">{c}</Badge>) : '-'}
          </div>
        </Field>

        <Field label="요구사항">
          <p className="whitespace-pre-wrap bg-muted/40 rounded-md p-3 text-sm leading-relaxed">{lead.detail || '-'}</p>
        </Field>

        <Field label="첨부 (NNN 적용 · 비공개 저장)">
          <div className="mt-1"><LeadAttachments attachments={lead.attachments} /></div>
        </Field>

        <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>처리 상태</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>담당 영업 / PM (이메일)</Label>
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="pm@company.com" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>내부 메모</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="통화 내용, 다음 액션 등" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button disabled={saving} onClick={() => onSave({ status, assignee_email: assignee.trim(), internal_note: note })}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}