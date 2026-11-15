// 펌웨어 검산: 예시 제품마다 스케치를 만들고 내용(할 일 없음·핀·시스템 항목)을 보고, 호스트 g++ 로 C++ 문법·타입 검사를 한다.
// 실제 ESP32 컴파일은 GitHub Actions(.github/workflows/firmware.yml, arduino-cli + esp32 코어 3.x)에서 한다.
// 실행: npm run check:firmware
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SAMPLES, writeSamples } from './firmware-samples.mjs';
import { MCUS } from '../src/lib/devkit/features.js';
import { buildGatt } from '../src/lib/devkit/ble.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`✓ ${name}`); } else { fails.push(name); console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`); } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-'));
writeSamples(dir);
let gpp = true;
try { execFileSync('which', ['g++'], { stdio: 'ignore' }); } catch { gpp = false; }

for (const s of SAMPLES) {
  const src = fs.readFileSync(path.join(dir, s.name, `${s.name}.ino`), 'utf8');
  const g = buildGatt(s.dev);
  check(`${s.name}: 할 일(TODO) 없이 만들어지고, 모든 BLE 항목(${g.chars.length} + 시스템 ${g.sys.length})의 UUID 가 들어 있다`, !/TODO/.test(src) && [...g.chars, ...g.sys].every((c) => src.includes(c.uuid)));
  if (gpp) {
    const cpp = path.join(dir, s.name, 'main.cpp');
    fs.writeFileSync(cpp, `${src}\nHardwareSerial Serial;\n`);
    let err = '';
    try { execFileSync('g++', ['-std=gnu++17', '-fsyntax-only', '-Wall', '-Werror=return-type', '-Wno-unused-variable', '-Wno-unused-function', '-Wno-unused-but-set-variable', `-I${path.join(here, 'fw-stubs')}`, cpp], { stdio: 'pipe' }); }
    catch (e) { err = String(e.stderr || e.message).split('\n').slice(0, 8).join('\n'); }
    check(`${s.name}: C++ 문법·타입 검사 통과 (g++, Arduino 대역 헤더)`, !err, err);
  }
}
const lamp = fs.readFileSync(path.join(dir, 'lamp_s3', 'lamp_s3.ino'), 'utf8');
check('조명: 다이얼 4체배 인터럽트·짧게/길게 누르기·밝기 1 %/5 % 단계가 들어 있다', /encIsr\d+/.test(lamp) && /millis\(\) - downAt >= 800/.test(lamp) && /\? 1 : 5/.test(lamp));
check('조명: 11비트 PWM + 감마 2.2 + 디더링 + 서서히 따라가기', /LIGHT_BITS\s+11/.test(lamp) && /powf\(lightNow\[i\] \/ 100\.0f, 2\.2f\)/.test(lamp) && /lightErr/.test(lamp) && /LIGHT_FADE_S/.test(lamp));
check('조명: 수면 일정 23:00 감광 30분 · 08:00 증광 30분, 앱에서 바꾸면 저장', /schedCfg\[8\] = \{1, 23, 0, 30, 8, 0, 30, 100\}/.test(lamp) && /schedSave\(\)/.test(lamp));
check('조명: RTC(PCF8563) 읽기·쓰기와 앱·시리얼 시각 맞추기', /rtcRead\(\)/.test(lamp) && /rtcWrite\(/.test(lamp) && /line.startsWith\("time "\)/.test(lamp) && /c == sys_time/.test(lamp));
check('조명: 시간 표시는 STP16CP05 32비트 직렬 전송, 조명이 꺼지면 OE 로 끈다', /dispShift\d+\(uint32_t bits\)/.test(lamp) && /ledcWrite\(PIN_F\d+_DISPLAY, 1023\)/.test(lamp));
check('센서 보정: 원시값 요청·저장·지우기 명령과 비휘발 저장', /b\[0\] == 0x01/.test(lamp) && /calSave\(i\)/.test(lamp) && /prefs.clear\(\)/.test(lamp));
check('출하 검사: selftest 가 이름·버전·MAC·입력값·원시값을 한 줄 JSON 으로, out 명령이 출력을 직접 켠다', /line == "selftest"/.test(lamp) && /\\"mac\\"/.test(lamp) && /\\"in\d+\\":%d/.test(lamp) && /\\"raw\d+\\":%d/.test(lamp) && /line.startsWith\("out "\)/.test(lamp));
check('무선 업데이트: 시작·조각·끝·취소와 오류 알림, 끝나면 다시 시작, 업데이트 중 출력 끔', /Update\.begin\(otaSize\)/.test(lamp) && /Update\.write/.test(lamp) && /Update\.end\(true\)/.test(lamp) && /0xE2/.test(lamp) && /otaRestartAt/.test(lamp) && /c == sys_ota/.test(lamp));
check('인증 시험 송신: rftest <채널> 로 DTM 송신, rftest off 로 복귀 (C3·S3)', /esp_ble_dtm_tx_start/.test(lamp) && /rftest off/.test(lamp) && /CONFIG_IDF_TARGET_ESP32C3/.test(lamp));
check('무선 업데이트를 쓰려면 앱 영역이 둘인 파티션(min_spiffs)이어야 한다', SAMPLES.every((x) => /PartitionScheme=min_spiffs/.test(MCUS[x.dev.mcu].fqbn)));
const humid = fs.readFileSync(path.join(dir, 'humidifier_c3', 'humidifier_c3.ino'), 'utf8');
check('가습기: 온도 센서가 끊기면(INT16_MIN) 히터를 막는다 (fail-safe)', /in\d+ == INT16_MIN \|\| in\d+ >= 1200/.test(humid));
// 공용 펌웨어
{
  const { universalSketch, universalConfig, universalSerialLines, UNIVERSAL_MAX } = await import('../src/lib/devkit/universal.js');
  const src = universalSketch();
  if (gpp) {
    const cpp = path.join(dir, 'universal.cpp');
    fs.writeFileSync(cpp, `${src}\nHardwareSerial Serial;\n`);
    let err = '';
    try { execFileSync('g++', ['-std=gnu++17', '-fsyntax-only', '-Wall', '-Werror=return-type', '-Wno-unused-variable', '-Wno-unused-function', '-Wno-unused-but-set-variable', `-I${path.join(here, 'fw-stubs')}`, cpp], { stdio: 'pipe' }); }
    catch (e) { err = String(e.stderr || e.message).split('\n').slice(0, 12).join('\n'); }
    check('공용 펌웨어: C++ 문법·타입 검사 통과', !err, err);
  }
  const lampDev = SAMPLES.find((x) => x.name === 'lamp_s3').dev;
  const cfg = universalConfig(lampDev);
  const g = buildGatt(lampDev);
  const fLines = cfg.lines.filter((l) => l.startsWith('F ')), rLines = cfg.lines.filter((l) => l.startsWith('R '));
  check(`공용 설정(조명): 기능 ${fLines.length}줄·규칙 ${rLines.length}줄·시스템 4줄, 모든 UUID 포함, 한계 안`, fLines.length === g.chars.length && rLines.length >= 3 && cfg.lines.filter((l) => l.startsWith('Y ')).length === 4 && g.chars.every((c) => cfg.text.includes(c.uuid)) && !cfg.problems.length && fLines.length <= UNIVERSAL_MAX.features);
  check('공용 설정: 펌웨어가 읽는 칸 수와 같다 (F 11칸, R 14칸)', fLines.every((l) => l.split(' ').length === 12) && rLines.every((l) => l.split(' ').length === 15));
  check('공용 설정: 수면 일정 규칙에 23:00·30분·08:00·30분·100 이 들어간다, 시계 I2C 핀 줄이 있다', rLines.some((l) => /^R C \d+ \d+ 0 0 \d+ 1 23 0 30 8 0 30 100$/.test(l)) && cfg.lines.some((l) => /^C \d+ \d+$/.test(l)));
  check('공용 설정: 시리얼로 보낼 줄은 cfg begin 으로 시작해 cfg end 로 끝난다', universalSerialLines(cfg)[0] === 'cfg begin' && universalSerialLines(cfg).at(-1) === 'cfg end');
  const many = { ...lampDev, features: Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, kind: 'led', name: `LED ${i}` })), rules: [] };
  check('공용 설정: 기능 20개는 한계를 넘는다고 알려 준다', universalConfig(many).problems.length > 0);
}
// 무선 업데이트 (브라우저 쪽)
{
  const { espImageSize, appImage, otaSend } = await import('../src/lib/devkit/ota.js');
  // 가짜 앱 이미지: 머리 24 + 조각 2개(8+100, 8+52) → 192, 체크섬 칸 16 → 208 + 해시 32 = 240
  const img = new Uint8Array(240); img[0] = 0xe9; img[1] = 2; img[23] = 1;
  const dv = new DataView(img.buffer); dv.setUint32(24 + 4, 100, true); dv.setUint32(24 + 108 + 4, 52, true);
  const merged = new Uint8Array(0x10000 + 240 + 4096).fill(0xff); merged[0] = 0xe9; merged.set(img, 0x10000);
  check('무선 업데이트: 앱 이미지 길이 계산(240), 합친 파일에서는 0x10000 부터 앱만 꺼낸다', espImageSize(img) === 240 && appImage(img).from === 'app' && appImage(merged).from === 'merged' && appImage(merged).image.length === 240);
  let threw = false; try { appImage(new Uint8Array(100)); } catch { threw = true; }
  const sent = []; let got = 0, size = 0;
  const r5 = (c, v) => { const r = new Uint8Array(5); r[0] = c; new DataView(r.buffer).setUint32(1, v, true); return r; };
  const api = { write: async (_k, b) => { sent.push(b[0]); if (b[0] === 2) got += b.length - 1; }, request: async (_k, b) => { sent.push(b[0]); if (b[0] === 1) { size = new DataView(b.buffer).getUint32(1, true); return r5(1, size); } return r5(got === size ? 3 : 0xe3, got); } };
  const prog = [];
  const res = await otaSend(api, img, { chunk: 50, onProgress: (p) => prog.push(p) });
  check('무선 업데이트: 시작 → 조각 5개(50바이트씩) → 끝, 진행률이 1 까지, 잘못된 파일은 거절', threw && sent.join('') === '1222223' && got === 240 && res.bytes === 240 && prog.at(-1) === 1);
  let failed = ''; try { await otaSend({ write: async () => {}, request: async (_k, b) => r5(b[0] === 1 ? 1 : 0xe3, 0) }, img); } catch (e) { failed = e.message; }
  check('무선 업데이트: 장치가 검증 실패(E3)를 알리면 오류로 알려 준다', /검증값이 맞지 않습니다/.test(failed));
}
if (!gpp) console.log('  (g++ 가 없어 C++ 문법 검사는 건너뜀)');
console.log(`\n${pass}개 검산 통과${fails.length ? `, ${fails.length}개 실패` : ''}`);
if (fails.length) process.exit(1);
