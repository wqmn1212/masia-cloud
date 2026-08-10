import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil, ChevronDown, ChevronRight } from 'lucide-react';

const TYPE_LABEL = { ONLINE: '화상', OFFLINE: '대면', CALL: '전화', WECHAT: '위챗' };

export default function MeetingLogItem({ log, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg">
      <div className="flex items-center gap-2 p-3">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setOpen(o => !o)}>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </Button>
        <span className="text-xs font-semibold tabular-nums text-primary">{log.meeting_date}</span>
        <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[log.meeting_type] || log.meeting_type}</Badge>
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{log.title}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onEdit(log)}>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onDelete(log.id)}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {log.attendees && <p className="text-xs text-muted-foreground">참석: {log.attendees}</p>}
          {log.notes && <p className="text-xs whitespace-pre-wrap">{log.notes}</p>}
          {log.decisions && <p className="text-xs whitespace-pre-wrap"><span className="font-semibold">결정: </span>{log.decisions}</p>}
          {log.next_steps && <p className="text-xs whitespace-pre-wrap"><span className="font-semibold">다음 액션: </span>{log.next_steps}</p>}
        </div>
      )}
    </div>
  );
}