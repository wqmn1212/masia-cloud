// 기판 시뮬레이션 (직류): 한 넷의 동박을 저항망으로 바꿔 전압 강하·구간 전류·전류 밀도·온도 상승·손실을 푼다.
//  - 트랙: 길이·폭·동박 두께로 저항 (T 자로 붙은 곳은 그 자리에서 나눈다)
//  - 비아: 도금 통 저항 (층마다 따로 마디를 두고 그 사이)
//  - 동박면: 닿은 점들 사이를 퍼짐 저항으로 (가까운 4곳씩), 서멀 연결은 스포크(4 × 폭, 길이 = 틈) 저항
//  - 공급점 하나(전압 고정)와 부하 패드들(전류를 빼 감) — 접지 넷이면 '돌아오는 전류'로 보고 공급점은 전원·배터리의 접지 단자
// 근사 모델이다: 동박면은 연속 판으로, 패드 안 저항은 0 으로 본다. 결과는 어디가 약한지 비교하는 용도.
import { dist, pointSeg, closestOnSeg, inPoly, gap } from './geom.js';
import { allPads } from './board.js';
import { analyzeConnectivity } from './connectivity.js';
import { trackR, viaR, spreadR, sheetR, tempRise, OZ_MM } from './ipc.js';

const R_CONTACT = 1e-6;
const posKey = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;

/** 패드 key (화면·검사와 같은 형식) */
export const padKey = (p) => `p:${p.ref}:${p.num}:${p.at.join(',')}`;

/** 기본 부하: 공급 패드를 뺀 같은 넷 패드 중 큰 전류 부품(L·T·Q·D·U…) 핀, 없으면 전부 — 전체 전류를 고르게 나눈다 */
export function defaultLoads(b, net, sourceKey, totalI = 1) {
  const pads = allPads(b).filter((p) => p.net === net && p.type !== 'np_thru_hole' && padKey(p) !== sourceKey);
  const srcRef = sourceKey?.split(':')[1];
  const others = pads.filter((p) => p.ref !== srcRef);
  const power = others.filter((p) => /^(L|T|TR|Q|D|U|K|M|LED)\d/i.test(p.ref));
  const pick = power.length ? power : others.length ? others : pads;
  return pick.map((p) => ({ key: padKey(p), ref: p.ref, num: p.num, i: Math.round((totalI / pick.length) * 1e4) / 1e4 }));
}
/** 기본 공급점: 커넥터(J)·배터리(BT) 패드 → 없으면 조정기(U) → 첫 패드 */
export function defaultSource(b, net) {
  const pads = allPads(b).filter((p) => p.net === net && p.type !== 'np_thru_hole');
  const p = pads.find((x) => /^(J|CN|BT|P)\d/i.test(x.ref)) || pads.find((x) => /^U\d/i.test(x.ref)) || pads[0];
  return p ? padKey(p) : null;
}

/** 대칭 양의 정부호 연립 방정식 (켤레 기울기 + 대각 전처리) */
function solveCG(n, rows, rhs, iters = 4000, tol = 1e-12) {
  const x = new Float64Array(n), r = Float64Array.from(rhs), z = new Float64Array(n), p = new Float64Array(n), Ap = new Float64Array(n);
  const diag = rows.map((row) => row.get(-1) || 1);
  const mul = (v, out) => { for (let i = 0; i < n; i++) { let s = diag[i] * v[i]; for (const [j, g] of rows[i]) if (j >= 0) s += g * v[j]; out[i] = s; } };
  for (let i = 0; i < n; i++) z[i] = r[i] / diag[i];
  p.set(z);
  let rz = r.reduce((s, v, i) => s + v * z[i], 0);
  const b2 = Math.sqrt(rhs.reduce((s, v) => s + v * v, 0)) || 1;
  for (let k = 0; k < iters; k++) {
    mul(p, Ap);
    const pAp = p.reduce((s, v, i) => s + v * Ap[i], 0);
    if (!(Math.abs(pAp) > 0)) break;
    const a = rz / pAp;
    for (let i = 0; i < n; i++) { x[i] += a * p[i]; r[i] -= a * Ap[i]; }
    if (Math.sqrt(r.reduce((s, v) => s + v * v, 0)) / b2 < tol) break;
    for (let i = 0; i < n; i++) z[i] = r[i] / diag[i];
    const rz2 = r.reduce((s, v, i) => s + v * z[i], 0);
    const beta = rz2 / rz; rz = rz2;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
  }
  return x;
}

/**
 * 넷 하나 시뮬레이션.
 * opts: { net, source(패드 key), sourceV, loads:[{key, i}], cu(동박 mm), tempC, plating(비아 도금 mm), spokes }
 * 돌려줌: { ok, error?, loads:[{key, ref, num, i, v, drop}], edges:[{kind, key, a, b, R, I, w, J, dT, loss}], maxDrop, loss, worst:{...}, floating }
 */
