// 조립 순서 (쇼룸 '조립 순서' 모드): 단계마다 들어가는 부품, 들어오는 방향, 하는 일, 체결 부품(나사·커넥터), 검사 포인트, 표준 작업 시간(초).
// 공장에 넘기는 작업 지시서(SOP)의 뼈대와 같은 형식이다. 예시 제품의 값은 설명을 위한 가상 값이다.
// 단계 0(부품 확인)은 자동으로 붙는다. 모든 부품은 정확히 한 단계에 한 번 들어가야 한다 (check:showroom 이 확인).

const shortName = (s) => String(s || '').split(/\s[(—-]/)[0].trim() || String(s || '');

export const ASSEMBLY = {
  'air-purifier': [
    { title: '바닥 받침과 흡입 그릴', parts: ['d2', 'd3'], from: 'up', sec: 25,
      how: ['바닥 받침을 지그에 올린다', '흡입 그릴의 탭 4곳을 받침 홈에 맞춰 눌러 끼운다'],
      hw: ['스냅 탭 4곳'], check: '그릴이 받침과 틈 없이 붙었는지 (0.3 mm 이하)' },
    { title: '필터 넣기', parts: ['d9'], from: 'up', sec: 10,
      how: ['필터의 화살표(공기 방향)가 위를 보게 그릴 안에 넣는다'],
      check: '필터 비닐 포장을 벗겼는지' },
    { title: '제어 기판과 USB-C', parts: ['d10', 'd11'], from: 'up', sec: 45,
      how: ['제어 기판을 필터 위 받침대에 올린다', '나사 2개로 고정한다', 'USB-C 포트가 뒤쪽 구멍 가운데에 오는지 맞춘다'],
      hw: ['나사 M2 × 5 · 2개'], tool: '전동 드라이버 (토크 0.2 N·m)', check: 'USB-C 를 꽂았다 뺄 때 걸림이 없는지' },
    { title: '팬 달기', parts: ['d8'], from: 'up', sec: 40,
      how: ['팬을 기판 위 브래킷에 올리고 고무 부싱 4개를 끼운다', '팬 커넥터를 기판 FAN 단자에 꽂는다'],
      hw: ['고무 부싱 4개', '커넥터 1개 (JST 3핀)'], check: '손으로 돌렸을 때 날개가 어디에도 닿지 않는지' },
    { title: '외장과 터치 버튼', parts: ['d1', 'd7'], from: 'up', sec: 35,
      how: ['터치 버튼 FPC 를 기판 커넥터에 꽂는다', '외장 케이스를 위에서 씌워 받침에 돌려 잠근다'],
      hw: ['FPC 커넥터 1개'], check: '외장 이음선 단차 0.2 mm 이하' },
    { title: '윗면 (그릴 · LED 링)', parts: ['d5', 'd6', 'd4'], from: 'up', sec: 30,
      how: ['토출 그릴을 팬 위에 끼운다', 'LED 링 커넥터를 꽂고 링을 홈에 맞춘다', '상단 토출구를 눌러 끼운다'],
      hw: ['커넥터 1개 (LED)'], check: '그릴 틈으로 손가락(시험 프로브 12 mm)이 팬에 닿지 않는지' },
    { title: '작동 · 출하 검사', parts: [], sec: 60,
      how: ['USB-C 로 전원을 넣는다', '버튼을 눌러 세기 1 → 2 → 3 이 바뀌는지 본다', '30 cm 거리에서 소음을 잰다'],
      tool: '소음계', check: '3단에서 45 dB 이하, LED 링이 고르게 빛나는지', demo: true },
  ],
  humidifier: [
    { title: '베이스에 기판 고정', parts: ['h_base', 'h_pcb', 'h_usb'], from: 'up', sec: 40,
      how: ['우드 베이스를 뒤집어 지그에 올린다', '제어 기판을 나사 2개로 고정한다', 'USB-C 가 뒤쪽 구멍에 맞는지 본다'],
      hw: ['나사 M2 × 4 · 2개'], tool: '전동 드라이버', check: 'USB-C 주변 틈이 고른지' },
    { title: '무드등과 터치 버튼', parts: ['h_led', 'h_btn'], from: 'up', sec: 30,
      how: ['LED 링을 베이스 윗면 홈에 끼우고 커넥터를 꽂는다', '터치 버튼을 앞쪽 구멍에 눌러 끼운다'],
      hw: ['커넥터 1개 (LED)', '양면 테이프 (버튼 전극)'], check: '버튼 전극이 기판 패드에 닿는지 (정전 용량 확인)' },
    { title: '본체 외장 씌우기', parts: ['h_body'], from: 'up', sec: 15,
      how: ['본체 외장을 베이스에 올려 1/8 바퀴 돌려 잠근다'],
      check: '돌림 잠금이 "딸깍" 소리 나게 끝까지 들어갔는지' },
    { title: '물통과 수위 센서', parts: ['h_level', 'h_tank'], from: 'up', sec: 25,
      how: ['수위 센서를 본체 안쪽 홈에 끼우고 선을 기판 쪽으로 넘긴다', '물통을 본체 안에 넣는다'],
      hw: ['커넥터 1개 (수위)'], check: '물통이 센서 쪽 표시와 맞게 들어갔는지' },
    { title: '심지와 초음파 진동판', parts: ['h_wick', 'h_disc'], from: 'up', sec: 30,
      how: ['흡수 심지를 물통 가운데 꽂는다', '초음파 진동판을 고무 패킹에 끼워 심지 위에 얹는다'],
      hw: ['고무 패킹 1개'], check: '진동판이 패킹에 기울지 않고 수평인지' },
    { title: '상단 커버와 분무구', parts: ['h_cap', 'h_mist'], from: 'up', sec: 15,
      how: ['상단 커버를 덮는다', '분무구를 가운데 구멍에 끼운다'],
      check: '분무구가 진동판 바로 위에 오는지' },
    { title: '작동 · 출하 검사', parts: [], sec: 90,
      how: ['물 200 mL 를 넣고 USB-C 로 전원을 넣는다', '버튼을 눌러 안개와 무드등을 확인한다', '물을 빼고 자동 정지를 확인한다'],
      check: '안개 높이 15 cm 이상, 물이 없으면 10초 안에 멈추는지', demo: true },
  ],
  'night-vision': [
    { title: '메인 기판 모듈', parts: ['b_main', 'i_mcu', 'i_wifi', 'i_spread'], from: 'up', sec: 60,
      how: ['메인 기판(MCU·Wi-Fi 실장 완료)을 지그에 올린다', '열전도 패드를 붙이고 방열판을 얹어 나사 4개로 고정한다'],
      hw: ['나사 M2 × 4 · 4개', '열전도 패드 2장'], tool: '전동 드라이버 (0.25 N·m)', check: '방열판이 SoC 를 고르게 누르는지 (패드 압착 자국)' },
    { title: '영상 경로 (렌즈 · 센서)', parts: ['b_sensor', 'i_sensor', 'i_icr', 'i_objlens'], from: 'front', sec: 90,
      how: ['센서 기판을 메인 기판과 FPC 로 잇는다', '주야 전환 필터를 센서 앞에 끼운다', '대물 렌즈군을 나사산에 돌려 넣는다'],
      hw: ['FPC 1개 (MIPI)', '나사 M1.6 × 4 · 2개'], tool: '클린 벤치 · 장갑', check: '센서 면에 먼지가 없는지 (확대경)' },
    { title: '적외선 조사기', parts: ['i_irled', 'i_ircoll'], from: 'front', sec: 45,
      how: ['적외선 LED 를 알루미늄 경통 끝 방열 면에 붙인다', '조사각 렌즈를 앞에 끼운다'],
      hw: ['방열 그리스', '커넥터 1개 (IR)'], check: 'LED 가 경통 면에 빈틈없이 붙었는지' },
    { title: '화면과 접안 렌즈', parts: ['i_oledL', 'i_oledR', 'i_optL', 'i_optR'], from: 'back', sec: 75,
      how: ['마이크로 OLED 두 개를 접안 경통 끝에 끼운다', '접안 렌즈군을 그 뒤에 넣는다', 'OLED FPC 를 메인 기판에 꽂는다'],
      hw: ['FPC 2개'], tool: '클린 벤치', check: '두 화면의 높이가 맞는지 (테스트 패턴)' },
    { title: '배터리 카트리지', parts: ['i_bat1', 'i_bat2'], from: 'down', sec: 20,
      how: ['18650 두 개가 든 카트리지를 아래쪽 배터리 칸에 넣는다'],
      check: '극성 표시와 맞는지, 전압 3.6 V 이상' },
    { title: '하우징 닫기', parts: ['s_body', 's_gripL', 's_gripR', 's_rail', 'i_tripod'], from: 'up', sec: 90,
      how: ['개스킷을 하우징 하판 홈에 넣는다', '상판을 덮고 나사 6개를 대각선 순서로 조인다', '그립·레일·삼각대 인서트를 붙인다'],
      hw: ['나사 M2.5 × 8 · 6개', '실리콘 개스킷 1개'], tool: '토크 드라이버 (0.4 N·m)', check: '개스킷이 홈 밖으로 삐져나오지 않았는지' },
    { title: '앞쪽 경통 · 창', parts: ['s_objbar', 's_focus', 's_objglass', 's_irbar', 's_irwin'], from: 'front', sec: 60,
      how: ['대물 경통을 돌려 끼우고 초점 링을 씌운다', '앞유리를 O-링과 함께 넣는다', '적외선 경통과 창을 같은 방법으로'],
      hw: ['O-링 2개'], check: '초점 링이 3 m ~ 무한대까지 부드럽게 도는지' },
    { title: '접안부 · 눈컵', parts: ['s_eyeL', 's_eyeR', 's_cupL', 's_cupR'], from: 'back', sec: 30,
      how: ['접안부를 슬라이드 레일에 끼운다', '눈컵을 씌운다'],
      check: '눈 간격 58~72 mm 로 움직이는지' },
    { title: '버튼 · 포트 · 덮개', parts: ['u_pwr', 'u_ir', 'u_rec', 'u_dial', 'u_eye', 'u_usbc', 'u_sd', 's_door'], from: 'up', sec: 60,
      how: ['실리콘 키패드(버튼 3개)를 윗면에 끼운다', '다이얼을 엔코더 축에 끼운다', 'USB-C 고무 마개와 배터리 덮개를 닫는다'],
      check: '버튼 세 개가 모두 "딸깍" 눌리는지' },
    { title: '작동 · 방수 검사', parts: [], sec: 180,
      how: ['전원을 켜 양쪽 화면에 영상이 나오는지 본다', '암실에서 적외선 1~3단을 확인한다', '방수 시험기로 IP65 분사 시험'],
      tool: '암실 · 방수 시험기', check: '암실 10 m 앞 표적이 보이는지, 물 유입이 없는지', demo: true },
  ],
};

/** 단계 0(부품 확인)을 붙인 전체 단계 */
export function assemblySteps(product) {
  const steps = ASSEMBLY[product.slug] || [];
  const list = checklist(product.parts);
  return [
    { title: '부품 확인', parts: [], sec: 30, prep: true, from: 'up',
      how: ['부품을 작업대에 늘어놓고 목록과 하나씩 맞춰 본다', '빠지거나 흠집 난 부품은 따로 둔다'],
      check: `부품 ${product.parts.length}개 (${list.length}종)가 모두 있는지` },
    ...steps,
  ];
}

/** 부품 목록: 이름이 같은 것(왼쪽·오른쪽, 1·2)은 묶어서 개수로 */
export function checklist(parts) {
  const out = [];
  (parts || []).forEach((p) => {
    const name = shortName(p.name).replace(/\s*\((왼쪽|오른쪽|\d)\)\s*$/, '');
    const g = out.find((x) => x.name === name);
    if (g) { g.n += 1; g.ids.push(p.id); } else out.push({ name, n: 1, ids: [p.id], layer: p.layer });
  });
  return out;
}

/** i 단계 화면: 지금까지 조립된 부품, 이번에 들어가는 부품, 들어오는 방향, 분해 여부 */
export function buildAt(product, steps, i) {
  const s = steps[i];
  if (!s || s.prep) return { shown: product.parts.map((p) => p.id), enter: [], from: 'up', explode: 1 };
  const shown = steps.slice(0, i + 1).flatMap((x) => x.parts || []);
  return { shown: s.parts.length ? shown : product.parts.map((p) => p.id), enter: s.parts || [], from: s.from || 'up', explode: 0 };
}

export const totalSec = (steps) => steps.reduce((a, s) => a + (Number(s.sec) || 0), 0);
export const fmtSec = (sec) => (sec >= 60 ? `${Math.floor(sec / 60)}분${sec % 60 ? ` ${sec % 60}초` : ''}` : `${sec}초`);
