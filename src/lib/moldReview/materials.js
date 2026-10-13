// 금형 사전 검토용 재질 기준 (일반 사출 참고값, 등급·업체별로 다르므로 최종은 재료 데이터시트로 확인)
//   shrink    수축률 범위 (%)
//   minWall   권장 최소 살 두께 (mm) — 이보다 얇으면 끝까지 차지 않을 수 있다
//   lt        유동 길이비(L/t) 참고 한계 — 게이트에서 가장 먼 곳까지 거리 ÷ 살 두께
//   pressure  캐비티 내 평균 압력 (kgf/cm²) — 형체력 추정용
//   gateN     게이트 치수 재료 상수 (Pye 공식)
//   ribRatio  권장 리브 두께 / 기본 살 두께

export const MOLD_MATERIALS = [
  { key: 'ABS', name: 'ABS', zh: 'ABS', density: 1.05, shrink: [0.4, 0.7], minWall: 0.9, lt: 175, pressure: 350, gateN: 0.7, ribRatio: 0.6 },
  { key: 'PCABS', name: 'PC/ABS', zh: 'PC/ABS', density: 1.13, shrink: [0.5, 0.7], minWall: 1.0, lt: 150, pressure: 400, gateN: 0.7, ribRatio: 0.6 },
  { key: 'PC', name: 'PC', zh: 'PC', density: 1.2, shrink: [0.5, 0.7], minWall: 1.0, lt: 110, pressure: 450, gateN: 0.7, ribRatio: 0.6 },
  { key: 'PMMA', name: 'PMMA (아크릴)', zh: 'PMMA (亚克力)', density: 1.18, shrink: [0.2, 0.8], minWall: 0.9, lt: 130, pressure: 450, gateN: 0.8, ribRatio: 0.6 },
  { key: 'PP', name: 'PP', zh: 'PP', density: 0.91, shrink: [1.0, 2.5], minWall: 0.8, lt: 250, pressure: 300, gateN: 0.7, ribRatio: 0.5 },
  { key: 'PA66', name: 'PA66 (나일론)', zh: 'PA66 (尼龙)', density: 1.14, shrink: [1.0, 2.0], minWall: 0.8, lt: 200, pressure: 400, gateN: 0.8, ribRatio: 0.5 },
  { key: 'POM', name: 'POM', zh: 'POM', density: 1.41, shrink: [1.8, 2.2], minWall: 0.8, lt: 150, pressure: 450, gateN: 0.7, ribRatio: 0.5 },
  { key: 'PBT', name: 'PBT', zh: 'PBT', density: 1.31, shrink: [1.5, 2.0], minWall: 0.8, lt: 200, pressure: 400, gateN: 0.7, ribRatio: 0.5 },
  { key: 'TPU', name: 'TPU', zh: 'TPU', density: 1.2, shrink: [0.8, 1.8], minWall: 0.8, lt: 150, pressure: 350, gateN: 0.7, ribRatio: 0.6 },
];

export const DEFAULT_MATERIAL_KEY = 'ABS';

/** 사출기 형체력 등급 (톤) */
export const MACHINE_TONNAGES = [50, 80, 100, 130, 160, 200, 250, 300, 350, 450, 550, 650, 850, 1000, 1300];

export function getMaterial(key) {
  return MOLD_MATERIALS.find((m) => m.key === key) || MOLD_MATERIALS[0];
}

/**
 * materialGuess.js 의 추정 재질명을 이 표의 key 로 바꾼다.
 * 고무(실리콘·LSR)는 사출 기준이 달라 rubber: true 로 알려 준다.
 */
export function materialKeyFromGuess(name) {
  const n = String(name || '').toUpperCase();
  if (n === 'PC/ABS') return { key: 'PCABS', rubber: false };
  if (n === 'NYLON' || n.startsWith('PA')) return { key: 'PA66', rubber: false };
  if (n === '실리콘' || n === 'LSR' || n === 'SILICONE') return { key: DEFAULT_MATERIAL_KEY, rubber: true };
  const hit = MOLD_MATERIALS.find((m) => m.key === n);
  return { key: hit ? hit.key : DEFAULT_MATERIAL_KEY, rubber: false };
}

/** 부식(텍스처) 깊이 선택지 — 깊이 0.025mm 마다 구배 1° 추가 (업계 통용 기준) */
export const TEXTURE_OPTIONS = [
  { value: 0, label: '없음 (광택·일반)', zh: '无 (光面)' },
  { value: 0.025, label: '0.025mm (구배 +1°)', zh: '0.025mm (拔模 +1°)' },
  { value: 0.05, label: '0.05mm (구배 +2°)', zh: '0.05mm (拔模 +2°)' },
  { value: 0.075, label: '0.075mm (구배 +3°)', zh: '0.075mm (拔模 +3°)' },
  { value: 0.1, label: '0.1mm (구배 +4°)', zh: '0.1mm (拔模 +4°)' },
];

export function textureDraftDeg(depthMm) {
  return Math.round((Number(depthMm || 0) / 0.025) * 10) / 10;
}
