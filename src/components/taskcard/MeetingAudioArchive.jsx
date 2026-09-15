import { useState } from 'react';
import { Button } from '@/components/ui/button';
import call from '@/components/taskcard/meetingAudioClient';
export default function MeetingAudioArchive({ log }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await call(log.id, 'read')); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  if (!log.transcript && !log.recording_uris?.length) return null;
  return <details className="border-t pt-2" onToggle={e => { if (e.currentTarget.open) load(); }}>
    <summary className="cursor-pointer text-xs font-medium">전사 전문·녹음 파일 ({log.recording_uris?.length || 0}구간)</summary>
    {loading && <p className="py-2 text-xs text-muted-foreground">비공개 기록을 불러오는 중...</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error} <Button size="sm" variant="ghost" onClick={load}>재시도</Button></p>}
    {data && <div className="space-y-3 py-3">
      <p className="text-xs text-muted-foreground">언어 자동 인식 · 한국어 / English / 中文 · 인식 오류가 있을 수 있으니 수치·고유명사는 확인하세요.</p>
      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm">{data.transcript || '아직 전사되지 않았습니다.'}</div>
      {data.recordings.map((r,i) => <div key={i} className="space-y-1"><p className="text-xs">{r.name}</p><audio controls preload="none" src={r.url} className="w-full" aria-label={r.name} /><a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">녹음 열기·다운로드</a></div>)}
    </div>}
  </details>;
}