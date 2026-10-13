import React from 'react';

const fmt = (n, d = 1) => Number(n || 0).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** 부품 요약 (크기·중량·두께·성형 조건 추정) */
export default function MoldSummary({ result, report, cavitiesManual }) {
  const s = result.summary;
  const c = report.calc;
  const rows = [
    ['크기 (mm)', s.size.map((v) => fmt(v, 1)).join(' × ')],
    ['중량 (추정)', `${fmt(c.weight, 1)} g`],
    ['기본 살 두께', `${fmt(s.nominal, 2)} mm`],
    ['빼기 방향', `${result.pull.label}${result.pull.auto ? ' (자동)' : ''}`],
    ['투영 면적', `${fmt(c.projectedCm2, 1)} cm²`],
    ['캐비티 수', `${c.cavities}개${cavitiesManual ? '' : ' (자동)'}`],
    ['형체력 (추정)', `${fmt(c.tonnage, 0)} 톤`],
    ['추천 사출기', `${c.machine}톤급 이상`],
  ];
  return (
    <div>
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-border gap-px">
        {rows.map(([k, v]) => (
          <div key={k} className="bg-card px-3 py-2">
            <span className="block text-[11px] text-muted-foreground">{k}</span>
            <b className="block text-sm tabular-nums">{v}</b>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        삼각형 {s.nt.toLocaleString()}개 · 검토 {fmt(s.ms / 1000, 1)}초 · 엔진 {result.version}
      </p>
    </div>
  );
}
