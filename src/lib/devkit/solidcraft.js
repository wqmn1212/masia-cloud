// SolidCraft(파라메트릭 CAD) 연결
// ① 파일 주고받기: 컨셉 3D 를 STL·GLB 로 넘기고, SolidCraft 에서 만든 STEP 을 시제품 파일로 되받는다 (conceptExport.js)
// ② AI 작업 지시서: Claude Code 에 SolidCraft MCP 서버를 붙여 AI 가 직접 모델링하게 하는 지시문
// ③ 스크립트: solidcraft-cli 로 돌리는 명령 목록(JSON). 공개 예제(bracket.json)에서 확인한 명령·인자만 쓴다:
//    parameters.change{name, expression} · sketch.create{plane, name} · sketch.line{points, closed} ·
//    sketch.circle.center{center, diameter} · sketch.finish · solid.extrude{distance, direction, body_name, operation} · solid.fillet{edges, radius}
// 좌표: 컨셉(three.js, Y 위, Z 앞쪽, mm) → CAD(Z 위, 앞쪽 = −Y). 윗면을 Z=0 에 두고 몸체를 아래(−Z)로 뽑아서
// 윗면 스케치(XY 평면)를 그대로 버튼·창 자리 파내기에 쓴다 (bracket.json 의 구멍 파내기와 같은 방식).
import { FEATURE_KINDS } from './features.js';

const r1 = (v) => Math.round(Number(v) * 10) / 10;
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** 컨셉 부품들의 범위 (three 좌표). 외장(SHELL) 부품이 있으면 외장만으로 잰다 */
export function conceptBounds(parts) {
  const list = (parts || []).filter((p) => p.size);
  const shell = list.filter((p) => p.layer === 'SHELL');
  const use = shell.length ? shell : list;
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  use.forEach((p) => {
    const x = num(p.position?.x), y = num(p.position?.y), z = num(p.position?.z);
    const sx = num(p.size?.x, 1) / 2, sy = num(p.size?.y, 1) / 2, sz = num(p.size?.z, p.size?.x || 1) / 2;
    b.minX = Math.min(b.minX, x - sx); b.maxX = Math.max(b.maxX, x + sx);
    b.minY = Math.min(b.minY, y - sy); b.maxY = Math.max(b.maxY, y + sy);
    b.minZ = Math.min(b.minZ, z - sz); b.maxZ = Math.max(b.maxZ, z + sz);
  });
  if (!Number.isFinite(b.minX)) return null;
  return { ...b, cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, width: b.maxX - b.minX, height: b.maxY - b.minY, depth: b.maxZ - b.minZ };
}

/** 몸통 모양: 가장 큰 외장 부품이 원기둥·캡슐이면 원형, 아니면 사각 */
export function bodyShape(parts) {
  const shell = (parts || []).filter((p) => p.layer === 'SHELL' && p.size);
  const big = shell.sort((a, b) => num(b.size.x) * num(b.size.y) * num(b.size.z, b.size.x) - num(a.size.x) * num(a.size.y) * num(a.size.z, a.size.x))[0];
  return big && ['cylinder', 'capsule'].includes(big.shape) ? 'round' : 'box';
}

/** 컨셉 → 스크립트 기본 치수 */
export function defaultCadParams(preview) {
  const b = conceptBounds(preview?.parts);
  const o = preview?.overall_mm || {};
  const width = r1(b?.width || num(o.x, 80)), depth = r1(b?.depth || num(o.z, 60)), height = r1(b?.height || num(o.y, 40));
  const shape = bodyShape(preview?.parts);
  return { shape, width, depth, height, wall: 2, corner: shape === 'box' ? r1(Math.min(8, Math.min(width, depth) * 0.1)) : 0, pocket: 2 };
}

// ── 외장 부품별 설계 (본체·물탱크처럼 따로 사출되는 부품마다 스크립트·도면) ──
const vol = (p) => num(p.size?.x, 1) * num(p.size?.y, 1) * num(p.size?.z, p.size?.x || 1);
const boxOf = (p) => ({ minX: num(p.position?.x) - num(p.size.x) / 2, maxX: num(p.position?.x) + num(p.size.x) / 2, minY: num(p.position?.y) - num(p.size.y) / 2, maxY: num(p.position?.y) + num(p.size.y) / 2, minZ: num(p.position?.z) - num(p.size.z, p.size.x) / 2, maxZ: num(p.position?.z) + num(p.size.z, p.size.x) / 2 });

