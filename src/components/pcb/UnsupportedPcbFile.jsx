import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadNativeFile } from '@/lib/pcbArt/opj';

export default function UnsupportedPcbFile({ file }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="text-title font-semibold">파일은 열었지만 회로 형식은 지원되지 않습니다</h2>
      <p className="text-body text-warning-text">{file.reason}</p>
      <dl className="grid gap-2 text-caption sm:grid-cols-3"><div><dt className="text-muted-foreground">파일</dt><dd className="break-all">{file.name}</dd></div><div><dt className="text-muted-foreground">크기</dt><dd>{file.bytes.length.toLocaleString()} bytes</dd></div><div><dt className="text-muted-foreground">저장 유형</dt><dd>{file.text === null ? '바이너리 또는 미확인 인코딩' : '텍스트'}</dd></div></dl>
      <p className="text-caption text-muted-foreground">형식을 확인하기 전에는 회로를 추측해 그리거나 내용을 변경하지 않습니다. 아래 다운로드는 수정본이 아닌 업로드 원본입니다.</p>
      <Button variant="outline" onClick={() => downloadNativeFile(file.bytes, file.name)}><Download />원본 그대로 다운로드</Button>
    </section>
  );
}