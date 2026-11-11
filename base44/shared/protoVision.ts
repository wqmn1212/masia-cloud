// 시제품 컨셉: 첨부 이미지 → 3D 형상 정확도 보강 (prototypeConcept 함수와 검산이 같이 쓴다)
//
// 1) 분석: AI 는 "보이는 것"만 적는다 — 시점(정면·측면·윗면), 원근 정도, 제품·부품의 위치 상자(0~1000), 이미지에 적힌 치수.
// 2) 측정: 앱이 실제 이미지 크기(픽셀)로 상자를 환산해 전체 비율과 부품 위치를 계산한다. (AI 가 mm 를 어림하지 않는다)
// 3) 생성: 형상 AI 는 측정값을 받아 3D 를 조립하고, 같은 부품에 ref_key 를 붙인다.
// 4) 보정: 앱이 만들어진 형상을 측정값과 비교해 전체 비율과 겉 부품 위치·크기를 맞추고, 일치도를 기록한다.
//
// 좌표: 단위 mm, Y 위, 원점은 제품 바닥면 중심, +X 는 정면에서 볼 때 오른쪽, +Z 는 정면(앞).

export const VIEWS = ['FRONT', 'BACK', 'SIDE', 'TOP', 'PERSPECTIVE', 'DETAIL'];
const KINDS = ['PHOTO', 'DRAWING', 'SKETCH', 'RENDER', 'OTHER'];
const PERSPECTIVES = ['LOW', 'MEDIUM', 'HIGH'];
const SIDES = ['LEFT', 'RIGHT', 'TOP', 'BOTTOM', 'UNKNOWN'];
const AXES = ['WIDTH', 'HEIGHT', 'DEPTH', 'DIAMETER', 'OTHER'];
const ROUND = ['cylinder', 'sphere', 'capsule', 'cone', 'torus'];
export const MAX_VISION_IMAGES = 4;

const box = { type: 'array', items: { type: 'number' } };
export const VISION_SCHEMA = {
  type: 'object',
  properties: {
    images: { type: 'array', items: { type: 'object', properties: {
      image_index: { type: 'integer' }, kind: { type: 'string', enum: KINDS }, orientation: { type: 'string', enum: ['LANDSCAPE', 'PORTRAIT', 'SQUARE'] },
      views: { type: 'array', items: { type: 'object', properties: {
        view: { type: 'string', enum: VIEWS }, perspective: { type: 'string', enum: PERSPECTIVES }, front_side: { type: 'string', enum: SIDES }, box,
        parts: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, name: { type: 'string' }, box } } },
      } } },
      dimensions: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, value_mm: { type: 'number' }, axis: { type: 'string', enum: AXES }, target: { type: 'string' } } } },
      product_text: { type: 'array', items: { type: 'string' } },
    } } },
    appearance: { type: 'string' },
    notes: { type: 'array', items: { type: 'string' } },
  },
};

export const VISION_PROMPT = `You are measuring product reference images so that a 3D concept model can match them exactly. The images are attached in order; image_index starts at 0.

For each image:
- kind: PHOTO, DRAWING (orthographic design or engineering drawing), SKETCH, RENDER or OTHER. orientation: LANDSCAPE, PORTRAIT or SQUARE as you see it.
- views: every separate depiction of the product. A photo usually has one; a drawing sheet may have several (front, side, top). Close-up crops are DETAIL.
  - view: FRONT, BACK, SIDE, TOP, PERSPECTIVE (three-quarter or angled) or DETAIL.
  - perspective: LOW if the camera looks straight at that face with almost no foreshortening (orthographic drawings are LOW), MEDIUM if slightly off-axis, HIGH if clearly angled, three-quarter or wide-angle close-up.
  - front_side (SIDE and TOP views only): which edge of the image the product's front faces: LEFT, RIGHT, TOP, BOTTOM or UNKNOWN. For FRONT, BACK and PERSPECTIVE use UNKNOWN.
  - box: tight bounding box of the whole product in this view as [x0, y0, x1, y1], integers 0-1000 relative to the image width and height, origin at the top-left. Exclude shadows, reflections, hands, backgrounds, dimension lines, arrows and text.
  - parts: visible exterior parts in this view, each with its own tight box in the same coordinates. key is a short snake_case name of the physical part (body, lid, base, handle, display, power_button, vent_grille, leg_front_left ...). Use the SAME key for the same physical part in every image and view, and different keys for different parts even if they look alike. name is the Korean name.
- dimensions: every dimension written on the image, converted to mm. axis is WIDTH (left-right), HEIGHT (up-down), DEPTH (front-back), DIAMETER or OTHER from the product's own point of view. target is "overall" for the whole product or the part key. text is the label as written.
- product_text: lettering physically printed or shown on the product.
Also: appearance — one English paragraph on colors, materials, finishes and distinctive shapes; notes — Korean, what was unclear or could not be measured.

Precision matters: the boxes are converted to proportions by the app. Do not box parts you cannot actually see, and do not invent dimensions that are not written.`;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;
const str = (v: unknown, n = 120) => (typeof v === 'string' ? v.slice(0, n) : '');
const pick = (v: any, allowed: string[], d: string) => (allowed.includes(v) ? v : d);

