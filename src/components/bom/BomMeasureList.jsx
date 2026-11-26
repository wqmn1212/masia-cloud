import React from 'react';
import BomMeasureRow from '@/components/bom/BomMeasureRow';

// 이 화면에서 잰 측정 목록 (저장하지 않는 임시 기록) — 누르면 도면 위에 다시 표시
export default function BomMeasureList({ rows, selectedId, onSelect, onChange, onDelete }) {
  if (!rows.length) return <p className="px-1 text-caption text-muted-foreground">거리·각도 모드에서 모델 위를 찍으면 측정이 여기에 쌓입니다.</p>;
  const diffCount = rows.filter((r) => r.design !== '' && Math.abs(r.value - Number(r.design)) > (Number(r.tolerance) || 0)).length;
  return (
    <div className="space-y-2">
      {diffCount > 0 && <p className="px-1 text-caption text-destructive">설계치와 다른 측정 {diffCount}건</p>}
      {rows.map((r) => (
        <BomMeasureRow
          key={r.id}
          row={r}
          active={selectedId === r.id}
          onSelect={() => onSelect(selectedId === r.id ? '' : r.id)}
          onChange={onChange}
          onDelete={() => onDelete(r.id)}
        />
      ))}
    </div>
  );
}