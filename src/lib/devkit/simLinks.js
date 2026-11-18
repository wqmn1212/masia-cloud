// 동작 시뮬레이션 3D: 기능 ↔ 부품 연결 (SimStep·고객 시연 화면이 같이 쓴다)
// 한 부품에 조명이 여럿이면(예: 한 패브릭 면에 따뜻한 빛 + 밝은 빛) lights 에 모두 담아 3D 에서 섞어 보인다
export function simLinks(features, parts, usingFallback) {
  const m = {};
  (features || []).forEach((f) => {
    const pid = usingFallback ? (parts.some((p) => p.id === f.id) ? f.id : null) : (f.part_id || parts.find((p) => p.name === f.name)?.id);
    if (!pid) return;
    const prev = m[pid];
    if (f.kind === 'light' && prev?.kind === 'light') { prev.lights.push(f); return; }
    m[pid] = { feature_id: f.id, kind: f.kind, feature: f, ...(f.kind === 'light' ? { lights: [f] } : {}) };
  });
  return m;
}
