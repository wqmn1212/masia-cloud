import React from 'react';

export default function SimStats({ result }) {
  const tiles = [
    ['총 시간', result.duration_s, 's'], ['최대 전류', result.peak_current_a, 'A'], ['평균 전류', result.avg_current_a, 'A'],
    ['최대 전력', result.peak_power_w, 'W'], ['소비 에너지', result.energy_wh, 'Wh'],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {tiles.map(([l, v, u]) => (
        <div key={l} className="rounded-lg border p-3">
          <p className="text-micro text-muted-foreground">{l} · 계산</p>
          <p className="text-title font-semibold tabular-nums">{v ?? '-'}<span className="text-caption font-normal text-muted-foreground ml-1">{u}</span></p>
        </div>
      ))}
    </div>
  );
}