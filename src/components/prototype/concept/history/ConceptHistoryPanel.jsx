import React, { useMemo, useState } from 'react';
import { GitCompareArrows, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConceptHistoryRow from './ConceptHistoryRow';
import ConceptComparePanel from './ConceptComparePanel';

// 컨셉 버전 히스토리: 버전별 수정 내역과 보관된 3D 도면 파일을 한 목록에서 관리하고, 두 버전을 비교한다
export default function ConceptHistoryPanel({ concepts = [], concept, onSelect, onChanged }) {
  const rows = useMemo(() => [...concepts].sort((a, b) => (b.version_no || 0) - (a.version_no || 0)), [concepts]);
  const [pair, setPair] = useState(null);
  if (!rows.length) return null;

  const defaultPair = () => {
    const target = rows.find((c) => c.id === concept?.id) || rows[0];
    const older = rows.find((c) => (c.version_no || 0) < (target.version_no || 0)) || rows.find((c) => c.id !== target.id);
    return { targetId: target.id, baseId: (older || target).id };
  };
  const open = Boolean(pair);

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <p className="text-title font-semibold">버전 히스토리</p>
        <p className="text-caption text-muted-foreground">최신 v{rows[0].version_no} · {rows.length}개 버전 — 수정 내역과 3D 도면 파일</p>
        <Button size="sm" variant={open ? 'default' : 'outline'} className="ml-auto" disabled={rows.length < 2} onClick={() => setPair(open ? null : defaultPair())}>
          <GitCompareArrows />{open ? '비교 닫기' : '버전 비교'}
        </Button>
      </div>
      {pair && <ConceptComparePanel concepts={rows} baseId={pair.baseId} targetId={pair.targetId} onChange={setPair} />}
      <ul className="divide-y border-t">
        {rows.map((c) => (
          <ConceptHistoryRow
            key={c.id}
            concept={c}
            current={c.id === concept?.id}
            isBase={Boolean(pair) && pair.baseId === c.id}
            onSelect={onSelect}
            onCompare={(id) => setPair({ baseId: id, targetId: concept?.id || rows[0].id })}
            onFilesChanged={() => onChanged(null)}
          />
        ))}
      </ul>
    </section>
  );
}