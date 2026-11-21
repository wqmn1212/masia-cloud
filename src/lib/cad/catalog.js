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
  handheld: {
    label: '손잡이형 (리모컨·휴대 기기)',
    hint: '길쭉한 둥근 몸체를 위·아래 케이스로 나누고, 윗면에 버튼을 길이 방향으로 늘어놓고 끝에 USB-C 를 둔다',
    params: [
      { key: 'length', label: '길이 (Y)', unit: 'mm', min: 60, max: 300, step: 1, def: 150, group: '크기' },
      { key: 'width', label: '폭 (X)', unit: 'mm', min: 25, max: 120, step: 1, def: 46, group: '크기' },
      { key: 'height', label: '두께 (Z)', unit: 'mm', min: 12, max: 60, step: 0.5, def: 24, group: '크기' },
      { key: 'split', label: '아래 케이스 높이 비율', unit: '%', min: 20, max: 80, step: 5, def: 55, group: '크기' },
      { key: 'buttons', label: '윗면 버튼 수', unit: '개', min: 0, max: 8, step: 1, def: 4, group: '조작부' },
      { key: 'button_d', label: '버튼 지름', unit: 'mm', min: 4, max: 20, step: 0.5, def: 9, group: '조작부' },
      { key: 'usb', label: '끝면 USB-C', type: 'select', options: [['parting', '분할선에 반반 (슬라이드 없음)'], ['hole', '벽 구멍 (슬라이드 필요)'], ['none', '없음']], def: 'parting', group: '조작부' },
      { key: 'battery', label: '배터리 (두께 mm, 0 = 없음)', unit: 'mm', min: 0, max: 20, step: 0.5, def: 4, group: '내부' },
      ...common,
    ],
  },
  sphere_lamp: {
    label: '구형 셸 조명 (비스듬히 자른 공·앞면 발광)',
    hint: '공을 뒤로 누운 평면으로 자른 한 덩어리 외장(발광면 방향으로 뺀다), 평평한 바닥, 패브릭 프레임·확산판·LED 판·방열판, 아래 띠 도트 시계, 바닥 제어 기판, 뒤 버튼·잭과 오른쪽 다이얼',
    params: [
      { key: 'dia', label: '공 지름', unit: 'mm', min: 100, max: 300, step: 1, def: 180, group: '외장' },
      { key: 'face_tilt', label: '패브릭 판 뒤로 눕힘', unit: '°', min: 0, max: 45, step: 1, def: 28, group: '외장', help: '0° = 똑바로 서 있음. 사진처럼 위를 보게 하려면 25~35°' },
      { key: 'rim_open', label: '외장 테두리를 판보다 더 눕힘', unit: '°', min: 0, max: 20, step: 0.5, def: 14, group: '외장', help: '클수록 아래 입술이 두툼하고 판 윗부분이 테두리 위로 나온다' },
      { key: 'face_off', label: '외장 자르는 면 위치 (중심에서 앞으로)', unit: 'mm', min: -30, max: 30, step: 0.5, def: 0, group: '외장', help: '0 이하면 외장을 한 번에 뺄 수 있다. 앞으로 내밀면 언더컷이 생긴다' },
      { key: 'flat_d', label: '바닥 평면 지름', unit: 'mm', min: 30, max: 140, step: 1, def: 70, group: '외장' },
      { key: 'recess', label: '패브릭 판 위치 (중심에서 뒤로)', unit: 'mm', min: -10, max: 20, step: 0.5, def: 7, group: '발광면', help: '클수록 판이 안으로 들어가 위쪽으로 덜 나온다' },
      { key: 'mix', label: 'LED ↔ 확산판 거리 (혼광)', unit: 'mm', min: 6, max: 40, step: 0.5, def: 15, group: '발광면', help: 'LED 점이 안 보이려면 LED 간격의 1.2배 이상' },
      { key: 'clock_h', label: '아래 시계 띠 높이', unit: 'mm', min: 0, max: 50, step: 0.5, def: 26, group: '발광면' },
      { key: 'pcb_r', label: '제어 기판 반지름 (최대)', unit: 'mm', min: 20, max: 120, step: 0.5, def: 48, group: '내부' },
      { key: 'plate_t', label: '바닥 무게판 두께 (강판, 접착)', unit: 'mm', min: 0, max: 10, step: 0.5, def: 3, group: '내부' },
      { key: 'dial_d', label: '오른쪽 다이얼 지름', unit: 'mm', min: 8, max: 30, step: 0.5, def: 14, group: '조작부' },
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
  // 공 모양 외장 (구형 셸 조명): 거의 같은 지름의 sphere 외장
  const ball = shells.find((p) => ['sphere', 'sphere_cut'].includes(p.shape) && Math.max(p.size.x, p.size.y, p.size.z) / Math.min(p.size.x, p.size.y, p.size.z) < 1.15);
  if (ball) {
    const p = defaultParams('sphere_lamp');
    p.dia = r1(Math.max(ball.size.x, ball.size.z));
    const hint = preview.cad_hint?.template === 'sphere_lamp' ? preview.cad_hint.params || {} : {};
    return { template: 'sphere_lamp', params: cleanParams('sphere_lamp', { ...p, ...hint }) };
  }
  // 원판형 조명: 세운 원판이 제품의 주 외장일 때만 (렌즈 링·눈컵·다이얼 같은 작은 원통은 제외)
  const ov = preview?.overall_mm;
  const span = ov ? Math.max(ov.x || 0, ov.y || 0) : Math.max(0, ...shells.map((p) => Math.max(p.size.x, p.size.y)));
  const disc = shells
    .filter((p) => p.shape === 'cylinder' && Math.abs((p.rotation_deg?.x || 0)) === 90 && p.size.y < p.size.x * 0.45 && p.size.x >= span * 0.6)
    .sort((a, b) => b.size.x - a.size.x)[0];
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

/** 손잡이형은 사각 하우징 계산을 그대로 쓴다: 길이 방향(Y)으로 버튼, 평면 모서리는 폭의 절반 가까이(알약 모양) */
export function handheldAsBox(p) {
  const corner = Math.max(2, Math.min(p.width / 2 - 1, 40));
  return { ...p, width: p.width, depth: p.length, corner, button_axis: 'y', pcb_w: Math.max(10, Math.round(p.width - 2 * p.wall - 8)), pcb_d: Math.max(10, Math.round(p.length - 2 * p.wall - 2 * corner * 0.6 - 4)) };
}
