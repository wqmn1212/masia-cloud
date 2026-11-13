import React from 'react';

// 최근 기록을 줄마다 작은 선 그래프로 (각 줄이 자기 눈금을 쓴다)
export default function SimChart({ history, rows, seconds = 30 }) {
  const end = history.length ? history[history.length - 1].t : 0;
  const pts = history.filter((h) => h.t >= end - seconds);
  const W = 600, H = 46;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const vals = pts.map((h) => r.get(h));
        const lo = r.min ?? Math.min(...vals, 0), hi = Math.max(r.max ?? -Infinity, ...vals, lo + (r.span || 1));
        const x = (t) => ((t - (end - seconds)) / seconds) * W;
        const y = (v) => H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6);
        const d = pts.map((h, i) => `${i ? 'L' : 'M'}${x(h.t).toFixed(1)},${y(r.get(h)).toFixed(1)}`).join('');
        const ref = r.ref != null ? y(r.ref) : null;
        const now = vals.length ? vals[vals.length - 1] : null;
        return (
          <div key={r.label} className="grid grid-cols-[88px_1fr] items-center gap-2">
            <div className="min-w-0">
              <p className="text-micro text-muted-foreground truncate">{r.label}</p>
              <p className="text-label font-semibold tabular-nums">{now == null ? '—' : r.fmt(now)}</p>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-11 w-full rounded bg-secondary/60" role="img" aria-label={`${r.label} 최근 ${seconds}초`}>
              {ref != null && ref > 0 && ref < H && <line x1="0" x2={W} y1={ref} y2={ref} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
              <path d={d} fill="none" stroke={r.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        );
      })}
      <p className="text-right text-micro text-muted-foreground">최근 {seconds}초 (시뮬레이션 시간){rows.some((r) => r.ref != null) ? ' · 점선 = 한계' : ''}</p>
    </div>
  );
}
