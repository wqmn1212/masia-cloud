// 공개 3D 쇼룸 (/showroom) 의 예시 제품. 모두 설명을 위한 가상 제품이며, 3D 는 개념 시각화다.
// 형상은 컨셉 스튜디오와 같은 부품 형식이라 작동 원리 3D 엔진(분해·투명·단면·자동 해설)을 그대로 쓴다.
import { DEMO_PARTS } from '@/lib/landingCapabilities';
import { accentOf } from '@/lib/stage3d';
import nv1 from './nv1.json';

// 쇼룸에서만 쓰는 부품 설명 + 전원 입력(USB-C) — 랜딩 데모 형상(DEMO_PARTS)은 그대로 둔다
const PURIFIER_ROLES = {
  d1: ['바깥 몸통. 필터·팬·기판을 감싼다', 'PP 무광 (2피스)'],
  d2: ['바닥 받침, 미끄럼 방지', 'TPE 고무'],
  d3: ['아래 둘레로 공기를 빨아들이는 구멍', 'ABS + 금속 메시'],
  d4: ['깨끗해진 공기가 나가는 윗면 테두리', 'ABS 유광'],
  d5: ['팬 위를 덮는 그릴. 손가락이 팬에 닿지 않게', 'ABS'],
  d6: ['켜져 있는 동안 빛나는 상태 표시등', 'PC 확산판 + LED'],
  d7: ['누를 때마다 바람 세기 1 → 2 → 3 → 끄기', '정전식 터치'],
  d8: ['아래에서 빨아들여 필터를 거쳐 위로 내보낸다', '5 V BLDC 팬 90 mm'],
  d9: ['먼지·꽃가루를 거르는 원통형 필터', 'H13 HEPA + 활성탄'],
  d10: ['버튼을 읽고 팬 속도·표시등을 정한다', 'FR-4 2층 + MCU'],
  d11: ['5 V 전원 입력', 'USB-C 리셉터클'],
};
const purifierParts = [
  ...DEMO_PARTS,
  { id: 'd11', name: 'USB-C 포트', layer: 'PCB', shape: 'box', size: { x: 9, y: 3.5, z: 7 }, position: { x: 0, y: 20, z: -60 }, color: '#9AA3AD', finish: 'metal' },
].map((p) => ({ ...p, role: PURIFIER_ROLES[p.id]?.[0], material: PURIFIER_ROLES[p.id]?.[1] }));
const purifierFeatures = [
  { id: 'f_btn', kind: 'button', name: '터치 버튼', part_id: 'd7', note: '누르면 바람 세기 1 → 2 → 3' },
  { id: 'f_fan', kind: 'motor', name: '팬', part_id: 'd8', note: '아래에서 빨아들여 필터를 거쳐 위로' },
  { id: 'f_led', kind: 'led', name: 'LED 링', part_id: 'd6', note: '켜져 있는 동안 빛남' },
];
const purifierRules = [
  { id: 'r1', type: 'event', src: 'f_btn', dst: 'f_fan', action: 'cycle' },
  { id: 'r2', type: 'show', src: 'f_fan', dst: 'f_led' },
];
// 제품 기능: 무엇이 있어야 되는지(needs)와, 빠지면 왜 안 되는지(why). 되는 동안 3D 에 흐름(flows)이 보인다
const purifierFunctions = [
  { id: 'wind', name: '바람 내보내기', desc: '터치 버튼으로 세기 1·2·3', feature: 'f_fan',
    needs: ['@power', '@control', { ids: ['d8'], why: '팬이 없어 공기가 움직이지 않습니다' }],
    flows: [{ from: 'd8', to: 'out', kind: 'air' }] },
  { id: 'clean', name: '먼지 거르기', desc: '빨아들인 공기를 필터로 거른다', feature: 'f_fan',
    needs: ['@power', '@control', { ids: ['d8'], why: '팬이 없어 공기가 필터를 지나가지 않습니다' }, { ids: ['d9'], why: '필터가 없어 바람은 나오지만 먼지는 그대로 나옵니다' }],
    flows: [{ from: 'd3', to: 'd9', kind: 'air' }, { from: 'd9', to: 'd8', kind: 'air' }] },
  { id: 'speed', name: '세기 바꾸기', desc: '누를 때마다 1 → 2 → 3 → 끄기', feature: 'f_btn',
    needs: ['@power', '@control', { ids: ['d7'], why: '터치 버튼이 없어 켜거나 세기를 바꿀 수 없습니다' }] },
  { id: 'status', name: '동작 표시', desc: '켜져 있는 동안 LED 링이 빛남', feature: 'f_led',
    needs: ['@power', '@control', { ids: ['d6'], why: 'LED 링이 없어 켜졌는지 밖에서 알 수 없습니다' }] },
  { id: 'safe', name: '손가락 보호', desc: '그릴이 팬·흡입구를 막아 손이 닿지 않게', kind: 'safety',
    needs: [{ ids: ['d5'], why: '토출 그릴이 없어 돌아가는 팬에 손가락이 닿습니다 (안전 인증 불가)' }, { ids: ['d3'], why: '흡입 그릴이 없어 안쪽 부품에 손이 닿습니다' }] },
];

