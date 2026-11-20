// PCB 아트웍 검산: .kicad_pcb 읽기·쓰기·편집, 연결성(미연결·합선), 아트웍 검사(제조·전기 규칙), 기판 시뮬레이션(전압 강하·온도), IPC 기준식
// 실행: npm run check:pcb-art
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as lib from '../src/lib/hw/kicadLib.data.js';
import { buildHwPackage } from '../src/lib/hw/exportHw.js';
import { parseBoard, toKicadText, placeFootprint, flipFootprint, addTrack, addVia, removeItems, allPads, netId, keepouts, boardStats } from '../src/lib/pcbArt/board.js';
import { analyzeConnectivity } from '../src/lib/pcbArt/connectivity.js';
import { runDrc, guessNetRules, padConnection, drcCounts } from '../src/lib/pcbArt/drc.js';
import { simulateNet, padKey, defaultSource, defaultLoads } from '../src/lib/pcbArt/sim.js';
import { widthForCurrent, tempRise, trackR, viaR, clearanceForVoltage, microstripZ0, widthForZ0, guessNet } from '../src/lib/pcbArt/ipc.js';
import { rot, gap, arcPoints, chainLoops } from '../src/lib/pcbArt/geom.js';
import { boardsFromZip } from '../src/lib/pcbArt/zipRead.js';
import { makeZip } from '../src/lib/zipStore.js';
import zlib from 'node:zlib';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const near = (a, b, t, msg = '') => assert.ok(Math.abs(a - b) <= t, `${msg} ${a} ≠ ${b} ± ${t}`);

// 작은 시험 기판 만들기
const pad = (num, x, y, w, h, layer, net, extra = '') => `(pad "${num}" smd rect (at ${x} ${y}) (size ${w} ${h}) (layers "${layer}") ${net ? `(net ${net})` : ''} ${extra})`;
const fpT = (ref, x, y, r, pads, layer = 'F.Cu') => `(footprint "T:${ref}" (layer "${layer}") (at ${x} ${y} ${r}) (property "Reference" "${ref}") ${pads})`;
const board = (body, nets = ['GND', '+5V', 'SIG', 'EP_OUT']) => `(kicad_pcb (version 20221018) (general (thickness 1.6))
 (layers (0 "F.Cu" signal) (31 "B.Cu" signal) (44 "Edge.Cuts" user))
 (net 0 "") ${nets.map((x, i) => `(net ${i + 1} "${x}")`).join(' ')}
 (gr_rect (start 0 0) (end 60 40) (stroke (width 0.1) (type default)) (layer "Edge.Cuts"))
 ${body})`;

ok('기하: KiCad 회전(화면 반시계), 도형 사이 거리, 원호, 외곽 고리', () => {
  assert.deepEqual(rot([1, 0], 90).map((v) => Math.round(v * 1e9) / 1e9), [0, -1]);
  near(gap({ kind: 'cap', a: [0, 0], b: [10, 0], r: 0.5 }, { kind: 'cap', a: [5, 2], b: [5, 2], r: 0.5 }), 1, 1e-9);
  near(gap({ kind: 'poly', pts: [[0, 0], [2, 0], [2, 2], [0, 2]] }, { kind: 'cap', a: [3, 1], b: [3, 1], r: 0.25 }), 0.75, 1e-9);
  const arc = arcPoints([1, 0], [0, -1], [-1, 0], 4);
  assert.ok(arc.every((p) => Math.abs(Math.hypot(p[0], p[1]) - 1) < 1e-9) && arc[2][1] < 0, '중간점을 지나는 쪽으로');
  assert.equal(chainLoops([[[0, 0], [1, 0]], [[1, 1], [1, 0]], [[1, 1], [0, 1]], [[0, 1], [0, 0]]])[0].length, 4);
});

// 워크벤치가 만드는 실제 기판
const req = JSON.parse(fs.readFileSync(new URL('./pcb-sample.json', import.meta.url), 'utf8'));
const pkg = buildHwPackage(req.dev, lib, { title: req.title || '', seed: 'x', date: '2026-11-19' });
const real = parseBoard(pkg.boards[0].pcb.text);

