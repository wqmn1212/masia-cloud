// 금형용 설계 템플릿 목록과 치수 항목 (화면용 — CAD 엔진을 끌어오지 않는다)
// 각 템플릿은 치수만 넣으면 살두께·상하 분할·구배·모서리 R·나사 보스·리브·구멍이 들어간 솔리드를 만든다 (builders.js).

export const MATERIALS = {
  ABS: { label: 'ABS', density: 1.05, shrink: 0.5 },
  PC: { label: 'PC', density: 1.2, shrink: 0.6 },
  'PC/ABS': { label: 'PC/ABS', density: 1.15, shrink: 0.5 },
  PP: { label: 'PP', density: 0.91, shrink: 1.5 },
};

const common = [
  { key: 'wall', label: '살두께', unit: 'mm', min: 1.2, max: 4, step: 0.1, def: 2, group: '사출 기본', help: 'ABS·PC 외장은 1.8~2.5 mm' },
  { key: 'draft', label: '구배', unit: '°', min: 0.5, max: 5, step: 0.5, def: 2, group: '사출 기본', help: '일반 1~2°, 외관 부식(텍스처)이 있으면 2~3°' },
  { key: 'edge_r', label: '바깥 모서리 R', unit: 'mm', min: 0, max: 10, step: 0.5, def: 2, group: '사출 기본' },
  { key: 'material', label: '재질', type: 'select', options: Object.entries(MATERIALS).map(([v, m]) => [v, m.label]), def: 'ABS', group: '사출 기본' },
];

const HOLE_STYLE = [['hole', '벽 구멍 (슬라이드 필요)'], ['notch', '아래로 트인 홈 (슬라이드 없음)']];

