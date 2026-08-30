// 부품명 패턴 기반 재질·비중 추정
// STEP 파일에 재질 정보가 없으므로 추정 후 사용자가 확정한다.
// 추정값은 material_confirmed: false 로 저장한다.

export const MATERIAL_OPTIONS = [
  { material: 'ABS', density: 1.05 },
  { material: 'PC/ABS', density: 1.13 },
  { material: 'PC', density: 1.20 },
  { material: 'PMMA', density: 1.18 },
  { material: 'TPU', density: 1.20 },
  { material: '실리콘', density: 1.15 },
  { material: 'LSR', density: 1.15 },
  { material: 'POM', density: 1.41 },
  { material: 'PP', density: 0.91 },
  { material: 'NYLON', density: 1.14 },
];

const RULES = [
  { test: /(PCB|FPC)/i, material: '구매품', density: 0, is_purchased: true },
  { test: /(SCREW|BOLT|NUT|WASHER)/i, material: '구매품', density: 0, is_purchased: true },
  { test: /(RUBBER|PAD|SEAL|GASKET)/i, material: '실리콘', density: 1.15 },
  { test: /(WINDOW|LENS|LAMP)/i, material: 'PMMA', density: 1.18 },
  { test: /COVER/i, material: 'PMMA', density: 1.18 },
  { test: /(HEAD[+-]|ELECTRODE)/i, material: 'PC/ABS', density: 1.13 },
];

const DEFAULT = { material: 'ABS', density: 1.05, is_purchased: false };

/**
 * 부품명으로 재질을 추정한다.
 * @param {string} partName
 * @returns {{material: string, density: number, is_purchased: boolean}}
 */
export function guessMaterial(partName) {
  const name = String(partName || '');
  for (const rule of RULES) {
    if (rule.test.test(name)) {
      return {
        material: rule.material,
        density: rule.density,
        is_purchased: !!rule.is_purchased,
      };
    }
  }
  return { ...DEFAULT };
}

/** 부피(cm³) × 비중 → 중량(g) */
export function computeWeightG(volumeCm3, density) {
  return Number(volumeCm3 || 0) * Number(density || 0);
}