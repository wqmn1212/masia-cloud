import React from 'react';
import MeasureRow from '@/components/prototype/measure/MeasureRow';

// 3D 검토 측정 기록 목록
export default function MeasureList({ rows, selectedId, onSelect, onStatus, onDelete }) {
  if (!rows.length) {
    return <p className="text-caption text-muted-foreground">아직 측정 기록이 없습니다. 거리·각도를 찍어 저장하면 여기에 쌓입니다.</p>;
  }
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <MeasureRow
          key={row.id}
          row={row}
          active={row.id === selectedId}
          onSelect={() => onSelect(row.id === selectedId ? '' : row.id)}
          onStatus={onStatus}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}