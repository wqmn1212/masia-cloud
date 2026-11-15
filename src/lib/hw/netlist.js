// 기능 목록 → 실제 회로 (부품 + 핀별 연결 넷). KiCad 회로도·PCB·JLCPCB 부품표가 모두 이 결과를 쓴다.
// 블록: 전원(USB-C·DC 잭·벅·LDO·충전) → MCU(리셋·부트·디커플링) → 시계(RTC) → 기능별 회로.
// 값은 일반적인 데이터시트 권장 회로이며, 기판 설계 전에 설계자가 검토한다.
import { FEATURE_KINDS, MCUS, pinPlan, lightSpec } from '../devkit/features.js';
import { PARTS, RES, CAP, conn } from './parts.js';
import { CUSTOM, gpioPinMap } from './customSymbols.js';

const PREFIX = { R: 'R', C: 'C', L: 'L', D: 'D', Q: 'Q', U: 'U', J: 'J', SW: 'SW', TH: 'TH', BZ: 'BZ', Y: 'Y', BT: 'BT', H: 'H' };
const KIND_EN = { button: 'BUTTON', led: 'LED', motor: 'DC MOTOR', heater: 'HEATER', buzzer: 'BUZZER', servo: 'SERVO', relay: 'RELAY', tilt: 'TILT SWITCH', lid: 'LID SENSOR', water: 'WATER LEVEL', temp: 'TEMPERATURE (NTC)', analog: 'ANALOG INPUT', battery: 'BATTERY SENSE', light: 'LED LIGHT DRIVER', display: 'CLOCK DISPLAY LINK', switch: 'TOGGLE SWITCH', encoder: 'ROTARY ENCODER', custom: 'COMMAND' };
const fmtOhm = (v) => (v >= 1 ? `${Number(v.toFixed(2))}Ω` : `${Number(v.toFixed(3))}Ω`);

/** 기능 이름 → 넷 이름에 쓸 짧은 영문 (KiCad 넷 이름은 영문이 안전하다) */
const NET_KIND = { button: 'BTN', led: 'LED', motor: 'MOT', heater: 'HEAT', buzzer: 'BUZ', servo: 'SERVO', relay: 'RLY', tilt: 'TILT', lid: 'LID', water: 'WATER', temp: 'TEMP', analog: 'ADC', battery: 'VBAT_SNS', light: 'LIGHT', display: 'DISP', switch: 'SW', encoder: 'ENC', custom: 'CMD' };

/** 부품 한 종류를 가리키는 열쇠 (LCSC 번호를 직접 넣을 때 쓴다) */
export const lcscKey = (part) => `${(part.fp || '').split(':')[1] || ''}|${part.search || part.value || ''}`;

