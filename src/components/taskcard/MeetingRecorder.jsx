import { useState } from 'react';
import { Mic, Pause, Play, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import useMeetingRecorder from '@/components/taskcard/useMeetingRecorder';
export default function MeetingRecorder({ log, userId, onComplete, onBusy, disabled }) {
  const [consent, setConsent] = useState(false);
  const rec = useMeetingRecorder(log, userId, onComplete, onBusy);
  const live = ['recording','paused'].includes(rec.phase);
  const time = `${Math.floor(rec.seconds / 3600).toString().padStart(2,'0')}:${Math.floor(rec.seconds / 60 % 60).toString().padStart(2,'0')}:${(rec.seconds % 60).toString().padStart(2,'0')}`;
  return <div className="space-y-2 border-t px-3 py-3">
    {!rec.busy && <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={consent} onCheckedChange={v => setConsent(!!v)} />참석자에게 녹음을 알리고 필요한 동의를 받았습니다.</label>}
    <div className="flex items-center flex-wrap gap-2">
      {!rec.busy && <Button size="sm" variant="outline" disabled={!consent || disabled || !userId} onClick={rec.start}><Mic />녹음 시작</Button>}
      {live && <><span className="text-sm font-semibold tabular-nums text-primary">{rec.phase === 'paused' ? '일시정지' : '녹음 중'} {time}</span><Button size="sm" variant="outline" onClick={rec.pause}>{rec.phase === 'paused' ? <Play /> : <Pause />}{rec.phase === 'paused' ? '계속' : '일시정지'}</Button><Button size="sm" onClick={rec.stop}><Square />종료·정리</Button></>}
      {rec.phase === 'processing' && <span className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin" />녹음 저장·전사 처리 중...</span>}
      {!!rec.saved && <span className="text-xs text-muted-foreground">{rec.saved}구간 전사 완료</span>}
      {rec.phase === 'error' && <Button size="sm" variant="outline" disabled={disabled} onClick={rec.retry}>저장된 녹음 복구·전사 재시도</Button>}
    </div>
    {rec.error && <p role="alert" className="text-xs text-destructive">{rec.error}</p>}
    <p className="text-[11px] leading-relaxed text-muted-foreground">약 10분마다 비공개 저장합니다. 화면 잠금·앱 전환·탭 종료 시 녹음이 중단될 수 있으니 이 화면을 유지하세요. 기기 마이크 소리만 녹음되며, 통화 상대나 시스템 오디오가 자동 녹음되지는 않습니다.</p>
  </div>;
}