// 공개 3D 쇼룸 (/showroom) 의 예시 제품. 모두 설명을 위한 가상 제품이며, 3D 는 개념 시각화다.
// 형상은 컨셉 스튜디오와 같은 부품 형식이라 작동 원리 3D 엔진(분해·투명·단면·자동 해설)을 그대로 쓴다.
import { DEMO_PARTS } from '@/lib/landingCapabilities';
import { accentOf } from '@/lib/stage3d';
import nv1 from './nv1.json';

const purifierFeatures = [
  { id: 'f_btn', kind: 'button', name: '터치 버튼', part_id: 'd7', note: '누르면 바람 세기 1 → 2 → 3' },
  { id: 'f_fan', kind: 'motor', name: '팬', part_id: 'd8', note: '아래에서 빨아들여 필터를 거쳐 위로' },
  { id: 'f_led', kind: 'light', name: 'LED 링', part_id: 'd6', note: '공기 상태에 따라 색이 바뀜' },
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
  { id: 'h_btn', name: '터치 버튼', role: '켜기 · 무드등 · 끄기', layer: 'UI', shape: 'cylinder', size: { x: 12, y: 4, z: 12 }, position: { x: 0, y: 18, z: 52 }, rotation_deg: { x: 90, y: 0, z: 0 }, color: '#8A6A45', finish: 'gloss' },
];
const humidifierFeatures = [
  { id: 'f_btn', kind: 'button', name: '터치 버튼', part_id: 'h_btn', note: '켜기 → 무드등 → 끄기' },
  { id: 'f_led', kind: 'light', name: '무드등', part_id: 'h_led', note: '따뜻한 빛' },
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
    parts: DEMO_PARTS, features: purifierFeatures, supplyV: 5,
    facts: [['금형 포인트', '외장 2피스로 금형 수 줄이기'], ['일정 (예시)', '약 17주 · 첫 양산 1,000대']],
    points: ['목표 판매가에서 거꾸로 부품별 예산을 나눔', '팬은 표준 부품으로 골라 단가·수급 위험을 낮춤', '시제품 2차에서 진동 소음을 팬 고정 구조로 해결'],
  }),
  make({
    slug: 'night-vision', category: '아웃도어 · 광학', title: '디지털 야간투시경 NV-1', tagline: '별빛·완전 암흑에서도 보이는 쌍안형',
    idea: '적외선 조사기 + 저조도 센서 + 마이크로 OLED 두 개',
    parts: nv1.parts, features: nv1.features, supplyV: nv1.supply_v, overall: nv1.overall,
    facts: [['금형 포인트', '상·하 2분할 하우징, 가운데 수평 파팅'], ['방수 목표', 'IP65 (실리콘 개스킷)']],
    points: ['장갑 낀 손으로도 잡히는 TPU 이중 사출 그립', '눈을 떼면 화면이 꺼져 얼굴이 빛나지 않게', '18650 배터리 두 개를 카트리지째 교체'],
  }),
  make({
    slug: 'humidifier', category: '리빙', title: '미니 가습기 (우드)', tagline: '공책에 그린 낙서 한 장에서 시작한 가습기',
    idea: '“나무 받침 위에 동그란 가습기” 스케치 한 장',
    parts: humidifierParts, features: humidifierFeatures, supplyV: 5,
    facts: [['금형 포인트', '몸통·뚜껑·받침 3벌, 원목 무늬는 열전사'], ['물통', '300 mL · 투명 PCTG']],
    points: ['물통을 비치는 재질로 해 수위를 바로 확인', '수위 센서로 물이 떨어지면 자동 정지', '원목 대신 열전사로 원가와 품질 편차를 낮춤'],
  }),
];

export const productBySlug = (slug) => PRODUCTS.find((p) => p.slug === slug) || PRODUCTS[0];
