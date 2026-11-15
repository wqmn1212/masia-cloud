// KiCad 7 기본 라이브러리에 없는 기호: 사각 상자에 왼쪽·오른쪽 핀을 단다 (핀 번호 = 실장 모양 패드 번호).
// 핀 간격 2.54 mm, 길이 2.54 mm. 연결점 좌표는 kicad.js 가 SYMBOLS 와 같은 모양({num,name,x,y,a})으로 만든다.

export const CUSTOM = {
  // ESP32-C3-WROOM-02 데이터시트 핀 표 (19번 = 바닥 GND 패드)
  'custom:ESP32-C3-WROOM-02': {
    ref: 'U', desc: 'ESP32-C3-WROOM-02 module',
    left: [['1', '3V3', 'power_in'], ['2', 'EN', 'input'], ['9', 'GND', 'power_in'], ['19', 'GND', 'passive'], ['11', 'RXD/IO20', 'bidirectional'], ['12', 'TXD/IO21', 'bidirectional'], ['13', 'IO18', 'bidirectional'], ['14', 'IO19', 'bidirectional']],
    right: [['18', 'IO0', 'bidirectional'], ['17', 'IO1', 'bidirectional'], ['16', 'IO2', 'bidirectional'], ['15', 'IO3', 'bidirectional'], ['3', 'IO4', 'bidirectional'], ['4', 'IO5', 'bidirectional'], ['5', 'IO6', 'bidirectional'], ['6', 'IO7', 'bidirectional'], ['7', 'IO8', 'bidirectional'], ['8', 'IO9', 'bidirectional'], ['10', 'IO10', 'bidirectional']],
  },
  // TP4056 (ESOP-8, 9번 = 바닥 패드)
  'custom:TP4056': {
    ref: 'U', desc: 'TP4056 1-cell Li-ion charger',
    left: [['4', 'VCC', 'power_in'], ['8', 'CE', 'input'], ['2', 'PROG', 'passive'], ['1', 'TEMP', 'input']],
    right: [['5', 'BAT', 'power_out'], ['7', '~{CHRG}', 'open_collector'], ['6', '~{STDBY}', 'open_collector'], ['3', 'GND', 'power_in'], ['9', 'EP', 'passive']],
  },
};

/** GPIO 번호 → MCU 기호의 핀 번호 (C3 는 위 표, S3·클래식은 KiCad 기호의 핀 이름에서) */
export function gpioPinMap(symbolPins) {
  const map = {};
  for (const p of symbolPins) {
    const n = p.name;
    let m = n.match(/^(?:IO|GPIO)(\d+)$/) || n.match(/\/IO(\d+)$/) || n.match(/^RXD0\/IO(\d+)$/) || n.match(/^TXD0\/IO(\d+)$/);
    if (m) { map[Number(m[1])] ??= p.num; continue; }
    if (n === 'SENSOR_VP') map[36] ??= p.num;
    else if (n === 'SENSOR_VN') map[39] ??= p.num;
    else if (n === 'RXD0') map[44] ??= p.num; // S3 U0RXD = GPIO44
    else if (n === 'TXD0') map[43] ??= p.num; // S3 U0TXD = GPIO43
  }
  return map;
}