ok('워크벤치 기판 읽기: 부품·패드·넷·외곽·안테나 금지 구역, 다시 써도 같다', () => {
  const st = boardStats(real);
  assert.ok(st.parts > 30 && st.nets > 20 && st.w > 40, JSON.stringify(st));
  assert.ok(allPads(real).filter((p) => p.net).length > 100);
  assert.ok(real.outline[0].length > 10, '바깥 외곽');
  assert.ok(keepouts(real).some((k) => k.ref && k.keepout.tracks === 'not_allowed'), 'ESP32 안테나 금지 구역 (부품 좌표 → 기판 좌표)');
  const back = parseBoard(toKicadText(real));
  assert.deepEqual(allPads(back).map((p) => [p.at, p.net, p.drill?.w]), allPads(real).map((p) => [p.at, p.net, p.drill?.w]));
  assert.ok(allPads(real).some((p) => p.drill && p.drill.w > 0.5), '구멍 크기(글자로 된 수)도 읽는다');
});

ok('편집: 이동·회전(패드가 따라 돎)·뒤집기 두 번이면 제자리·트랙/비아 추가·삭제', () => {
  const b = parseBoard(board(fpT('R1', 20, 20, 0, `${pad(1, -1, 0, 0.6, 0.6, 'F.Cu', 3)} ${pad(2, 1, 0, 0.6, 0.6, 'F.Cu', 3)}`)));
  const r = placeFootprint(b, 0, { rot: 90 });
  assert.deepEqual(r.footprints[0].pads.map((p) => p.at.map((v) => Math.round(v * 1000) / 1000)), [[20, 21], [20, 19]], '90° 반시계: 오른쪽 패드가 위로');
  assert.deepEqual(parseBoard(toKicadText(r)).footprints[0].pads.map((p) => p.angle), [90, 90], '파일에 패드 각도도 같이');
  const f = flipFootprint(b, 0);
  assert.equal(f.footprints[0].side, 'B'); assert.deepEqual(f.footprints[0].pads[0].layers, ['B.Cu']);
  assert.deepEqual(flipFootprint(f, 0).footprints[0].pads.map((p) => p.at), b.footprints[0].pads.map((p) => p.at));
  let e = addTrack(b, { a: [19, 20], b: [10, 20], w: 0.25, layer: 'F.Cu', net: 3 });
  e = addVia(e, { at: [10, 20], net: 3 });
  const txt = toKicadText(e);
  assert.ok(txt.includes('(segment') && txt.includes('(via'));
  assert.equal(removeItems(e, [e.tracks[0].id]).tracks.length, 0);
});

ok('연결성: 미연결 선이 트랙으로 줄고, 다른 넷을 가로지르면 합선', () => {
  const c = analyzeConnectivity(real);
  assert.ok(c.unrouted.length > 50 && c.shorts.length === 0);
  const b = parseBoard(board(`${fpT('R1', 10, 10, 0, `${pad(1, -1, 0, 0.6, 0.6, 'F.Cu', 3)} ${pad(2, 1, 0, 0.6, 0.6, 'F.Cu', 1)}`)} ${fpT('R2', 30, 10, 0, `${pad(1, -1, 0, 0.6, 0.6, 'F.Cu', 3)} ${pad(2, 1, 0, 0.6, 0.6, 'F.Cu', 2)}`)}`));
  assert.equal(analyzeConnectivity(b).unrouted.filter((u) => u.net === 3).length, 1);
  const routed = addTrack(b, { a: [9, 10], b: [29, 10], w: 0.25, layer: 'F.Cu', net: 3 });
  const c2 = analyzeConnectivity(routed);
  assert.equal(c2.unrouted.filter((u) => u.net === 3).length, 0);
  assert.equal(c2.shorts.length, 1, 'R1 2번(GND) 위를 지나감');
});

ok('IPC 기준식: 전류 폭(1 A ≈ 0.3 mm), 온도 상승, 저항, 고전압 간격, 50 Ω 폭, 넷 이름 짐작', () => {
  near(widthForCurrent(1), 0.3, 0.01); near(widthForCurrent(3), 1.37, 0.02);
  near(tempRise(1, widthForCurrent(1)), 10, 1e-6, '역함수');
  near(trackR(10, 0.25) * 1000, 20, 0.1, 'mΩ');
  near(viaR(0.3) * 1000, 1.37, 0.05, 'mΩ');
  assert.deepEqual([5, 40, 200, 400, 1000].map(clearanceForVoltage), [0.1, 0.6, 1.25, 2.5, 5]);
  near(microstripZ0({ w: widthForZ0(50, { h: 1.5 }), h: 1.5 }), 50, 0.1);
  assert.deepEqual(['GND', '3V3', '+12V', 'VBUS', 'EP_OUT', 'NET-(R1-PAD2)'].map((x) => guessNet(x).kind), ['gnd', 'power', 'power', 'power', 'hv', 'signal']);
  assert.equal(guessNet('3V3').v, 3.3);
});

