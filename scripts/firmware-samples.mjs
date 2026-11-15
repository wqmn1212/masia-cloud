// 펌웨어 검사용 예시 제품들 (검산과 GitHub Actions 컴파일이 같이 쓴다)
// node scripts/firmware-samples.mjs <폴더> → <폴더>/<이름>/<이름>.ino 와 <폴더>/targets.txt(이름 FQBN) 를 쓴다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firmwareSketch } from '../src/lib/devkit/firmware.js';
import { makeFeature, FEATURE_KINDS, MCUS } from '../src/lib/devkit/features.js';
import { defaultRules } from '../src/lib/devkit/rules.js';

const F = (kind, name, extra = {}) => ({ ...makeFeature(kind, name), ...extra });
const base = '82360000-c6bf-46fc-877f-a3727229996e';
const lamp = [
  F('light', '전면 기상등', { id: 'f_front', face: 'front', power_w: 5 }), F('light', '후면 수면등', { id: 'f_rear', face: 'rear', power_w: 1.8 }),
  F('display', '호박색 시계', { id: 'f_clock' }), F('encoder', '다이얼 버튼', { id: 'f_dial' }), F('switch', '수면 모드 토글', { id: 'f_sleep' }), F('button', '블루투스 버튼', { id: 'f_bt' }),
  F('temp', '전면 LED 판 온도', { id: 'f_ntc_f', watch: 'f_front' }), F('temp', '후면 LED 판 온도', { id: 'f_ntc_r', watch: 'f_rear' }),
];
const lampRules = [{ id: 'a', type: 'event', src: 'f_bt', dst: '', action: 'pair' }, { id: 'b', type: 'show', src: '*', dst: 'f_clock' }, { id: 'c', type: 'schedule', src: 'f_sleep', dst: '*', wake_dst: 'f_front', bed: '23:00', dim_min: 30, wake: '08:00', rise_min: 30, wake_level: 100 }];
const humid = [F('heater', '후막 히터', { power_w: 48 }), F('water', '수위 감지'), F('temp', '히터 온도'), F('button', '전원 버튼'), F('button', '모드 버튼'), F('led', '동작 표시등'), F('tilt', '넘어짐 감지'), F('buzzer', '알림 부저')];
const every = Object.keys(FEATURE_KINDS).filter((k) => !['light', 'display', 'encoder', 'switch'].includes(k)).map((k) => F(k, FEATURE_KINDS[k].label));

export const SAMPLES = [
  { name: 'lamp_s3', dev: { device_name: 'RENIGHT-L1', uuid_base: base, mcu: 'esp32s3', supply_v: 12, features: lamp, rules: lampRules } },
  { name: 'humidifier_c3', dev: { device_name: 'HUMID-1', uuid_base: base, mcu: 'esp32c3', supply_v: 12, features: humid, rules: defaultRules(humid) } },
  { name: 'all_kinds_s3', dev: { device_name: 'ALLKINDS', uuid_base: base, mcu: 'esp32s3', supply_v: 5, features: every, rules: defaultRules(every) } },
  { name: 'toy_esp32', dev: { device_name: 'TOY', uuid_base: base, mcu: 'esp32', supply_v: 5, features: [F('battery', '배터리'), F('motor', '모터'), F('servo', '서보'), F('button', '버튼'), F('lid', '뚜껑')] } },
  { name: 'dial_only_c3', dev: { device_name: 'DIAL', uuid_base: base, mcu: 'esp32c3', supply_v: 5, features: [F('encoder', '다이얼'), F('led', 'LED'), F('display', '표시')] } },
];

export function writeSamples(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const targets = [];
  for (const s of SAMPLES) {
    const d = path.join(dir, s.name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, `${s.name}.ino`), firmwareSketch(s.dev));
    targets.push(`${s.name} ${MCUS[s.dev.mcu].fqbn}`);
  }
  fs.writeFileSync(path.join(dir, 'targets.txt'), `${targets.join('\n')}\n`);
  return targets;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = process.argv[2] || 'build/firmware-samples';
  console.log(writeSamples(out).join('\n'));
}
