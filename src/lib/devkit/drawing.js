// 외장 부품 하나의 2D 설계 도면 (A3 가로, 3각법): 평면도·정면도·우측면도 + 치수 + 구멍 표 + 주기 + 표제란
// 입력은 3D 도면 단계의 파라메트릭 치수(partParams)와 개구부(partCutouts). 결과는 SVG 문자열 (단위 mm).
// 이 도면은 컨셉 기준 외형 초안이다: 살두께·리브·보스 같은 내부 형상은 CAD 모델(STEP)이 기준이다.

export const SHEET = { w: 420, h: 297 };
const SCALES = [[5, '5:1'], [2, '2:1'], [1, '1:1'], [0.5, '1:2'], [0.4, '1:2.5'], [0.2, '1:5'], [0.1, '1:10'], [0.05, '1:20']];
const FACE = { top: '윗면', front: '앞면', back: '뒷면' };

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => String(Math.round(Number(v) * 10) / 10);
const n = (v) => Number(v.toFixed(2));

/** 도면 영역에 들어가는 가장 큰 표준 척도 */
export function pickScale(W, D, H) {
  const g = 24;
  const kx = (380 - 22 - g) / (W + D), ky = (196 - 16 - g) / (D + H);
  const k = Math.min(kx, ky);
  return SCALES.find(([s]) => s <= k) || SCALES[SCALES.length - 1];
}

function arrowHead(x, y, dx, dy) {
  // (x, y) 가 화살 끝, (dx, dy) 는 화살이 가리키는 방향의 단위 벡터
  const L = 2.6, Wd = 0.9;
  const bx = x - dx * L, by = y - dy * L;
  return `<path d="M${n(x)} ${n(y)}L${n(bx - dy * Wd)} ${n(by + dx * Wd)}L${n(bx + dy * Wd)} ${n(by - dx * Wd)}z" fill="#111"/>`;
}

/** 가로 치수: (x1, x2) 사이, 기준선 yBase 에서 yDim 까지 보조선 */
function dimH(x1, x2, yBase, yDim, text) {
  const s = Math.sign(yDim - yBase) || 1;
  return [
    `<line x1="${n(x1)}" y1="${n(yBase + s * 1)}" x2="${n(x1)}" y2="${n(yDim + s * 1.5)}" class="thin"/>`,
    `<line x1="${n(x2)}" y1="${n(yBase + s * 1)}" x2="${n(x2)}" y2="${n(yDim + s * 1.5)}" class="thin"/>`,
    `<line x1="${n(x1)}" y1="${n(yDim)}" x2="${n(x2)}" y2="${n(yDim)}" class="thin"/>`,
    arrowHead(x1, yDim, -1, 0), arrowHead(x2, yDim, 1, 0),
    `<text x="${n((x1 + x2) / 2)}" y="${n(yDim - 1.2)}" class="dim" text-anchor="middle">${esc(text)}</text>`,
  ].join('');
}

/** 세로 치수: (y1, y2) 사이, 기준선 xBase 에서 xDim 까지 보조선 */
function dimV(y1, y2, xBase, xDim, text) {
  const s = Math.sign(xDim - xBase) || -1;
  const ty = (y1 + y2) / 2;
  return [
    `<line x1="${n(xBase + s * 1)}" y1="${n(y1)}" x2="${n(xDim + s * 1.5)}" y2="${n(y1)}" class="thin"/>`,
    `<line x1="${n(xBase + s * 1)}" y1="${n(y2)}" x2="${n(xDim + s * 1.5)}" y2="${n(y2)}" class="thin"/>`,
    `<line x1="${n(xDim)}" y1="${n(y1)}" x2="${n(xDim)}" y2="${n(y2)}" class="thin"/>`,
    arrowHead(xDim, y1, 0, -1), arrowHead(xDim, y2, 0, 1),
    `<text x="${n(xDim - 1.2)}" y="${n(ty)}" class="dim" text-anchor="middle" transform="rotate(-90 ${n(xDim - 1.2)} ${n(ty)})">${esc(text)}</text>`,
  ].join('');
}

const centerH = (x1, x2, y) => `<line x1="${n(x1)}" y1="${n(y)}" x2="${n(x2)}" y2="${n(y)}" class="center"/>`;
const centerV = (x, y1, y2) => `<line x1="${n(x)}" y1="${n(y1)}" x2="${n(x)}" y2="${n(y2)}" class="center"/>`;
const balloon = (x, y, i) => `<circle cx="${n(x)}" cy="${n(y)}" r="2.6" class="thin" fill="#fff"/><text x="${n(x)}" y="${n(y + 1.05)}" class="small" text-anchor="middle">${i}</text>`;

