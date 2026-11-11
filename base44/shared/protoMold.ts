// 컨셉 단계 사출·금형 규칙 계산 (입력 치수 기반). 유동 해석이 아니라 일반 설계 기준과의 비교다.
// 재질 기준은 화면의 src/lib/moldReview/materials.js 와 같은 참고값 (등급·업체별로 다르다)

const M: Record<string, any> = {
  ABS: { name: 'ABS', shrink: [0.4, 0.7], minWall: 0.9, lt: 175, rib: 0.6 },
  PCABS: { name: 'PC/ABS', shrink: [0.5, 0.7], minWall: 1.0, lt: 150, rib: 0.6 },
  PC: { name: 'PC', shrink: [0.5, 0.7], minWall: 1.0, lt: 110, rib: 0.6 },
  PMMA: { name: 'PMMA', shrink: [0.2, 0.8], minWall: 0.9, lt: 130, rib: 0.6 },
  PP: { name: 'PP', shrink: [1.0, 2.5], minWall: 0.8, lt: 250, rib: 0.5 },
  PA66: { name: 'PA66', shrink: [1.0, 2.0], minWall: 0.8, lt: 200, rib: 0.5 },
  POM: { name: 'POM', shrink: [1.8, 2.2], minWall: 0.8, lt: 150, rib: 0.5 },
  PBT: { name: 'PBT', shrink: [1.5, 2.0], minWall: 0.8, lt: 200, rib: 0.5 },
  TPU: { name: 'TPU', shrink: [0.8, 1.8], minWall: 0.8, lt: 150, rib: 0.6 },
};
export const MOLD_MATERIAL_KEYS = Object.keys(M);

const num = (v: any) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r = (v: number, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

export function moldRuleChecks(inp: any) {
  const m = M[inp?.material] || M.ABS;
  const L = num(inp?.length_mm); const W = num(inp?.width_mm); const H = num(inp?.height_mm);
  const wall = num(inp?.wall_mm); const wallMax = num(inp?.wall_max_mm); const wallMin = num(inp?.wall_min_mm);
  const rib = num(inp?.rib_mm); const draft = num(inp?.draft_deg); const texture = num(inp?.texture_depth_mm) || 0;
  const checks: any[] = [];
  const unknowns: string[] = [];
  const add = (severity: string, category: string, title: string, detail: string) => checks.push({ severity, category, title, detail });

  if (wall == null) unknowns.push('기본 살 두께 미입력 — 충전·수축·리브 비율을 판단하지 못했습니다');
  else {
    if (wall < m.minWall) add('HIGH', 'THICKNESS', '살 두께가 재질 최소값보다 얇음', `기본 살 ${wall}mm < ${m.name} 권장 최소 ${m.minWall}mm — 끝까지 차지 않을 수 있습니다(미성형)`);
    if (wall > 4) add('MEDIUM', 'SINK', '기본 살이 두꺼움', `기본 살 ${wall}mm — 4mm 를 넘으면 냉각이 늦어 수축·싱크·보이드가 생기기 쉽습니다. 살을 빼고 리브로 강성을 확보하세요`);
    if (wallMax != null && wallMax > wall) {
      const ratio = wallMax / wall;
      if (ratio > 1.5) add('HIGH', 'SINK', '두께 편차가 큼', `가장 두꺼운 곳 ${wallMax}mm 가 기본 살 ${wall}mm 의 ${r(ratio)}배 — 두꺼운 쪽이 늦게 굳어 싱크·변형 위험이 높습니다 (권장 1.25배 이내)`);
      else if (ratio > 1.25) add('MEDIUM', 'SINK', '두께 편차 주의', `가장 두꺼운 곳 ${wallMax}mm 가 기본 살의 ${r(ratio)}배 — 완만한 두께 전환(3:1 이상 경사)이 필요합니다`);
    }
    if (rib != null && rib / wall > m.rib + 0.05) add(rib / wall > 0.8 ? 'HIGH' : 'MEDIUM', 'SINK', '리브가 두꺼워 반대면 싱크 위험', `리브 ${rib}mm 는 기본 살의 ${Math.round((rib / wall) * 100)}% — ${m.name} 권장 ${Math.round(m.rib * 100)}% (${r(wall * m.rib)}mm) 이하`);
  }
  if (wallMin != null && wallMin < m.minWall) add('MEDIUM', 'THICKNESS', '가장 얇은 곳이 최소 살 미만', `최소 살 ${wallMin}mm < ${m.name} 권장 최소 ${m.minWall}mm — 그 부위가 덜 찰 수 있습니다`);

  const draftNeed = (H != null && H > 50 ? 1.5 : 1) + texture / 0.025;
  if (draft == null) unknowns.push('빼기 구배 미입력 — 취출 가능 여부를 판단하지 못했습니다');
  else if (draft < 0.5) add('HIGH', 'DRAFT', '구배가 거의 없음', `구배 ${draft}° — 금형에서 빠지지 않거나 긁힘·백화가 생깁니다. 최소 ${r(draftNeed, 1)}° 필요`);
  else if (draft < draftNeed) add('MEDIUM', 'DRAFT', '구배 부족', `구배 ${draft}° < 필요 ${r(draftNeed, 1)}° (높이${texture ? '·부식 깊이' : ''} 기준)`);

  let flowRatio: number | null = null;
  const t = wallMin ?? wall;
  if (L != null && W != null && t) {
    const path = Math.sqrt((L / 2) ** 2 + (W / 2) ** 2) + (H || 0);
    flowRatio = r(path / t, 0);
    if (flowRatio > m.lt) add('HIGH', 'FLOW', '유동 길이비 초과', `중앙 1점 게이트 가정 시 유동 길이 약 ${r(path, 0)}mm ÷ 살 ${t}mm = ${flowRatio} > ${m.name} 참고 한계 ${m.lt} — 게이트를 늘리거나 살을 키워야 합니다`);
    else if (flowRatio > m.lt * 0.8) add('MEDIUM', 'FLOW', '유동 길이비 한계 근접', `유동 길이비 약 ${flowRatio} (한계 ${m.lt}) — 게이트 위치에 따라 미성형·웰드라인이 생길 수 있습니다`);
  } else unknowns.push('가로·세로 또는 살 두께 미입력 — 유동 길이비를 계산하지 못했습니다');

  if (String(inp?.undercuts || '').trim()) add('MEDIUM', 'UNDERCUT', '언더컷 처리 필요', `언더컷(${String(inp.undercuts).slice(0, 80)}) — 슬라이드·리프터가 필요해 금형비와 납기가 늘어납니다. 형상 변경으로 없앨 수 있는지 검토하세요`);

  return {
    metrics: {
      material_name: m.name, shrink_pct: m.shrink,
      shrink_mm: L != null ? [r(L * m.shrink[0] / 100), r(L * m.shrink[1] / 100)] : null,
      min_wall_mm: m.minWall, rib_max_mm: wall != null ? r(wall * m.rib) : null,
      draft_required_deg: r(draftNeed, 1), flow_ratio: flowRatio, flow_limit: m.lt,
    },
    checks, unknowns,
  };
}