// ── 이미지 크기(픽셀): PNG·JPEG·WebP 머리말만 읽는다. JPEG 은 EXIF 회전(5~8)이면 가로·세로를 바꾼다
export function imageSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (!bytes || bytes.length < 30) return null;
  const be16 = (i: number) => (bytes[i] << 8) | bytes[i + 1];
  const be32 = (i: number) => ((bytes[i] << 24) >>> 0) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
  const le16 = (i: number) => bytes[i] | (bytes[i + 1] << 8);
  const le24 = (i: number) => bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);
  const ascii = (i: number, n: number) => String.fromCharCode(...bytes.slice(i, i + n));
  if (bytes[0] === 0x89 && ascii(1, 3) === 'PNG') return { w: be32(16), h: be32(20) };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8 ') return { w: le16(26) & 0x3fff, h: le16(28) & 0x3fff };
    if (chunk === 'VP8L') { const [b0, b1, b2, b3] = bytes.slice(21, 25); return { w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) }; }
    if (chunk === 'VP8X') return { w: 1 + le24(24), h: 1 + le24(27) };
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2, orient = 1;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const m = bytes[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
      const len = be16(i + 2);
      if (m === 0xe1 && ascii(i + 4, 4) === 'Exif') orient = exifOrientation(bytes, i + 10) || orient;
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
        const h = be16(i + 5), w = be16(i + 7);
        return orient >= 5 && orient <= 8 ? { w: h, h: w } : { w, h };
      }
      i += 2 + len;
    }
  }
  return null;
}

function exifOrientation(b: Uint8Array, t: number) {
  if (t + 8 > b.length) return 0;
  const le = b[t] === 0x49;
  const u16 = (i: number) => (le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
  const u32 = (i: number) => (le ? (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000 : b[i] * 0x1000000 + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]));
  const ifd = t + u32(t + 4);
  if (ifd + 2 > b.length) return 0;
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 10 > b.length) break;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return 0;
}

export const b64Bytes = (d: string) => { try { return Uint8Array.from(atob(d), (c) => c.charCodeAt(0)); } catch { return new Uint8Array(); } };

const cleanBox = (b: any) => {
  if (!Array.isArray(b) || b.length !== 4 || !b.every((v) => Number.isFinite(Number(v)))) return null;
  const [x0, y0, x1, y1] = b.map((v) => clamp(Number(v), 0, 1000));
  return x1 - x0 >= 5 && y1 - y0 >= 5 ? [x0, y0, x1, y1] : null;
};
const cleanKey = (k: any) => str(k, 40).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * AI 분석 결과 정리. files 는 AI 에 보낸 순서 그대로 [{id, name, width_px, height_px}].
 * AI 가 본 방향(가로·세로)과 픽셀 크기가 반대면 바꾼다 (휴대폰 사진의 회전 정보 차이).
 */