/** 번호 풍선: 뷰 가운데에서 구멍 쪽 바깥 방향(대각선)으로 끌어낸다 — 중심선·외형선과 겹치지 않게 */
function leader(c, cx, cy, vx, vy, k) {
  const r = (c.kind === 'circle' ? c.d / 2 : Math.hypot(c.w, c.h) / 2) * k;
  const dx = Math.sign(cx - vx) || 1, dy = Math.sign(cy - vy) || -1;
  const ux = dx * Math.SQRT1_2, uy = dy * Math.SQRT1_2;
  const sx = cx + ux * r, sy = cy + uy * r, ex = sx + ux * 6, ey = sy + uy * 6;
  return `<line x1="${n(sx)}" y1="${n(sy)}" x2="${n(ex)}" y2="${n(ey)}" class="thin"/>${balloon(ex + ux * 2.6, ey + uy * 2.6, c.no)}`;
}

/** 개구부 하나를 그린다 (cx, cy 는 화면 좌표, k 는 척도) */
function opening(c, cx, cy, k, hidden) {
  const cls = hidden ? 'hidden' : 'part';
  const mark = `<line x1="${n(cx - 1.5)}" y1="${n(cy)}" x2="${n(cx + 1.5)}" y2="${n(cy)}" class="thin"/><line x1="${n(cx)}" y1="${n(cy - 1.5)}" x2="${n(cx)}" y2="${n(cy + 1.5)}" class="thin"/>`;
  if (c.kind === 'circle') return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n((c.d / 2) * k)}" class="${cls}" fill="none"/>${hidden ? '' : mark}`;
  return `<rect x="${n(cx - (c.w / 2) * k)}" y="${n(cy - (c.h / 2) * k)}" width="${n(c.w * k)}" height="${n(c.h * k)}" class="${cls}" fill="none"/>${hidden ? '' : mark}`;
}

export const sizeText = (c) => (c.kind === 'circle' ? `Ø${f1(c.d)}` : `${f1(c.w)} × ${f1(c.h)}`);
/** 구멍 표의 위치: 윗면은 X, Y(앞쪽 −) / 앞·뒷면은 X, 윗면에서 아래로 */
export const posText = (c) => (c.face === 'top' ? `X ${f1(c.x)} · Y ${f1(c.y)}` : `X ${f1(c.x)} · 위에서 ${f1(-c.z)}`);

// 등각 투상: +X → (cos30, sin30), +Y(뒤) → (cos30, −sin30), +Z(위) → (0, −1)
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
function isoView(P, W, D, H, cuts, box, kMax) {
  if (box.w < 60) return '';
  const fit = Math.min((box.w - 10) / ((W + D) * C30), (box.h - 24) / ((W + D) * S30 + H));
  const k = Math.min(kMax, fit);
  const ox = box.x + box.w / 2 - ((W - D) / 2) * C30 * k * 0 , oy = box.y + 14 + (D / 2) * S30 * k + (W / 2) * S30 * k;
  // 원점 = 윗면 중심. 윗면 마름모의 위 꼭짓점이 상자 위쪽에 오도록 둔다
  const pt = (x, y, z) => [ox + (x * C30 + y * C30) * k, oy + (x * S30 - y * S30 - z) * k];
  const poly = (ps) => `<path d="M${ps.map((q) => `${n(q[0])} ${n(q[1])}`).join('L')}z" class="part" fill="#fff"/>`;
  const out = [];
  const w = W / 2, d = D / 2;
  if (P.shape === 'round') {
    const r = W / 2, rx = r * C30 * Math.SQRT2 * k, ry = r * S30 * Math.SQRT2 * k;
    out.push(`<path d="M${n(ox - rx)} ${n(oy)}L${n(ox - rx)} ${n(oy + H * k)}A${n(rx)} ${n(ry)} 0 0 0 ${n(ox + rx)} ${n(oy + H * k)}L${n(ox + rx)} ${n(oy)}" class="part" fill="#fff"/>`);
    out.push(`<ellipse cx="${n(ox)}" cy="${n(oy)}" rx="${n(rx)}" ry="${n(ry)}" class="part" fill="#fff"/>`);
  } else {
    out.push(poly([pt(-w, -d, -H), pt(w, -d, -H), pt(w, -d, 0), pt(-w, -d, 0)]));
    out.push(poly([pt(w, -d, -H), pt(w, d, -H), pt(w, d, 0), pt(w, -d, 0)]));
    out.push(poly([pt(-w, -d, 0), pt(w, -d, 0), pt(w, d, 0), pt(-w, d, 0)]));
  }
  // 개구부: 윗면은 (x, y) 평면, 앞면은 (x, z) 평면에 그린 원·사각형을 등각으로 변환
  const topM = `matrix(${n(C30)} ${n(S30)} ${n(C30)} ${n(-S30)} ${n(ox)} ${n(oy)})`;
  const [fx, fy] = pt(0, -d, 0);
  const frontM = `matrix(${n(C30)} ${n(S30)} 0 -1 ${n(fx)} ${n(fy)})`;
  cuts.forEach((c) => {
    if (c.face === 'back') return;
    const m = c.face === 'top' ? topM : frontM;
    const v = c.face === 'top' ? c.y : c.z;
    const shape = c.kind === 'circle'
      ? `<circle cx="${n(c.x * k)}" cy="${n(v * k)}" r="${n((c.d / 2) * k)}"/>`
      : `<rect x="${n((c.x - c.w / 2) * k)}" y="${n((v - c.h / 2) * k)}" width="${n(c.w * k)}" height="${n(c.h * k)}"/>`;
    out.push(`<g transform="${m}" fill="#f3f4f6" stroke="#111" stroke-width="0.35" vector-effect="non-scaling-stroke">${shape.replace('/>', ' vector-effect="non-scaling-stroke"/>')}</g>`);
  });
  out.push(`<text x="${n(box.x + box.w / 2)}" y="${n(box.y + box.h - 2)}" class="label" text-anchor="middle">등각도 (참고, 척도 없음)</text>`);
  return out.join('');
}