ok('검사(제조): 가는 트랙·작은 비아·간격·가장자리·끝이 뜬 트랙·금지 구역', () => {
  const body = `${fpT('R1', 10, 10, 0, `${pad(1, -1, 0, 0.6, 0.6, 'F.Cu', 3)} ${pad(2, 1, 0, 0.6, 0.6, 'F.Cu', 1)}`)}
   (segment (start 9 10) (end 9 20) (width 0.1) (layer "F.Cu") (net 3))
   (segment (start 11 10) (end 11 20) (width 0.2) (layer "F.Cu") (net 1))
   (segment (start 9.25 25) (end 9.25 30) (width 0.2) (layer "F.Cu") (net 2))
   (segment (start 0.1 5) (end 5 5) (width 0.2) (layer "F.Cu") (net 2))
   (via (at 30 30) (size 0.45) (drill 0.2) (layers "F.Cu" "B.Cu") (net 2))
   (zone (net 0) (net_name "") (layers "F.Cu" "B.Cu") (hatch edge 0.5) (connect_pads (clearance 0)) (min_thickness 0.25) (keepout (tracks not_allowed) (vias not_allowed) (pads allowed) (copperpour not_allowed) (footprints allowed)) (fill (thermal_gap 0.5) (thermal_bridge_width 0.5)) (polygon (pts (xy 25 25) (xy 35 25) (xy 35 35) (xy 25 35))))`;
  const codes = runDrc(parseBoard(board(body))).map((x) => x.code);
  for (const c of ['track_width', 'via_drill', 'annular', 'edge', 'dangling', 'keepout']) assert.ok(codes.includes(c), `${c} 를 찾아야 함: ${codes.join(',')}`);
  const clear = runDrc(parseBoard(board(`(segment (start 10 10) (end 20 10) (width 0.2) (layer "F.Cu") (net 1)) (segment (start 10 10.3) (end 20 10.3) (width 0.2) (layer "F.Cu") (net 2))`)));
  assert.ok(clear.some((x) => x.code === 'clearance'), '0.1 mm 간격');
});

ok('검사(전기): 고전압 간격, 전류 대비 폭, 디커플링 거리', () => {
  const src = board(`(segment (start 10 10) (end 20 10) (width 0.3) (layer "F.Cu") (net 4)) (segment (start 10 10.8) (end 20 10.8) (width 0.3) (layer "F.Cu") (net 1))
   ${fpT('U1', 40, 20, 0, pad(1, 0, 0, 0.6, 0.6, 'F.Cu', 2))} ${fpT('C1', 50, 20, 0, `${pad(1, 0, 0, 0.6, 0.6, 'F.Cu', 2)} ${pad(2, 1, 0, 0.6, 0.6, 'F.Cu', 1)}`)}`);
  const b = parseBoard(src);
  const rules = { ...guessNetRules(b), 4: { kind: 'hv', v: 200, i: 0 }, 1: { kind: 'gnd', v: 0, i: 2 } };
  const r = runDrc(b, { rules });
  const hv = r.find((x) => x.code === 'hv_clearance');
  assert.ok(hv && /1\.25 mm/.test(hv.title), '200 V 는 1.25 mm');
  assert.ok(r.some((x) => x.code === 'current_width' && x.net === 1), 'GND 2 A 에 0.3 mm');
  assert.ok(r.some((x) => x.code === 'decoupling_far'), 'U1 ↔ C1 10 mm');
});

// 트랜스포머 접지 핀: 동박면에 서멀 스포크로만 붙은 경우 (N30 같은 문제)
const tBoard = (connect, extra = '') => board(`${fpT('T1', 20, 20, 0, `${pad(1, 0, 0, 2, 2, 'F.Cu', 1)} ${pad(2, 6, 0, 2, 2, 'F.Cu', 2)}`)} ${fpT('J1', 50, 20, 0, `${pad(1, 0, 0, 2, 2, 'F.Cu', 1)} ${pad(2, 0, 4, 2, 2, 'F.Cu', 2)}`)}
   (zone (net 1) (net_name "GND") (layer "F.Cu") (hatch edge 0.5) (connect_pads ${connect} (clearance 0.3)) (min_thickness 0.25) (fill yes (thermal_gap 0.5) (thermal_bridge_width 0.3))
     (polygon (pts (xy 10 10) (xy 58 10) (xy 58 30) (xy 10 30))) (filled_polygon (layer "F.Cu") (pts (xy 10 10) (xy 58 10) (xy 58 30) (xy 10 30))))
   (segment (start 26 20) (end 50 24) (width 1.5) (layer "F.Cu") (net 2)) ${extra}`);

