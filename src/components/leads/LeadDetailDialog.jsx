import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import LeadAttachmentList from './LeadAttachmentList';
import { LEAD_STATUS } from './leadMeta';

const Info = ({ label, value }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm mt-0.5 break-words">{value || '-'}</div>
  </div>
);

export default function LeadDetailDialog({ lead, open, onClose, onSave, saving }) {
  const [draft, setDraft] = useState({ status: 'new', assignee_email: '', internal_note: '' });

  useEffect(() => {
    if (lead) setDraft({ status: lead.status || 'new', assignee_email: lead.assignee_email || '', internal_note: lead.internal_note || '' });
  }, [lead]);

  if (!lead) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {lead.company}
            <span className="text-sm font-normal text-muted-foreground">
              {lead.created_date ? format(new Date(lead.created_date), 'yyyy.MM.dd HH:mm') : ''} · {lead.lang?.toUpperCase()}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Info label="담당자" value={lead.contact_name} />
          <Info label="연락처" value={lead.phone} />
          <Info label="이메일" value={<a className="text-primary underline" href={`mailto:${lead.email}`}>{lead.email}</a>} />
          <Info label="유입 경로" value={lead.referrer || lead.source} />
          <Info label="발주 예정 수량" value={lead.quantity} />
          <Info label="희망 단가" value={lead.target_price} />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">카테고리</div>
          <div className="flex flex-wrap gap-1">
            {(lead.categories || []).length ? lead.categories.map((c) => <Badge key={c} variant="secondary">{c}</Badge>) : <span className="text-sm">-</span>}
          </div>
        </div>
        <Info label="요구사항" value={<p className="whitespace-pre-wrap">{lead.detail}</p>} />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">첨부 (비공개 · NNN)</div>
          <LeadAttachmentList attachments={lead.attachments} />
        </div>

        <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>처리 상태</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LEAD_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>담당자 이메일</Label>
            <Input value={draft.assignee_email} onChange={(e) => setDraft((d) => ({ ...d, assignee_email: e.target.value }))} placeholder="pm@company.com" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>내부 메모</Label>
            <Textarea rows={3} value={draft.internal_note} onChange={(e) => setDraft((d) => ({ ...d, internal_note: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button onClick={() => onSave(lead.id, draft)} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}