/** 따로 설계할 만한 외장 부품 (가장 큰 것의 2 % 이상, 큰 순서) */
export function shellParts(parts) {
  const shell = (parts || []).filter((p) => p.layer === 'SHELL' && p.size);
  const big = Math.max(0, ...shell.map(vol));
  return shell.filter((p) => vol(p) >= big * 0.02).sort((a, b) => vol(b) - vol(a));
}

// 조작부(UI) 부품 중 이 외장 부품 표면에 붙은 것
const uiOn = (parts, part) => {
  const b = boxOf(part);
  // 조작부(UI)와, 이 부품보다 훨씬 작은 외장 부품(뚜껑·노즐 같은 개구부 자리)
  return (parts || []).filter((u) => u.size && u.id !== part.id && (u.layer === 'UI' || (u.layer === 'SHELL' && vol(u) < vol(part) * 0.15)) && (() => {
    // 상자끼리 닿거나 겹치면 (1 mm 여유) 이 부품에 붙은 것으로 본다
    const c = boxOf(u), m = 1;
    return c.maxX >= b.minX - m && c.minX <= b.maxX + m && c.maxY >= b.minY - m && c.minY <= b.maxY + m && c.maxZ >= b.minZ - m && c.minZ <= b.maxZ + m;
  })());
};

/** 기본으로 고를 외장 부품: 조작부가 가장 많이 붙은 것 (같으면 큰 것) */
export function mainShellId(parts) {
  const list = shellParts(parts);
  return list.slice().sort((a, b) => uiOn(parts, b).length - uiOn(parts, a).length || vol(b) - vol(a))[0]?.id || null;
}

/** 외장 부품 하나의 기본 치수 */
export function partParams(parts, partId) {
  const p = (parts || []).find((x) => x.id === partId);
  if (!p) return null;
  const round = ['cylinder', 'capsule'].includes(p.shape);
  const width = r1(num(p.size.x)), depth = r1(num(p.size.z, p.size.x)), height = r1(num(p.size.y));
  return { part_id: p.id, part_name: p.name, material: p.material || '', shape: round ? 'round' : 'box', width, depth, height, wall: 2, corner: round ? 0 : r1(Math.min(8, Math.min(width, depth) * 0.1)), pocket: 2 };
}

/**
 * 외장 부품 하나에 붙은 조작부 → 윗면·앞면·뒷면 자리 (그 부품 좌표: 윗면 중심 원점, Z 위, 앞쪽 −Y, mm)
 * face: top {x, y} · front/back {x, z(음수)}
 */
export function partCutouts(parts, partId) {
  const part = (parts || []).find((x) => x.id === partId);
  if (!part) return [];
  const b = boxOf(part), cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const tol = (span) => Math.max(3, span * 0.06);
  return uiOn(parts, part).map((u) => {
    const ux = num(u.position?.x), uy = num(u.position?.y), uz = num(u.position?.z);
    const rx = Math.abs(num(u.rotation_deg?.x)) % 180 === 90;
    const round = ['cylinder', 'sphere', 'cone', 'capsule', 'torus'].includes(u.shape);
    // 표면에 수직인 축: 회전하지 않은 원기둥은 위를 보고, X 로 90° 돌린 것은 앞·뒤를 본다
    const halfY = num(u.size.y) / 2, halfZ = num(u.size.z, u.size.x) / 2;
    const onTop = !rx && uy + halfY >= b.maxY - tol(b.maxY - b.minY) && uy - halfY <= b.maxY + 1;
    const onFront = uz + (rx ? halfY : halfZ) >= b.maxZ - tol(b.maxZ - b.minZ);
    const onBack = uz - (rx ? halfY : halfZ) <= b.minZ + tol(b.maxZ - b.minZ);
    const x = r1(ux - cx);
    const base = { id: u.id, name: u.name };
    const d = r1(Math.max(1, num(u.size.x)));
    if (onTop) return round ? { ...base, face: 'top', kind: 'circle', x, y: r1(-(uz - cz)), d } : { ...base, face: 'top', kind: 'rect', x, y: r1(-(uz - cz)), w: d, h: r1(num(u.size.z, u.size.x)) };
    const face = onFront ? 'front' : onBack ? 'back' : null;
    if (!face) return null;
    const z = r1(uy - b.maxY);
    if (round) return { ...base, face, kind: 'circle', x, z, d };
    return { ...base, face, kind: 'rect', x, z, w: d, h: r1(rx ? num(u.size.z, u.size.x) : num(u.size.y)) };
  }).filter(Boolean);
}

