import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

const STAGES = [
  { key: 'CONTRACT', label: '계약 완료' },
  { key: 'MANUFACTURING', label: '제조 중' },
  { key: 'QC_PASS', label: 'QC 통과' },
  { key: 'SHIPPING', label: '해상 선적' },
  { key: 'CUSTOMS', label: '통관' },
  { key: 'INSTALLATION', label: '설치 완료' },
];

export default function TimelineStageBar({ currentStage }) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div className="flex items-center gap-0 w-full">
      {STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isPending = idx > currentIdx;

        return (
          <React.Fragment key={stage.key}>
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                isCompleted && "bg-accent text-accent-foreground",
                isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                isPending && "bg-muted text-muted-foreground"
              )}>
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <span className="text-[10px] font-bold">{idx + 1}</span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium text-center leading-tight whitespace-nowrap",
                isCurrent ? "text-primary" : isCompleted ? "text-accent" : "text-muted-foreground"
              )}>
                {stage.label}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 min-w-[20px] rounded-full mx-1",
                idx < currentIdx ? "bg-accent" : "bg-border"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}