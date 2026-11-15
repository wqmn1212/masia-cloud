// 실제 회로도에 쓰는 부품 목록: KiCad 기본 라이브러리 기호·실장 모양 + LCSC(JLCPCB) 부품번호.
// LCSC 번호는 확실한 것만 적었다. 비어 있으면 search 로 LCSC 에서 찾아 PCB 부품 탭에서 확정한다.
// sym 이 'custom:' 이면 kicadLib 의 CUSTOM_SYMBOLS 에서 만든 사각 기호를 쓴다 (KiCad 7 기본 라이브러리에 없는 부품).

const R = (value, lcsc) => ({ sym: 'Device:R', fp: 'Resistor_SMD:R_0603_1608Metric', value, lcsc, type: lcsc ? 'BASIC' : '', search: `0603 ${value} 1%`, cat: 'R' });
const C = (value, lcsc, size = '0603') => ({ sym: 'Device:C', fp: size === '0805' ? 'Capacitor_SMD:C_0805_2012Metric' : 'Capacitor_SMD:C_0603_1608Metric', value, lcsc, type: lcsc ? 'BASIC' : '', search: `${size} ${value}`, cat: 'C' });

export const RES = {
  '10k': R('10k', 'C25804'), '330': R('330', 'C23138'), '1k': R('1k', 'C21190'), '100': R('100', 'C22775'),
  '100k': R('100k', 'C25803'), '5.1k': R('5.1k', 'C23186'), '4.7k': R('4.7k', 'C23162'), '2k': R('2k', 'C22975'),
  '36k': R('36k', ''), '3.9k': R('3.9k', ''), '13.7k': R('13.7k', ''),
};
export const CAP = {
  '100n': C('100nF', 'C14663'), '10n': C('10nF', 'C57112'), '1u': C('1uF', 'C15849'),
  '10u': C('10uF 25V', 'C15850', '0805'), '22u': C('22uF 25V', 'C45783', '0805'),
};