/** 윗면에 있는 조작·표시 부품 → 윗면 파내기 자리 (CAD 좌표, mm) */
export function topCutouts(parts, params) {
  const b = conceptBounds(parts);
  if (!b) return [];
  const tol = Math.max(3, b.height * 0.08);
  return (parts || [])
    .filter((p) => p.layer === 'UI' && p.size && num(p.position?.y) + num(p.size.y) / 2 >= b.maxY - tol)
    .filter((p) => !num(p.rotation_deg?.x) && !num(p.rotation_deg?.z))
    .map((p) => {
      const x = r1(num(p.position?.x) - b.cx), y = r1(-(num(p.position?.z) - b.cz));
      const round = ['cylinder', 'sphere', 'cone', 'capsule', 'torus'].includes(p.shape);
      return round
        ? { id: p.id, name: p.name, kind: 'circle', x, y, d: r1(Math.max(1, num(p.size.x))) }
        : { id: p.id, name: p.name, kind: 'rect', x, y, w: r1(Math.max(1, num(p.size.x))), h: r1(Math.max(1, num(p.size.z, p.size.x))) };
    })
    // 몸통 밖으로 나가는 자리는 뺀다
    .filter((c) => Math.abs(c.x) < params.width / 2 && Math.abs(c.y) < params.depth / 2);
}

const rectPts = (cx, cy, w, h) => [[r1(cx - w / 2), r1(cy - h / 2)], [r1(cx + w / 2), r1(cy - h / 2)], [r1(cx + w / 2), r1(cy + h / 2)], [r1(cx - w / 2), r1(cy + h / 2)]];

/** ③ SolidCraft 스크립트 { commands: [...] } */
export function solidcraftScript(params, cutouts = []) {
  const p = { ...params };
  const C = [];
  const cmd = (command, prm = {}) => C.push({ command, params: prm });
  cmd('parameters.change', { name: 'width', expression: `${p.width} mm` });
  cmd('parameters.change', { name: 'depth', expression: `${p.depth} mm` });
  cmd('parameters.change', { name: 'height', expression: `${p.height} mm` });
  cmd('parameters.change', { name: 'pocket', expression: `${p.pocket} mm` });
  // 몸통: 윗면 윤곽을 Z=0 에 그리고 아래로 height 만큼
  cmd('sketch.create', { plane: 'XY', name: 'Top outline' });
  if (p.shape === 'round') cmd('sketch.circle.center', { center: [0, 0], diameter: p.width });
  else cmd('sketch.line', { points: rectPts(0, 0, p.width, p.depth), closed: true, ids: ['o1', 'o2', 'o3', 'o4'] });
  cmd('sketch.finish', {});
  cmd('solid.extrude', { distance: 'height', direction: 'negative', body_name: 'Housing' });
  // 세로 모서리 4개 둥글리기 (모서리 위의 한 점으로 고른다)
  if (p.shape === 'box' && p.corner > 0) {
    const x = r1(p.width / 2), y = r1(p.depth / 2), z = r1(-p.height / 2);
    cmd('solid.fillet', { edges: [[x, y, z], [-x, y, z], [-x, -y, z], [x, -y, z]], radius: p.corner });
  }
  // 윗면 조작부 자리 파내기
  const top = cutouts.filter((c) => !c.face || c.face === 'top');
  if (top.length) {
    cmd('sketch.create', { plane: 'XY', name: 'Top cutouts' });
    top.forEach((c) => {
      if (c.kind === 'circle') cmd('sketch.circle.center', { center: [c.x, c.y], diameter: c.d });
      else cmd('sketch.line', { points: rectPts(c.x, c.y, c.w, c.h), closed: true });
    });
    cmd('sketch.finish', {});
    cmd('solid.extrude', { distance: 'pocket', direction: 'negative', operation: 'cut' });
  }
  // 앞면 구멍: 가운데 XZ 평면에 그리고 앞쪽(−Y)으로 깊이의 절반만큼 자른다 → 앞 벽을 뚫는 구멍
  // (XZ 스케치의 세로축이 −Z 라는 것은 공개 예제 bracket.json 에서 추정한 것이라 첫 실행에서 확인이 필요하다)
  const front = cutouts.filter((c) => c.face === 'front');
  if (front.length) {
    cmd('parameters.change', { name: 'reach', expression: `${r1(p.depth / 2)} mm` });
    cmd('sketch.create', { plane: 'XZ', name: 'Front cutouts' });
    front.forEach((c) => {
      if (c.kind === 'circle') cmd('sketch.circle.center', { center: [c.x, r1(-c.z)], diameter: c.d });
      else cmd('sketch.line', { points: rectPts(c.x, r1(-c.z), c.w, c.h), closed: true });
    });
    cmd('sketch.finish', {});
    cmd('solid.extrude', { distance: 'reach', direction: 'negative', operation: 'cut' });
  }
  return { commands: C };
}