// 낙서 한 장에서 시작한 미니 가습기 (카드뉴스 '스케치 한 장만 가져오세요' 의 예시 제품)
const humidifierParts = [
  { id: 'h_base', name: '우드 베이스', role: '바닥 받침, 원목 무늬 마감', layer: 'SHELL', shape: 'cylinder', size: { x: 104, y: 30, z: 104 }, position: { x: 0, y: 15, z: 0 }, color: '#B88A5A', finish: 'matte', material: 'ABS 원목 무늬 열전사' },
  { id: 'h_body', name: '본체 외장', role: '물통을 감싸는 바깥 몸통', layer: 'SHELL', shape: 'cylinder', size: { x: 98, y: 98, z: 98 }, position: { x: 0, y: 79, z: 0 }, color: '#F3F0EA', finish: 'matte', material: 'PP 무광' },
  { id: 'h_cap', name: '상단 커버', role: '물을 붓는 뚜껑, 분무구가 달린 면', layer: 'SHELL', shape: 'cylinder', size: { x: 94, y: 8, z: 94 }, position: { x: 0, y: 132, z: 0 }, color: '#E9E4DC', finish: 'gloss', material: 'ABS 유광' },
  { id: 'h_mist', name: '분무구', role: '안개가 나오는 구멍', layer: 'SHELL', shape: 'torus', size: { x: 30, y: 6, z: 30 }, position: { x: 0, y: 137, z: 0 }, color: '#CFC8BE', finish: 'gloss' },
  { id: 'h_tank', name: '물통', role: '물 300 mL, 비치는 재질로 수위 확인', layer: 'INTERNAL', shape: 'cylinder', size: { x: 86, y: 86, z: 86 }, position: { x: 0, y: 79, z: 0 }, color: '#9CC8F0', finish: 'glass', material: 'PCTG 투명' },
  { id: 'h_wick', name: '흡수 심지', role: '물을 위로 끌어올림', layer: 'INTERNAL', shape: 'cylinder', size: { x: 10, y: 92, z: 10 }, position: { x: 0, y: 80, z: 0 }, color: '#EFE7D6', finish: 'matte', material: '면 섬유' },
  { id: 'h_disc', name: '초음파 진동판', role: '물을 아주 작은 알갱이로 쪼개 안개로', layer: 'INTERNAL', shape: 'cylinder', size: { x: 22, y: 5, z: 22 }, position: { x: 0, y: 127, z: 0 }, color: '#B9C1CA', finish: 'metal', material: '세라믹 진동자' },
  { id: 'h_level', name: '수위 센서', role: '물이 떨어지면 자동으로 멈춤', layer: 'INTERNAL', shape: 'box', size: { x: 6, y: 22, z: 4 }, position: { x: 38, y: 58, z: 0 }, color: '#2B2F35', finish: 'matte' },
  { id: 'h_pcb', name: '제어 기판', role: '진동판 구동·무드등·버튼', layer: 'PCB', shape: 'box', size: { x: 62, y: 2, z: 42 }, position: { x: 0, y: 20, z: 0 }, color: '#15803D', finish: 'matte' },
  { id: 'h_usb', name: 'USB-C 포트', role: '5 V 전원 입력', layer: 'PCB', shape: 'box', size: { x: 9, y: 3.5, z: 7 }, position: { x: 0, y: 12, z: -49 }, color: '#9AA3AD', finish: 'metal' },
  { id: 'h_led', name: '무드등 LED 링', role: '바닥을 은은하게 비춤', layer: 'UI', shape: 'torus', size: { x: 84, y: 4, z: 84 }, position: { x: 0, y: 31, z: 0 }, color: '#F5C77E', finish: 'glass' },
  { id: 'h_btn', name: '터치 버튼', role: '누르면 켜기, 다시 누르면 끄기', layer: 'UI', shape: 'cylinder', size: { x: 12, y: 4, z: 12 }, position: { x: 0, y: 18, z: 52 }, rotation_deg: { x: 90, y: 0, z: 0 }, color: '#8A6A45', finish: 'gloss' },
];
const humidifierFeatures = [
  { id: 'f_btn', kind: 'button', name: '터치 버튼', part_id: 'h_btn', note: '누르면 켜기, 다시 누르면 끄기' },
  { id: 'f_mist', kind: 'relay', name: '안개 (초음파 진동판)', part_id: 'h_disc', note: '켜면 물을 안개로' },
  { id: 'f_led', kind: 'led', name: '무드등', part_id: 'h_led', note: '안개가 나오는 동안 따뜻한 빛' },
  { id: 'f_water', kind: 'water', name: '수위 센서', part_id: 'h_level', note: '물이 떨어지면 멈춤' },
];
const humidifierRules = [
  { id: 'r1', type: 'event', src: 'f_btn', dst: 'f_mist', action: 'toggle' },
  { id: 'r2', type: 'show', src: 'f_mist', dst: 'f_led' },
  { id: 'r3', type: 'guard', src: 'f_water', cond: 'empty', dst: 'f_mist' },
];
const humidifierFunctions = [
  { id: 'mist', name: '안개 내보내기', desc: '물을 아주 작은 알갱이로 쪼개 위로', feature: 'f_mist',
    needs: ['@power', '@control',
      { ids: ['h_disc'], why: '초음파 진동판이 없어 물을 안개로 바꾸지 못합니다' },
      { ids: ['h_tank'], why: '물통이 없어 물을 담을 수 없습니다' },
      { ids: ['h_wick'], why: '흡수 심지가 없어 진동판까지 물이 올라오지 않습니다' }],
    flows: [{ from: 'h_tank', to: 'h_wick', kind: 'water' }, { from: 'h_wick', to: 'h_disc', kind: 'water' }, { from: 'h_disc', to: 'out', kind: 'air' }] },
  { id: 'onoff', name: '켜기 · 끄기', desc: '터치 버튼 한 번', feature: 'f_btn',
    needs: ['@power', '@control', { ids: ['h_btn'], why: '터치 버튼이 없어 켤 수 없습니다' }] },
  { id: 'mood', name: '무드등', desc: '안개가 나오는 동안 바닥을 은은하게', feature: 'f_led',
    needs: ['@power', '@control', { ids: ['h_led'], why: '무드등 LED 링이 없어 빛이 나지 않습니다' }] },
  { id: 'dry', name: '물 떨어지면 자동 정지', desc: '빈 물통으로 진동판이 타지 않게', kind: 'safety',
    needs: ['@control', { ids: ['h_level'], why: '수위 센서가 없어 물이 떨어져도 진동판이 계속 돌아 고장 납니다' }] },
  { id: 'see', name: '남은 물 보기', desc: '비치는 물통으로 바로 확인', kind: 'safety',
    needs: [{ ids: ['h_tank'], why: '물통이 없습니다' }] },
];

