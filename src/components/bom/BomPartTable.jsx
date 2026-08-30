import React from 'react';
import BomPartRow from '@/components/bom/BomPartRow';

const HEAD = [
  '', '부품명', '부피 (cm³)', '외곽 치수 (mm)', '재질', '중량 (g)',
  '캐비티', '사이클 (s)', '기계', '수량', '구매품',
];

export default function BomPartTable({ parts, onPartChange }) {
  return (
    <div className="border rounded-xl overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            {HEAD.map((h, i) => (
              <th key={i} className="p-2 text-left font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parts.map((part, index) => (
            <BomPartRow
              key={`${part.part_name}-${index}`}
              part={part}
              onChange={(next) => onPartChange(index, next)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}