export const TEMPLATES = {
  round_lamp: {
    label: '원형 양면 조명 (받침대·회전축)',
    hint: '원판 본체를 앞·뒤 하우징으로 나누고, 받침대 속 축으로 기울인다. 앞뒤 발광창, 나사 보스, 힌지 연결부, 받침대 버튼·잭 구멍',
    params: [
      { key: 'dia', label: '본체 지름', unit: 'mm', min: 80, max: 300, step: 1, def: 150, group: '본체' },
      { key: 'thick', label: '본체 두께', unit: 'mm', min: 16, max: 60, step: 0.5, def: 28, group: '본체' },
      { key: 'bezel', label: '테두리 폭 (발광창 바깥)', unit: 'mm', min: 6, max: 30, step: 0.5, def: 11, group: '본체' },
      { key: 'bosses', label: '본체 나사 보스', type: 'select', options: [[0, '없음'], [3, '3개'], [4, '4개'], [6, '6개']], def: 4, group: '본체' },
      { key: 'base_w', label: '받침대 폭 (X)', unit: 'mm', min: 40, max: 200, step: 1, def: 66, group: '받침대' },
      { key: 'base_d', label: '받침대 깊이 (Y)', unit: 'mm', min: 40, max: 200, step: 1, def: 70, group: '받침대' },
      { key: 'base_h', label: '받침대 높이', unit: 'mm', min: 20, max: 80, step: 0.5, def: 36, group: '받침대' },
      { key: 'plate_t', label: '바닥 무게판 두께 (강판)', unit: 'mm', min: 1, max: 10, step: 0.5, def: 4, group: '받침대' },
      { key: 'hole_style', label: '받침대 버튼·잭 구멍', type: 'select', options: HOLE_STYLE, def: 'hole', group: '받침대' },
      { key: 'gap', label: '본체–받침대 갭', unit: 'mm', min: 1, max: 20, step: 0.1, def: 4, group: '회전' },
      { key: 'pivot_h', label: '회전축 높이 (바닥에서)', unit: 'mm', min: 8, max: 70, step: 0.5, def: 18, group: '회전' },
      { key: 'tilt', label: '기울기 범위 ±', unit: '°', min: 0, max: 45, step: 1, def: 15, group: '회전' },
      { key: 'dial_d', label: '다이얼 지름', unit: 'mm', min: 8, max: 30, step: 0.5, def: 12, group: '조작부' },
      { key: 'dial_z', label: '다이얼 높이', unit: 'mm', min: 8, max: 60, step: 0.5, def: 17, group: '조작부' },
      ...common,
    ],
  },
  box: {
    label: '사각 하우징 (상·하 케이스)',
    hint: '둥근 사각 상자를 위·아래 케이스로 나누고, 모서리 나사 보스·리브·윗면 버튼 구멍·옆면 USB-C 자리를 넣는다',
    params: [
      { key: 'width', label: '폭 (X)', unit: 'mm', min: 30, max: 400, step: 1, def: 100, group: '크기' },
      { key: 'depth', label: '깊이 (Y)', unit: 'mm', min: 30, max: 400, step: 1, def: 70, group: '크기' },
      { key: 'height', label: '높이 (Z)', unit: 'mm', min: 15, max: 300, step: 1, def: 35, group: '크기' },
      { key: 'corner', label: '평면 모서리 R', unit: 'mm', min: 1, max: 40, step: 0.5, def: 8, group: '크기' },
      { key: 'split', label: '아래 케이스 높이 비율', unit: '%', min: 20, max: 80, step: 5, def: 40, group: '크기' },
      { key: 'buttons', label: '윗면 버튼 수', unit: '개', min: 0, max: 6, step: 1, def: 2, group: '조작부' },
      { key: 'button_d', label: '버튼 지름', unit: 'mm', min: 4, max: 30, step: 0.5, def: 10, group: '조작부' },
      { key: 'usb', label: '옆면 USB-C', type: 'select', options: [['parting', '분할선에 반반 (슬라이드 없음)'], ['hole', '벽 구멍 (슬라이드 필요)'], ['none', '없음']], def: 'parting', group: '조작부' },
      { key: 'pcb_w', label: '기판 폭', unit: 'mm', min: 10, max: 380, step: 1, def: 70, group: '내부' },
      { key: 'pcb_d', label: '기판 깊이', unit: 'mm', min: 10, max: 380, step: 1, def: 45, group: '내부' },
      { key: 'battery', label: '배터리 (두께 mm, 0 = 없음)', unit: 'mm', min: 0, max: 30, step: 0.5, def: 8, group: '내부' },
      ...common,
    ],
  },
  cylinder: {
    label: '원통형 (몸통·윗뚜껑)',
    hint: '원통 몸통(바닥 막힘)과 윗뚜껑으로 나누고, 뚜껑 윗면 배출구·버튼, 몸통 바닥 보스·리브를 넣는다',
    params: [
      { key: 'dia', label: '지름', unit: 'mm', min: 30, max: 400, step: 1, def: 110, group: '크기' },
      { key: 'height', label: '전체 높이', unit: 'mm', min: 30, max: 500, step: 1, def: 180, group: '크기' },
      { key: 'cap_h', label: '윗뚜껑 높이', unit: 'mm', min: 10, max: 200, step: 1, def: 45, group: '크기' },
      { key: 'outlet_d', label: '윗면 배출구 지름 (0 = 없음)', unit: 'mm', min: 0, max: 200, step: 1, def: 30, group: '조작부' },
      { key: 'buttons', label: '윗면 버튼 수', unit: '개', min: 0, max: 6, step: 1, def: 2, group: '조작부' },
      { key: 'button_d', label: '버튼 지름', unit: 'mm', min: 4, max: 30, step: 0.5, def: 10, group: '조작부' },
      { key: 'pcb_d', label: '원형 기판 지름', unit: 'mm', min: 10, max: 380, step: 1, def: 70, group: '내부' },
      ...common,
    ],
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

export function defaultParams(key) {
  const t = TEMPLATES[key] || TEMPLATES.box;
  return Object.fromEntries(t.params.map((p) => [p.key, p.def]));
}

/** 범위를 벗어난 값은 잘라서 쓴다 (저장된 값이 이상해도 엔진이 멈추지 않게) */
export function cleanParams(key, params = {}) {
  const t = TEMPLATES[key] || TEMPLATES.box;
  const out = {};
  for (const p of t.params) {
    const v = params[p.key];
    if (p.type === 'select') {
      const ok = p.options.some(([o]) => String(o) === String(v));
      const raw = ok ? v : p.def;
      out[p.key] = typeof p.def === 'number' ? Number(raw) : raw;
    } else {
      const n = Number(v);
      out[p.key] = Number.isFinite(n) ? Math.min(p.max, Math.max(p.min, n)) : p.def;
    }
  }
  return out;
}

const r1 = (v) => Math.round(v * 2) / 2;

/** 컨셉 부품(위 +y, 앞 +z)에서 템플릿과 치수를 추정한다 */
export function guessFromConcept(preview) {
  const parts = preview?.parts || [];
  const shells = parts.filter((p) => p.layer === 'SHELL');
  const disc = shells.find((p) => p.shape === 'cylinder' && Math.abs((p.rotation_deg?.x || 0)) === 90 && p.size.y < p.size.x * 0.45);
  if (disc) {
    const base = shells.filter((p) => p !== disc && p.position.y < disc.position.y).sort((a, b) => b.size.x * b.size.z - a.size.x * a.size.z)[0];
    const axle = parts.find((p) => /축|axle|hinge|힌지/i.test(p.name) && p.layer === 'INTERNAL' && p.shape === 'cylinder');
    const dial = parts.find((p) => /다이얼|dial|knob/i.test(p.name) && p.shape === 'cylinder');
    const p = defaultParams('round_lamp');
    p.dia = r1(disc.size.x);
    p.thick = r1(disc.size.y);
    if (base) {
      p.base_w = r1(base.size.x); p.base_d = r1(base.size.z); p.base_h = r1(base.size.y);
      const bottom = disc.position.y - disc.size.x / 2;
      const top = base.position.y + base.size.y / 2;
      if (bottom - top > 0.5) p.gap = Math.round((bottom - top) * 10) / 10;
    }
    if (axle) p.pivot_h = r1(axle.position.y);
    if (dial) { p.dial_d = r1(dial.size.x); p.dial_z = r1(dial.position.y); }
    return { template: 'round_lamp', params: cleanParams('round_lamp', p) };
  }
  const main = shells.sort((a, b) => b.size.x * b.size.y * b.size.z - a.size.x * a.size.y * a.size.z)[0];
  if (main && main.shape === 'cylinder' && !main.rotation_deg?.x) {
    const p = defaultParams('cylinder');
    p.dia = r1(main.size.x);
    p.height = r1(preview.overall_mm?.y || main.size.y);
    p.cap_h = r1(Math.min(p.height * 0.4, Math.max(20, p.height * 0.25)));
    return { template: 'cylinder', params: cleanParams('cylinder', p) };
  }
  const p = defaultParams('box');
  const o = preview?.overall_mm || (main ? { x: main.size.x, y: main.size.y, z: main.size.z } : null);
  if (o) { p.width = r1(o.x); p.depth = r1(o.z); p.height = r1(o.y); }
  p.pcb_w = Math.max(10, r1(p.width - 2 * p.wall - 12));
  p.pcb_d = Math.max(10, r1(p.depth - 2 * p.wall - 12));
  return { template: 'box', params: cleanParams('box', p) };
}

/** STEP 부품 이름: 영문 id 를 앞에 둔다 (UTF-8 한글을 못 읽는 CAD 에서도 부품을 구분할 수 있게) */
export const stepName = (p) => `${String(p.id).toUpperCase()} ${p.name}`;