// 야간투시경: 화면(두 OLED)을 전원 버튼으로 켜고 끈다. 배터리 잔량은 두 배터리 공통이라 특정 부품에 묶지 않는다
const nvFeatures = [
  { id: 'f_screen', kind: 'display', name: '화면 (마이크로 OLED ×2)', part_id: 'i_oledL', note: '전원 버튼 길게 = 켜기·끄기' },
  ...nv1.features.map((f) => (f.kind === 'battery' ? { ...f, part_id: undefined } : f)),
];
const nvRules = [
  { id: 'r1', type: 'event', src: 'f_pwr', dst: 'f_screen', action: 'toggle' },
  { id: 'r2', type: 'event', src: 'f_irbtn', dst: 'f_ir', action: 'cycle' },
  { id: 'r3', type: 'guard', src: 'f_irntc', cond: 'above', value: 85, dst: 'f_ir' },
];
const SEE = [{ ids: ['i_objlens'], why: '대물 렌즈가 없어 빛을 센서에 모으지 못합니다' }, { ids: ['i_sensor'], why: '이미지 센서가 없어 영상이 만들어지지 않습니다' }, { ids: ['b_sensor'], why: '센서 기판이 없어 영상이 메인 기판으로 가지 않습니다' }];
const nvFunctions = [
  { id: 'see', name: '어두운 곳 보기', desc: '별빛만 있어도 양쪽 화면에 영상', feature: 'f_screen',
    needs: ['@power', '@control', ...SEE, { ids: ['i_oledL', 'i_oledR'], any: true, why: '마이크로 OLED 가 없어 볼 화면이 없습니다' }],
    flows: [{ from: 'i_sensor', to: 'b_main', kind: 'signal' }, { from: 'b_main', to: 'i_oledL', kind: 'signal' }, { from: 'b_main', to: 'i_oledR', kind: 'signal' }],
    actions: [{ part: 'i_oledR', kind: 'glow' }] },
  { id: 'both', name: '두 눈으로 보기', desc: '양쪽 화면에 같은 영상', feature: 'f_screen',
    needs: ['@power', '@control', ...SEE, { ids: ['i_oledL'], why: '왼쪽 OLED 가 없어 한쪽 눈으로만 보입니다' }, { ids: ['i_oledR'], why: '오른쪽 OLED 가 없어 한쪽 눈으로만 보입니다' }] },
  { id: 'dark', name: '완전 암흑에서 보기', desc: '적외선 단계 버튼: 끔 → 1 → 2 → 3', feature: 'f_ir',
    needs: ['@power', '@control', ...SEE, { ids: ['i_irled'], why: '적외선 LED 가 없어 빛이 전혀 없는 곳은 보이지 않습니다' }, { ids: ['u_ir'], why: '적외선 단계 버튼이 없어 조사기를 켤 수 없습니다' }] },
  { id: 'day', name: '낮에 자연색', desc: '낮에는 적외선을 막아 색이 그대로', kind: 'always',
    needs: ['@power', '@control', ...SEE, { ids: ['i_icr'], why: '주야 전환 필터가 없어 낮에 색이 붉게 틀어집니다' }] },
  { id: 'rec', name: '사진 · 녹화', desc: '짧게 사진, 길게 녹화', kind: 'always',
    needs: ['@power', '@control', ...SEE, { ids: ['u_rec'], why: '녹화 버튼이 없습니다' }, { ids: ['u_sd'], why: 'microSD 슬롯이 없어 저장할 곳이 없습니다' }] },
  { id: 'zoom', name: '줌 · 밝기', desc: '다이얼을 돌려 1~8배', kind: 'always',
    needs: ['@power', '@control', { ids: ['u_dial'], why: '다이얼이 없어 줌·밝기를 바꿀 수 없습니다' }] },
  { id: 'eye', name: '눈 떼면 화면 꺼짐', desc: '얼굴이 빛나 위치가 드러나지 않게', kind: 'always',
    needs: ['@power', '@control', { ids: ['u_eye'], why: '눈 감지 센서가 없어 눈을 떼도 화면이 켜져 있습니다' }] },
  { id: 'phone', name: '휴대폰으로 보기', desc: '실시간 화면·파일 전송', kind: 'always',
    needs: ['@power', '@control', { ids: ['i_wifi'], why: 'Wi-Fi 모듈이 없어 휴대폰과 연결되지 않습니다' }] },
  { id: 'carry', name: '배터리로 들고 다니기', desc: '18650 두 개로 약 7시간', kind: 'always',
    needs: [{ ids: ['i_bat1', 'i_bat2'], any: true, why: '배터리가 없어 USB-C 를 꽂아 둔 동안에만 켜집니다' }] },
  { id: 'cool', name: '오래 켜도 꺼지지 않기', desc: '영상 처리 칩의 열을 윗면으로', kind: 'always',
    needs: ['@power', { ids: ['i_spread'], why: '방열판이 없어 영상 처리 칩이 과열돼 몇 분 뒤 꺼집니다' }] },
];