export const scriptFileName = (title) => `${String(title || 'housing').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40)}-housing`;
export const cliCommand = (base) => `solidcraft-cli run ${base}.json --out ${base}.step`;
export const MCP_SETUP = [
  ['MCP 서버 연결 (한 번)', 'claude mcp add solidcraft -- solidcraft-cli mcp'],
  ['작업을 화면으로 보며 하려면', 'solidcraft --control 7878'],
];

/** CAD 좌표로 바꾼 컨셉 부품 표 (AI 지시서·부품 JSON 용) */
export function cadParts(parts) {
  const b = conceptBounds(parts);
  if (!b) return [];
  return (parts || []).filter((p) => p.size).map((p) => ({
    id: p.id, name: p.name, layer: p.layer, shape: p.shape, material: p.material || '', role: p.role || '',
    center_mm: [r1(num(p.position?.x) - b.cx), r1(-(num(p.position?.z) - b.cz)), r1(num(p.position?.y) - b.maxY)],
    size_mm: [r1(num(p.size.x)), r1(num(p.size.z, p.size.x)), r1(num(p.size.y))],
    rotation_deg: [num(p.rotation_deg?.x), num(p.rotation_deg?.z), num(p.rotation_deg?.y)],
  }));
}

const HOUSING_TEXT = { hole: '구멍', vent: '통풍구', grille: '소리 구멍', mount: '고정 보스·리브', compartment: '배터리 자리·커버' };

