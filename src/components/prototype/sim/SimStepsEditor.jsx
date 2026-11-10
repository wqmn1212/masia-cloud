import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SimStepRow from '@/components/prototype/sim/SimStepRow';
import { newStep } from '@/lib/protoSim';

export default function SimStepsEditor({ steps, actuators, onChange }) {
  const total = steps.reduce((s, x) => s + (Number(x.duration_s) || 0), 0);
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-body font-semibold mr-auto">동작 시나리오 {steps.length}단계 · 총 {Math.round(total * 100) / 100}초</p>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...steps, newStep(steps.length + 1)])}><Plus className="w-4 h-4" />단계 추가</Button>
      </div>
      <p className="text-caption text-muted-foreground">단계마다 켜지는 부품과 출력(%)·방향을 고르세요. 출력 %는 정격 전류와 속도에 곱해 계산합니다.</p>
      {steps.map((s, i) => (
        <SimStepRow key={s.id} step={s} index={i} actuators={actuators} onChange={(v) => onChange(steps.map((x, k) => (k === i ? v : x)))} onMove={(d) => move(i, d)} onRemove={() => onChange(steps.filter((_, k) => k !== i))} />
      ))}
    </div>
  );
}