import React from 'react';
import { Loader2 } from 'lucide-react';
import DropZone from '@/components/ui/drop-zone';
import { Progress } from '@/components/ui/progress';
import { MAX_FILE_SIZE_MB, MAX_PART_COUNT } from '@/lib/stepParser';

export default function BomUploadZone({ onFile, isParsing, progress, phaseLabel }) {
  if (isParsing) {
    return (
      <div className="border border-dashed rounded-xl p-8 text-center bg-card">
        <Loader2 className="w-7 h-7 mx-auto mb-3 animate-spin text-primary" />
        <p className="text-sm font-medium mb-3">{phaseLabel || 'STEP 파일 파싱 중...'}</p>
        <Progress value={progress} className="max-w-sm mx-auto" />
        <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 border">
      <DropZone
        onFile={onFile}
        accept=".stp,.step"
        label="STEP 도면(.stp / .step)을 끌어놓거나 클릭해 선택"
        className="py-4"
      />
      <p className="text-xs text-muted-foreground mt-3 text-center">
        최대 {MAX_FILE_SIZE_MB}MB · 부품 {MAX_PART_COUNT}개 이하 · 브라우저에서 직접 파싱합니다
      </p>
    </div>
  );
}