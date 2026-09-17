import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil, FileText, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

import MeetingRecorder from '@/components/taskcard/MeetingRecorder';
import MeetingLiveNotes from '@/components/taskcard/MeetingLiveNotes';
import { useLanguage } from '@/lib/LanguageContext';
const TYPE_LABEL = { ONLINE: '화상', OFFLINE: '대면', CALL: '전화', WECHAT: '위챗' };

export default function MeetingLogItem({ log, onDelete, onEdit, onAnalyze, userId, onBusy, disabled, recordDisabled }) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const qc = useQueryClient();
  const { content, lang } = useLanguage();
  return (
    <div className="border rounded-lg">
      <div className="flex items-center gap-2 p-3">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </Button>
        <span className="text-xs font-semibold tabular-nums text-primary">{log.meeting_date}</span>
        <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[log.meeting_type] || log.meeting_type}</Badge>
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{content(log, 'title')}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 shrink-0 text-[11px] gap-1" disabled={disabled} onClick={() => onAnalyze(log)}>
          <Sparkles className="h-3.5 w-3.5 text-primary" /> AI 분석
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setWriting(value => !value)} title="미팅 내용 작성">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled={disabled} onClick={() => onEdit(log)} title="미팅 정보 수정">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled={disabled} onClick={() => onDelete(log.id)}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {(log.attendees || log.attendees_cn) && <p className="text-xs text-muted-foreground">{lang === 'zh' ? '参与者' : '참석'}: {content(log, 'attendees')}</p>}
          {(log.notes || log.notes_cn) && <p className="text-xs whitespace-pre-wrap">{content(log, 'notes')}</p>}
          {(log.decisions || log.decisions_cn) && <p className="text-xs whitespace-pre-wrap"><span className="font-semibold">{lang === 'zh' ? '决定' : '결정'}: </span>{content(log, 'decisions')}</p>}
          {(log.next_steps || log.next_steps_cn) && <p className="text-xs whitespace-pre-wrap"><span className="font-semibold">{lang === 'zh' ? '下一步' : '다음 액션'}: </span>{content(log, 'next_steps')}</p>}
        </div>
      )}
      {writing && <MeetingLiveNotes log={log} onSaved={() => qc.invalidateQueries({ queryKey: ['meeting-logs', log.card_id] })} />}
      <MeetingRecorder log={log} userId={userId} onComplete={() => onAnalyze(log)} onBusy={onBusy} disabled={recordDisabled} />
    </div>
  );
}