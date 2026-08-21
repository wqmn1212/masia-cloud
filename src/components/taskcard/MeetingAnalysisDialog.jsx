import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2, ListPlus, AlertTriangle } from 'lucide-react';

const PRIORITY_LABEL = { LOW: '낮음', MEDIUM: '보통', HIGH: '높음', URGENT: '긴급' };

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    risks: { type: 'array', items: { type: 'string' } },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          due_date: { type: 'string' },
        },
      },
    },
  },
};

export default function MeetingAnalysisDialog({ log, card, user, open, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(0);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) { setResult(null); setSelected({}); setAdded(0); return; }
    setLoading(true);
    (async () => {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `당신은 중국 소싱 무역 프로젝트의 PM입니다. 아래 미팅 기록을 분석해 주세요. 오늘 날짜는 ${new Date().toISOString().slice(0, 10)}입니다.

[프로젝트]
제목: ${card.title}
고객사: ${card.client_name || '미지정'}
공장: ${card.factory_name || '미지정'}
상태: ${card.status}
마감일: ${card.due_date || '미정'}
요구사항: ${card.hq_requirements || '없음'}

[미팅]
일자: ${log.meeting_date}
제목: ${log.title}
참석: ${log.attendees || '미기재'}
내용: ${log.notes || '없음'}
결정 사항: ${log.decisions || '없음'}
다음 액션: ${log.next_steps || '없음'}

요구사항:
1) summary: 미팅 핵심을 한국어 3~5문장으로 요약
2) risks: 놓치면 문제가 될 리스크/확인 필요 사항 (없으면 빈 배열)
3) tasks: 이 미팅 이후 실제로 실행해야 할 구체적인 업무 3~6개. title은 실행 동사로 짧게, description은 무엇을 어떻게 할지, priority는 LOW/MEDIUM/HIGH/URGENT, due_date는 YYYY-MM-DD (판단 가능할 때만).
모든 텍스트는 한국어로 작성하세요.`,
        response_json_schema: SCHEMA,
      });
      setResult(res);
      setSelected(Object.fromEntries((res.tasks || []).map((_, i) => [i, true])));
      setLoading(false);
    })();
  }, [open, log?.id]);

  const addTasks = async () => {
    const picked = (result.tasks || []).filter((_, i) => selected[i]);
    if (picked.length === 0) return;
    setAdding(true);
    await base44.entities.TaskItem.bulkCreate(picked.map(t => ({
      card_id: card.id,
      title: t.title,
      description: [t.description, `\n(미팅 ${log.meeting_date} - ${log.title} 분석)`].filter(Boolean).join(' '),
      status: 'TODO',
      priority: t.priority || 'MEDIUM',
      ...(t.due_date ? { due_date: t.due_date } : {}),
      assignee_name: user?.full_name || user?.email || '',
    })));
    qc.invalidateQueries({ queryKey: ['task-items', card.id] });
    qc.invalidateQueries({ queryKey: ['task-items-all'] });
    setAdded(picked.length);
    setAdding(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> 미팅 AI 분석 · {log?.title}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 미팅 내용을 분석하고 있습니다...
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground mb-1">요약</h5>
              <p className="text-sm whitespace-pre-wrap">{result.summary}</p>
            </div>

            {result.risks?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> 리스크 / 확인 필요
                </h5>
                <ul className="space-y-1">
                  {result.risks.map((r, i) => (
                    <li key={i} className="text-sm text-destructive">· {r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h5 className="text-xs font-semibold text-muted-foreground mb-2">추천 업무 (선택 후 세부 업무로 추가)</h5>
              <div className="space-y-2">
                {(result.tasks || []).map((t, i) => (
                  <label key={i} className="flex gap-2 items-start border rounded-lg p-2.5 cursor-pointer">
                    <Checkbox
                      checked={!!selected[i]}
                      onCheckedChange={(v) => setSelected(s => ({ ...s, [i]: !!v }))}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{t.title}</span>
                        <Badge variant="outline" className="text-[10px]">{PRIORITY_LABEL[t.priority] || t.priority}</Badge>
                        {t.due_date && <span className="text-[11px] text-muted-foreground tabular-nums">~{t.due_date}</span>}
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {added > 0 ? (
              <p className="text-sm text-primary font-medium">{added}개 업무를 세부 업무 목록에 추가했습니다.</p>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>닫기</Button>
                <Button onClick={addTasks} disabled={adding || !(result.tasks || []).some((_, i) => selected[i])}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
                  선택 업무 추가
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}