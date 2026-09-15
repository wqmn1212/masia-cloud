import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import useMeetingAnalysis from '@/components/taskcard/useMeetingAnalysis';
import MeetingAnalysisFields from '@/components/taskcard/MeetingAnalysisFields';
import MeetingAnalysisTasks from '@/components/taskcard/MeetingAnalysisTasks';
export default function MeetingAnalysisDialog({ log, card, user, open, onClose }) {
  const analysis = useMeetingAnalysis(log, card, user, open);
  const busy = analysis.loading || analysis.applying || analysis.adding;
  return <Dialog open={open} onOpenChange={v => { if (!v && !busy) onClose(); }}>
    <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />미팅 AI 분석 · {log.title}</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">전사와 작성한 내용을 함께 분석합니다. 원문은 보존되며, 확인 후 반영하면 미팅 기록이 갱신됩니다.</p>
      {analysis.loading && <p className="flex items-center justify-center gap-2 py-10 text-sm"><Loader2 className="h-4 w-4 animate-spin" />미팅 내용 분석 중...</p>}
      {analysis.error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{analysis.error}</p><Button disabled={busy} variant="outline" onClick={analysis.analyze}>다시 분석</Button></div>}
      {analysis.result && <div className="space-y-4">
        <MeetingAnalysisFields result={analysis.result} applied={analysis.applied} busy={analysis.applying} onApply={analysis.apply} />
        <MeetingAnalysisTasks {...analysis} onAdd={analysis.add} />
      </div>}
      <div className="flex justify-end"><Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button></div>
    </DialogContent>
  </Dialog>;
}