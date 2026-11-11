import React, { useState } from 'react';
import { Box, Eye, FileBox, GitCompareArrows, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtDate } from '@/lib/prototype';
import { conceptFiles, hasModel, openConceptFile, saveConceptModelFile } from '@/lib/conceptHistory';

const statusChip = (status) => (status === 'BRIEF' ? { label: '확인 전', cls: 'bg-muted text-muted-foreground' } : { label: '프리뷰 완료', cls: 'bg-success/15 text-success-text' });

// 히스토리 한 줄: 버전·수정 내역·보관된 3D 도면 파일
export default function ConceptHistoryRow({ concept, current, isBase, onSelect, onCompare, onFilesChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chip = statusChip(concept.status);
  const size = concept.preview?.overall_mm;
  const files = conceptFiles(concept);
  const model = hasModel(concept);

  const save = async () => {
    setBusy(true); setError('');
    try { await saveConceptModelFile(concept); onFilesChanged(); } catch (e) { setError(e?.response?.data?.error || e?.message || '3D 파일을 저장하지 못했습니다.'); }
    setBusy(false);
  };

  return (
    <li className={`px-4 py-3.5 ${current ? 'bg-primary/[0.04]' : ''}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-label font-semibold tabular-nums">v{concept.version_no}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-label font-medium">
            <span className="truncate">{concept.title || '컨셉'}</span>
            <span className={`rounded px-1.5 py-0.5 text-micro font-semibold ${chip.cls}`}>{chip.label}</span>
            {current && <span className="text-micro font-semibold text-primary">보는 중</span>}
            {isBase && <span className="text-micro text-muted-foreground">비교 기준</span>}
          </p>
          <p className="text-micro text-muted-foreground">{fmtDate(concept.created_date)} · {concept.created_by_name || '-'} · {concept.based_on_id ? '수정 버전' : '최초 컨셉'}</p>
          {concept.change_request && <p className="mt-1 text-caption text-muted-foreground">요청: {concept.change_request}</p>}
          {concept.preview?.change_summary && <p className="text-caption text-muted-foreground">반영: {concept.preview.change_summary}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-muted-foreground">
            <span>부품 {concept.preview?.parts?.length || 0}개</span>
            {size?.x ? <span>약 {size.x} × {size.z} × {size.y} mm</span> : null}
            {files.map((f) => (
              <button key={f.id} type="button" onClick={() => openConceptFile(f).catch(() => setError('파일을 열지 못했습니다.'))} title={`${f.name} 내려받기`} className="inline-flex max-w-[220px] items-center gap-1 rounded border px-1.5 py-0.5 hover:border-primary/50 hover:text-foreground">
                <FileBox className="h-3 w-3 shrink-0" /><span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
          {error && <p className="mt-1 text-caption text-destructive">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => onSelect(concept.id)}><Eye />보기</Button>
          {model && <Button size="sm" variant="outline" onClick={() => onCompare(concept.id)}><GitCompareArrows />비교</Button>}
          {model && <Button size="sm" variant="ghost" onClick={save} disabled={busy} title="이 버전의 3D 형상을 STL 도면 파일로 보관합니다">{busy ? <Loader2 className="animate-spin" /> : <Box />}3D 파일 저장</Button>}
        </div>
      </div>
    </li>
  );
}