export const PARTS = {
  // ── MCU 모듈 ──
  esp32c3: { sym: 'custom:ESP32-C3-WROOM-02', fp: 'RF_Module:ESP32-C3-WROOM-02', value: 'ESP32-C3-WROOM-02-N4', lcsc: '', search: 'ESP32-C3-WROOM-02-N4', cat: 'U', desc: 'MCU 모듈 (BLE 5, USB 내장)' },
  esp32s3: { sym: 'RF_Module:ESP32-S3-WROOM-1', fp: 'RF_Module:ESP32-S3-WROOM-1', value: 'ESP32-S3-WROOM-1-N8', lcsc: '', search: 'ESP32-S3-WROOM-1-N8', cat: 'U', desc: 'MCU 모듈 (BLE 5, USB 내장)' },
  esp32: { sym: 'RF_Module:ESP32-WROOM-32E', fp: 'RF_Module:ESP32-WROOM-32', value: 'ESP32-WROOM-32E-N4', lcsc: '', search: 'ESP32-WROOM-32E-N4', cat: 'U', desc: 'MCU 모듈 (BLE 4.2)' },
  // ── 전원·USB ──
  usbc: { sym: 'Connector:USB_C_Receptacle_USB2.0_16P', fp: 'Connector_USB:USB_C_Receptacle_HRO_TYPE-C-31-M-12', value: 'TYPE-C-31-M-12', lcsc: 'C165948', type: 'EXTENDED', search: 'TYPE-C-31-M-12', cat: 'J', desc: 'USB-C (전원·프로그래밍)' },
  esd: { sym: 'Power_Protection:USBLC6-2SC6', fp: 'Package_TO_SOT_SMD:SOT-23-6', value: 'USBLC6-2SC6', lcsc: 'C7519', type: 'EXTENDED', search: 'USBLC6-2SC6', cat: 'U', desc: 'USB 정전기 보호' },
  ldo: { sym: 'Regulator_Linear:AP2112K-3.3', fp: 'Package_TO_SOT_SMD:SOT-23-5', value: 'ME6211C33M5G', lcsc: 'C82942', type: 'EXTENDED', search: 'ME6211C33M5G', cat: 'U', desc: '3.3 V LDO 500 mA (AP2112K 와 핀 호환)' },
  buck: { sym: 'Regulator_Switching:TPS54202DDC', fp: 'Package_TO_SOT_SMD:SOT-23-6', value: 'TPS54202DDCR', lcsc: '', search: 'TPS54202DDCR', cat: 'U', desc: '벅 컨버터 4.5~28 V → 5 V 2 A' },
  buckL: { sym: 'Device:L', fp: 'Inductor_SMD:L_Bourns_SRU5016_5.2x5.2mm', value: '10uH 2A', lcsc: '', search: 'SMD 5x5 10uH 2A', cat: 'L' },
  jack: { sym: 'Connector:Barrel_Jack', fp: 'Connector_BarrelJack:BarrelJack_Horizontal', value: 'DC-005 5.5×2.1', lcsc: '', search: 'DC-005 5.5x2.1', cat: 'J', desc: 'DC 어댑터 입력' },
  schottky: { sym: 'Device:D_Schottky', fp: 'Diode_SMD:D_SMA', value: 'SS34', lcsc: 'C8678', type: 'BASIC', search: 'SS34 SMA', cat: 'D' },
  diode: { sym: 'Device:D', fp: 'Diode_SMD:D_SOD-123', value: '1N4148W', lcsc: 'C81598', type: 'BASIC', search: '1N4148W SOD-123', cat: 'D' },
  charger: { sym: 'custom:TP4056', fp: 'Package_SO:SOIC-8-1EP_3.9x4.9mm_P1.27mm_EP2.41x3.3mm', value: 'TP4056', lcsc: 'C16581', type: '', search: 'TP4056 ESOP-8', cat: 'U', desc: '리튬 1S 충전 500 mA' },
  pmos: { sym: 'Device:Q_PMOS_GSD', fp: 'Package_TO_SOT_SMD:SOT-23', value: 'AO3401A', lcsc: 'C15127', type: 'BASIC', search: 'AO3401A', cat: 'Q' },
  nmos: { sym: 'Device:Q_NMOS_GSD', fp: 'Package_TO_SOT_SMD:SOT-23', value: 'AO3400A', lcsc: 'C20917', type: 'BASIC', search: 'AO3400A', cat: 'Q' },
  npn: { sym: 'Device:Q_NPN_BEC', fp: 'Package_TO_SOT_SMD:SOT-23', value: 'S8050', lcsc: 'C2146', type: 'BASIC', search: 'S8050 SOT-23', cat: 'Q' },
  usbuart: { sym: 'Interface_USB:CH340C', fp: 'Package_SO:SOIC-16_3.9x9.9mm_P1.27mm', value: 'CH340C', lcsc: 'C84681', type: '', search: 'CH340C', cat: 'U', desc: 'USB-시리얼 (ESP32 클래식 프로그래밍)' },
  tact: { sym: 'Switch:SW_Push', fp: 'Button_Switch_SMD:SW_Push_1P1T_XKB_TS-1187A', value: 'TS-1187A', lcsc: 'C318884', type: 'BASIC', search: 'TS-1187A-B-A-B', cat: 'SW' },
  slide: { sym: 'Switch:SW_SPDT', fp: 'Button_Switch_THT:SW_Slide_SPDT_Straight_CK_OS102011MS2Q', value: 'SS12D', lcsc: '', search: 'SS12D00', cat: 'SW' },
  led: { sym: 'Device:LED', fp: 'LED_SMD:LED_0603_1608Metric', value: 'LED 녹색', lcsc: 'C72043', type: 'BASIC', search: '0603 green LED', cat: 'D' },
  ntc: { sym: 'Device:Thermistor_NTC', fp: 'Resistor_SMD:R_0603_1608Metric', value: 'NTC 10k B3950', lcsc: '', search: '0603 NTC 10K 3950', cat: 'TH' },
  buzzer: { sym: 'Device:Buzzer', fp: 'Buzzer_Beeper:Buzzer_12x9.5RM7.6', value: '패시브 부저 12 mm', lcsc: '', search: 'passive buzzer 12x9.5', cat: 'BZ' },
  encoder: { sym: 'Device:RotaryEncoder_Switch', fp: 'Rotary_Encoder:RotaryEncoder_Alps_EC11E-Switch_Vertical_H20mm', value: 'EC11 엔코더 (누름 포함)', lcsc: '', search: 'EC11 rotary encoder switch', cat: 'SW' },
  ledDriver: { sym: 'Driver_LED:AL8860WT', fp: 'Package_TO_SOT_SMD:TSOT-23-5', value: 'AL8860WT', lcsc: '', search: 'AL8860WT-7', cat: 'U', desc: '정전류 벅 LED 드라이버 (PWM·아날로그 조광)' },
  ledL: { sym: 'Device:L', fp: 'Inductor_SMD:L_Bourns_SRU5016_5.2x5.2mm', value: '33uH 1.5A', lcsc: '', search: 'SMD 5x5 33uH', cat: 'L' },
  rsense: (value) => ({ sym: 'Device:R', fp: 'Resistor_SMD:R_1206_3216Metric', value, lcsc: '', search: `1206 ${value} 1%`, cat: 'R' }),
  comparator: { sym: 'Comparator:LM393', fp: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm', value: 'LM393', lcsc: 'C7955', type: '', search: 'LM393DR2G', cat: 'U', desc: 'LED 판 85 °C 하드웨어 차단 비교기' },
  rtc: { sym: 'Timer_RTC:PCF8563T', fp: 'Package_SO:SOIC-8_3.9x4.9mm_P1.27mm', value: 'PCF8563T', lcsc: 'C7440', type: '', search: 'PCF8563T', cat: 'U', desc: '실시간 시계 (정전에도 시각 유지)' },
  xtal: { sym: 'Device:Crystal', fp: 'Crystal:Crystal_SMD_3215-2Pin_3.2x1.5mm', value: '32.768kHz', lcsc: 'C32346', type: 'BASIC', search: '3215 32.768KHz 12.5pF', cat: 'Y' },
  coin: { sym: 'Device:Battery_Cell', fp: 'Battery:BatteryHolder_Keystone_3000_1x12mm', value: 'CR1220 홀더', lcsc: '', search: 'CR1220 holder', cat: 'BT' },
  cap100u: { sym: 'Device:C_Polarized', fp: 'Capacitor_SMD:CP_Elec_6.3x5.4', value: '100uF 16V', lcsc: '', search: '100uF 16V 6.3x5.4', cat: 'C' },
  hole: { sym: null, fp: 'MountingHole:MountingHole_3.2mm_M3', value: 'M3', cat: 'H' },
  hole25: { sym: null, fp: 'MountingHole:MountingHole_2.7mm_M2.5', value: 'M2.5', cat: 'H' },
  hole2: { sym: null, fp: 'MountingHole:MountingHole_2.2mm_M2', value: 'M2', cat: 'H' },
};

// 기판 밖 부품으로 가는 커넥터 (JST PH 2.0 mm 세로형). 큰 전류(히터)는 XH 2.5 mm
export const conn = (n, label, big = false) => ({
  sym: `Connector_Generic:Conn_01x${String(n).padStart(2, '0')}`,
  fp: big ? `Connector_JST:JST_XH_B${n}B-XH-A_1x${String(n).padStart(2, '0')}_P2.50mm_Vertical` : `Connector_JST:JST_PH_B${n}B-PH-K_1x${String(n).padStart(2, '0')}_P2.00mm_Vertical`,
  value: label, lcsc: '', search: big ? `B${n}B-XH-A` : `B${n}B-PH-K-S`, cat: 'J',
});

/** 라이브러리 추출 스크립트가 읽는 목록: 쓰는 기호·실장 모양 전부 */
export function allLibIds() {
  const syms = new Set(['power:PWR_FLAG']);
  const fps = new Set();
  const take = (p) => { if (!p) return; if (p.sym && !p.sym.startsWith('custom:')) syms.add(p.sym); if (p.fp) fps.add(p.fp); };
  Object.values(RES).forEach(take);
  Object.values(CAP).forEach(take);
  Object.values(PARTS).forEach((p) => take(typeof p === 'function' ? p('0.1') : p));
  [2, 3, 4, 6].forEach((n) => take(conn(n, '')));
  take(conn(2, '', true));
  return { syms: [...syms].sort(), fps: [...fps].sort() };
}