export function cleanVision(ai: any, files: any[]) {
  const images = files.map((f, i) => {
    const a = (Array.isArray(ai?.images) ? ai.images : []).find((x: any) => Number(x?.image_index) === i) || {};
    let w = Number(f.width_px) || 0, h = Number(f.height_px) || 0;
    if (w && h && ((a.orientation === 'PORTRAIT' && w > h * 1.05) || (a.orientation === 'LANDSCAPE' && h > w * 1.05))) [w, h] = [h, w];
    const views = (Array.isArray(a.views) ? a.views : []).slice(0, 6).map((v: any) => ({
      view: pick(v?.view, VIEWS, 'PERSPECTIVE'), perspective: pick(v?.perspective, PERSPECTIVES, 'HIGH'), front_side: pick(v?.front_side, SIDES, 'UNKNOWN'), box: cleanBox(v?.box),
      parts: (Array.isArray(v?.parts) ? v.parts : []).slice(0, 30).map((p: any) => ({ key: cleanKey(p?.key), name: str(p?.name, 60), box: cleanBox(p?.box) })).filter((p: any) => p.key && p.box),
    })).filter((v: any) => v.box);
    const dimensions = (Array.isArray(a.dimensions) ? a.dimensions : []).slice(0, 20)
      .filter((d: any) => Number(d?.value_mm) > 0 && Number(d.value_mm) < 5000)
      .map((d: any) => ({ text: str(d.text, 60), value_mm: r1(Number(d.value_mm)), axis: pick(d.axis, AXES, 'OTHER'), target: cleanKey(d.target) || 'overall' }));
    return { file_id: f.id, name: f.name, kind: pick(a.kind, KINDS, 'OTHER'), w, h, views, dimensions, product_text: (Array.isArray(a.product_text) ? a.product_text : []).filter((t: any) => typeof t === 'string').slice(0, 10).map((t: string) => t.slice(0, 60)) };
  });
  return { images, appearance: str(ai?.appearance, 1200), notes: (Array.isArray(ai?.notes) ? ai.notes : []).filter((t: any) => typeof t === 'string').slice(0, 8).map((t: string) => t.slice(0, 200)) };
}

