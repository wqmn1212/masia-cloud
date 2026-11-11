import React from 'react';
import { AlertTriangle, Crosshair, Wrench } from 'lucide-react';
import ConceptNotes from '@/components/prototype/concept/ConceptNotes';
import { REVIEW_VERDICT, SEVERITY, fmtDate } from '@/lib/prototype';
import { MOLD_CATEGORIES } from '@/lib/concept';

const ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const Tag = ({ meta }) => <span className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-medium ${meta.className}`}>{meta.label}</span>;
const range = (v, unit) => (v ? `${v[0]}~${v[1]}${unit}` : '-');

export default function ConceptMoldResult({ mold, parts, highlightId, onHighlight }) {
  const mt = mold.rules?.metrics || {};
  const partName = (id) => (parts || []).find((p) => p.id === id)?.name;
  const tiles = [
    ['수축률', range(mt.shrink_pct, '%'), mt.material_name], ['길이 방향 예상 수축', range(mt.shrink_mm, 'mm'), '금형 보정 대상'],
    ['권장 최소 살', mt.min_wall_mm != null ? `${mt.min_wall_mm}mm` : '-', '재질 기준'], ['리브 두께 상한', mt.rib_max_mm != null ? `${mt.rib_max_mm}mm` : '-', '싱크 방지'],
    ['필요 구배', mt.draft_required_deg != null ? `${mt.draft_required_deg}°` : '-', '높이·표면 기준'], ['유동 길이비', mt.flow_ratio != null ? `${mt.flow_ratio} / ${mt.flow_limit}` : '-', '중앙 1점 게이트 가정'],
  ];
  const issues = [
    ...(mold.rules?.checks || []).map((c, i) => ({ id: `r${i}`, ...c, basis: c.detail, source: '규칙 계산' })),
    ...(mold.findings || []).map((f) => ({ ...f, source: 'AI 검토' })),
  ].sort((a, b) => (ORDER[a.severity] ?? 1) - (ORDER[b.severity] ?? 1));

  return (
    <div className="space-y-4">
      {mold.stale && <p className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning-text"><AlertTriangle className="w-4 h-4" />이전 버전의 검토 결과입니다. 형상이 바뀌었으니 다시 실행해 주세요.</p>}
      <div className="flex items-start gap-2"><Tag meta={REVIEW_VERDICT[mold.verdict] || REVIEW_VERDICT.CONDITIONAL} /><p className="text-body">{mold.summary}</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {tiles.map(([l, v, sub]) => (
          <div key={l} className="rounded-lg border p-3">
            <p className="text-micro text-muted-foreground">{l} · 참고값</p>
            <p className="text-body font-semibold tabular-nums">{v}</p>
            <p className="text-micro text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-label font-semibold">걸리는 부분 {issues.length}</p>
        {issues.length === 0 && <p className="text-caption text-muted-foreground">입력한 조건에서 찾은 문제가 없습니다. 미확인 항목을 채우면 더 정확해집니다.</p>}
        {issues.map((f) => (
          <div key={f.id} className={`rounded-lg border p-3 space-y-1 transition-colors ${f.part_id && highlightId === f.part_id ? 'border-primary bg-primary/5' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Tag meta={SEVERITY[f.severity] || SEVERITY.MEDIUM} />
              <span className="rounded-full bg-muted px-2 py-0.5 text-micro text-muted-foreground">{MOLD_CATEGORIES[f.category] || '기타'}</span>
              <p className="text-label font-medium">{f.title}</p>
              <span className="ml-auto text-micro text-muted-foreground">{f.source}</span>
            </div>
            {(f.location || f.part_id) && (
              <button type="button" disabled={!f.part_id} onClick={() => onHighlight(highlightId === f.part_id ? null : f.part_id)} className="inline-flex items-center gap-1 text-caption text-primary disabled:text-muted-foreground">
                <Crosshair className="w-3.5 h-3.5" />{[partName(f.part_id), f.location].filter(Boolean).join(' · ')}{f.part_id ? ' — 3D에서 보기' : ''}
              </button>
            )}
            <p className="text-caption text-muted-foreground"><span className="font-medium text-foreground">근거</span> {f.basis}</p>
            {f.recommendation && <p className="text-caption"><span className="font-medium text-primary">개선 제안</span> {f.recommendation}</p>}
            {f.needs_vendor_check && <p className="inline-flex items-center gap-1 text-micro text-warning-text"><Wrench className="w-3 h-3" />금형 업체 검토 필요</p>}
          </div>
        ))}
      </div>

      {(mold.gate_candidates?.length > 0 || mold.parting_line) && (
        <div className="space-y-1.5">
          <p className="text-label font-semibold">게이트 후보 · 파팅</p>
          {(mold.gate_candidates || []).map((g, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-0.5">
              <p className="text-label font-medium">후보 {i + 1}. {[partName(g.part_id), g.location].filter(Boolean).join(' · ')}<span className="ml-2 text-caption font-normal text-muted-foreground">{g.type}</span></p>
              <p className="text-caption text-muted-foreground">{g.reason}</p>
              {g.constraint && <p className="text-caption"><span className="font-medium text-warning-text">위치 제약</span> {g.constraint}</p>}
            </div>
          ))}
          {mold.parting_line && <p className="text-caption text-muted-foreground"><span className="font-medium text-foreground">파팅라인</span> {mold.parting_line}</p>}
        </div>
      )}

      <ConceptNotes groups={[
        { title: '금형 업체가 확인해야 하는 항목', kind: 'vendor', items: mold.vendor_checks },
        { title: '미확인 조건 (판단하지 않음)', kind: 'unverified', items: [...(mold.rules?.unknowns || []), ...(mold.unverified || [])] },
        { title: 'AI가 둔 가정', kind: 'assume', items: mold.assumptions },
      ]} />
      <p className="text-micro text-muted-foreground">{fmtDate(mold.generated_at)} · {mold.generated_by_name}{mold.files?.length ? ` · 도면 ${mold.files.map((f) => f.name).join(', ')}` : ''}</p>
    </div>
  );
}