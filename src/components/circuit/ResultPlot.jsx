import React, { useEffect, useRef, useState } from 'react';
import { formatSI } from '@/lib/circuit/parts';

const isDark = () => document.documentElement.classList.contains('dark');

/** 보기 좋은 눈금 (1·2·5 단위) */
function niceTicks(lo, hi, count = 6) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw) || mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

const PLAIN = new Set(['dB', '°']);
const fmt = (v, unit, d = 3) => (PLAIN.has(unit) ? `${Number(v.toFixed(d > 3 ? 2 : 1))} ${unit}` : formatSI(v, unit, d));

function interp(x, y, xv) {
  let lo = 0, hi = x.length - 1;
  if (xv <= x[0]) return y[0];
  if (xv >= x[hi]) return y[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (x[m] <= xv) lo = m; else hi = m; }
  const t = (xv - x[lo]) / ((x[hi] - x[lo]) || 1);
  return y[lo] + t * (y[hi] - y[lo]);
}

/**
 * 결과 그래프. series: [{ x, y, color, alpha, label, width }], xLog: 로그 가로축
 * 마우스를 올리면 세로선과 각 선의 값을 보여 준다.
 */
export default function ResultPlot({ series, xLog = false, xUnit = 's', yUnit = 'V', yLabel = '', height = 220, xLabel = '' }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const geo = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = r.width, H = r.height, dark = isDark();
    const ink = dark ? '#d1d5db' : '#374151', grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    ctx.clearRect(0, 0, W, H);
    const L = 64, R = 12, T = 10, B = 28;
    const pw = W - L - R, ph = H - T - B;
    const all = series.filter((s) => s.x?.length);
    if (!all.length) { geo.current = null; return; }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    all.forEach((s) => {
      for (let i = 0; i < s.x.length; i++) {
        const xv = s.x[i], yv = s.y[i];
        if (!Number.isFinite(yv) || (xLog && !(xv > 0))) continue;
        x0 = Math.min(x0, xv); x1 = Math.max(x1, xv); y0 = Math.min(y0, yv); y1 = Math.max(y1, yv);
      }
    });
    if (!(x1 > x0)) x1 = x0 + 1;
    if (!(y1 > y0)) { const m = Math.abs(y0) || 1; y0 -= m * 0.1; y1 += m * 0.1; }
    const pad = (y1 - y0) * 0.06; y0 -= pad; y1 += pad;
    const fx = xLog ? (v) => L + ((Math.log10(v) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0))) * pw : (v) => L + ((v - x0) / (x1 - x0)) * pw;
    const fy = (v) => T + (1 - (v - y0) / (y1 - y0)) * ph;
    geo.current = { L, T, pw, ph, x0, x1, xLog, W };

    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = ink; ctx.strokeStyle = grid; ctx.lineWidth = 1;
    // 세로축 눈금
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    niceTicks(y0, y1, 5).forEach((v) => {
      const y = fy(v);
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke();
      ctx.fillText(fmt(v, yUnit, 3), L - 6, y);
    });
    // 가로축 눈금
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xt = xLog
      ? Array.from({ length: Math.floor(Math.log10(x1)) - Math.ceil(Math.log10(x0)) + 1 }, (_, i) => Math.pow(10, Math.ceil(Math.log10(x0)) + i))
      : niceTicks(x0, x1, 8);
    xt.forEach((v) => {
      const x = fx(v);
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
      // 오른쪽 끝 글자가 잘리지 않게
      ctx.textAlign = x > L + pw - 24 ? 'right' : x < L + 16 ? 'left' : 'center';
      ctx.fillText(formatSI(v, xUnit, 3), x, T + ph + 6);
    });
    if (xLog) {
      // 로그 축의 2~9 보조선
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
      for (let d = Math.floor(Math.log10(x0)); d <= Math.ceil(Math.log10(x1)); d++) for (let k = 2; k < 10; k++) {
        const v = k * Math.pow(10, d);
        if (v < x0 || v > x1) continue;
        const x = fx(v); ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
      }
    }
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)';
    ctx.strokeRect(L, T, pw, ph);
    if (yLabel) { ctx.save(); ctx.translate(12, T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(yLabel, 0, 0); ctx.restore(); }
    if (xLabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(xLabel, L + pw, T + ph - 4); }

    // 선
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
    all.forEach((s) => {
      ctx.strokeStyle = s.color; ctx.globalAlpha = s.alpha ?? 1; ctx.lineWidth = s.width || 1.6;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < s.x.length; i++) {
        const yv = s.y[i];
        if (!Number.isFinite(yv) || (xLog && !(s.x[i] > 0))) { pen = false; continue; }
        const X = fx(s.x[i]), Y = fy(yv);
        if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
      }
      ctx.stroke();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
    if (hover && hover.px >= L && hover.px <= L + pw) {
      ctx.strokeStyle = ink; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(hover.px, T); ctx.lineTo(hover.px, T + ph); ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [series, xLog, xUnit, yUnit, yLabel, xLabel, hover, height]);

  const onMove = (e) => {
    const g = geo.current;
    if (!g) return;
    const r = ref.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const t = Math.max(0, Math.min(1, (px - g.L) / g.pw));
    const xv = g.xLog ? Math.pow(10, Math.log10(g.x0) + t * (Math.log10(g.x1) - Math.log10(g.x0))) : g.x0 + t * (g.x1 - g.x0);
    setHover({ px, xv });
  };

  const shown = hover ? series.filter((s) => s.x?.length && s.label).slice(0, 8) : [];
  return (
    <div className="relative">
      <canvas ref={ref} style={{ height }} className="block w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {hover && shown.length > 0 && (
        <div className="pointer-events-none absolute top-2 rounded-md border bg-popover/95 px-2.5 py-1.5 text-caption shadow-sm"
          style={{ left: Math.min(hover.px + 12, (geo.current?.W || 400) - 190) }}>
          <p className="font-mono text-muted-foreground">{formatSI(hover.xv, xUnit, 4)}</p>
          {shown.map((s) => (
            <p key={s.label} className="flex items-center gap-1.5 font-mono tabular-nums">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="max-w-[120px] truncate">{s.label}</span>
              <span className="ml-auto pl-2">{fmt(interp(s.x, s.y, hover.xv), yUnit, 4)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