ok('검사(전기): 큰 전류 핀이 서멀 스포크로만 → 약함(오류), 비아·트랙 더하면 해결', () => {
  const b = parseBoard(tBoard(''));
  const rules = { ...guessNetRules(b), 1: { kind: 'gnd', v: 0, i: 3 } };
  const conn = analyzeConnectivity(b);
  const c = padConnection(b, conn, b.footprints[0].pads[0]);
  assert.deepEqual([c.zoneMode, c.eff], ['thermal', 1.2], '스포크 4 × 0.3 mm');
  const r = runDrc(b, { rules, conn });
  const weak = r.find((x) => x.code === 'weak_power_pin' && /T1 1번/.test(x.title));
  assert.ok(weak && /1\.37 mm/.test(weak.detail), weak?.detail);
  const fixed = parseBoard(tBoard('yes'));
  assert.ok(!runDrc(fixed, { rules }).some((x) => x.code === 'weak_power_pin' && /T1/.test(x.title)), '꽉 연결이면 통과');
});

ok('시뮬레이션: 트랙·비아 사슬이 손 계산과 같다 (1 A)', () => {
  const b = parseBoard(board(`${fpT('J1', 5, 5, 0, pad(1, 0, 0, 1, 1, 'F.Cu', 2))} ${fpT('U1', 15, 25, 0, pad(1, 0, 0, 1, 1, 'B.Cu', 2), 'B.Cu')}
    (segment (start 5 5) (end 15 5) (width 0.5) (layer "F.Cu") (net 2)) (via (at 15 5) (size 0.6) (drill 0.3) (layers "F.Cu" "B.Cu") (net 2))
    (segment (start 15 5) (end 15 25) (width 1) (layer "B.Cu") (net 2))`));
  const [j, u] = b.footprints.map((f) => f.pads[0]);
  const r = simulateNet(b, { net: 2, source: padKey(j), sourceV: 5, loads: [{ key: padKey(u), i: 1 }] });
  near(r.loads[0].drop, trackR(10, 0.5) + viaR(0.3) + trackR(20, 1), 2e-5);
  near(r.loss, r.loads[0].drop * 1, 1e-6, '손실 = 강하 × 전류');
  assert.equal(r.hotTrack.w, 0.5, '가는 쪽이 더 뜨겁다');
  near(r.hotTrack.dT, tempRise(1, 0.5), 1e-6);
  // T 자로 붙은 트랙: 가운데에서 나뉘어 두 부하로
  const t = parseBoard(board(`${fpT('J1', 5, 5, 0, pad(1, 0, 0, 1, 1, 'F.Cu', 2))} ${fpT('A1', 25, 5, 0, pad(1, 0, 0, 1, 1, 'F.Cu', 2))} ${fpT('B1', 15, 15, 0, pad(1, 0, 0, 1, 1, 'F.Cu', 2))}
    (segment (start 5 5) (end 25 5) (width 0.5) (layer "F.Cu") (net 2)) (segment (start 15 5) (end 15 15) (width 0.5) (layer "F.Cu") (net 2))`));
  const [J, A, B] = t.footprints.map((f) => f.pads[0]);
  const rt = simulateNet(t, { net: 2, source: padKey(J), sourceV: 5, loads: [{ key: padKey(A), i: 0.5 }, { key: padKey(B), i: 0.5 }] });
  near(rt.loads[0].drop, trackR(10, 0.5) * 1 + trackR(10, 0.5) * 0.5, 2e-5, 'A: 앞 10 mm 1 A + 뒤 10 mm 0.5 A');
  near(rt.loads[1].drop, rt.loads[0].drop, 2e-5, 'B 도 같은 거리');
});

