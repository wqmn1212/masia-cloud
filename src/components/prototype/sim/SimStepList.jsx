import React from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';

// 단계 목록: 계산값 + AI 설명. 누르면 그 단계 시작 시각으로 이동
export default function SimStepList({ result, current, onSelect }) {
  const notes = result.ai?.step_notes || [];
  return (
    <div className="space-y-2">
      {(result.steps || []).map((s, i) => {
        const n = notes.find((x) => x.step_id === s.step_id);
        const checks = (result.checks || []).filter((c) => c.step_id === s.step_id);
        const on = current?.step_id === s.step_id;
        return (
          <button key={s.step_id} type="button" onClick={() => onSelect(s)} className={`w-full text-left rounded-lg border p-3 transition-colors ${on ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-label font-semibold">{i + 1}. {s.name}</span>
              <span className="text-micro text-muted-foreground tabular-nums">{s.t_start}–{s.t_end}s · {s.current_a}A · {s.power_w}W</span>
            </div>
            <p className="text-caption text-muted-foreground">작동: {s.active.length ? s.active.join(', ') : '없음 (대기)'}</p>
            {n?.explanation && <p className="mt-1 text-caption"><Sparkles className="inline w-3.5 h-3.5 mr-1 text-chart-4" /><span className="text-micro text-chart-4 mr-1">AI 설명</span>{n.explanation}</p>}
            {n?.state_change && <p className="text-caption text-muted-foreground">상태 변화: {n.state_change}</p>}
            {n?.caution && <p className="text-caption text-warning-text">주의: {n.caution}</p>}
            {checks.map((c, k) => <p key={k} className={`text-caption flex gap-1 ${c.severity === 'HIGH' ? 'text-destructive' : 'text-warning-text'}`}><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{c.title} — {c.detail}</p>)}
          </button>
        );
      })}
    </div>
  );
}