// 가중 중앙값
const wmedian = (xs: { v: number; w: number }[]) => {
  const a = xs.filter((x) => Number.isFinite(x.v) && x.v > 0).sort((p, q) => p.v - q.v);
  if (!a.length) return null;
  const half = a.reduce((s, x) => s + x.w, 0) / 2;
  let acc = 0;
  for (const x of a) { acc += x.w; if (acc >= half) return x.v; }
  return a[a.length - 1].v;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const VIEW_KO: Record<string, string> = { FRONT: '정면', BACK: '뒷면', SIDE: '측면', TOP: '윗면', PERSPECTIVE: '비스듬한 사진', DETAIL: '부분 확대' };

/** 분석 결과 → 전체 비율·실제 치수·부품 위치(전체 크기에 대한 비율). 원근이 강한 시점은 쓰지 않는다 */
export function measureVision(vision: any) {
  const ratios: Record<string, { v: number; w: number }[]> = { xy: [], zy: [], xz: [] };
  const parts = new Map<string, any>();
  const used: Record<string, number> = { FRONT: 0, BACK: 0, SIDE: 0, TOP: 0 };
  const skipped: string[] = [];
  const warnings: string[] = [];
  const anchors: Record<string, number[]> = { x: [], y: [], z: [] };
  const anchorText: string[] = [];
  let noSize = 0;

  for (const img of vision?.images || []) {
    for (const d of img.dimensions) {
      if (d.target !== 'overall') continue;
      const axes = d.axis === 'WIDTH' ? ['x'] : d.axis === 'HEIGHT' ? ['y'] : d.axis === 'DEPTH' ? ['z'] : d.axis === 'DIAMETER' ? ['x', 'z'] : [];
      axes.forEach((a) => anchors[a].push(d.value_mm));
      if (axes.length) anchorText.push(`${d.text || d.axis} = ${d.value_mm}mm`);
    }
    for (const v of img.views) {
      if (v.view === 'PERSPECTIVE' || v.view === 'DETAIL' || v.perspective === 'HIGH') { skipped.push(`${img.name} (${VIEW_KO[v.view]}${v.perspective === 'HIGH' && v.view !== 'PERSPECTIVE' ? ', 원근 강함' : ''})`); continue; }
      const wt = v.perspective === 'LOW' ? 1 : 0.5;
      const [x0, y0, x1, y1] = v.box;
      const bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const side = v.front_side;
      if (img.w && img.h) {
        const r = (bw * img.w) / (bh * img.h);
        if (v.view === 'FRONT' || v.view === 'BACK') ratios.xy.push({ v: r, w: wt });
        else if (v.view === 'SIDE') ratios.zy.push({ v: r, w: wt });
        else if (v.view === 'TOP' && (side === 'TOP' || side === 'BOTTOM')) ratios.xz.push({ v: r, w: wt });
        else if (v.view === 'TOP' && (side === 'LEFT' || side === 'RIGHT')) ratios.xz.push({ v: 1 / r, w: wt });
      } else noSize++;
      used[v.view]++;
      for (const p of v.parts) {
        const [p0, q0, p1, q1] = p.box;
        const pcx = (p0 + p1) / 2, pcy = (q0 + q1) / 2;
        const e = parts.get(p.key) || { key: p.key, name: p.name, fx: [], fy: [], fw: [], fh: [], fz: [], fd: [] };
        if (!e.name && p.name) e.name = p.name;
        if (v.view === 'FRONT' || v.view === 'BACK') {
          e.fx.push(((pcx - cx) / bw) * (v.view === 'BACK' ? -1 : 1)); e.fy.push((y1 - pcy) / bh); e.fw.push((p1 - p0) / bw); e.fh.push((q1 - q0) / bh);
        } else if (v.view === 'SIDE') {
          e.fy.push((y1 - pcy) / bh); e.fh.push((q1 - q0) / bh);
          if (side === 'RIGHT' || side === 'LEFT') { e.fz.push(((pcx - cx) / bw) * (side === 'RIGHT' ? 1 : -1)); e.fd.push((p1 - p0) / bw); }
        } else if (v.view === 'TOP' && (side === 'BOTTOM' || side === 'TOP')) {
          const s = side === 'BOTTOM' ? 1 : -1;
          e.fx.push(((pcx - cx) / bw) * s); e.fw.push((p1 - p0) / bw); e.fz.push(((pcy - cy) / bh) * s); e.fd.push((q1 - q0) / bh);
        }
        parts.set(p.key, e);
      }
    }
  }

  let xy = wmedian(ratios.xy), zy = wmedian(ratios.zy);
  const xz = wmedian(ratios.xz);
  if (!zy && xy && xz) zy = xy / xz;
  if (!xy && zy && xz) xy = xz * zy;
  const known = { x: wmedian(anchors.x.map((v) => ({ v, w: 1 }))), y: wmedian(anchors.y.map((v) => ({ v, w: 1 }))), z: wmedian(anchors.z.map((v) => ({ v, w: 1 }))) };
  const overall: Record<string, number | null> = { x: known.x, y: known.y, z: known.z };
  if (!overall.y && overall.x && xy) overall.y = overall.x / xy;
  if (!overall.y && overall.z && zy) overall.y = overall.z / zy;
  if (overall.y) { if (!overall.x && xy) overall.x = overall.y * xy; if (!overall.z && zy) overall.z = overall.y * zy; }

  const views = used.FRONT + used.BACK + used.SIDE + used.TOP;
  if (!views) warnings.push('정면·측면처럼 똑바로 찍은 시점이 없어 비율을 측정하지 못했습니다. 정면·측면 사진을 올리면 정확해집니다.');
  else {
    if (!xy) warnings.push('정면(또는 뒷면) 시점이 없어 폭 비율은 추정입니다.');
    if (!zy) warnings.push('측면·윗면 시점이 없어 깊이는 추정입니다.');
  }
  if (noSize) warnings.push(`이미지 크기를 읽지 못한 시점 ${noSize}개는 비율 계산에서 뺐습니다.`);
  if (views && !anchorText.length) warnings.push('이미지에 실제 치수 표기가 없어 전체 크기는 추정입니다 (비율은 사진 기준).');

  const hints = [...parts.values()].map((e) => ({
    key: e.key, name: e.name,
    fx: mean(e.fx), fy: mean(e.fy), fw: mean(e.fw), fh: mean(e.fh), fz: mean(e.fz), fd: mean(e.fd),
  })).filter((h) => (h.fx != null && h.fy != null) || (h.fz != null && h.fy != null)).slice(0, 30);

  return {
    ratios: { xy: xy && r2(xy), zy: zy && r2(zy) },
    overall_mm: overall.x || overall.y || overall.z ? { x: overall.x && Math.round(overall.x), y: overall.y && Math.round(overall.y), z: overall.z && Math.round(overall.z) } : null,
    anchors: anchorText.slice(0, 6), used, skipped: skipped.slice(0, 8), warnings, parts: hints,
  };
}

/** 형상 AI 에 넘길 측정값 설명 */
export function visionHint(vision: any, m: any) {
  if (!m) return '';
  const u = m.used;
  const lines = [
    '[이미지 측정값 — 앱이 이미지 픽셀로 계산한 값. 형상은 이 값을 우선한다]',
    `- 측정에 쓴 시점: 정면 ${u.FRONT + u.BACK} · 측면 ${u.SIDE} · 윗면 ${u.TOP}${m.skipped.length ? ` (비율 측정에서 뺀 것: ${m.skipped.join(', ')})` : ''}`,
    `- 전체 비율: 폭/높이 ${m.ratios.xy ?? '측정 못 함'}, 깊이/높이 ${m.ratios.zy ?? '측정 못 함'}`,
    m.anchors.length ? `- 이미지에 적힌 실제 치수: ${m.anchors.join(', ')}` : '- 이미지에 실제 치수 표기 없음: 전체 크기는 같은 종류 제품 기준으로 정하되 위 비율은 지킨다.',
    m.overall_mm ? `- 계산한 전체 크기(mm): 폭 ${m.overall_mm.x ?? '?'} × 높이 ${m.overall_mm.y ?? '?'} × 깊이 ${m.overall_mm.z ?? '?'}` : '',
  ];
  if (m.parts.length) {
    lines.push('- 겉 부품 위치·크기 (전체 폭 W·높이 H·깊이 D 에 대한 비율. x 는 정면에서 볼 때 오른쪽이 +, y 는 바닥에서 부품 중심까지, z 는 앞쪽이 +):');
    for (const h of m.parts) {
      const f = (v: number | null, s: string) => (v == null ? '' : `${s} ${r2(v)}`);
      lines.push(`  · ${h.key}${h.name ? `(${h.name})` : ''}: ${[f(h.fx, '중심x/W'), f(h.fy, '중심y/H'), f(h.fz, '중심z/D'), f(h.fw, '폭/W'), f(h.fh, '높이/H'), f(h.fd, '깊이/D')].filter(Boolean).join(', ')}`);
    }
  }
  if (vision?.appearance) lines.push(`- 외관(이미지에서 읽음): ${vision.appearance}`);
  const text = (vision?.images || []).flatMap((i: any) => i.product_text).filter(Boolean);
  if (text.length) lines.push(`- 제품에 적힌 글자: ${[...new Set(text)].join(', ')}`);
  lines.push('규칙: 위 목록의 부품과 같은 부품은 ref_key 에 그 키를 그대로 적는다(목록에 없는 부품은 ref_key 를 비운다). 겉 부품의 위치·크기는 위 비율을 따르고, 이미지에 보이지 않는 부분(내부·뒷면)만 추정한다. 측정값과 다르게 만든 곳은 그 이유를 assumptions 에 적는다.');
  return lines.filter(Boolean).join('\n');
}

// ── 형상 보정
const rad = (d: number) => (d * Math.PI) / 180;
// three.js Euler XYZ 회전행렬 (R = Rx·Ry·Rz)
function rotMatrix(r: any) {
  const [a, b, c] = [rad(r?.x || 0), rad(r?.y || 0), rad(r?.z || 0)];
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(c), Math.sin(c)];
  return [
    [cb * cc, -cb * sc, sb],
    [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb],
    [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb],
  ];
}
const AX = ['x', 'y', 'z'] as const;
const isUpright = (r: any) => AX.every((a) => Math.abs(((Number(r?.[a]) || 0) % 360 + 360) % 360) < 1 || (a === 'y' && Math.abs((((Number(r?.y) || 0) % 360) + 360) % 360 - 180) < 1));

