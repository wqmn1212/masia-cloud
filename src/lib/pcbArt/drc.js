// 아트웍 검사: 제조(JLCPCB 기준) DRC + 연결(미연결·합선·끊긴 트랙) + 전기 규칙(전류 대비 폭·고전압 간격·접지/전원 연결 강도·디커플링·금지 구역)
// 결과: [{ id, sev: 'error'|'warn'|'info', cat: '연결'|'제조'|'전기', code, title, detail, at:[x,y], net?, keys:[항목 key] }]
import { gap, boxesNear, inPoly, pointSeg, dist } from './geom.js';
import { netName, keepouts } from './board.js';
import { analyzeConnectivity } from './connectivity.js';
import { widthForCurrent, clearanceForVoltage, guessNet } from './ipc.js';

export const FAB_PROFILES = {
  jlc2: { label: 'JLCPCB 2층 표준', minTrack: 0.127, minClear: 0.127, minViaDrill: 0.3, minAnnular: 0.13, minHole: 0.3, holeToHole: 0.5, edgeClear: 0.3 },
  jlc4: { label: 'JLCPCB 4·6층', minTrack: 0.09, minClear: 0.09, minViaDrill: 0.2, minAnnular: 0.1, minHole: 0.2, holeToHole: 0.5, edgeClear: 0.3 },
  safe: { label: '여유 있게 (어느 공장이나)', minTrack: 0.2, minClear: 0.2, minViaDrill: 0.4, minAnnular: 0.15, minHole: 0.4, holeToHole: 0.6, edgeClear: 0.5 },
};
// 큰 전류가 지나는 부품 (인덕터·트랜스포머·FET·다이오드·퓨즈·커넥터·배터리·조정기)
export const POWER_REF = /^(L|T|TR|Q|D|F|J|CN|BT|U|K)\d/i;

/** 넷 규칙 짐작 (이름으로). 화면에서 고친 값이 우선한다: rules[netId] = { kind, v, i } */
export function guessNetRules(b) {
  const out = {};
  for (const [id, name] of b.nets) if (id) out[id] = { ...guessNet(name), i: 0 };
  return out;
}

const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString();
const at0 = (s) => (s.kind === 'cap' ? s.a : s.pts[0]);
const label = (it) => (it.kind === 'pad' ? `${it.pad.ref} ${it.pad.num}번` : it.kind === 'via' ? '비아' : '트랙');

/**
 * 패드 하나의 연결 강도: 닿은 트랙 폭 합, 비아 수, 동박면 연결(꽉·서멀 스포크) → 같은 일을 하는 트랙 폭(mm)
 * 서멀 연결은 스포크 개수 × 폭 (KiCad 기본 스포크 4개, 동박면 설정의 스포크 폭)
 */
export function padConnection(b, conn, pad) {
  const it = conn.items.find((x) => x.kind === 'pad' && x.pad === pad);
  if (!it) return null;
  const touching = conn.items.filter((x) => x !== it && x.net === pad.net && x.layers.some((l) => it.layers.includes(l)) && boxesNear(x.box, it.box, 0.01) && gap(x.shape, it.shape) <= 1e-6);
  const tracks = touching.filter((x) => x.kind === 'track');
  const vias = touching.filter((x) => x.kind === 'via');
  const zone = conn.areas.find((a) => a.net === pad.net && it.layers.includes(a.layer) && inPoly(at0(it.shape), a.pts));
  let zoneW = 0, zoneMode = null;
  if (zone) {
    const z = zone.zone;
    zoneMode = pad.zoneConnect === 2 ? 'solid' : pad.zoneConnect === 1 ? 'thermal' : pad.zoneConnect === 0 ? 'none' : z.connect === 'thru_hole_only' ? (pad.type === 'thru_hole' ? 'thermal' : 'none') : z.connect;
    const perim = 2 * (pad.size.w + pad.size.h);
    zoneW = zoneMode === 'solid' ? perim : zoneMode === 'thermal' ? 4 * z.thermalBridge : 0;
  }
  const trackW = tracks.reduce((s, x) => s + x.track.w, 0);
  // 비아 하나는 둘레(π·d)만큼의 폭으로 친다 — 도금 두께가 동박보다 얇아 절반으로
  const viaW = vias.reduce((s, x) => s + (Math.PI * x.via.drill) / 2, 0);
  return { tracks: tracks.length, trackW, vias: vias.length, zoneMode, zoneW, zone: zone?.zone || null, eff: trackW + viaW + zoneW, paths: tracks.length + vias.length + (zoneW > 0 ? 1 : 0) };
}

