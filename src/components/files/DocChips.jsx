import React from 'react';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';

// 연결된 서류를 이름 + 열기 버튼으로 나열 (송금확인증·물류비 청구서·인증서 등)
export default function DocChips({ docs = [], max = 3 }) {
  if (!docs.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {docs.slice(0, max).map((d) => (
        <span key={d.id} className="flex max-w-[220px] items-center rounded-md border bg-background pl-2 text-[11px]">
          <span className="truncate">{d.file_name}</span>
          <DocumentOpenButton document={d} />
        </span>
      ))}
      {docs.length > max && <span className="text-[11px] text-muted-foreground">외 {docs.length - max}건</span>}
    </span>
  );
}
