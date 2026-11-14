// 회로도 그리기 (캔버스 2D). 좌표는 화면 픽셀. view: { scale(격자 1칸 px), ox, oy }
import { LED_COLORS, axes, terminals, valueLabel, formatSI, TERMINAL_NAMES } from '@/lib/circuit/parts';

export const GRID = 20;

export const toScreen = (view, gx, gy) => ({ x: gx * view.scale + view.ox, y: gy * view.scale + view.oy });

/** 전압 → 색: 양(+)은 초록, 음(−)은 빨강, 0 은 회색 */
export function voltColor(v, vmax, theme) {
  if (v == null || !Number.isFinite(v)) return theme.neutral;
  const k = Math.max(-1, Math.min(1, v / (vmax || 1)));
  const [r0, g0, b0] = theme.zero;
  const [r1, g1, b1] = k >= 0 ? theme.pos : theme.neg;
  const a = Math.abs(k);
  return `rgb(${Math.round(r0 + (r1 - r0) * a)},${Math.round(g0 + (g1 - g0) * a)},${Math.round(b0 + (b1 - b0) * a)})`;
}

export function themeOf(dark) {
  return dark
    ? { bg: '#0f1115', grid: 'rgba(255,255,255,0.06)', ink: '#e5e7eb', muted: '#9ca3af', neutral: '#9ca3af', zero: [140, 140, 150], pos: [52, 211, 120], neg: [248, 90, 90], sel: '#60a5fa', dot: '#facc15', label: '#d1d5db' }
    : { bg: '#ffffff', grid: 'rgba(15,23,42,0.07)', ink: '#1f2937', muted: '#6b7280', neutral: '#6b7280', zero: [120, 120, 130], pos: [22, 163, 74], neg: [220, 38, 38], sel: '#2563eb', dot: '#d97706', label: '#374151' };
}

/** 부품 몸체를 그리기 위한 국소 좌표계: 원점 p1, x 축 p1→p2 */
function frame(ctx, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.atan2(dy, dx));
  return len;
}

function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

/** 두 단자 부품: 양쪽 리드를 단자 전압 색으로 그리고 가운데 몸체를 그린다 */
function twoTerminal(ctx, a, b, c1, c2, bodyLen, body, s) {
  const len = frame(ctx, a, b);
  const bl = Math.min(bodyLen * s, len * 0.8);
  const x0 = (len - bl) / 2;
  ctx.strokeStyle = c1; line(ctx, 0, 0, x0, 0);
  ctx.strokeStyle = c2; line(ctx, x0 + bl, 0, len, 0);
  const grad = ctx.createLinearGradient(x0, 0, x0 + bl, 0);
  grad.addColorStop(0, c1); grad.addColorStop(1, c2);
  body(x0, bl, grad, Math.atan2(b.y - a.y, b.x - a.x));
  ctx.restore();
  return len;
}