/**
 * @param {object} o { title, partName, material, params:{shape,width,depth,height,wall,corner}, cutouts, date:'YYYY-MM-DD', docNo, author }
 */
export function drawingSvg(o) {
  const P = o.params || {};
  const W = Number(P.width) || 100, D = P.shape === 'round' ? W : Number(P.depth) || 100, H = Number(P.height) || 50;
  const R = P.shape === 'round' ? 0 : Math.max(0, Number(P.corner) || 0);
  const [k, scaleLabel] = pickScale(W, D, H);
  const g = 24;
  const x0 = 38, yA = 26;
  const top = { x: x0, y: yA, w: W * k, h: D * k };
  const front = { x: x0, y: yA + D * k + g, w: W * k, h: H * k };
  const side = { x: x0 + W * k + g, y: front.y, w: D * k, h: H * k };
  const cuts = (o.cutouts || []).map((c, i) => ({ ...c, no: i + 1 }));
  const S = [];

  S.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}" font-family="'Pretendard','Noto Sans KR','Malgun Gothic',sans-serif">`);
  S.push('<style>.part{stroke:#111;stroke-width:0.5;fill:none}.thin{stroke:#111;stroke-width:0.18;fill:none}.center{stroke:#111;stroke-width:0.18;stroke-dasharray:6 1.2 1 1.2}.hidden{stroke:#111;stroke-width:0.25;stroke-dasharray:2.2 1.2}.frame{stroke:#111;stroke-width:0.7;fill:none}.dim{font-size:3.2px;fill:#111}.small{font-size:2.4px;fill:#111}.label{font-size:3.2px;fill:#111;font-weight:600}.tb{font-size:2.6px;fill:#444}.tbv{font-size:3.4px;fill:#111}.tbt{font-size:4.6px;fill:#111;font-weight:700}</style>');
  S.push(`<rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}" fill="#fff"/>`);
  S.push(`<rect x="10" y="10" width="${SHEET.w - 20}" height="${SHEET.h - 20}" class="frame"/>`);

  // ── 평면도 (위에서 본 모양, 앞쪽이 아래) ──
  const tcx = top.x + top.w / 2, tcy = top.y + top.h / 2;
  if (P.shape === 'round') S.push(`<circle cx="${n(tcx)}" cy="${n(tcy)}" r="${n((W / 2) * k)}" class="part"/>`);
  else S.push(`<rect x="${n(top.x)}" y="${n(top.y)}" width="${n(top.w)}" height="${n(top.h)}" rx="${n(R * k)}" class="part"/>`);
  S.push(centerH(top.x - 4, top.x + top.w + 4, tcy), centerV(tcx, top.y - 4, top.y + top.h + 4));
  cuts.filter((c) => c.face === 'top').forEach((c) => {
    const cx = tcx + c.x * k, cy = tcy - c.y * k;
    S.push(opening(c, cx, cy, k, false));
    S.push(leader(c, cx, cy, tcx, tcy, k));
  });
  S.push(dimV(top.y, top.y + top.h, top.x, top.x - 9, f1(D)));
  if (R > 0) {
    const ax = top.x + top.w - R * k * 0.29, ay = top.y + R * k * 0.29;
    S.push(`<line x1="${n(ax)}" y1="${n(ay)}" x2="${n(ax + 7)}" y2="${n(ay - 7)}" class="thin"/>`, arrowHead(ax, ay, -0.707, 0.707), `<text x="${n(ax + 7.5)}" y="${n(ay - 7.5)}" class="dim">R${f1(R)}</text>`);
  }
  S.push(`<text x="${n(tcx)}" y="${n(top.y - 4)}" class="label" text-anchor="middle">평면도</text>`);

  // ── 정면도 ──
  const fcx = front.x + front.w / 2;
  S.push(`<rect x="${n(front.x)}" y="${n(front.y)}" width="${n(front.w)}" height="${n(front.h)}" class="part"/>`);
  if (R > 0) S.push(`<line x1="${n(front.x + R * k)}" y1="${n(front.y)}" x2="${n(front.x + R * k)}" y2="${n(front.y + front.h)}" class="thin"/><line x1="${n(front.x + front.w - R * k)}" y1="${n(front.y)}" x2="${n(front.x + front.w - R * k)}" y2="${n(front.y + front.h)}" class="thin"/>`);
  S.push(centerV(fcx, front.y - 4, front.y + front.h + 4));
  cuts.filter((c) => c.face === 'front' || c.face === 'back').forEach((c) => {
    const cx = fcx + c.x * k, cy = front.y - c.z * k;
    S.push(opening(c, cx, cy, k, c.face === 'back'));
    S.push(leader(c, cx, cy, fcx, front.y + front.h / 2, k));
  });
  S.push(dimH(front.x, front.x + front.w, front.y + front.h, front.y + front.h + 9, f1(W)));
  S.push(dimV(front.y, front.y + front.h, front.x, front.x - 9, f1(H)));
  S.push(`<text x="${n(fcx)}" y="${n(front.y + front.h + 18)}" class="label" text-anchor="middle">정면도</text>`);

  // ── 우측면도 (앞쪽이 왼쪽) ──
  const scx = side.x + side.w / 2;
  S.push(`<rect x="${n(side.x)}" y="${n(side.y)}" width="${n(side.w)}" height="${n(side.h)}" class="part"/>`);
  if (R > 0) S.push(`<line x1="${n(side.x + R * k)}" y1="${n(side.y)}" x2="${n(side.x + R * k)}" y2="${n(side.y + side.h)}" class="thin"/><line x1="${n(side.x + side.w - R * k)}" y1="${n(side.y)}" x2="${n(side.x + side.w - R * k)}" y2="${n(side.y + side.h)}" class="thin"/>`);
  S.push(centerV(scx, side.y - 4, side.y + side.h + 4));
  if (P.shape !== 'round') S.push(dimH(side.x, side.x + side.w, side.y + side.h, side.y + side.h + 9, f1(D)));
  S.push(`<text x="${n(scx)}" y="${n(side.y + side.h + 18)}" class="label" text-anchor="middle">우측면도</text>`);

  // ── 등각도 (참고, 오른쪽 위 빈 곳) ──
  S.push(isoView(P, W, D, H, cuts, { x: x0 + W * k + g + D * k + 16, y: 20, w: 400 - (x0 + W * k + g + D * k + 16), h: 205 }, k));

  // ── 구멍 표 (왼쪽 아래) ──
  const ht = { x: 16, y: 236, w: 134 };
  const cols = [[0, '번호'], [12, '이름'], [52, '면'], [66, '크기'], [92, '위치 (mm)']];
  S.push(`<text x="${ht.x}" y="${ht.y - 2}" class="label">구멍·개구부 표</text>`);
  S.push(`<line x1="${ht.x}" y1="${ht.y}" x2="${ht.x + ht.w}" y2="${ht.y}" class="thin"/>`);
  cols.forEach(([dx, t]) => S.push(`<text x="${ht.x + dx + 1}" y="${ht.y + 3.6}" class="tb">${t}</text>`));
  S.push(`<line x1="${ht.x}" y1="${ht.y + 5}" x2="${ht.x + ht.w}" y2="${ht.y + 5}" class="thin"/>`);
  const shown = cuts.slice(0, 8);
  shown.forEach((c, i) => {
    const y = ht.y + 5 + (i + 1) * 5;
    const vals = [String(c.no), String(c.name || '').slice(0, 14), FACE[c.face] || c.face, sizeText(c), posText(c)];
    cols.forEach(([dx], j) => S.push(`<text x="${ht.x + dx + 1}" y="${y - 1.4}" class="small">${esc(vals[j])}</text>`));
    S.push(`<line x1="${ht.x}" y1="${y}" x2="${ht.x + ht.w}" y2="${y}" class="thin"/>`);
  });
  if (!cuts.length) S.push(`<text x="${ht.x + 1}" y="${ht.y + 8.6}" class="small">개구부 없음</text>`);
  if (cuts.length > shown.length) S.push(`<text x="${ht.x + 1}" y="${ht.y + 5 + 9 * 5 - 1.4}" class="small">외 ${cuts.length - shown.length}개 (CAD 모델 참조)</text>`);

  // ── 주기 ──
  const nx = 156, ny = 236;
  const notes = [
    '주기',
    `1. 살두께 ${f1(P.wall || 2)} mm (균일), 빼기 구배 1° 이상`,
    '2. 지시 없는 모서리 R0.5, 리브 두께는 살두께의 60 % 이하',
    '3. 앞·뒷면 개구부는 벽을 관통, 뒷면은 숨은선',
    '4. 컨셉 기준 외형 초안. 내부 형상은 CAD(STEP) 기준',
    '5. 위치: 윗면 중심 원점, 앞쪽 −Y',
  ];
  notes.forEach((t, i) => S.push(`<text x="${nx}" y="${ny - 2 + i * 4.6}" class="${i ? 'small' : 'label'}">${esc(t)}</text>`));

  // ── 표제란 (오른쪽 아래) ──
  const tb = { x: 236, y: 233, w: 174, h: 54 };
  S.push(`<rect x="${tb.x}" y="${tb.y}" width="${tb.w}" height="${tb.h}" class="frame"/>`);
  const rows = [14, 10, 10, 10, 10];
  let yy = tb.y;
  rows.forEach((h, i) => { yy += h; if (i < rows.length - 1) S.push(`<line x1="${tb.x}" y1="${yy}" x2="${tb.x + tb.w}" y2="${yy}" class="thin"/>`); });
  S.push(`<text x="${tb.x + 2}" y="${tb.y + 4}" class="tb">품명</text><text x="${tb.x + 2}" y="${tb.y + 11}" class="tbt">${esc(`${o.title || ''}${o.partName ? ` — ${o.partName}` : ''}`.slice(0, 40))}</text>`);
  const cell = (row, c, label, value) => {
    const y = tb.y + 14 + row * 10, x = tb.x + c * (tb.w / 2);
    S.push(`<text x="${x + 2}" y="${y + 3.6}" class="tb">${esc(label)}</text><text x="${x + 2}" y="${y + 8.4}" class="tbv">${esc(value)}</text>`);
  };
  S.push(`<line x1="${tb.x + tb.w / 2}" y1="${tb.y + 14}" x2="${tb.x + tb.w / 2}" y2="${tb.y + tb.h}" class="thin"/>`);
  cell(0, 0, '도번', o.docNo || '-'); cell(0, 1, '척도', `${scaleLabel} (A3)`);
  cell(1, 0, '재질', o.material || '-'); cell(1, 1, '단위', 'mm');
  cell(2, 0, '투상법', '3각법'); cell(2, 1, '일반 공차', 'KS B ISO 2768-m');
  cell(3, 0, '작성', `${o.author || 'AEGIS 개발 워크벤치'} · ${o.date || ''}`); cell(3, 1, '시트', '1 / 1');
  // 3각법 기호 (원뿔대 정면 + 측면 원)
  const px = tb.x + 40, py = tb.y + 14 + 2 * 10 + 5;
  S.push(`<path d="M${px} ${py - 3}L${px + 7} ${py - 1.5}L${px + 7} ${py + 1.5}L${px} ${py + 3}z" class="thin"/><circle cx="${px + 13}" cy="${py}" r="3" class="thin"/><circle cx="${px + 13}" cy="${py}" r="1.5" class="thin"/>`);

  S.push('</svg>');
  return { svg: S.join(''), scale: scaleLabel, k, holes: cuts };
}

export const drawingFileName = (title, partName) => `${String(`${title || 'drawing'}-${partName || ''}`).replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+$/, '').slice(0, 60)}-도면`;
