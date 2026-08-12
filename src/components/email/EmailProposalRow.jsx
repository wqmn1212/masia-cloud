import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Check, X, ChevronDown, ChevronRight } from 'lucide-react';

export default function EmailProposalRow({ proposal, cards, onApply, onReject, busy }) {
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState(proposal.card_id || '');

  return (
    <div className="rounded-xl border p-3 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </Button>
        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{proposal.email_subject || '(제목 없음)'}</p>
          <p className="text-[10px] text-muted-foreground truncate">{proposal.email_from} · {proposal.email_date}</p>
        </div>
        {proposal.client_name && <Badge variant="outline" className="text-[10px] shrink-0">{proposal.client_name}</Badge>}
        {(proposal.suggested_tasks || []).length > 0 && (
          <Badge variant="secondary" className="text-[10px] shrink-0">작업 {proposal.suggested_tasks.length}</Badge>
        )}
      </div>

      {open && (
        <div className="space-y-2 pl-8">
          {proposal.summary && <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{proposal.summary}</p>}
          {proposal.client_requirements && (
            <div>
              <p className="text-[11px] font-semibold">고객 요구사항</p>
              <p className="text-[11px] whitespace-pre-wrap text-muted-foreground">{proposal.client_requirements}</p>
            </div>
          )}
          {proposal.our_commitments && (
            <div>
              <p className="text-[11px] font-semibold">회신/약속 내용</p>
              <p className="text-[11px] whitespace-pre-wrap text-muted-foreground">{proposal.our_commitments}</p>
            </div>
          )}
          {(proposal.suggested_tasks || []).map((t, i) => (
            <div key={i} className="text-[11px] rounded-md bg-background border px-2 py-1">
              <span className="font-medium">{t.title}</span>
              {t.due_date && <span className="text-muted-foreground"> · {t.due_date}</span>}
              {t.description && <p className="text-muted-foreground">{t.description}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-8">
        <Select value={cardId} onValueChange={setCardId}>
          <SelectTrigger className="sm:w-72"><SelectValue placeholder="반영할 태스크 카드 선택" /></SelectTrigger>
          <SelectContent>
            {cards.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}{c.client_name ? ` · ${c.client_name}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 sm:ml-auto">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onReject(proposal)}>
            <X className="w-3.5 h-3.5" /> 거절
          </Button>
          <Button size="sm" disabled={busy || !cardId} onClick={() => onApply(proposal, cardId)}>
            <Check className="w-3.5 h-3.5" /> 이 카드에 반영
          </Button>
        </div>
      </div>
    </div>
  );
}