import React from 'react';
import { PROTO_STAGES, stageIndex } from '@/lib/prototype';

// 요구사항 → 설계 → 제작 → 시험 → 개선 진행 막대
export default function ProtoStageBar({ stage, onSelect }) {
  const at = stageIndex(stage);
  return (
    <div className="flex gap-1.5">
      {PROTO_STAGES.map((s, i) => (
        <button
          key={s.key}
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect?.(s.key)}
          className="flex-1 text-left group disabled:cursor-default"
        >
          <div className={`h-1.5 rounded-full transition-colors ${i <= at ? 'bg-primary' : 'bg-muted group-enabled:group-hover:bg-primary/30'}`} />
          <p className={`mt-1.5 text-micro ${i === at ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{i + 1}. {s.label}</p>
        </button>
      ))}
    </div>
  );
}