const size = (parts) => {
  let a = [Infinity, Infinity, Infinity]; let b = [-Infinity, -Infinity, -Infinity];
  parts.forEach((p) => {
    const s = p.size || {}; const c = p.position || {};
    const h = [(s.x || 0) / 2, (s.y || 0) / 2, (s.z || s.x || 0) / 2];
    [c.x || 0, c.y || 0, c.z || 0].forEach((v, i) => { a[i] = Math.min(a[i], v - h[i]); b[i] = Math.max(b[i], v + h[i]); });
  });
  return { x: Math.round(b[0] - a[0]), y: Math.round(b[1] - a[1]), z: Math.round(b[2] - a[2]) };
};

const make = (x) => {
  const overall = x.overall || size(x.parts);
  return {
    ...x,
    overall,
    accent: x.accent || accentOf(x.parts),
    facts: [
      ['크기', `${Math.round(overall.x)} × ${Math.round(overall.z)} × ${Math.round(overall.y)} mm`],
      ['부품', `${x.parts.length}개`],
      ...x.facts,
    ],
  };
};

export const PRODUCTS = [
  make({
    slug: 'air-purifier', category: '소형 가전', title: '미니 공기청정기', tagline: '책상 위에 두는 원통형 공기청정기',
    idea: '“책상 위에 두는 원통형 미니 공기청정기” 한 문장에서 시작',
    parts: purifierParts, features: purifierFeatures, rules: purifierRules, functions: purifierFunctions, supplyV: 5,
    facts: [['금형 포인트', '외장 2피스로 금형 수 줄이기'], ['일정 (예시)', '약 17주 · 첫 양산 1,000대']],
    points: ['목표 판매가에서 거꾸로 부품별 예산을 나눔', '팬은 표준 부품으로 골라 단가·수급 위험을 낮춤', '시제품 2차에서 진동 소음을 팬 고정 구조로 해결'],
  }),
  make({
    slug: 'night-vision', category: '아웃도어 · 광학', title: '디지털 야간투시경 NV-1', tagline: '별빛·완전 암흑에서도 보이는 쌍안형',
    idea: '적외선 조사기 + 저조도 센서 + 마이크로 OLED 두 개',
    parts: nv1.parts, features: nvFeatures, rules: nvRules, functions: nvFunctions, supplyV: nv1.supply_v, overall: nv1.overall,
    facts: [['금형 포인트', '상·하 2분할 하우징, 가운데 수평 파팅'], ['방수 목표', 'IP65 (실리콘 개스킷)']],
    points: ['장갑 낀 손으로도 잡히는 TPU 이중 사출 그립', '눈을 떼면 화면이 꺼져 얼굴이 빛나지 않게', '18650 배터리 두 개를 카트리지째 교체'],
  }),
  make({
    slug: 'humidifier', category: '리빙', title: '미니 가습기 (우드)', tagline: '공책에 그린 낙서 한 장에서 시작한 가습기',
    idea: '“나무 받침 위에 동그란 가습기” 스케치 한 장',
    parts: humidifierParts, features: humidifierFeatures, rules: humidifierRules, functions: humidifierFunctions, supplyV: 5,
    facts: [['금형 포인트', '몸통·뚜껑·받침 3벌, 원목 무늬는 열전사'], ['물통', '300 mL · 투명 PCTG']],
    points: ['물통을 비치는 재질로 해 수위를 바로 확인', '수위 센서로 물이 떨어지면 자동 정지', '원목 대신 열전사로 원가와 품질 편차를 낮춤'],
  }),
];

export const productBySlug = (slug) => PRODUCTS.find((p) => p.slug === slug) || PRODUCTS[0];