export function buildHardware(dev, opts = {}) {
  const mcuKey = MCUS[dev?.mcu] ? dev.mcu : 'esp32c3';
  const M = MCUS[mcuKey];
  const supplyV = Number(dev?.supply_v) || 5;
  const plan = pinPlan(dev?.features || [], mcuKey, dev?.rules);
  const features = plan.features.filter((f) => FEATURE_KINDS[f.kind]);
  const comps = [];
  const blocks = [];
  const notes = [];
  const offboard = [];
  const gpioNet = new Map(); // GPIO 번호 → 넷
  let block = null;
  const startBlock = (id, name, kind, en) => { block = { id, name, kind, en: en || name, refs: [] }; blocks.push(block); }; // en: KiCad 파일용 영문 제목 (KiCad 기본 글꼴은 한글이 없다)
  const add = (part, conns, extra = {}) => {
    const c = { ref: null, part, value: extra.value || part.value, block: block.id, conns, note: extra.note || '', anchor: extra.anchor || null };
    comps.push(c);
    block.refs.push(c);
    return c;
  };
  // 외장 벽으로 나가는 자리(앵커)에 놓이는 첫 부품은 옆으로 눕힌(직각) 부품으로
  const sidewaysLeft = new Map([...(opts.sideways || [])].map((k) => [k, 1]));
  const side = (kind) => { const n = sidewaysLeft.get(kind) || 0; if (n > 0) { sidewaysLeft.set(kind, n - 1); return true; } return false; };
  const mcuPin = (gpio, net, role) => {
    if (!Number.isInteger(gpio)) return;
    const prev = gpioNet.get(gpio);
    if (prev && prev.net !== net) { notes.push(`GPIO${gpio} 을 ${prev.role} 와 ${role} 이 함께 쓰려고 합니다 — ${prev.role} 쪽으로 연결했습니다. 기능 정의에서 핀을 바꾸세요.`); return; }
    gpioNet.set(gpio, { net, role });
  };
  const hasBattery = features.some((f) => f.kind === 'battery');
  const highV = supplyV > 6;
  const VDRIVE = highV ? '+VIN' : '+5V';

  // ── 전원 ──
  startBlock('power', '전원 (USB-C · 3.3 V)', 'power', 'POWER IN (USB-C)');
  add(PARTS.usbc, { A4: 'VBUS', A9: 'VBUS', B4: 'VBUS', B9: 'VBUS', A1: 'GND', A12: 'GND', B1: 'GND', B12: 'GND', S1: 'GND', A5: 'CC1', B5: 'CC2', A6: 'USB_DP', B6: 'USB_DP', A7: 'USB_DM', B7: 'USB_DM' }, { anchor: 'usb' });
  add(RES['5.1k'], { 1: 'CC1', 2: 'GND' }, { note: 'USB-C 5 V 요청 (CC1)' });
  add(RES['5.1k'], { 1: 'CC2', 2: 'GND' }, { note: 'USB-C 5 V 요청 (CC2)' });
  add(PARTS.esd, { 1: 'USB_DP', 6: 'USB_DP', 3: 'USB_DM', 4: 'USB_DM', 5: 'VBUS', 2: 'GND' });
  add(PARTS.schottky, { 1: '+5V', 2: 'VBUS' }, { note: 'USB 5 V → 내부 5 V (역류 방지)' });
  if (highV) {
    startBlock('dcin', `DC 입력 ${supplyV} V → 5 V`, 'power', `DC IN ${supplyV} V -> 5 V BUCK`);
    add(PARTS.jack, { 1: '+VIN', 2: 'GND' }, { anchor: 'jack', value: `DC 잭 ${supplyV} V` });
    add(CAP['10u'], { 1: '+VIN', 2: 'GND' });
    add(CAP['10u'], { 1: '+VIN', 2: 'GND' });
    add(PARTS.buck, { 3: '+VIN', 1: 'GND', 5: 'BUCK_EN', 6: 'BUCK_BST', 2: 'BUCK_SW', 4: 'BUCK_FB' });
    add(RES['100k'], { 1: '+VIN', 2: 'BUCK_EN' }, { note: 'EN 켜기' });
    add(CAP['100n'], { 1: 'BUCK_BST', 2: 'BUCK_SW' }, { note: '부트스트랩' });
    add(PARTS.buckL, { 1: 'BUCK_SW', 2: '+5V_BUCK' });
    add(RES['100k'], { 1: '+5V_BUCK', 2: 'BUCK_FB' }, { note: '출력 5 V 설정 (0.596 V × (1 + 100k/13.7k))' });
    add(RES['13.7k'], { 1: 'BUCK_FB', 2: 'GND' });
    add(CAP['22u'], { 1: '+5V_BUCK', 2: 'GND' });
    add(CAP['22u'], { 1: '+5V_BUCK', 2: 'GND' });
    add(PARTS.schottky, { 1: '+5V', 2: '+5V_BUCK' });
    if (supplyV > 28) notes.push(`입력 ${supplyV} V 는 벅 컨버터 TPS54202 최대 입력(28 V)을 넘습니다. 더 높은 전압용 벅으로 바꾸세요.`);
  }
  if (hasBattery) {
    startBlock('charger', '리튬 배터리 충전·전원 전환', 'power', 'LI-ION CHARGER + POWER PATH');
    add(PARTS.charger, { 4: 'VBUS', 8: 'VBUS', 3: 'GND', 9: 'GND', 1: 'GND', 2: 'CHG_PROG', 5: '+VBAT', 7: 'CHG_LED', 6: 'STBY_LED' });
    add(RES['2k'], { 1: 'CHG_PROG', 2: 'GND' }, { note: '충전 전류 약 580 mA' });
    add(CAP['10u'], { 1: 'VBUS', 2: 'GND' });
    add(CAP['10u'], { 1: '+VBAT', 2: 'GND' });
    add(RES['1k'], { 1: 'VBUS', 2: 'CHG_LED_A' });
    add(PARTS.led, { 2: 'CHG_LED_A', 1: 'CHG_LED' }, { value: 'LED 충전 중' });
    add(RES['1k'], { 1: 'VBUS', 2: 'STBY_LED_A' });
    add(PARTS.led, { 2: 'STBY_LED_A', 1: 'STBY_LED' }, { value: 'LED 충전 완료' });
    add(conn(2, '배터리 1S'), { 1: '+VBAT', 2: 'GND' }, { note: '보호 회로(PCM) 내장 셀을 쓰세요' });
    add(PARTS.pmos, { 1: 'VBUS', 3: '+VBAT', 2: '+5V' }, { note: 'USB 가 없으면 배터리로 전환' });
    add(RES['100k'], { 1: 'VBUS', 2: 'GND' }, { note: 'USB 빠지면 P-MOSFET 켜짐' });
  }
  startBlock('ldo', '3.3 V 레귤레이터', 'power', '3.3 V LDO');
  add(CAP['10u'], { 1: '+5V', 2: 'GND' });
  add(PARTS.ldo, { 1: '+5V', 3: '+5V', 2: 'GND', 5: '+3V3' });
  add(CAP['10u'], { 1: '+3V3', 2: 'GND' });
  add(CAP['100n'], { 1: '+3V3', 2: 'GND' });

  // ── MCU ──
  startBlock('mcu', `MCU ${M.module}`, 'mcu', `MCU ${M.module}`);
  const mcuPart = PARTS[mcuKey];
  const mcu = add(mcuPart, {});
  add(CAP['10u'], { 1: '+3V3', 2: 'GND' }, { note: 'MCU 전원' });
  add(CAP['100n'], { 1: '+3V3', 2: 'GND' });
  add(RES['10k'], { 1: '+3V3', 2: 'EN' }, { note: '리셋 지연' });
  add(CAP['1u'], { 1: 'EN', 2: 'GND' });
  add(PARTS.tact, { 1: 'EN', 2: 'GND' }, { value: 'RESET' });
  add(PARTS.tact, { 1: 'BOOT', 2: 'GND' }, { value: 'BOOT' });
  add(RES['10k'], { 1: '+3V3', 2: 'BOOT' });
  mcuPin(M.boot, 'BOOT', '부트 버튼');
  if (M.usb) { mcuPin(M.usb[0], 'USB_DM', 'USB D−'); mcuPin(M.usb[1], 'USB_DP', 'USB D+'); }
  else {
    // ESP32 클래식: USB-시리얼 + 자동 리셋
    startBlock('usbuart', 'USB-시리얼 (프로그래밍)', 'mcu', 'USB-UART + AUTO RESET');
    add(PARTS.usbuart, { 16: '+3V3', 4: '+3V3', 1: 'GND', 5: 'USB_DP', 6: 'USB_DM', 2: 'U0RXD', 3: 'U0TXD', 13: 'DTR', 14: 'RTS' });
    add(CAP['100n'], { 1: '+3V3', 2: 'GND' });
    add(PARTS.npn, { 1: 'DTR_B', 2: 'RTS', 3: 'EN' });
    add(RES['10k'], { 1: 'DTR', 2: 'DTR_B' });
    add(PARTS.npn, { 1: 'RTS_B', 2: 'DTR', 3: 'BOOT' });
    add(RES['10k'], { 1: 'RTS', 2: 'RTS_B' });
    mcuPin(3, 'U0RXD', 'UART RX'); mcuPin(1, 'U0TXD', 'UART TX');
  }
  if (mcuKey === 'esp32c3' && plan.i2c?.sda !== 8) { startBlock('strap', '부팅 설정 핀', 'mcu', 'BOOT STRAP'); add(RES['10k'], { 1: '+3V3', 2: 'IO8_STRAP' }, { note: 'GPIO8 은 부팅 때 HIGH 여야 한다' }); mcuPin(8, 'IO8_STRAP', '부팅 설정'); }

  // ── 시계 ──
  if (plan.i2c) {
    startBlock('rtc', '실시간 시계 (정전 유지)', 'rtc', 'RTC PCF8563 + BACKUP CELL');
    add(PARTS.rtc, { 8: 'RTC_VDD', 4: 'GND', 1: 'RTC_OSCI', 2: 'RTC_OSCO', 5: 'I2C_SDA', 6: 'I2C_SCL' });
    add(PARTS.xtal, { 1: 'RTC_OSCI', 2: 'RTC_OSCO' });
    add(PARTS.diode, { 2: '+3V3', 1: 'RTC_VDD' });
    add(PARTS.diode, { 2: '+VCOIN', 1: 'RTC_VDD' });
    if (opts.compact) add(conn(2, 'RTC 백업 전지 (CR2032 리드선 홀더)'), { 1: '+VCOIN', 2: 'GND' }, { note: '기판이 작아 전지 홀더는 선으로 빼서 하우징 안에 붙인다' });
    else add(PARTS.coin, { 1: '+VCOIN', 2: 'GND' });
    add(CAP['100n'], { 1: 'RTC_VDD', 2: 'GND' });
    add(RES['4.7k'], { 1: '+3V3', 2: 'I2C_SDA' });
    add(RES['4.7k'], { 1: '+3V3', 2: 'I2C_SCL' });
    mcuPin(plan.i2c.sda, 'I2C_SDA', '시계 I2C SDA');
    mcuPin(plan.i2c.scl, 'I2C_SCL', '시계 I2C SCL');
  }

  // ── 기능별 ──
  const count = {};
  const lights = [];
  const watchNet = new Map(); // 조명 기능 id → LED 판 NTC 넷
  features.filter((f) => f.kind === 'light').forEach((f) => { count.light = (count.light || 0) + 1; f._n = `LIGHT${count.light}`; watchNet.set(f.id, `${f._n}_NTC`); });
  for (const f of features) {
    const k = f.kind;
    if (k !== 'light') { count[k] = (count[k] || 0) + 1; f._n = `${NET_KIND[k]}${count[k]}`; }
    const N = f._n;
    const anchor = (want) => want;
    startBlock(`f_${f.id}`, f.name, k, `${N} ${KIND_EN[k] || k}${/^[\x20-\x7e]+$/.test(f.name) ? ` (${f.name})` : ''}`);
    block.feature = f.id;
    if (['button', 'tilt', 'lid', 'water'].includes(k)) {
      if (k === 'button') add(side('button') ? PARTS.tactSide : PARTS.tact, { 1: N, 2: 'GND' }, { value: f.name.slice(0, 20), anchor: anchor('button') });
      else add(conn(2, `${f.name.slice(0, 16)} 센서`), { 1: N, 2: 'GND' }, { note: FEATURE_KINDS[k].bom.map((b) => b[0]).join(', ') });
      add(RES['10k'], { 1: '+3V3', 2: N });
      add(CAP['100n'], { 1: N, 2: 'GND' }, { note: '채터링·잡음' });
      mcuPin(f.pin, N, f.name);
    } else if (k === 'switch') {
      const sw = side('switch');
      add(sw ? PARTS.slideSide : PARTS.slide, { 2: N, 1: 'GND' }, { value: `${f.name.slice(0, 16)} (${sw ? 'OS102011MA1Q 직각' : 'SS12D'})`, anchor: 'switch' });
      add(RES['10k'], { 1: '+3V3', 2: N });
      mcuPin(f.pin, N, f.name);
    } else if (k === 'encoder') {
      add(side('encoder') ? PARTS.encoderSide : PARTS.encoder, { A: `${N}_A`, B: `${N}_B`, C: 'GND', S1: `${N}_SW`, S2: 'GND' }, { anchor: 'encoder' });
      add(RES['10k'], { 1: '+3V3', 2: `${N}_A` });
      add(RES['10k'], { 1: '+3V3', 2: `${N}_B` });
      add(CAP['10n'], { 1: `${N}_A`, 2: 'GND' });
      add(CAP['10n'], { 1: `${N}_B`, 2: 'GND' });
      add(RES['10k'], { 1: '+3V3', 2: `${N}_SW` });
      mcuPin(f.pin, `${N}_SW`, `${f.name} 누름`);
      mcuPin(f.pins?.a, `${N}_A`, `${f.name} A상`);
      mcuPin(f.pins?.b, `${N}_B`, `${f.name} B상`);
    } else if (k === 'led') {
      add(RES['330'], { 1: N, 2: `${N}_A` });
      add(PARTS.led, { 2: `${N}_A`, 1: 'GND' }, { value: f.name.slice(0, 20) });
      mcuPin(f.pin, N, f.name);
    } else if (k === 'motor' || k === 'heater') {
      const big = k === 'heater';
      add(conn(2, f.name.slice(0, 20), big), { 1: VDRIVE, 2: `${N}_D` }, { note: big ? '온도 퓨즈를 히터와 직렬로 (기판 밖)' : '' });
      add(PARTS.nmos, { 1: `${N}_G`, 2: 'GND', 3: `${N}_D` });
      add(RES['100'], { 1: N, 2: `${N}_G` }, { note: '게이트' });
      add(RES['100k'], { 1: `${N}_G`, 2: 'GND' }, { note: '부팅 중 꺼짐' });
      if (!big) add(PARTS.schottky, { 1: VDRIVE, 2: `${N}_D` }, { note: '모터 역기전력 환류' });
      mcuPin(f.pin, N, f.name);
      const amps = big ? (Number(f.power_w) || 20) / supplyV : 1;
      if (big && amps > 3) notes.push(`${f.name}: 약 ${amps.toFixed(1)} A — AO3400A(SOT-23) 대신 더 큰 MOSFET(예: DPAK)과 굵은 배선이 필요합니다.`);
    } else if (k === 'buzzer') {
      add(PARTS.buzzer, { 1: '+5V', 2: `${N}_C` });
      add(PARTS.diode, { 1: '+5V', 2: `${N}_C` });
      add(PARTS.npn, { 1: `${N}_B`, 2: 'GND', 3: `${N}_C` });
      add(RES['1k'], { 1: N, 2: `${N}_B` });
      mcuPin(f.pin, N, f.name);
    } else if (k === 'servo') {
      add(conn(3, f.name.slice(0, 20)), { 1: `${N}_SIG`, 2: '+5V', 3: 'GND' });
      add(RES['100'], { 1: N, 2: `${N}_SIG` });
      add(PARTS.cap100u, { 1: '+5V', 2: 'GND' });
      mcuPin(f.pin, N, f.name);
    } else if (k === 'relay') {
      add(conn(2, `${f.name.slice(0, 14)} 코일`), { 1: '+5V', 2: `${N}_C` }, { note: '릴레이·접점은 절연된 별도 전원 기판에' });
      add(PARTS.diode, { 1: '+5V', 2: `${N}_C` });
      add(PARTS.npn, { 1: `${N}_B`, 2: 'GND', 3: `${N}_C` });
      add(RES['1k'], { 1: N, 2: `${N}_B` });
      mcuPin(f.pin, N, f.name);
    } else if (k === 'temp') {
      const net = watchNet.get(f.watch);
      if (net) {
        add(CAP['100n'], { 1: net, 2: 'GND' }, { note: 'LED 판 NTC 필터 (풀업 10k 는 조명 블록)' });
        mcuPin(f.pin, net, f.name);
      } else {
        add(RES['10k'], { 1: '+3V3', 2: N });
        add(PARTS.ntc, { 1: N, 2: 'GND' });
        add(CAP['100n'], { 1: N, 2: 'GND' });
        mcuPin(f.pin, N, f.name);
      }
    } else if (k === 'analog') {
      add(conn(3, `${f.name.slice(0, 16)} 가변저항`), { 1: '+3V3', 2: N, 3: 'GND' });
      add(CAP['100n'], { 1: N, 2: 'GND' });
      mcuPin(f.pin, N, f.name);
    } else if (k === 'battery') {
      add(RES['100k'], { 1: '+VBAT', 2: N });
      add(RES['100k'], { 1: N, 2: 'GND' });
      add(CAP['100n'], { 1: N, 2: 'GND' });
      mcuPin(f.pin, N, f.name);
    } else if (k === 'light') {
      const ls = lightSpec(f);
      const series = Math.max(1, Math.floor((supplyV - 2) / 3.1));
      const amps = ls.power_w / (series * 3);
      add(PARTS.ledDriver, { 5: '+VIN_LED', 2: 'GND', 3: `${N}_CTRL`, 4: `${N}_SET`, 1: `${N}_SW` });
      add(PARTS.rsense(fmtOhm(0.1 / amps)), { 1: '+VIN_LED', 2: `${N}_SET` }, { note: `LED 전류 ${amps.toFixed(2)} A (LED ${series}개 직렬 기준, 0.1 V / R)` });
      add(PARTS.ledL, { 1: `${N}_LEDK`, 2: `${N}_SW` });
      add(PARTS.schottky, { 1: '+VIN_LED', 2: `${N}_SW` });
      add(CAP['10u'], { 1: '+VIN_LED', 2: 'GND' });
      add(RES['1k'], { 1: N, 2: `${N}_CTRL` }, { note: 'PWM 20 kHz → CTRL' });
      add(RES['10k'], { 1: `${N}_CTRL`, 2: 'GND' }, { note: '부팅 중 꺼짐 (CTRL 은 열리면 최대 밝기)' });
      add(conn(4, `${f.name.slice(0, 14)} LED 판`), { 1: `${N}_SET`, 2: `${N}_LEDK`, 3: `${N}_NTC`, 4: 'GND' }, { note: 'LED+ · LED− · NTC · GND (LED 판의 NTC 10k B3950)' });
      add(RES['10k'], { 1: '+3V3', 2: `${N}_NTC` }, { note: 'LED 판 NTC 풀업' });
      // 85 °C 하드웨어 차단: NTC 전압이 기준보다 낮아지면(뜨거우면) 비교기 출력 HIGH → N-MOSFET 이 CTRL 을 0 V 로 (MCU 와 상관없이)
      add(RES['36k'], { 1: '+3V3', 2: `${N}_REF` }, { note: `기준 ${ls.cutoff_c} °C (36k/3.9k)` });
      add(RES['3.9k'], { 1: `${N}_REF`, 2: 'GND' });
      add(RES['100k'], { 1: `${N}_OTP`, 2: `${N}_REF` }, { note: '히스테리시스 약 10 °C' });
      add(RES['10k'], { 1: '+3V3', 2: `${N}_OTP` });
      add(PARTS.nmos, { 1: `${N}_OTP`, 2: 'GND', 3: `${N}_CTRL` }, { note: '과열 시 CTRL 끌어내림' });
      lights.push({ f, N });
      mcuPin(f.pin, N, f.name);
      if (amps > 1.5) notes.push(`${f.name}: LED 전류 ${amps.toFixed(2)} A 가 AL8860 한계(1.5 A)를 넘습니다. 입력 전압을 높여 LED 를 더 직렬로 하거나 드라이버를 바꾸세요.`);
      if (supplyV <= 6) notes.push(`${f.name}: 입력 ${supplyV} V 로는 LED 를 1개만 직렬로 둘 수 있어 전류가 큽니다. 조명 제품은 12 V 어댑터를 권합니다.`);
    } else if (k === 'display') {
      add(conn(6, `${f.name.slice(0, 16)} 표시 기판`, false, !!opts.compact), { 1: '+3V3', 2: `${N}_SDI`, 3: `${N}_CLK`, 4: `${N}_LE`, 5: `${N}_OE`, 6: 'GND' }, { note: '3V3 · SDI · CLK · LE · OE · GND' });
      mcuPin(f.pin, `${N}_OE`, `${f.name} 밝기·끄기 (OE)`);
      mcuPin(f.pins?.sdi, `${N}_SDI`, `${f.name} 데이터`);
      mcuPin(f.pins?.clk, `${N}_CLK`, `${f.name} 클럭`);
      mcuPin(f.pins?.le, `${N}_LE`, `${f.name} 래치`);
      offboard.push({ name: `${f.name} 표시 기판`, parts: [['정전류 16채널 LED 드라이버 STP16CP05 (직렬 연결)', 2], ['7세그먼트 1자리 (공통 애노드)', 4], ['전류 설정 저항 2 kΩ (약 9 mA)', 2], ['콘덴서 100 nF', 2]], note: '32 세그먼트를 정적으로 켭니다(깜빡임 없음). 6핀 케이블로 제어 기판과 잇습니다.' });
    } else if (k === 'custom') {
      block.refs = [];
    }
  }
  // 조명: LED 전원은 입력 전원에서, 비교기는 두 개씩
  if (lights.length) {
    startBlock('light_otp', `LED 판 과열 차단 비교기`, 'light', 'LED BOARD OVER-TEMP CUT (85 C)');
    for (let i = 0; i < lights.length; i += 2) {
      const a = lights[i], b = lights[i + 1];
      const conns = { 8: '+3V3', 4: 'GND', 3: `${a.N}_REF`, 2: `${a.N}_NTC`, 1: `${a.N}_OTP` };
      if (b) Object.assign(conns, { 5: `${b.N}_REF`, 6: `${b.N}_NTC`, 7: `${b.N}_OTP` });
      else Object.assign(conns, { 5: 'GND', 6: '+3V3' });
      add(PARTS.comparator, conns);
      add(CAP['100n'], { 1: '+3V3', 2: 'GND' });
    }
    startBlock('led_power', 'LED 구동 전원', 'power', 'LED DRIVER SUPPLY');
    add(PARTS.schottky, { 1: '+VIN_LED', 2: highV ? '+VIN' : '+5V' }, { note: '드라이버 입력' });
    add(CAP['22u'], { 1: '+VIN_LED', 2: 'GND' });
  }

  // MCU 핀 연결
  const pinsOf = mcuPart.sym.startsWith('custom:') ? [...CUSTOM[mcuPart.sym].left, ...CUSTOM[mcuPart.sym].right].map(([num, name]) => ({ num, name })) : (opts.symbols?.[mcuPart.sym]?.pins || []);
  const gmap = gpioPinMap(pinsOf);
  const mc = { ...mcu.conns };
  pinsOf.forEach((p) => {
    if (/^(3V3|VDD)$/.test(p.name)) mc[p.num] = '+3V3';
    else if (p.name === 'GND' || p.name === 'EP') mc[p.num] = 'GND';
    else if (p.name === 'EN') mc[p.num] = 'EN';
  });
  const pinMap = [];
  for (const [gpio, { net, role }] of gpioNet) {
    const num = gmap[gpio];
    if (!num) { notes.push(`GPIO${gpio} (${role}) 이 ${M.module} 에 없습니다.`); continue; }
    mc[num] = net;
    pinMap.push({ gpio, net, role, pad: num });
  }
  mcu.conns = mc;
  pinMap.sort((a, b) => a.gpio - b.gpio);

  // 기판 나누기: 조명 구동부(LED 드라이버·과열 차단·LED 전원)를 보조 기판으로 → 두 기판을 잇는 넷에 커넥터를 단다
  const split = new Set(opts.split || []);
  const auxBlock = (b) => split.has('light') && (b.kind === 'light' || b.id === 'led_power') && !(b.kind === 'temp');
  comps.forEach((c) => { const b = blocks.find((x) => x.id === c.block); c.board = b && auxBlock(b) ? 'aux' : 'main'; });
  const boards = comps.some((c) => c.board === 'aux') ? ['main', 'aux'] : ['main'];
  if (boards.length > 1) {
    const where = new Map();
    comps.forEach((c) => Object.values(c.conns).forEach((n) => { if (!where.has(n)) where.set(n, new Set()); where.get(n).add(c.board); }));
    const cross = [...where].filter(([, set]) => set.size > 1).map(([n]) => n).sort((a, b) => (a === 'GND' ? 1 : b === 'GND' ? -1 : a.localeCompare(b)));
    const n = Math.min(10, Math.max(2, cross.length + (cross.includes('GND') ? 1 : 0)));
    const pins = [...cross];
    if (cross.includes('GND') && pins.length < n) pins.push('GND'); // 굵은 전류용 GND 하나 더
    const sizes = [2, 3, 4, 5, 6, 7, 8, 10];
    const N = sizes.find((x) => x >= pins.length) || 10;
    if (pins.length > 10) notes.push(`두 기판을 잇는 선이 ${pins.length}개라 10핀 커넥터에 다 들어가지 않습니다.`);
    const conns = Object.fromEntries(pins.slice(0, 10).map((net, i) => [String(i + 1), net]));
    for (const board of ['main', 'aux']) {
      startBlock(`link_${board}`, board === 'main' ? '보조 기판 연결 (제어 기판 쪽)' : '제어 기판 연결 (보조 기판 쪽)', 'link', board === 'main' ? 'LINK TO LED DRIVER BOARD' : 'LINK TO CONTROL BOARD');
      const c = add(conn(N, board === 'main' ? '보조 기판 연결' : '제어 기판 연결'), conns, { note: pins.slice(0, 10).map((x, i) => `${i + 1} ${x}`).join(' · ') });
      c.board = board;
    }
  }

  // 참조 번호
  const seq = {};
  comps.forEach((c) => { const p = PREFIX[c.part.cat] || 'U'; seq[p] = (seq[p] || 0) + 1; c.ref = `${p}${seq[p]}`; });
  // 넷
  const nets = new Map();
  comps.forEach((c) => Object.entries(c.conns).forEach(([pin, net]) => { if (!nets.has(net)) nets.set(net, []); nets.get(net).push({ ref: c.ref, pin }); }));
  const lone = [...nets].filter(([, list]) => list.length < 2).map(([n]) => n);
  if (lone.length) notes.push(`한 곳에만 연결된 넷: ${lone.join(', ')}`);
  const powerFlags = ['GND', 'VBUS', '+5V', ...(highV ? ['+VIN'] : []), ...(lights.length ? ['+VIN_LED'] : []), ...(hasBattery ? ['+VBAT'] : []), ...(plan.i2c ? ['RTC_VDD'] : [])];
  // 팀이 직접 확인해 넣은 LCSC 번호 (기본 표에 없는 부품): 같은 실장 모양·같은 부품이면 모두 적용
  const userLcsc = opts.lcsc || {};
  for (const c of comps) {
    const ov = !c.part.lcsc && userLcsc[lcscKey(c.part)];
    if (ov && /^C\d{3,9}$/.test(ov)) c.part = { ...c.part, lcsc: ov, lcsc_user: true };
  }
  return { mcu: mcuKey, module: M.module, supplyV, comps, nets, blocks: blocks.filter((b) => b.refs.length), notes, pinMap, offboard, powerFlags, i2c: plan.i2c, features, boards };
}

