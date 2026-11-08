import React from 'react';
import Pill from '@/components/prototype/Pill';
import { VERIFY_STATUS } from '@/lib/prototype';

// PCB 부품표: 부품명/제조사/부품번호/수량/전압/전류/인터페이스 + 검증 상태·근거
export default function BomTable({ bom = [] }) {
  if (!bom.length) return <p className="text-caption text-muted-foreground">부품표가 없습니다.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-label">
        <thead className="bg-muted/60 text-caption text-muted-foreground">
          <tr>{['Ref', '부품명', '제조사', '부품번호', '수량', '전압', '전류', '인터페이스', '검증', '근거'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {bom.map((b, i) => (
            <tr key={i} className="align-top">
              <td className="px-3 py-2 font-mono text-caption">{b.ref || '-'}</td>
              <td className="px-3 py-2 font-medium">{b.name}{b.function && <p className="text-micro text-muted-foreground font-normal">{b.function}</p>}</td>
              <td className="px-3 py-2">{b.manufacturer || '-'}</td>
              <td className="px-3 py-2 font-mono text-caption">{b.part_no || '-'}</td>
              <td className="px-3 py-2 tabular-nums">{b.qty ?? '-'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{b.voltage || '-'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{b.current || '-'}</td>
              <td className="px-3 py-2">{b.interface || '-'}</td>
              <td className="px-3 py-2"><Pill meta={VERIFY_STATUS[b.verify_status] || VERIFY_STATUS.NEEDS_CHECK} /></td>
              <td className="px-3 py-2 text-caption text-muted-foreground min-w-[180px]">{b.basis || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}