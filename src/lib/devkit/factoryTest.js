// 출하 검사: 펌웨어의 시리얼 selftest (한 줄 JSON) 와 out 명령으로 기기 한 대를 검사한다.
//   자동: 이름·버전, 시계(RTC), 센서 범위, 쉬는 상태의 입력   수동: 버튼 누르기(자동 감지), 출력 켜 보기(검사자가 눈으로 확인)
// 글은 [한국어, 중국어] — 공장 화면은 중국어로 쓴다.
import { FEATURE_KINDS, OUTPUT_LEVELS, isOutput, pinPlan, MCUS } from './features.js';
import { buildGatt } from './ble.js';

const PRESS = ['button', 'encoder'];
const REST0 = ['button', 'encoder', 'lid', 'tilt', 'water'];

/** 검사 계획: { auto: [{ id, key, label, test(json) → {ok, value} }], press: [...], outputs: [...] } */
export function factoryPlan(dev, { fwVersion = '' } = {}) {
  const mcu = MCUS[dev?.mcu] ? dev.mcu : 'esp32c3';
  const plan = pinPlan((dev?.features || []).filter((f) => FEATURE_KINDS[f.kind]), mcu, dev?.rules);
  const g = buildGatt({ ...dev, features: plan.features });
  const clock = (g.sys || []).some((s) => s.key === 'time');
  const auto = [
    { id: 'name', label: ['장치 이름', '设备名称'], test: (j) => ({ ok: j.name === g.device_name, value: j.name }) },
    { id: 'fw', label: ['펌웨어 버전', '固件版本'], test: (j) => ({ ok: !!j.fw && (!fwVersion || j.fw === fwVersion), value: j.fw }) },
    { id: 'mac', label: ['블루투스 주소', '蓝牙地址'], test: (j) => ({ ok: /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(j.mac || ''), value: j.mac }) },
    ...(clock ? [{ id: 'rtc', label: ['시계(RTC) 응답', '时钟(RTC)应答'], test: (j) => ({ ok: j.rtc === 1, value: j.rtc === 1 ? 'OK' : '—' }) }] : []),
  ];
  for (const c of g.chars) {
    const key = `in${c.index}`;
    if (c.kind === 'temp') auto.push({ id: key, label: [`${c.name}: 5~45 °C`, `${c.name}：5~45 °C`], test: (j) => ({ ok: Number.isFinite(j[key]) && j[key] >= 50 && j[key] <= 450, value: Number.isFinite(j[key]) && j[key] > -1000 ? `${(j[key] / 10).toFixed(1)} °C` : '센서 없음 / 无传感器' }) });
    else if (c.kind === 'battery') auto.push({ id: key, label: [`${c.name}: 0~100 %`, `${c.name}：0~100 %`], test: (j) => ({ ok: j[key] >= 0 && j[key] <= 100, value: `${j[key]} %` }) });
    else if (REST0.includes(c.kind) && Number.isInteger(c.pin)) auto.push({ id: key, label: [`${c.name}: 쉬는 상태 0`, `${c.name}：静止状态 0`], test: (j) => ({ ok: j[key] === 0, value: String(j[key]) }) });
  }
  const press = g.chars.filter((c) => PRESS.includes(c.kind) && Number.isInteger(c.pin)).map((c) => ({ id: `press${c.index}`, key: `in${c.index}`, label: [`${c.name} 을 누르세요`, `请按下「${c.name}」`] }));
  const outputs = g.chars.filter((c) => isOutput(c.kind) && Number.isInteger(c.pin) && c.kind !== 'display').map((c) => ({ id: `out${c.index}`, index: c.index, on: c.kind === 'light' ? 30 : OUTPUT_LEVELS[c.kind].on, label: [`${c.name} 이 켜졌나요?`, `「${c.name}」是否点亮/动作？`], kind: c.kind }));
  return { device_name: g.device_name, auto, press, outputs, total: auto.length + press.length + outputs.length };
}

/** 시리얼 줄에서 selftest JSON 을 찾는다 (아니면 null) */
export function parseSelftest(line) {
  const s = String(line || '').trim();
  if (!s.startsWith('{"selftest"')) return null;
  try { return JSON.parse(s); } catch { return null; }
}

/** 자동 항목 판정 → [{ id, label, ok, value }] */
export const judgeAuto = (plan, json) => plan.auto.map((a) => { const r = a.test(json || {}); return { id: a.id, label: a.label, ok: !!r.ok, value: r.value ?? '' }; });

/** 전체 판정: results = { [id]: true | false } (자동·누름·출력 모두). 하나라도 false → FAIL, 빠진 게 있으면 INCOMPLETE */
export function verdictOf(plan, results) {
  const ids = [...plan.auto, ...plan.press, ...plan.outputs].map((x) => x.id);
  if (ids.some((id) => results[id] === false)) return 'FAIL';
  return ids.every((id) => results[id] === true) ? 'PASS' : 'INCOMPLETE';
}

/** 다음 일련번호: 접두어-YYMMDD-001 … (같은 날 마지막 번호 다음) */
export function nextSerial(prefix, last, date = new Date()) {
  const d = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const m = new RegExp(`^${prefix}-${d}-(\\d+)$`).exec(last || '');
  return `${prefix}-${d}-${String((m ? Number(m[1]) : 0) + 1).padStart(3, '0')}`;
}

/** 서버에 저장된 기록 중 같은 접두어·같은 날의 가장 큰 일련번호 (검사 PC 가 여러 대여도 이어서 매기게) */
export function lastSerialOf(units, prefix, date = new Date()) {
  const probe = nextSerial(prefix, '', date).replace(/-001$/, '');
  let best = null, bestN = 0;
  for (const u of units || []) {
    const m = new RegExp(`^${probe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`).exec(u?.serial || '');
    if (m && Number(m[1]) > bestN) { bestN = Number(m[1]); best = u.serial; }
  }
  return best;
}

/** 오늘 검사한 대수 (서버 기록 기준) */
export function todayCounts(units, date = new Date()) {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = (units || []).filter((u) => u?.inspected_date === d && u?.sheet === '출하 검사 (워크벤치)');
  return { pass: today.filter((u) => u.verdict === 'PASS').length, fail: today.filter((u) => u.verdict === 'FAIL').length };
}

/** 양산 시리얼 기록(ProductionUnit)에 넣을 값 */
export function unitRecord({ project, plan, serial, lot, json, results, values, inspector }) {
  const all = [...plan.auto, ...plan.press, ...plan.outputs];
  const verdict = verdictOf(plan, results);
  const failed = all.filter((x) => results[x.id] === false).map((x) => x.label[0]);
  return {
    tenant_id: project.tenant_id, card_id: project.card_id, serial, lot: lot || '', inspected_date: new Date().toISOString().slice(0, 10), sheet: '출하 검사 (워크벤치)',
    checks: { mac: json?.mac || '', fw: json?.fw || '', ...Object.fromEntries(all.map((x) => [x.label[0], results[x.id] === true ? (values?.[x.id] || 'OK') : results[x.id] === false ? `NG ${values?.[x.id] || ''}`.trim() : '-'])) },
    verdict, failed_items: failed, fail_note: failed.length ? `출하 검사 불합격: ${failed.join(', ')}` : '', inspector: inspector || '', updated_by_name: inspector || '',
    history: [{ at: new Date().toISOString(), by: inspector || '', action: `출하 검사 ${verdict}` }],
  };
}
