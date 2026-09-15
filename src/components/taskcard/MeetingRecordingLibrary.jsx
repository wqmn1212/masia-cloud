import { useState } from 'react';
import { Headphones, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import MeetingAudioArchive from '@/components/taskcard/MeetingAudioArchive';
const labels = { ONLINE: '화상', OFFLINE: '대면', CALL: '전화', WECHAT: '위챗' };
export default function MeetingRecordingLibrary({ logs }) {
  const recordings = logs.filter(log => log.recording_uris?.length || log.transcript_uri);
  const [open, setOpen] = useState({});
  if (!recordings.length) return null;
  const grouped = recordings.reduce((all, log) => {
    const type = log.meeting_type || 'ONLINE';
    all[type] = [...(all[type] || []), log];
    return all;
  }, {});
  const groups = Object.entries(grouped);
  return <section className="space-y-3 border-t pt-4">
    <h4 className="flex items-center gap-2 text-sm font-semibold"><Headphones className="h-4 w-4" />녹음 보관함 ({recordings.length})</h4>
    {groups.map(([type, items]) => <div key={type} className="space-y-2">
      <Badge variant="secondary">{labels[type] || type} · {items.length}</Badge>
      {items.map(log => <div key={log.id} className="rounded-lg border p-3">
        <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(v => ({ ...v, [log.id]: !v[log.id] }))}>
          {open[log.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="text-xs tabular-nums text-muted-foreground">{log.meeting_date}</span><span className="truncate text-sm font-medium">{log.title}</span>
        </button>
        {open[log.id] && <div className="mt-3"><MeetingAudioArchive log={log} expanded /></div>}
      </div>)}
    </div>)}
  </section>;
}