/** 보이는 부품(SHELL·UI) 기준 경계 상자 */
export function sceneBounds(parts: any[]) {
  const vis = parts.filter((p) => p.layer === 'SHELL' || p.layer === 'UI');
  const list = vis.length ? vis : parts;
  const lo = { x: Infinity, y: Infinity, z: Infinity }, hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of list) {
    const R = rotMatrix(p.rotation_deg);
    const h = [p.size.x / 2, p.size.y / 2, p.size.z / 2];
    AX.forEach((a, i) => {
      const e = Math.abs(R[i][0]) * h[0] + Math.abs(R[i][1]) * h[1] + Math.abs(R[i][2]) * h[2];
      lo[a] = Math.min(lo[a], p.position[a] - e); hi[a] = Math.max(hi[a], p.position[a] + e);
    });
  }
  if (!Number.isFinite(lo.x)) return null;
  return { lo, hi, size: { x: hi.x - lo.x, y: hi.y - lo.y, z: hi.z - lo.z }, center: { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 } };
}

const TOL_RATIO = 0.08;   // 전체 비율 차이가 8% 넘으면 보정
const TOL_POS = 0.04;     // 부품 중심이 전체 크기의 4% 넘게 벗어나면 보정
const TOL_SIZE = 0.12;    // 부품 크기가 12% 넘게 다르면 보정
const MAX_SCALE = 1.6;    // 한 번에 보정하는 배율 한도 (측정 오류로 형상이 망가지지 않게)