/** ② AI 작업 지시서 (Claude Code + SolidCraft MCP) */
export function mcpBrief({ project, concept, params, cutouts = [], features = [], outBase, otherParts = [] }) {
  const L = [];
  const parts = cadParts(concept?.preview?.parts);
  L.push(`# SolidCraft 모델링 작업: ${project?.title || '시제품'} ${params.part_name || '외장'}`, '');
  if (otherParts.length) L.push(`이 지시서는 외장 부품 중 '${params.part_name}' 하나만 다룹니다. ${otherParts.join(', ')} 은(는) 따로 만듭니다.`, '');
  L.push('SolidCraft MCP 도구로 아래 제품의 외장을 파라메트릭 모델로 만들어 주세요.', '');
  L.push('## 작업 규칙', '');
  L.push('1. 시작 전에 `list_commands` 로 명령 목록을 보고, 쓰려는 명령마다 `describe_command` 로 인자를 확인한 뒤 `execute`·`batch` 하세요. 인자를 추측하지 마세요.');
  L.push('2. 치수는 모두 매개변수로 둡니다: width, depth, height, wall, corner, draft. `set_parameter` 로 바꿨을 때 모델이 따라 바뀌는지 `check_parameters` 로 확인하세요.');
  L.push('3. 기능을 하나 넣을 때마다 `inspect_design` 으로 오류가 없는지, `screenshot` 으로 모양을 확인하세요. 실패하면 `undo` 하고 다른 방법을 쓰세요.');
  L.push(`4. 끝나면 \`save\` 로 ${outBase}.sc 를 저장하고 \`export\` 로 ${outBase}.step (format: step) 과 ${outBase}.stl 을 내보내세요.`);
  L.push('5. 마지막에 매개변수 표, 만든 기능 목록, 확인하지 못한 점을 짧게 보고하세요.', '');
  L.push('## 좌표와 단위', '', '- 단위 mm. Z 가 위, 제품 앞쪽이 −Y. 윗면 중심이 원점(0, 0, 0)이고 몸통은 아래(−Z)로 내려갑니다.', '');
  L.push('## 외장 기본값', '');
  L.push(`- 몸통: ${params.shape === 'round' ? `원통 지름 ${params.width}` : `사각 ${params.width} × ${params.depth}`} mm, 높이 ${params.height} mm`);
  L.push(`- 사출 외장: 살두께 ${params.wall} mm 로 속을 비우고(shell), 위·아래 케이스로 나눌 파팅 높이를 정하세요. 빼기 구배 1° 이상, 리브 두께는 살두께의 60 % 이하, 나사 보스는 바깥지름 = 나사 지름 × 2.`);
  if (params.shape === 'box' && params.corner > 0) L.push(`- 세로 모서리 R${params.corner}`);
  L.push('');
  if (cutouts.length) {
    const FACE = { top: '윗면', front: '앞면', back: '뒷면' };
    L.push('## 구멍·개구부 (컨셉 3D 기준)', '', '- 윗면은 (X, Y), 앞·뒷면은 (X, 윗면에서 아래로 깊이) 입니다. 앞·뒷면 구멍은 벽을 관통합니다.', '', '| 이름 | 면 | 모양 | 위치 | 크기 |', '|---|---|---|---|---|');
    cutouts.forEach((c) => {
      const face = c.face || 'top';
      const pos = face === 'top' ? `X ${c.x}, Y ${c.y}` : `X ${c.x}, 위에서 ${r1(-c.z)}`;
      L.push(`| ${c.name} | ${FACE[face]} | ${c.kind === 'circle' ? '원' : '사각'} | ${pos} | ${c.kind === 'circle' ? `Ø${c.d}` : `${c.w} × ${c.h}`} |`);
    });
    L.push('');
  }
  const fx = features.filter((f) => FEATURE_KINDS[f.kind]?.housing?.kind && FEATURE_KINDS[f.kind].housing.kind !== 'none');
  if (fx.length) {
    L.push('## 기능 때문에 외장에 필요한 것', '');
    fx.forEach((f) => { const h = FEATURE_KINDS[f.kind].housing; L.push(`- ${f.name}: ${HOUSING_TEXT[h.kind] || h.kind}${h.d ? ` (약 Ø${h.d})` : ''}${h.note ? ` — ${h.note}` : ''}`); });
    L.push('- 기판(PCB)·배터리가 들어갈 내부 공간과 USB-C 포트(약 9.5 × 3.5 mm) 자리를 남기세요.', '');
  }
  if (parts.length) {
    L.push('## 컨셉 부품 배치 (참고용 기본 도형, 중심·크기 [X, Y, Z] mm)', '', '```json', JSON.stringify(parts.map(({ name, layer, shape, center_mm, size_mm, material }) => ({ name, layer, shape, center_mm, size_mm, material })), null, 1), '```', '');
  }
  L.push('## 참고', '', `- 같은 폴더의 ${outBase}.json 은 몸통·윗면 자리까지 만드는 SolidCraft 스크립트입니다. \`batch\` 의 path 로 먼저 돌려 출발점으로 써도 됩니다.`, `- 컨셉 3D(STL/GLB)가 있으면 \`open\` 으로 불러와 비율을 맞추는 참고로만 쓰세요.`);
  return L.join('\n');
}