ok('시뮬레이션: 서멀 스포크가 꽉 연결보다 강하·온도가 크고, 구간 전류로 검사', () => {
  const run = (mode) => {
    const b = parseBoard(tBoard(mode));
    const src = defaultSource(b, 1);
    assert.match(src, /^p:J1:/, '공급점은 커넥터');
    const loads = defaultLoads(b, 1, src, 3);
    assert.deepEqual(loads.map((l) => l.ref), ['T1']);
    return { b, r: simulateNet(b, { net: 1, source: src, sourceV: 0, loads }) };
  };
  const th = run(''), so = run('yes');
  assert.ok(th.r.ok && so.r.ok);
  const t1Spoke = th.r.edges.find((e) => e.kind === 'spoke' && e.ref === 'T1');
  assert.ok(t1Spoke && t1Spoke.dT > 10 && th.r.hotSpoke.dT >= t1Spoke.dT, `T1 스포크 온도 ${t1Spoke?.dT} (3 A 가 0.3 mm × 4 로)`);
  assert.ok(th.r.maxDrop > so.r.maxDrop * 1.2, `서멀 ${th.r.maxDrop} vs 꽉 ${so.r.maxDrop}`);
  assert.ok(!so.r.hotSpoke);
  // 시뮬레이션 구간 전류를 검사에 넣으면 '구간 전류로 본' 폭 판정
  const b2 = parseBoard(board(`${fpT('J1', 5, 5, 0, pad(1, 0, 0, 1, 1, 'F.Cu', 2))} ${fpT('U1', 25, 5, 0, pad(1, 0, 0, 1, 1, 'F.Cu', 2))} (segment (start 5 5) (end 25 5) (width 0.2) (layer "F.Cu") (net 2))`));
  const [j, u] = b2.footprints.map((f) => f.pads[0]);
  const r2 = simulateNet(b2, { net: 2, source: padKey(j), sourceV: 5, loads: [{ key: padKey(u), i: 2 }] });
  const d = runDrc(b2, { segCurrents: r2.segCurrents }).find((x) => x.code === 'current_width');
  assert.ok(d && d.sev === 'error' && /2 A/.test(d.title));
});

ok('시뮬레이션: 공급점과 끊긴 부하는 따로 알린다', () => {
  const b = parseBoard(board(`${fpT('J1', 5, 5, 0, pad(1, 0, 0, 1, 1, 'F.Cu', 2))} ${fpT('U1', 25, 5, 0, pad(1, 0, 0, 1, 1, 'F.Cu', 2))}`));
  const [j, u] = b.footprints.map((f) => f.pads[0]);
  const r = simulateNet(b, { net: 2, source: padKey(j), sourceV: 5, loads: [{ key: padKey(u), i: 1 }] });
  assert.deepEqual(r.floating, [padKey(u)]);
  assert.equal(r.loads[0].v, null);
});

ok('실제 기판 전체 검사가 빠르다 (부품 50여 개)', () => {
  const t0 = performance.now();
  const r = runDrc(real, { rules: guessNetRules(real) });
  const ms = performance.now() - t0;
  assert.ok(ms < 2000, `${ms} ms`);
  const cnt = drcCounts(r);
  assert.ok(cnt.error > 0 && r.some((x) => x.code === 'unrouted'), '배선 전이라 미연결');
  assert.equal(netId(real, 'GND') > 0, true);
});


// zip: 저장(무압축)·deflate·안쪽 zip
{
  const enc = (x) => new TextEncoder().encode(x);
  const inner = makeZip([{ name: 'b/b.kicad_pcb', data: enc('(kicad_pcb B)') }]);
  const outer = makeZip([{ name: 'README.txt', data: enc('x') }, { name: 'a/a.kicad_pcb', data: enc('(kicad_pcb A)') }, { name: 'a/a-gerber.zip', data: makeZip([{ name: 'x.gbr', data: enc('G') }]) }, { name: 'inner.zip', data: inner }]);
  const got = await boardsFromZip(outer);
  assert.deepEqual(got.map((x) => [x.name, x.text]), [['a/a.kicad_pcb', '(kicad_pcb A)'], ['inner.zip/b/b.kicad_pcb', '(kicad_pcb B)']], '거버 zip 은 열지 않는다');
  const raw = enc('(kicad_pcb D)'), def = zlib.deflateRawSync(raw), name = enc('d.kicad_pcb');
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(def.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(def.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(name.length, 28);
  const body = Buffer.concat([lh, name, def]);
  const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(1, 8); eo.writeUInt16LE(1, 10); eo.writeUInt32LE(46 + name.length, 12); eo.writeUInt32LE(body.length, 16);
  assert.deepEqual((await boardsFromZip(new Uint8Array(Buffer.concat([body, cd, name, eo])))).map((x) => x.text), ['(kicad_pcb D)'], 'deflate 압축 zip (다른 도구가 만든 zip)');
  n++; console.log('✓ zip 에서 기판 파일 꺼내기: 무압축·deflate·안쪽 zip, 거버 zip 은 건너뜀');
}

console.log(`\n${n}개 검산 통과`);