/** 부품 하나 그리기. info: 시뮬레이션 결과(out), vmax: 전압 색 기준 */
export function drawPart(ctx, p, view, { info, vmax, theme, selected, hover, voltageAt }) {
  const s = view.scale / GRID;
  const ts = terminals(p).map((t) => toScreen(view, t.x, t.y));
  const a = toScreen(view, p.x1, p.y1), b = toScreen(view, p.x2, p.y2);
  const vs = ts.map((t, k) => (info?.volts ? info.volts[k] : voltageAt?.(terminals(p)[k])));
  const col = vs.map((v) => voltColor(v, vmax, theme));
  const q = p.props || {};
  ctx.lineWidth = Math.max(1.5, 2.2 * s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (selected || hover) {
    ctx.save();
    ctx.strokeStyle = selected ? theme.sel : theme.muted;
    ctx.globalAlpha = selected ? 0.35 : 0.18;
    ctx.lineWidth = 12 * s;
    outline(p).forEach(([u, w]) => { const A = toScreen(view, u.x, u.y), B = toScreen(view, w.x, w.y); line(ctx, A.x, A.y, B.x, B.y); });
    ctx.restore();
  }
  const ink = theme.ink;

  switch (p.type) {
    case 'wire': {
      ctx.strokeStyle = col[0]; line(ctx, a.x, a.y, b.x, b.y);
      break;
    }
    case 'resistor': {
      twoTerminal(ctx, a, b, col[0], col[1], 32, (x0, bl, grad) => {
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(x0, 0);
        const n = 6;
        for (let i = 0; i < n; i++) ctx.lineTo(x0 + ((i + 0.5) / n) * bl, (i % 2 ? 1 : -1) * 6 * s);
        ctx.lineTo(x0 + bl, 0); ctx.stroke();
      }, s);
      break;
    }
    case 'pot': {
      twoTerminal(ctx, a, b, col[0], col[1], 32, (x0, bl, grad) => {
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(x0, 0);
        for (let i = 0; i < 6; i++) ctx.lineTo(x0 + ((i + 0.5) / 6) * bl, (i % 2 ? 1 : -1) * 6 * s);
        ctx.lineTo(x0 + bl, 0); ctx.stroke();
      }, s);
      // 와이퍼 화살표: 단자에서 몸체 위치(pos)로
      const pos = Math.max(0, Math.min(1, Number(q.pos ?? 0.5)));
      const tip = { x: a.x + (b.x - a.x) * pos, y: a.y + (b.y - a.y) * pos };
      const w = ts[2];
      const { n } = axes(p);
      const off = { x: tip.x + n.x * 8 * s, y: tip.y + n.y * 8 * s };
      ctx.strokeStyle = col[2];
      ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + (off.x - w.x) * 0.0, off.y); ctx.lineTo(off.x, off.y); ctx.stroke();
      arrowHead(ctx, off.x + n.x * 4 * s, off.y + n.y * 4 * s, tip.x, tip.y, 6 * s, col[2]);
      break;
    }
    case 'capacitor': {
      twoTerminal(ctx, a, b, col[0], col[1], 10, (x0, bl) => {
        ctx.strokeStyle = col[0]; line(ctx, x0, -11 * s, x0, 11 * s);
        ctx.strokeStyle = col[1]; line(ctx, x0 + bl, -11 * s, x0 + bl, 11 * s);
      }, s);
      break;
    }
    case 'inductor': {
      twoTerminal(ctx, a, b, col[0], col[1], 36, (x0, bl, grad) => {
        ctx.strokeStyle = grad;
        const r = bl / 8;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) ctx.arc(x0 + r + i * 2 * r, 0, r, Math.PI, 0, false);
        ctx.stroke();
      }, s);
      break;
    }
    case 'switch': {
      twoTerminal(ctx, a, b, col[0], col[1], 28, (x0, bl) => {
        ctx.fillStyle = ink;
        [x0, x0 + bl].forEach((x) => { ctx.beginPath(); ctx.arc(x, 0, 2.5 * s, 0, Math.PI * 2); ctx.fill(); });
        ctx.strokeStyle = ink;
        if (q.closed) line(ctx, x0, 0, x0 + bl, 0);
        else line(ctx, x0, 0, x0 + bl * 0.92, -bl * 0.45);
      }, s);
      break;
    }
    case 'dcv': {
      twoTerminal(ctx, a, b, col[0], col[1], 10, (x0, bl) => {
        // p1 쪽 짧은 판(−), p2 쪽 긴 판(+)
        ctx.strokeStyle = col[0]; ctx.lineWidth = 4 * s; line(ctx, x0, -6 * s, x0, 6 * s);
        ctx.strokeStyle = col[1]; ctx.lineWidth = Math.max(1.5, 2.2 * s); line(ctx, x0 + bl, -13 * s, x0 + bl, 13 * s);
        plusMark(ctx, x0 + bl + 7 * s, -11 * s, 3 * s, ink);
      }, s);
      break;
    }
    case 'acv': case 'pulse': case 'dci': case 'voltmeter': case 'ammeter': {
      const r = 13;
      twoTerminal(ctx, a, b, col[0], col[1], 2 * r, (x0, bl, _g, ang) => {
        const cx = x0 + bl / 2, R = bl / 2;
        ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(cx, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = Math.max(1.2, 1.6 * s);
        if (p.type === 'acv') {
          ctx.beginPath();
          for (let i = 0; i <= 20; i++) { const t = i / 20; const x = cx - R * 0.6 + t * R * 1.2; const y = -Math.sin(t * Math.PI * 2) * R * 0.35; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        } else if (p.type === 'pulse') {
          const w = R * 0.6, h = R * 0.35;
          ctx.beginPath(); ctx.moveTo(cx - w, h); ctx.lineTo(cx - w, -h); ctx.lineTo(cx, -h); ctx.lineTo(cx, h); ctx.lineTo(cx + w, h); ctx.lineTo(cx + w, -h); ctx.stroke();
        } else if (p.type === 'dci') {
          line(ctx, cx - R * 0.55, 0, cx + R * 0.45, 0);
          arrowHead(ctx, cx, 0, cx + R * 0.6, 0, 5 * s, ink);
        } else {
          // 글자는 부품 방향과 상관없이 똑바로
          ctx.save(); ctx.translate(cx, 0); ctx.rotate(-ang); ctx.fillStyle = ink; ctx.font = `bold ${Math.round(12 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.type === 'voltmeter' ? 'V' : 'A', 0, 0); ctx.restore();
        }
        if (p.type === 'acv' || p.type === 'pulse') plusMark(ctx, x0 + bl + 6 * s, -10 * s, 3 * s, ink);
        if (p.type === 'voltmeter') plusMark(ctx, x0 - 6 * s, -10 * s, 3 * s, ink);
      }, s);
      break;
    }
    case 'diode': case 'led': case 'zener': {
      const on = p.type === 'led' ? Math.max(0, Math.min(1, info?.brightness || 0)) : 0;
      const rgb = LED_COLORS[q.color]?.rgb || [255, 60, 50];
      if (p.type === 'led' && on > 0.01) {
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 34 * s);
        g.addColorStop(0, `rgba(${rgb.join(',')},${0.75 * on})`);
        g.addColorStop(1, `rgba(${rgb.join(',')},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, 34 * s, 0, Math.PI * 2); ctx.fill();
      }
      twoTerminal(ctx, a, b, col[0], col[1], 16, (x0, bl) => {
        const h = 8 * s;
        ctx.beginPath(); ctx.moveTo(x0, -h); ctx.lineTo(x0, h); ctx.lineTo(x0 + bl, 0); ctx.closePath();
        if (p.type === 'led') { ctx.fillStyle = `rgba(${rgb.join(',')},${0.25 + 0.75 * on})`; ctx.fill(); }
        ctx.strokeStyle = ink; ctx.stroke();
        ctx.beginPath();
        if (p.type === 'zener') { ctx.moveTo(x0 + bl - 4 * s, -h - 3 * s); ctx.lineTo(x0 + bl, -h); ctx.lineTo(x0 + bl, h); ctx.lineTo(x0 + bl + 4 * s, h + 3 * s); }
        else { ctx.moveTo(x0 + bl, -h); ctx.lineTo(x0 + bl, h); }
        ctx.stroke();
        if (p.type === 'led') {
          ctx.lineWidth = Math.max(1, 1.4 * s);
          [0, 6].forEach((o) => { const sx = x0 + bl * 0.3 + o * s, sy = -h - 2 * s; line(ctx, sx, sy, sx + 6 * s, sy - 7 * s); arrowHead(ctx, sx, sy, sx + 7 * s, sy - 8 * s, 4 * s, ink); });
        }
      }, s);
      break;
    }
    case 'npn': case 'pnp': case 'nmos': case 'pmos': {
      // 몸체 막대는 p2 보다 조금 앞(베이스 쪽)에, 다리는 p2 의 세로줄로 나가 C·E(D·S) 단자로 곧게 이어진다
      const [B, C, E] = ts;
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
      const f = q.flip ? -1 : 1;
      const nx = -uy * f, ny = ux * f; // C 는 −n, E 는 +n 쪽
      const isMos = p.type === 'nmos' || p.type === 'pmos';
      const bc = { x: b.x - ux * 14 * s, y: b.y - uy * 14 * s };
      const h = 13 * s, leg = 8 * s;
      const at = (pt, k) => ({ x: pt.x + nx * k, y: pt.y + ny * k });
      // 베이스(게이트) 리드
      const gx = isMos ? 6 * s : 0;
      ctx.strokeStyle = col[0];
      line(ctx, B.x, B.y, bc.x - ux * gx, bc.y - uy * gx);
      if (isMos) { const g1 = at({ x: bc.x - ux * gx, y: bc.y - uy * gx }, -h), g2 = at({ x: bc.x - ux * gx, y: bc.y - uy * gx }, h); line(ctx, g1.x, g1.y, g2.x, g2.y); }
      // 몸체 막대
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, 3.5 * s);
      const t1 = at(bc, -h), t2 = at(bc, h);
      line(ctx, t1.x, t1.y, t2.x, t2.y);
      ctx.lineWidth = Math.max(1.5, 2.2 * s);
      const cIn = at(bc, -leg), eIn = at(bc, leg), cOut = at(b, -leg * 1.6), eOut = at(b, leg * 1.6);
      ctx.strokeStyle = col[1];
      if (isMos) { const c2 = at(b, -leg); line(ctx, cIn.x, cIn.y, c2.x, c2.y); line(ctx, c2.x, c2.y, C.x, C.y); }
      else { line(ctx, cIn.x, cIn.y, cOut.x, cOut.y); line(ctx, cOut.x, cOut.y, C.x, C.y); }
      ctx.strokeStyle = col[2];
      if (isMos) { const e2 = at(b, leg); line(ctx, eIn.x, eIn.y, e2.x, e2.y); line(ctx, e2.x, e2.y, E.x, E.y); }
      else { line(ctx, eIn.x, eIn.y, eOut.x, eOut.y); line(ctx, eOut.x, eOut.y, E.x, E.y); }
      if (p.type === 'npn') arrowHead(ctx, eIn.x, eIn.y, eOut.x, eOut.y, 7 * s, ink);
      if (p.type === 'pnp') arrowHead(ctx, eOut.x, eOut.y, (eIn.x + eOut.x) / 2, (eIn.y + eOut.y) / 2, 7 * s, ink);
      if (isMos) {
        // 바디(가운데) 선은 소스에 묶인다. 화살표: N채널은 안쪽, P채널은 바깥쪽
        const m2 = { x: b.x, y: b.y }, e2 = at(b, leg);
        ctx.strokeStyle = ink; line(ctx, bc.x, bc.y, m2.x, m2.y); line(ctx, m2.x, m2.y, e2.x, e2.y);
        if (p.type === 'nmos') arrowHead(ctx, m2.x, m2.y, bc.x + ux * 1 * s, bc.y + uy * 1 * s, 6 * s, ink);
        else arrowHead(ctx, bc.x, bc.y, m2.x - ux * 2 * s, m2.y - uy * 2 * s, 6 * s, ink);
      }
      break;
    }
    case 'opamp': {
      const [Pp, Nn] = ts;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      const nx = -uy, ny = ux;
      const baseX = a.x + ux * 12 * s, baseY = a.y + uy * 12 * s;
      const apex = { x: b.x - ux * 10 * s, y: b.y - uy * 10 * s };
      const h = 30 * s;
      ctx.strokeStyle = ink;
      ctx.beginPath(); ctx.moveTo(baseX + nx * h, baseY + ny * h); ctx.lineTo(baseX - nx * h, baseY - ny * h); ctx.lineTo(apex.x, apex.y); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = col[0]; line(ctx, Pp.x, Pp.y, Pp.x + ux * 12 * s, Pp.y + uy * 12 * s);
      ctx.strokeStyle = col[1]; line(ctx, Nn.x, Nn.y, Nn.x + ux * 12 * s, Nn.y + uy * 12 * s);
      ctx.strokeStyle = col[2]; line(ctx, apex.x, apex.y, b.x, b.y);
      ctx.fillStyle = ink; ctx.font = `bold ${Math.round(13 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', Pp.x + ux * 20 * s, Pp.y + uy * 20 * s);
      ctx.fillText('−', Nn.x + ux * 20 * s, Nn.y + uy * 20 * s);
      break;
    }
    case 'ground': {
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
      const e = { x: a.x + ux * 12 * s, y: a.y + uy * 12 * s };
      ctx.strokeStyle = voltColor(0, 1, theme); line(ctx, a.x, a.y, e.x, e.y);
      ctx.strokeStyle = ink;
      [[11, 0], [7, 4], [3, 8]].forEach(([w, o]) => line(ctx, e.x + ux * o * s + nx * w * s, e.y + uy * o * s + ny * w * s, e.x + ux * o * s - nx * w * s, e.y + uy * o * s - ny * w * s));
      break;
    }
    case 'probe': {
      ctx.strokeStyle = col[0];
      line(ctx, a.x, a.y, b.x, b.y);
      const v = vs[0];
      const text = v == null ? 'V' : formatSI(v, 'V');
      ctx.font = `600 ${Math.round(12 * s)}px ui-monospace, monospace`;
      const w = ctx.measureText(text).width + 10 * s;
      ctx.fillStyle = theme.bg; ctx.strokeStyle = col[0];
      roundRect(ctx, b.x - (b.x < a.x ? w : 0), b.y - 9 * s, w, 18 * s, 4 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = theme.label; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, b.x - (b.x < a.x ? w : 0) + 5 * s, b.y);
      break;
    }
    default: break;
  }

  // 단자 점
  ctx.fillStyle = theme.ink;
  if (p.type !== 'wire') ts.forEach((t, k) => { ctx.beginPath(); ctx.arc(t.x, t.y, 2.2 * s, 0, Math.PI * 2); ctx.fillStyle = col[k]; ctx.fill(); });

  // 값 라벨과 측정값
  const label = valueLabel(p);
  const reading = readingText(p, info);
  if ((label || reading) && view.scale >= 12) {
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
    const off = ['npn', 'pnp', 'nmos', 'pmos'].includes(p.type) ? 26 * s : 18 * s;
    ctx.font = `${Math.round(11 * s)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = theme.label;
    ctx.textBaseline = 'middle';
    const at = ['npn', 'pnp', 'nmos', 'pmos', 'opamp'].includes(p.type) ? b : m;
    if (vertical) { ctx.textAlign = 'left'; if (label) ctx.fillText(label, at.x + off, at.y - (reading ? 7 * s : 0)); if (reading) { ctx.fillStyle = theme.muted; ctx.fillText(reading, at.x + off, at.y + (label ? 7 * s : 0)); } }
    else { ctx.textAlign = 'center'; if (label) ctx.fillText(label, at.x, at.y - off); if (reading) { ctx.fillStyle = theme.muted; ctx.fillText(reading, at.x, at.y + off); } }
  }
  // 3단자 이름
  if (TERMINAL_NAMES[p.type] && (selected || hover)) {
    ctx.font = `600 ${Math.round(10 * s)}px sans-serif`; ctx.fillStyle = theme.sel; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ts.forEach((t, k) => ctx.fillText(TERMINAL_NAMES[p.type][k], t.x + 8 * s, t.y - 4 * s));
  }
}

function readingText(p, info) {
  if (!info) return '';
  if (p.type === 'voltmeter') return formatSI(info.voltage, 'V');
  if (p.type === 'ammeter') return formatSI(info.current, 'A');
  if (p.type === 'led' && Math.abs(info.avgCurrent ?? info.current) > 1e-6) return formatSI(info.avgCurrent ?? info.current, 'A');
  return '';
}

function plusMark(ctx, x, y, r, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.4;
  line(ctx, x - r, y, x + r, y); line(ctx, x, y - r, x, y + r);
  ctx.restore();
}

export function arrowHead(ctx, x1, y1, x2, y2, size, color) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save(); ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(ang - 0.45), y2 - size * Math.sin(ang - 0.45));
  ctx.lineTo(x2 - size * Math.cos(ang + 0.45), y2 - size * Math.sin(ang + 0.45));
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

/** 선택 표시용 선분(격자 좌표) */
export function outline(p) {
  const ts = terminals(p);
  if (ts.length === 1) return [[ts[0], { x: p.x2, y: p.y2 }]];
  if (ts.length === 2) return [[ts[0], ts[1]]];
  const c = p.type === 'pot' ? { x: (p.x1 + p.x2) / 2, y: (p.y1 + p.y2) / 2 } : { x: p.x2, y: p.y2 };
  return ts.map((t) => [t, c]);
}

/** 부품의 전류 경로(점 애니메이션용): [{a, b, i}] (a→b 방향 전류) */
export function currentPaths(p, info) {
  if (!info) return [];
  const ts = terminals(p);
  if (ts.length === 2) return [{ a: ts[0], b: ts[1], i: info.ti[0] }];
  if (p.type === 'opamp') {
    const { d } = axes(p);
    return [{ a: ts[2], b: { x: p.x2 - d.x * 0.5, y: p.y2 - d.y * 0.5 }, i: info.ti[2] }];
  }
  const c = p.type === 'pot' ? { x: (p.x1 + p.x2) / 2, y: (p.y1 + p.y2) / 2 } : { x: p.x2, y: p.y2 };
  return ts.map((t, k) => ({ a: t, b: c, i: info.ti[k] }));
}

/** 전류 점 그리기: 구간 a→b(화면 좌표), 위상(phase px) */
export function drawDots(ctx, A, B, phase, color, s) {
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
  if (len < 2) return;
  const gap = 16 * s;
  ctx.fillStyle = color;
  let start = ((phase % gap) + gap) % gap;
  for (let d = start; d < len; d += gap) {
    ctx.beginPath(); ctx.arc(A.x + (dx * d) / len, A.y + (dy * d) / len, 2.3 * s, 0, Math.PI * 2); ctx.fill();
  }
}

/** 전류 크기 → 점 속도(px/s). 1 µA 미만은 0 */
export function dotSpeed(i, speedScale = 1) {
  const a = Math.abs(i);
  if (!(a > 1e-6)) return 0;
  const k = Math.min(1, (Math.log10(a) + 6) / 6); // 1 µA → 0, 1 A → 1
  return Math.sign(i) * (12 + 140 * k) * speedScale;
}