/**
 * 만들어진 형상을 측정값에 맞춘다. 내부 부품은 전체 배율만 따라가고, 겉 부품(SHELL·UI)은 ref_key 로 위치·크기를 맞춘다.
 * 반환: { scene, fit } — fit 은 화면에 보여 줄 일치도 기록
 */
export function fitScene(scene: any, m: any) {
  const parts = scene.parts.map((p: any) => ({ ...p, size: { ...p.size }, position: { ...p.position } }));
  const b0 = sceneBounds(parts);
  const warnings = [...(m?.warnings || [])];
  if (!m || !b0 || !(b0.size.y > 0)) return { scene, fit: null };

  // 1) 전체 비율·크기: 실제 치수가 있으면 그 크기로, 없으면 높이를 기준으로 비율만 맞춘다
  const target: Record<string, number | null> = { x: null, y: null, z: null };
  const o = m.overall_mm || {};
  if (o.y) { target.y = o.y; target.x = o.x || (m.ratios.xy ? o.y * m.ratios.xy : null); target.z = o.z || (m.ratios.zy ? o.y * m.ratios.zy : null); }
  else if (o.x || o.z) { target.x = o.x || null; target.z = o.z || null; }
  else { if (m.ratios.xy) target.x = b0.size.y * m.ratios.xy; if (m.ratios.zy) target.z = b0.size.y * m.ratios.zy; }
  const scale = { x: 1, y: 1, z: 1 };
  for (const a of AX) {
    const t = target[a];
    if (!t || !(b0.size[a] > 0)) continue;
    let s = t / b0.size[a];
    if (Math.abs(s - 1) <= TOL_RATIO) continue;
    if (s > MAX_SCALE || s < 1 / MAX_SCALE) { warnings.push(`${a === 'x' ? '폭' : a === 'y' ? '높이' : '깊이'}이 측정값과 크게 달라(×${r2(s)}) 일부만 보정했습니다. 사진 시점을 확인해 주세요.`); s = clamp(s, 1 / MAX_SCALE, MAX_SCALE); }
    scale[a] = s;
  }
  if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
    for (const p of parts) {
      const R = rotMatrix(p.rotation_deg);
      // 부품 자신의 축으로 배율을 옮긴다 (90° 회전은 축이 그대로 바뀐다)
      const local = [0, 1, 2].map((j) => { const wsum = [0, 1, 2].reduce((s, i) => s + Math.abs(R[i][j]), 0) || 1; return [0, 1, 2].reduce((s, i) => s + Math.abs(R[i][j]) * scale[AX[i]], 0) / wsum; });
      AX.forEach((a, j) => { p.size[a] = r1(p.size[a] * local[j]); p.position[a] = r1(p.position[a] * scale[a]); });
    }
  }

  // 2) 겉 부품: ref_key 가 하나뿐인 부품만 측정 위치·크기로 맞춘다 (회전한 부품은 그대로 둔다)
  const b1 = sceneBounds(parts)!;
  const W = b1.size.x, H = b1.size.y, D = b1.size.z;
  const snapped: any[] = [];
  const errBefore: number[] = [];
  const counts = new Map<string, number>();
  parts.forEach((p: any) => p.ref_key && counts.set(p.ref_key, (counts.get(p.ref_key) || 0) + 1));
  const hintKeys = new Set(m.parts.map((h: any) => h.key));
  for (const h of m.parts) {
    const p = parts.find((x: any) => x.ref_key === h.key);
    if (!p || counts.get(h.key) !== 1 || !(p.layer === 'SHELL' || p.layer === 'UI')) continue;
    const want: Record<string, number> = {};
    if (h.fx != null) want.px = b1.center.x + h.fx * W;
    if (h.fy != null) want.py = b1.lo.y + h.fy * H;
    if (h.fz != null) want.pz = b1.center.z + h.fz * D;
    if (h.fw != null) want.sx = h.fw * W;
    if (h.fh != null) want.sy = h.fh * H;
    if (h.fd != null) want.sz = h.fd * D;
    const posErr = Math.max(want.px != null ? Math.abs(want.px - p.position.x) / W : 0, want.py != null ? Math.abs(want.py - p.position.y) / H : 0, want.pz != null && D ? Math.abs(want.pz - p.position.z) / D : 0);
    errBefore.push(posErr);
    if (!isUpright(p.rotation_deg) || p.shape === 'torus') continue;
    const sizeOff = (w: number | undefined, cur: number) => w != null && cur > 0 && Math.abs(w / cur - 1) > TOL_SIZE;
    if (posErr <= TOL_POS && !sizeOff(want.sx, p.size.x) && !sizeOff(want.sy, p.size.y) && !sizeOff(want.sz, p.size.z)) continue;
    const roundXZ = ROUND.includes(p.shape) && Math.abs(p.size.x - p.size.z) < 0.5;
    if (want.px != null) p.position.x = r1(want.px);
    if (want.py != null) p.position.y = r1(want.py);
    if (want.pz != null) p.position.z = r1(want.pz);
    if (want.sx != null) p.size.x = r1(Math.max(0.5, want.sx));
    if (want.sy != null) p.size.y = r1(Math.max(0.5, want.sy));
    if (want.sz != null) p.size.z = r1(Math.max(0.5, want.sz));
    else if (roundXZ && want.sx != null) p.size.z = p.size.x;
    snapped.push({ id: p.id, name: p.name, key: h.key, offset_pct: Math.round(posErr * 100) });
  }
  const sceneKeys = new Set(parts.map((p: any) => p.ref_key).filter(Boolean));
  const missing = [...hintKeys].filter((k) => !sceneKeys.has(k)).map((k) => m.parts.find((h: any) => h.key === k)?.name || k);
  if (missing.length) warnings.push(`이미지에서 본 부품 중 3D 에 없는 것: ${missing.slice(0, 6).join(', ')}`);

  const b2 = sceneBounds(parts)!;
  const ratioRow = (label: string, img: number | null, before: number, after: number) => (img ? { label, image: r2(img), before: r2(before), after: r2(after) } : null);
  const ratios = [
    ratioRow('폭/높이', m.ratios.xy, b0.size.x / b0.size.y, b2.size.x / b2.size.y),
    ratioRow('깊이/높이', m.ratios.zy, b0.size.z / b0.size.y, b2.size.z / b2.size.y),
  ].filter(Boolean);
  const overall = { x: Math.round(b2.size.x), y: Math.round(b2.size.y), z: Math.round(b2.size.z) };
  return {
    scene: { ...scene, parts, overall_mm: overall },
    fit: {
      views: m.used, skipped: m.skipped, anchors: m.anchors, ratios,
      scaled: AX.filter((a) => scale[a] !== 1).map((a) => ({ axis: a, factor: r2(scale[a]) })),
      matched: errBefore.length, snapped, part_offset_before_pct: errBefore.length ? Math.round((mean(errBefore) || 0) * 100) : null,
      warnings: warnings.slice(0, 8),
    },
  };
}
