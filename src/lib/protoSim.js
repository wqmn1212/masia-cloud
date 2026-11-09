// 시제품 동작 시뮬레이션: 입력 모양·입력 점검·재생용 보간 (계산 자체는 서버 prototypeSimulate)
import { newId } from '@/lib/prototypeApi';

export const ACTUATOR_KINDS = [
  ['ROTARY_MOTOR', '회전 모터'], ['SERVO', '서보'], ['LINEAR', '리니어 액추에이터'], ['SOLENOID', '솔레노이드'],
  ['PUMP_FAN', '펌프·팬'], ['HEATER', '히터'], ['LED', 'LED·조명'], ['SENSOR', '센서'], ['OTHER', '기타'],
];
export const MOTIONS = [['NONE', '움직임 없음'], ['ROTATE', '회전 (°/s)'], ['TRANSLATE', '직선 이동 (mm/s)']];
export const AXES = ['X', 'Y', 'Z'];
export const SIM_DISCLAIMER = '정격값 기반 정상 상태 계산 + AI 설명입니다. 돌입 전류·과도 응답·응력·마찰은 계산하지 않으며 실제 측정값이 아닙니다.';

export const newActuator = (extra = {}) => ({
  id: newId(), label: '', ref: '', kind: 'ROTARY_MOTOR', rated_voltage_v: null, rated_current_a: null, idle_current_a: null,
  motion: 'NONE', axis: 'Z', speed: null, travel_min: null, travel_max: null, part_index: null, part_name: '', ...extra,
});
export const newStep = (n) => ({ id: newId(), name: `단계 ${n}`, duration_s: 1, trigger: '', note: '', states: [] });
export const stateOf = (step, id) => (step.states || []).find((s) => s.actuator_id === id) || { actuator_id: id, on: false, direction: 1, duty_pct: 100 };
export const numOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

/** '12V', '500mA', '1.2 A' 같은 부품표 문자열에서 정격값을 꺼낸다 */
export function parseRated(text, unit) {
  const re = unit === 'V' ? /(\d+(?:\.\d+)?)\s*(m?)V/ : /(\d+(?:\.\d+)?)\s*(m?)A/;
  const m = String(text || '').replace(',', '.').match(re);
  return m ? Number(m[1]) / (m[2] ? 1000 : 1) : null;
}

const SCHEMATIC_CATS = ['SCHEMATIC', 'BOM_FILE', 'PCB'];
const AI_READABLE = /\.(png|jpe?g|webp|pdf)$/i;

/** 실행 전에 무엇을 해석할 수 있고 무엇이 빠졌는지 알려 준다. level: ok | warn | error */
export function checkInputs(sim, { parts, project, version }) {
  const items = [];
  const add = (level, label, detail) => items.push({ level, label, detail });
  if (parts?.length) add('ok', '3D 형상', `${parts.length}개 부품을 읽었습니다`);
  else add('warn', '3D 형상', '위에서 STEP·STL 을 불러와야 3D 움직임을 재생합니다 (수치 계산은 가능)');
  if (version?.bom?.length) add('ok', '설계 부품표', `v${version.version_no} 부품 ${version.bom.length}개 · 연결 ${version.connections?.length || 0}개 — AI 설명에 참고`);
  else add('warn', '설계 부품표', '설계 버전이 없어 회로 연결 관계를 참고하지 못합니다');
  (project.files || []).filter((f) => SCHEMATIC_CATS.includes(f.category)).forEach((f) => (AI_READABLE.test(f.name)
    ? add('ok', f.name, '이미지·PDF — AI 설명에 참고 (수치 계산에는 쓰지 않음)')
    : add('warn', f.name, '이 형식은 해석하지 못합니다 — 필요한 정격값은 직접 입력하세요')));
  if (!(sim.supply_voltage_v > 0)) add('error', '전원 전압', '공급 전압(V)을 입력해야 계산할 수 있습니다');
  if (!sim.actuators?.length) add('error', '구동 부품', '구동 부품을 하나 이상 등록하세요');
  (sim.actuators || []).forEach((a) => {
    const n = a.label || a.ref || '이름 없는 부품';
    if (a.rated_current_a == null) add('warn', n, '정격 전류가 없어 전류·전력 계산에서 빠집니다');
    if (a.rated_voltage_v == null) add('warn', n, '정격 전압이 없어 전압 적합성을 확인하지 못합니다');
    if (a.motion !== 'NONE' && !(a.speed > 0)) add('warn', n, '속도가 없어 움직임을 계산하지 못합니다');
    if (a.motion !== 'NONE' && !a.part_name) add('warn', n, '3D 부품이 연결되지 않아 애니메이션에 나타나지 않습니다');
  });
  if (!sim.steps?.length) add('error', '동작 시나리오', '단계를 하나 이상 만드세요');
  return { items, canRun: !items.some((i) => i.level === 'error') };
}

export function valueAt(kf, t) {
  if (!kf?.length) return 0;
  if (t <= kf[0].t) return kf[0].v;
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i].t) { const a = kf[i - 1]; const b = kf[i]; return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t); }
  }
  return kf[kf.length - 1].v;
}

/** 재생 시각 t 의 부품 자세 (불러온 3D 부품 번호에 맞춘다) */
export function posesAt(result, parts, t) {
  return (result?.tracks || []).map((tr) => {
    const idx = parts?.[tr.part_index]?.part_name === tr.part_name ? tr.part_index : (parts || []).findIndex((p) => p.part_name === tr.part_name);
    return { actuator_id: tr.actuator_id, part_index: idx, motion: tr.motion, axis: tr.axis, value: valueAt(tr.keyframes, t) };
  }).filter((p) => p.part_index >= 0);
}

export const stepAt = (result, t) => (result?.steps || []).find((s) => t >= s.t_start && t < s.t_end) || result?.steps?.[result.steps.length - 1];