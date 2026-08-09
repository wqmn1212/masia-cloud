import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Plus, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const HEALTH = {
  GOOD: { label: '정상', color: 'bg-primary/15 text-primary' },
  WATCH: { label: '주의', color: 'bg-chart-3/15 text-chart-3' },
  RISK: { label: '위험', color: 'bg-destructive/15 text-destructive' },
};

export default function TaskInsightPanel({ card, user }) {
  const [analysis, setAnalysis] = useState(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const runMut = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('analyzeTaskProgress', { card_id: card.id });
      return res.data;
    },
    onSuccess: (data) => setAnalysis(data?.analysis || null),
    onError: (e) => toast({ title: '분석 실패', description: e.message, variant: 'destructive' }),
  });

  const addTaskMut = useMutation({
    mutationFn: (rec) => base44.entities.TaskItem.create({
      card_id: card.id,
      title: rec.title,
      description: rec.description,
      priority: rec.priority || 'MEDIUM',
      due_date: rec.due_date || undefined,
      status: 'TODO',
      assignee_name: user?.full_name || '',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-items', card.id] });
      toast({ title: '업무로 등록되었습니다' });
    },
  });

  const health = analysis && (HEALTH[analysis.health] || HEALTH.WATCH);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" /> AI 진행 분석 & 업무 추천
        </h4>
        <Button size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
          {runMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {runMut.isPending ? '분석 중...' : '분석 실행'}
        </Button>
      </div>

      {!analysis && !runMut.isPending && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          미팅 기록·이메일·업무·견적·QC·결제 데이터를 종합해 진행 상황을 분석하고 다음 업무를 추천합니다.
        </p>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {health && <Badge className={`${health.color} border-0 text-[10px]`}>{health.label}</Badge>}
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, analysis.progress_percent || 0)}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{Math.round(analysis.progress_percent || 0)}%</span>
          </div>

          {analysis.summary && (
            <div className="border rounded-lg p-3">
              <p className="text-xs font-semibold mb-1">업무 진행 내역</p>
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {analysis.timeline?.length > 0 && (
            <div className="border rounded-lg p-3">
              <p className="text-xs font-semibold mb-2">일자별 진행</p>
              <div className="space-y-1.5">
                {analysis.timeline.map((t, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="tabular-nums text-primary font-medium shrink-0">{t.date}</span>
                    <span className="text-muted-foreground">{t.event}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.risks?.length > 0 && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3">
              <p className="text-xs font-semibold mb-1 flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> 리스크 / 병목
              </p>
              <ul className="text-xs space-y-1 list-disc pl-4">
                {analysis.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {analysis.open_items?.length > 0 && (
            <div className="border rounded-lg p-3">
              <p className="text-xs font-semibold mb-1">미처리 요구사항</p>
              <ul className="text-xs space-y-1 list-disc pl-4">
                {analysis.open_items.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {analysis.recommendations?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold">추천 업무</p>
              {analysis.recommendations.map((rec, i) => (
                <div key={i} className="border rounded-lg p-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{rec.title}</p>
                    {rec.description && <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>}
                    <div className="flex gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-[10px]">{rec.priority}</Badge>
                      {rec.due_date && <Badge variant="outline" className="text-[10px]">~{rec.due_date}</Badge>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => addTaskMut.mutate(rec)} disabled={addTaskMut.isPending}>
                    <Plus className="h-3.5 w-3.5" /> 업무 등록
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}