export function simulateNet(b, opts) {
  const { net, source, sourceV = 0, loads = [], cu = b.copperMm || OZ_MM, tempC = 25, plating = 0.02, spokes = 4 } = opts;
  const conn = opts.conn || analyzeConnectivity(b);
  const items = conn.items.filter((it) => it.net === net);
  const areas = conn.areas.filter((a) => a.net === net);
  if (!items.length) return { ok: false, error: '이 넷에 동박이 없습니다.' };
  const nodes = []; const index = new Map();
  const node = (key, at, layer) => { const k = `${key}`; if (!index.has(k)) { index.set(k, nodes.length); nodes.push({ key: k, at, layer }); } return index.get(k); };
  const edges = [];
  const edge = (a, b2, R, info) => { if (a !== b2) edges.push({ a, b: b2, R: Math.max(R, R_CONTACT), ...info }); };

  // 패드·비아 마디 (비아는 층마다)
  const padNode = new Map(), viaNode = new Map();
  for (const it of items) {
    if (it.kind === 'pad') padNode.set(it, node(it.key, it.pad.at, null));
    if (it.kind === 'via') {
      const ls = it.layers;
      ls.forEach((l) => viaNode.set(`${it.key}@${l}`, node(`${it.key}@${l}`, it.via.at, l)));
      for (let i = 1; i < ls.length; i++) edge(index.get(`${it.key}@${ls[i - 1]}`), index.get(`${it.key}@${ls[i]}`), viaR(it.via.drill, b.thickness / Math.max(1, ls.length - 1), plating), { kind: 'via', key: it.key, w: Math.PI * it.via.drill, len: b.thickness });
    }
  }
  // 트랙: 위에 닿은 점(다른 트랙 끝·비아·패드)으로 나눠 사슬로 잇는다
  const tracks = items.filter((it) => it.kind === 'track');
  const pointOn = (t, p) => pointSeg(p, t.track.a, t.track.b) <= t.track.w / 2 + 1e-6;
  for (const t of tracks) {
    const L = t.track.layer;
    const cuts = [{ s: 0, p: t.track.a }, { s: 1, p: t.track.b }];
    const len = dist(t.track.a, t.track.b);
    const param = (p) => { const c = closestOnSeg(p, t.track.a, t.track.b); return len > 0 ? dist(c, t.track.a) / len : 0; };
    for (const o of tracks) if (o !== t && o.track.layer === L) for (const e of [o.track.a, o.track.b]) if (pointOn(t, e)) cuts.push({ s: param(e), p: closestOnSeg(e, t.track.a, t.track.b) });
    for (const v of items.filter((x) => x.kind === 'via' && x.layers.includes(L))) if (gap(v.shape, t.shape) <= 1e-6) cuts.push({ s: param(v.via.at), p: closestOnSeg(v.via.at, t.track.a, t.track.b), via: v });
    for (const p of items.filter((x) => x.kind === 'pad' && x.layers.includes(L))) if (gap(p.shape, t.shape) <= 1e-6) cuts.push({ s: param(p.pad.at), p: closestOnSeg(p.pad.at, t.track.a, t.track.b), pad: p });
    cuts.sort((x, y) => x.s - y.s);
    let prev = null;
    for (const c of cuts) {
      const id = node(`${L}@${posKey(c.p)}`, c.p, L);
      if (c.via) edge(id, index.get(`${c.via.key}@${L}`), R_CONTACT, { kind: 'contact' });
      if (c.pad) edge(id, padNode.get(c.pad), R_CONTACT, { kind: 'contact' });
      if (prev && c.s > prev.s + 1e-9) {
        const segLen = (c.s - prev.s) * len;
        edge(prev.id, id, trackR(segLen, t.track.w, { cu, tempC }), { kind: 'track', key: t.key, w: t.track.w, len: segLen, layer: L });
      }
      prev = { ...c, id };
    }
  }
  // 동박면: 닿은 점을 모아 가까운 4곳끼리 퍼짐 저항으로 잇는다. 서멀 연결 패드는 스포크 저항을 거친다
  const Rs = sheetR(cu);
  for (const A of areas) {
    const contacts = [];
    for (const it of items) {
      if (!it.layers.includes(A.layer)) continue;
      if (it.kind === 'pad' && inPoly(it.pad.at, A.pts)) {
        const z = A.zone;
        const mode = it.pad.zoneConnect === 2 ? 'solid' : it.pad.zoneConnect === 1 ? 'thermal' : it.pad.zoneConnect === 0 ? 'none' : z.connect === 'thru_hole_only' ? (it.pad.type === 'thru_hole' ? 'thermal' : 'none') : z.connect;
        if (mode === 'none') continue;
        const r = Math.min(it.pad.size.w, it.pad.size.h) / 2;
        if (mode === 'thermal') {
          const zid = node(`${A.key}#${it.key}`, it.pad.at, A.layer);
          edge(padNode.get(it), zid, Rs * (z.thermalGap / (spokes * z.thermalBridge)), { kind: 'spoke', key: it.key, w: spokes * z.thermalBridge, len: z.thermalGap, layer: A.layer, ref: it.pad.ref, num: it.pad.num });
          contacts.push({ id: zid, at: it.pad.at, r: r + z.thermalGap });
        } else contacts.push({ id: padNode.get(it), at: it.pad.at, r });
      }
      if (it.kind === 'via' && inPoly(it.via.at, A.pts)) contacts.push({ id: index.get(`${it.key}@${A.layer}`), at: it.via.at, r: it.via.size / 2 });
    }
    for (const t of tracks.filter((x) => x.track.layer === A.layer)) for (const e of [t.track.a, t.track.b]) if (inPoly(e, A.pts) && index.has(`${A.layer}@${posKey(e)}`)) contacts.push({ id: index.get(`${A.layer}@${posKey(e)}`), at: e, r: t.track.w / 2 });
    const seen = new Set();
    contacts.forEach((c, i) => {
      const near = contacts.map((o, j) => ({ j, d: dist(c.at, o.at) })).filter((x) => x.j !== i).sort((x, y) => x.d - y.d).slice(0, 4);
      for (const { j, d } of near) {
        const k = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(k)) continue;
        seen.add(k);
        edge(c.id, contacts[j].id, spreadR(d, Math.max(c.r, contacts[j].r), cu), { kind: 'zone', key: A.key, layer: A.layer, len: d });
      }
    });
  }

  // 풀기: 공급 마디 전압 고정, 부하는 전류를 빼 간다
  const srcIt = items.find((it) => it.key === source);
  if (!srcIt) return { ok: false, error: '공급점 패드를 찾지 못했습니다.' };
  const s = padNode.get(srcIt);
  const loadNodes = loads.map((l) => ({ ...l, it: items.find((it) => it.key === l.key) })).filter((l) => l.it);
  // 공급점과 이어진 마디만 푼다
  const adj = nodes.map(() => []);
  edges.forEach((e, k) => { adj[e.a].push([e.b, k]); adj[e.b].push([e.a, k]); });
  const reach = new Set([s]); const stack = [s];
  while (stack.length) { const u = stack.pop(); for (const [v] of adj[u]) if (!reach.has(v)) { reach.add(v); stack.push(v); } }
  const unknown = [...reach].filter((i) => i !== s);
  const col = new Map(unknown.map((id, i) => [id, i]));
  const rows = unknown.map(() => new Map());
  const rhs = new Float64Array(unknown.length);
  for (const e of edges) {
    if (!reach.has(e.a)) continue;
    const g = 1 / e.R;
    for (const [u, v] of [[e.a, e.b], [e.b, e.a]]) {
      if (u === s) continue;
      const r = rows[col.get(u)];
      r.set(-1, (r.get(-1) || 0) + g);
      if (v === s) rhs[col.get(u)] += g * sourceV; else r.set(col.get(v), (r.get(col.get(v)) || 0) - g);
    }
  }
  const floating = [];
  for (const l of loadNodes) {
    const id = padNode.get(l.it);
    if (!reach.has(id)) { floating.push(l.key); continue; }
    if (id !== s) rhs[col.get(id)] -= l.i;
  }
  const x = unknown.length ? solveCG(unknown.length, rows, rhs) : new Float64Array(0);
  const V = (id) => (id === s ? sourceV : col.has(id) ? x[col.get(id)] : null);
  const out = edges.filter((e) => reach.has(e.a)).map((e) => {
    const I = (V(e.a) - V(e.b)) / e.R;
    const a = Math.abs(I);
    return { ...e, at: [nodes[e.a].at, nodes[e.b].at], I: a, loss: a * a * e.R, J: e.w ? a / (e.w * cu) : null, dT: e.kind === 'track' || e.kind === 'spoke' ? tempRise(a, e.w, { cu }) : 0 };
  });
  const loadsOut = loadNodes.map((l) => { const v = V(padNode.get(l.it)); return { key: l.key, ref: l.it.pad?.ref, num: l.it.pad?.num, i: l.i, v, drop: v == null ? null : sourceV - v }; });
  const worst = (list, f) => list.reduce((m, e) => (f(e) > (m ? f(m) : -Infinity) ? e : m), null);
  // 트랙 key 별 최대 구간 전류 (검사에서 '구간 전류로 본 폭' 판정에 쓴다)
  const segCurrents = {};
  for (const e of out) if (e.kind === 'track') segCurrents[e.key] = Math.max(segCurrents[e.key] || 0, e.I);
  return {
    ok: true, source, sourceV, loads: loadsOut, edges: out, floating, segCurrents,
    maxDrop: Math.max(0, ...loadsOut.filter((l) => l.drop != null).map((l) => Math.abs(l.drop))),
    loss: out.reduce((s2, e) => s2 + e.loss, 0),
    hotTrack: worst(out.filter((e) => e.kind === 'track'), (e) => e.dT),
    hotSpoke: worst(out.filter((e) => e.kind === 'spoke'), (e) => e.dT),
    maxJ: worst(out.filter((e) => e.J != null), (e) => e.J),
    total: loadNodes.reduce((s2, l) => s2 + l.i, 0),
  };
}
