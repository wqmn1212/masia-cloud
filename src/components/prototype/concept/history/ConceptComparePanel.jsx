import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { conceptSnapshot } from '@/lib/conceptSnapshot';
import { diffConcepts, hasModel } from '@/lib/conceptHistory';
import { CONCEPT_LAYERS } from '@/lib/concept';

const STATUS = {
  added: { label: '추가', cls: 'bg-success/15 text-success-text' },
  removed: { label: '삭제', cls: 'bg-destructive/10 text-destructive' },
  changed: { label: '변경', cls: 'bg-warning/15 text-warning-text' },
};

function VersionPicker({ label, value, concepts, onChange }) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="text-caption font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>
          {concepts.map((c) => <SelectItem key={c.id} value={c.id}>v{c.version_no} · {c.title || '컨셉'}{c.change_request ? ' (수정)' : ''}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}

// 두 버전을 나란히 놓고 전체 크기·부품 변화를 본다
export default function ConceptComparePanel({ concepts, baseId, targetId, onChange }) {
  const base = concepts.find((c) => c.id === baseId);
  const target = concepts.find((c) => c.id === targetId);
  const diff = base && target && base.id !== target.id ? diffConcepts(base, target) : null;
  const [shots, setShots] = useState({});

  useEffect(() => {
    let alive = true;
    const todo = [base, target].filter((c) => c && hasModel(c) && !shots[c.id]);
    if (!todo.length) return undefined;
    (async () => {
      for (const c of todo) {
        try {
          const { data } = conceptSnapshot(c.preview.parts, 560, 440);
          if (alive) setShots((prev) => ({ ...prev, [c.id]: data }));
        } catch { /* 형상을 그리지 못하면 글자 비교만 보여 준다 */ }
        await new Promise((r) => setTimeout(r, 80));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base?.id, target?.id]);

  return (
    <div className="space-y-4 border-b bg-secondary/40 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <VersionPicker label="기준 버전" value={baseId} concepts={concepts} onChange={(v) => onChange({ baseId: v, targetId })} />
        <VersionPicker label="비교 대상" value={targetId} concepts={concepts} onChange={(v) => onChange({ baseId, targetId: v })} />
      </div>

      {!base || !target ? <p className="text-caption text-muted-foreground">비교할 두 버전을 골라 주세요.</p> : base.id === target.id ? <p className="text-caption text-muted-foreground">서로 다른 두 버전을 골라 주세요.</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {[base, target].map((c) => (
              <div key={c.id} className="overflow-hidden rounded-xl border bg-card">
                <div className="relative flex h-36 items-center justify-center bg-gradient-to-b from-secondary to-card">
                  {shots[c.id] ? <img src={shots[c.id]} alt={`v${c.version_no} 형상`} className="h-full w-full object-contain" /> : hasModel(c) ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <span className="text-caption text-muted-foreground">3D 형상 없음</span>}
                  <span className="absolute left-2 top-2 rounded bg-card/90 px-1.5 py-0.5 text-micro font-semibold">v{c.version_no}</span>
                </div>
                <div className="border-t px-3 py-2">
                  <p className="truncate text-label font-medium">{c.title || '컨셉'}</p>
                  <p className="text-micro text-muted-foreground">{c.change_request || '최초 컨셉'}</p>
                </div>
              </div>
            ))}
          </div>

          {diff && (
            <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-caption font-semibold text-muted-foreground">전체 크기 (mm)</p>
                {diff.dims.map((d) => (
                  <div key={d.key} className="flex items-baseline justify-between gap-2 py-1 text-label">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="tabular-nums">{d.from} <ArrowRight className="inline h-3 w-3 align-middle text-muted-foreground" /> <b className={d.changed ? 'text-primary' : ''}>{d.to}</b></span>
                  </div>
                ))}
                <p className="mt-2 border-t pt-2 text-caption text-muted-foreground">부품 {diff.counts.before} → {diff.counts.after}개</p>
                {target.change_request && <p className="mt-2 border-t pt-2 text-caption"><span className="text-muted-foreground">변경 요청</span><br />{target.change_request}</p>}
                {target.preview?.change_summary && <p className="mt-1 text-caption"><span className="text-muted-foreground">반영</span><br />{target.preview.change_summary}</p>}
              </div>

              <div className="rounded-xl border bg-card p-3">
                <p className="px-1 text-caption font-semibold text-muted-foreground">형상 부품 변화 {diff.parts.length}</p>
                {diff.parts.length === 0 ? <p className="px-1 py-2 text-caption text-muted-foreground">부품 구성은 그대로입니다.</p> : (
                  <ul className="divide-y">
                    {diff.parts.map((p) => (
                      <li key={`${p.status}-${p.key}`} className="flex flex-wrap items-start gap-x-2 gap-y-1 px-1 py-2">
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
                        <span className="text-label font-medium">{p.name}</span>
                        <span className="text-micro text-muted-foreground">{CONCEPT_LAYERS[p.layer] || '기타'}</span>
                        {p.changes.length > 0 && <span className="w-full text-caption text-muted-foreground">{p.changes.join(' · ')}</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {diff.summaryChanged && (
                  <p className="mt-2 border-t px-1 pt-2 text-caption text-muted-foreground">설명이 바뀌었습니다 — {diff.summaryTo}</p>
                )}
                {diff.assumptions.length > 0 && (
                  <div className="mt-2 border-t px-1 pt-2">
                    <p className="text-caption font-semibold text-muted-foreground">새로 둔 가정</p>
                    <ul className="list-disc space-y-0.5 pl-4 text-caption text-muted-foreground">{diff.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}