export function runDrc(b, { profile = 'jlc2', rules = {}, conn = analyzeConnectivity(b), segCurrents = null } = {}) {
  const P = FAB_PROFILES[profile] || FAB_PROFILES.jlc2;
  const out = [];
  let n = 0;
  const add = (f) => out.push({ id: `d${(n += 1)}`, keys: [], ...f });
  const R = (net) => rules[net] || {};

  // ── 연결
  for (const u of conn.unrouted) add({ sev: 'error', cat: '연결', code: 'unrouted', title: `미연결: ${netName(b, u.net)}`, detail: `${fmt(u.len, 1)} mm 떨어진 두 곳이 아직 이어지지 않았습니다.`, at: [(u.a[0] + u.b[0]) / 2, (u.a[1] + u.b[1]) / 2], net: u.net, line: [u.a, u.b] });
  const byKey = new Map(conn.items.map((x) => [x.key, x]));
  for (const s of conn.shorts) add({ sev: 'error', cat: '연결', code: 'short', title: `합선: ${netName(b, s.nets[0])} ↔ ${netName(b, s.nets[1])}`, detail: `${label(byKey.get(s.a))} 와 ${label(byKey.get(s.b))} 가 닿아 있습니다.`, at: s.at, keys: [s.a, s.b] });
  // 끝이 아무것에도 닿지 않은 트랙
  const tracks = conn.items.filter((x) => x.kind === 'track');
  for (const t of tracks) {
    for (const end of [t.track.a, t.track.b]) {
      const probe = { kind: 'cap', a: end, b: end, r: t.track.w / 2 };
      const hit = conn.items.some((x) => x !== t && x.net === t.net && x.layers.some((l) => t.layers.includes(l)) && gap(x.shape, probe) <= 1e-6)
        || conn.areas.some((a) => a.net === t.net && t.layers.includes(a.layer) && inPoly(end, a.pts));
      if (!hit) add({ sev: 'warn', cat: '연결', code: 'dangling', title: `끝이 떠 있는 트랙 (${netName(b, t.net)})`, detail: '트랙 끝이 패드·비아·다른 트랙에 닿지 않았습니다. 지우거나 이어 주세요.', at: end, net: t.net, keys: [t.key] });
    }
  }

  // ── 제조
  for (const t of tracks) if (t.track.w < P.minTrack - 1e-9) add({ sev: 'error', cat: '제조', code: 'track_width', title: `트랙이 너무 가늚 ${fmt(t.track.w, 3)} mm`, detail: `${P.label} 최소 ${P.minTrack} mm`, at: t.track.a, net: t.net, keys: [t.key] });
  for (const v of conn.items.filter((x) => x.kind === 'via')) {
    if (v.via.drill < P.minViaDrill - 1e-9) add({ sev: 'error', cat: '제조', code: 'via_drill', title: `비아 구멍이 작음 ${v.via.drill} mm`, detail: `${P.label} 최소 ${P.minViaDrill} mm`, at: v.via.at, keys: [v.key] });
    if ((v.via.size - v.via.drill) / 2 < P.minAnnular - 1e-9) add({ sev: 'error', cat: '제조', code: 'annular', title: `비아 테두리가 얇음 ${fmt((v.via.size - v.via.drill) / 2, 3)} mm`, detail: `구멍 둘레 동박 최소 ${P.minAnnular} mm (지름 ${fmt(v.via.drill + 2 * P.minAnnular, 2)} mm 이상)`, at: v.via.at, keys: [v.key] });
  }
  // 다른 넷 사이 간격 (같은 부품 패드끼리는 부품 설계라 주의로만)
  const copper = conn.items;
  for (let i = 0; i < copper.length; i++) {
    const A = copper[i];
    for (let j = i + 1; j < copper.length; j++) {
      const B = copper[j];
      if (A.net === B.net && A.net) continue;
      if (!A.layers.some((l) => B.layers.includes(l))) continue;
      const hv = Math.max(Math.abs((R(A.net).v || 0) - (R(B.net).v || 0)), 0);
      const need = Math.max(P.minClear, clearanceForVoltage(hv));
      if (!boxesNear(A.box, B.box, need)) continue;
      const g = gap(A.shape, B.shape);
      if (g <= 1e-6 || g >= need - 1e-9) continue; // 닿은 것은 합선으로 따로
      const samePart = A.kind === 'pad' && B.kind === 'pad' && A.pad.ref === B.pad.ref;
      const hvRule = need > P.minClear;
      if (samePart && !hvRule) continue;
      add({ sev: hvRule || !samePart ? 'error' : 'warn', cat: hvRule ? '전기' : '제조', code: hvRule ? 'hv_clearance' : 'clearance',
        title: hvRule ? `고전압 간격 부족 ${fmt(g, 2)} mm (필요 ${need} mm)` : `간격 부족 ${fmt(g, 3)} mm`,
        detail: hvRule ? `${netName(b, A.net)} ↔ ${netName(b, B.net)} 전압 차 ${fmt(hv, 0)} V — IPC-2221B 외층(코팅 없음) 기준 ${need} mm. 안전 규격(가전·의료기기)은 이보다 넓을 수 있습니다.` : `${label(A)}(${netName(b, A.net)}) ↔ ${label(B)}(${netName(b, B.net)}), ${P.label} 최소 ${P.minClear} mm`,
        at: at0(A.shape), keys: [A.key, B.key] });
    }
  }
  // 구멍: 크기·구멍 사이
  const holes = [
    ...conn.items.filter((x) => x.kind === 'pad' && x.pad.drill).map((x) => ({ at: x.pad.at, d: Math.min(x.pad.drill.w, x.pad.drill.h), key: x.key, ref: x.pad.ref })),
    ...b.footprints.flatMap((f) => f.pads.filter((p) => p.type === 'np_thru_hole' && p.drill).map((p) => ({ at: p.at, d: Math.min(p.drill.w, p.drill.h), key: `np:${f.ref}:${p.num}`, ref: f.ref }))),
    ...conn.items.filter((x) => x.kind === 'via').map((x) => ({ at: x.via.at, d: x.via.drill, key: x.key, via: true })),
  ];
  // 기준보다 작아도 0.2 mm 이상이면 만들 수는 있다 (추가 비용·다층 공정) — 부품 라이브러리의 방열 비아가 흔히 그렇다
  for (const h of holes) if (!h.via && h.d < P.minHole - 1e-9) {
    const possible = h.d >= FAB_PROFILES.jlc4.minHole - 1e-9;
    add({ sev: possible ? 'warn' : 'error', cat: '제조', code: 'hole', title: `구멍이 작음 ${h.d} mm (${h.ref})`, detail: possible ? `${P.label} 기본 ${P.minHole} mm 보다 작습니다. 만들 수는 있지만 추가 비용이 붙을 수 있습니다 (부품 방열 비아라면 그대로 두어도 됩니다).` : `${P.label} 최소 ${P.minHole} mm — 이 크기는 뚫을 수 없습니다.`, at: h.at, keys: [h.key] });
  }
  for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) {
    const A = holes[i], B = holes[j];
    if (A.ref && A.ref === B.ref) continue;
    const g = dist(A.at, B.at) - A.d / 2 - B.d / 2;
    if (g < P.holeToHole - 1e-9 && g > -1e-6) add({ sev: 'warn', cat: '제조', code: 'hole_to_hole', title: `구멍 사이가 좁음 ${fmt(g, 2)} mm`, detail: `드릴이 깨지거나 구멍이 이어질 수 있습니다. ${P.label} 권장 ${P.holeToHole} mm 이상`, at: A.at, keys: [A.key, B.key] });
  }
  // 기판 가장자리 (바깥 외곽 + 안쪽 구멍)
  if (b.outline.length) {
    const outer = b.outline[0];
    const edgesOf = (pts) => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
    const allEdges = b.outline.flatMap(edgesOf);
    for (const it of copper) {
      const c = at0(it.shape);
      if (!inPoly(c, outer)) { add({ sev: 'error', cat: '제조', code: 'outside', title: `기판 밖의 동박 (${label(it)})`, detail: '외곽 밖에 있습니다.', at: c, keys: [it.key] }); continue; }
      const r = it.shape.kind === 'cap' ? it.shape.r : 0;
      let m = Infinity;
      for (const [p, q] of allEdges) m = Math.min(m, it.shape.kind === 'cap' ? Math.min(pointSeg(p, it.shape.a, it.shape.b), pointSeg(q, it.shape.a, it.shape.b), segDist(it.shape, p, q)) - r : polyEdgeDist(it.shape.pts, p, q));
      if (m < P.edgeClear - 1e-9) add({ sev: 'warn', cat: '제조', code: 'edge', title: `가장자리에 너무 가까움 ${fmt(Math.max(0, m), 2)} mm (${label(it)})`, detail: `자를 때 동박이 드러나거나 끊길 수 있습니다. ${P.edgeClear} mm 이상 띄우세요.`, at: c, keys: [it.key] });
    }
  }
  // 금지 구역 (안테나 아래 등): 트랙·비아는 하나씩, 다른 부품 패드는 부품마다 한 줄로
  for (const k of keepouts(b)) {
    const inside = (it) => it.layers.some((l) => k.layers.includes(l)) && inPoly(at0(it.shape), k.outline);
    const where = k.ref ? ` (${k.ref} 안테나 아래)` : '';
    for (const it of copper.filter((x) => (x.kind === 'track' && k.keepout.tracks === 'not_allowed') || (x.kind === 'via' && k.keepout.vias === 'not_allowed'))) {
      if (inside(it)) add({ sev: 'error', cat: '전기', code: 'keepout', title: `금지 구역 안의 ${label(it)}${where}`, detail: '안테나 성능이 떨어집니다. 이 구역에는 트랙·비아를 두지 마세요.', at: at0(it.shape), net: it.net, keys: [it.key] });
    }
    if (k.keepout.pads === 'not_allowed' || k.keepout.footprints === 'not_allowed') {
      const byRef = new Map();
      for (const it of copper.filter((x) => x.kind === 'pad' && x.pad.ref !== k.ref && inside(x))) { if (!byRef.has(it.pad.ref)) byRef.set(it.pad.ref, []); byRef.get(it.pad.ref).push(it); }
      for (const [ref, list] of byRef) add({ sev: 'warn', cat: '전기', code: 'keepout_part', title: `${ref} 가 금지 구역 안에 있음${where}`, detail: `패드 ${list.length}개가 모듈 제조사가 권장한 안테나 비움 구역 안입니다. 무선 거리가 줄 수 있습니다 — 옮길 자리가 없으면 안테나에서 가장 먼 쪽으로 두세요.`, at: at0(list[0].shape), keys: list.map((x) => x.key) });
    }
    for (const z of b.zones.filter((x) => !x.keepout && x.net && k.keepout.copperpour === 'not_allowed' && x.layers.some((l) => k.layers.includes(l)))) {
      if (z.outline.some((p) => inPoly(p, k.outline)) || k.outline.some((p) => inPoly(p, z.outline))) add({ sev: 'info', cat: '전기', code: 'keepout_pour', title: `동박면이 금지 구역과 겹침 (${netName(b, z.net)})`, detail: 'KiCad 가 채울 때 금지 구역을 비우는지 확인하세요.', at: k.outline[0] });
    }
  }

  // ── 전기: 전류 대비 트랙 폭 (시뮬레이션 결과가 있으면 구간 전류로)
  for (const t of tracks) {
    const I = segCurrents?.[t.key] ?? R(t.net).i ?? 0;
    if (!(I > 0)) continue;
    const need = widthForCurrent(I);
    if (t.track.w < need - 1e-6) add({ sev: segCurrents ? 'error' : 'warn', cat: '전기', code: 'current_width', title: `전류에 비해 가늚: ${fmt(t.track.w, 2)} mm < ${fmt(need, 2)} mm (${fmt(I, 2)} A)`, detail: `${netName(b, t.net)} — 온도 상승 10 °C 기준(IPC-2221B 외층 1 oz).${segCurrents ? ' 시뮬레이션한 구간 전류입니다.' : ' 넷 전체 전류로 본 보수적 판단입니다. 시뮬레이션으로 구간 전류를 확인하세요.'}`, at: t.track.a, net: t.net, keys: [t.key] });
  }
  // ── 전기: 큰 전류 부품 핀의 연결 강도 (접지·전원) — 트랜스포머 접지 불량 같은 문제
  for (const f of b.footprints) {
    if (!POWER_REF.test(f.ref)) continue;
    for (const p of f.pads) {
      const r = R(p.net);
      if (!p.net || !['gnd', 'power', 'hv'].includes(r.kind)) continue;
      const c = padConnection(b, conn, p);
      if (!c) continue;
      const I = r.i || 0;
      const need = I > 0 ? widthForCurrent(I) : 0;
      if (c.paths === 0) continue; // 미연결로 이미 나옴
      if (need && c.eff < need - 1e-6) add({ sev: 'error', cat: '전기', code: 'weak_power_pin', title: `${f.ref} ${p.num}번(${netName(b, p.net)}) 연결이 약함`, detail: `연결 폭 ${fmt(c.eff, 2)} mm 상당 < 필요 ${fmt(need, 2)} mm (${fmt(I, 2)} A). ${describe(c)} — 트랙을 넓히거나 비아를 더하고, 동박면은 꽉 연결(solid)로 바꾸세요.`, at: p.at, net: p.net, keys: [] });
      else if (c.paths === 1 && (I >= 0.5 || /^(T|TR|L|Q)\d/i.test(f.ref))) add({ sev: 'warn', cat: '전기', code: 'single_path', title: `${f.ref} ${p.num}번(${netName(b, p.net)})이 한 곳으로만 이어짐`, detail: `${describe(c)}. 이 연결 하나가 납땜·패턴 불량이면 기능이 멈춥니다 (예: 트랜스포머 접지 불량). 비아나 트랙을 하나 더 두세요.`, at: p.at, net: p.net });
      else if (c.zoneMode === 'thermal' && c.tracks === 0 && c.vias === 0 && I >= 1) add({ sev: 'warn', cat: '전기', code: 'thermal_only', title: `${f.ref} ${p.num}번이 서멀 스포크로만 이어짐`, detail: `스포크 4 × ${fmt(c.zone.thermalBridge, 2)} mm. ${fmt(I, 1)} A 이상이면 꽉 연결이나 비아를 더하세요.`, at: p.at, net: p.net });
    }
  }
  // ── 전기: 디커플링 커패시터 거리 (IC 전원 핀 ↔ 같은 넷의 가장 가까운 C)
  const caps = b.footprints.filter((f) => /^C\d/i.test(f.ref));
  for (const f of b.footprints.filter((x) => /^U\d/i.test(x.ref))) {
    for (const p of f.pads) {
      if (R(p.net).kind !== 'power') continue;
      const near = caps.flatMap((c) => c.pads.filter((q) => q.net === p.net)).reduce((m, q) => Math.min(m, dist(q.at, p.at)), Infinity);
      if (near === Infinity) add({ sev: 'info', cat: '전기', code: 'no_decoupling', title: `${f.ref} ${p.num}번(${netName(b, p.net)}) 근처에 디커플링 커패시터가 없음`, detail: '같은 넷의 커패시터를 찾지 못했습니다.', at: p.at, net: p.net });
      else if (near > 5) add({ sev: 'warn', cat: '전기', code: 'decoupling_far', title: `${f.ref} ${p.num}번 디커플링 커패시터가 멂 (${fmt(near, 1)} mm)`, detail: '전원 핀에서 3 mm 안쪽에 두면 잡음과 전압 출렁임이 줄어듭니다.', at: p.at, net: p.net });
    }
  }
  const order = { error: 0, warn: 1, info: 2 };
  return out.sort((a, c) => order[a.sev] - order[c.sev]);
}

function describe(c) {
  return [c.tracks && `트랙 ${c.tracks}개(폭 합 ${fmt(c.trackW, 2)} mm)`, c.vias && `비아 ${c.vias}개`, c.zoneMode && c.zoneMode !== 'none' && `동박면 ${c.zoneMode === 'solid' ? '꽉 연결' : `서멀 스포크(4 × ${fmt(c.zone.thermalBridge, 2)} mm)`}`].filter(Boolean).join(' · ') || '연결 없음';
}
const segDist = (s, p, q) => { let m = Infinity; for (let i = 0; i <= 8; i++) { const t = i / 8; m = Math.min(m, pointSeg([s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t], p, q)); } return m; };
const polyEdgeDist = (pts, p, q) => Math.min(...pts.map((v) => pointSeg(v, p, q)));

/** 검사 결과 묶음 개수 */
export const drcCounts = (list) => ({ error: list.filter((x) => x.sev === 'error').length, warn: list.filter((x) => x.sev === 'warn').length, info: list.filter((x) => x.sev === 'info').length });
