// 실물 시제품 검증(브링업) 체크리스트: 설계(기능·전원·기판 나눔)에서 확인 항목을 만들고, 결과(통과·불합격·메모)는 dev.bringup 에 남긴다.
// 화면 안 검산·CI 로는 볼 수 없는 것(전원 레일, 실제 부품 방향, 블루투스 거리, 발열, 외장 맞춤)을 실기로 닫기 위한 목록이다.
import { FEATURE_KINDS, MCUS } from './features.js';

const KIND_CHECK = {
  button: (f) => `${f.name}: 누르면 앱 값이 1, 떼면 0. 연결한 동작(규칙)이 한 번만 일어난다`,
  switch: (f) => `${f.name}: 켠 위치에서 값 1, 끈 위치에서 0`,
  encoder: (f) => `${f.name}: 한 칸 돌릴 때 밝기가 한 단계만 바뀐다 (어두운 쪽 1 %, 밝은 쪽 5 %). 방향이 맞다. 짧게·길게 누르기가 구분된다`,
  light: (f) => `${f.name}: 1 % 에서 깜빡임·계단 없이 켜지고 100 % 까지 부드럽게 변한다. LED 전류를 재서 설계값과 비교한다`,
  display: (f) => `${f.name}: 네 자리 모두 켜지고 시각이 맞다. 조명이 꺼지면 같이 꺼진다`,
  led: (f) => `${f.name}: 켜고 끄기, 밝기 30 %·100 % 가 구분된다`,
  heater: (f) => `${f.name}: 켠 뒤 전류·온도 상승을 재고, 온도 한계에서 꺼지는지 확인한다 (온도 퓨즈 동작 온도 기록)`,
  motor: (f) => `${f.name}: 40·70·100 % 에서 돌고, 기동 전류를 잰다`,
  buzzer: (f) => `${f.name}: 1 kHz·2 kHz 소리가 난다`,
  servo: (f) => `${f.name}: 0·90·180° 로 움직인다`,
  relay: (f) => `${f.name}: 켜고 끌 때 접점이 붙고 떨어진다`,
  temp: (f) => `${f.name}: 상온 값이 기준 온도계와 ±1 °C 안 (보정 후). 센서를 뽑으면 연결된 출력이 꺼진다`,
  analog: (f) => `${f.name}: 0 V·3.3 V 근처 값이 멀티미터와 ±30 mV 안`,
  battery: (f) => `${f.name}: 충전 중·완충 표시, 잔량 % 가 전압과 맞다`,
  tilt: (f) => `${f.name}: 기울이면 구동부가 모두 꺼진다`,
  lid: (f) => `${f.name}: 열면 구동부가 모두 꺼진다`,
  water: (f) => `${f.name}: 물이 없으면 히터가 켜지지 않는다`,
  custom: (f) => `${f.name}: 명령을 보내면 같은 값이 돌아온다`,
};

/** 확인 항목 [{ id, group, text, measure? }] — id 는 설계가 같으면 같게 유지된다 */
export function bringupItems(dev) {
  const f = (dev?.features || []).filter((x) => FEATURE_KINDS[x.kind]);
  const v = Number(dev?.supply_v) || 5;
  const split = (dev?.hw?.split || []).includes('light');
  const items = [
    { id: 'pwr_short', group: '전원', text: `전원을 넣기 전 ${v > 6 ? `${v} V·` : ''}5 V·3.3 V 와 GND 사이가 단락이 아니다 (멀티미터 저항)` },
    { id: 'pwr_3v3', group: '전원', text: '3.3 V 레일이 3.25~3.35 V', measure: 'V' },
    ...(v > 6 ? [{ id: 'pwr_5v', group: '전원', text: `${v} V 입력에서 5 V 레일이 4.9~5.2 V, 벅 컨버터가 뜨겁지 않다`, measure: 'V' }] : []),
    { id: 'pwr_idle', group: '전원', text: '모든 출력이 꺼진 상태의 대기 전류', measure: 'mA' },
    { id: 'fw_flash', group: '펌웨어', text: `USB 로 굽기가 되고 시리얼 info 에 이름·버전이 나온다 (${MCUS[dev?.mcu]?.module || dev?.mcu})` },
    { id: 'ble_pair', group: '블루투스', text: '앱(또는 워크벤치 시험기)에서 장치가 보이고 연결된다' },
    { id: 'ble_range', group: '블루투스', text: '외장을 닫은 상태에서 끊기지 않는 거리 (목표 5 m 이상)', measure: 'm' },
    { id: 'ble_latency', group: '블루투스', text: '응답 시간 20번 평균 (워크벤치 "20번 왕복 재기")', measure: 'ms' },
    ...f.map((x) => ({ id: `f_${x.id}`, group: '기능', text: (KIND_CHECK[x.kind] || ((y) => `${y.name}: 동작한다`))(x) })),
    ...(split ? [{ id: 'link', group: '조립', text: '제어 기판 ↔ LED 구동 기판 커넥터가 한 방향으로만 끼워지고 핀 순서가 맞다' }] : []),
    { id: 'fit_pcb', group: '조립', text: '기판이 외장 보스·받침에 맞게 들어가고 나사가 잠긴다' },
    { id: 'fit_openings', group: '조립', text: '버튼·다이얼·USB·잭이 외장 구멍 가운데에 오고 걸리지 않는다' },
    { id: 'fit_height', group: '조립', text: '외장을 닫았을 때 키 큰 부품(커넥터·콘덴서)이 닿지 않는다' },
    { id: 'heat_1h', group: '발열', text: '최대 출력으로 1시간 켠 뒤 가장 뜨거운 곳의 온도 (외장 표면 60 °C 이하 권장)', measure: '°C' },
  ];
  return items;
}

/** 결과 요약 { total, pass, fail, open } */
export function bringupSummary(dev) {
  const items = bringupItems(dev);
  const r = dev?.bringup?.items || {};
  const pass = items.filter((i) => r[i.id]?.result === 'pass').length, fail = items.filter((i) => r[i.id]?.result === 'fail').length;
  return { total: items.length, pass, fail, open: items.length - pass - fail, failed: items.filter((i) => r[i.id]?.result === 'fail').map((i) => ({ ...i, note: r[i.id]?.note || '' })) };
}