export const BOARD_NAME = { main: '제어 기판', aux: 'LED 구동 기판' };

/** 기판 하나만 떼어 본 회로 (KiCad 프로젝트를 기판마다 따로 만든다) */
export function boardView(hw, board) {
  if (hw.boards.length < 2) return hw;
  const comps = hw.comps.filter((c) => c.board === board);
  const refs = new Set(comps.map((c) => c.ref));
  const nets = new Map();
  comps.forEach((c) => Object.entries(c.conns).forEach(([pin, net]) => { if (!nets.has(net)) nets.set(net, []); nets.get(net).push({ ref: c.ref, pin }); }));
  const blocks = hw.blocks.map((b) => ({ ...b, refs: b.refs.filter((c) => refs.has(c.ref)) })).filter((b) => b.refs.length);
  return { ...hw, comps, nets, blocks, powerFlags: board === 'aux' ? ['GND', '+VIN', '+5V', '+3V3', '+VIN_LED'].filter((n) => nets.has(n)) : hw.powerFlags.filter((n) => nets.has(n)), pinMap: board === 'main' ? hw.pinMap : [], board };
}

/** JLCPCB 부품표 (같은 부품·값·실장 모양은 한 줄) */
export function hwBom(hw) {
  const rows = new Map();
  for (const c of hw.comps) {
    if (!c.part.fp || c.part.cat === 'H') continue;
    const key = `${c.value}|${c.part.fp}|${c.part.lcsc || ''}`;
    const r = rows.get(key) || { value: c.value, footprint: c.part.fp.split(':')[1], lcsc: c.part.lcsc || '', lcsc_type: c.part.type || '', search: c.part.search || '', desc: c.part.desc || '', refs: [], smt: !/^(Connector_JST|Connector_BarrelJack|Rotary_Encoder|Buzzer_Beeper|Button_Switch_THT|Battery)/.test(c.part.fp) };
    r.refs.push(c.ref);
    rows.set(key, r);
  }
  const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  return [...rows.values()].map((r) => ({ ...r, refs: r.refs.sort(natural), qty: r.refs.length })).sort((a, b) => natural(a.refs[0], b.refs[0]));
}
