// 실제 회로도·PCB 내보내기 검산: 기능 목록 → 넷리스트 → KiCad 회로도·기판·DXF
// 실행: npm run check:hw
// KiCad 7(kicad-cli, pcbnew 파이썬)이 있으면 회로도를 KiCad 로 다시 읽어 넷리스트가 같은지, 기판을 열어 DRC 를 돌린다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildHardware, hwBom } from '../src/lib/hw/netlist.js';
import { toKicadPro, toDxf } from '../src/lib/hw/kicad.js';
import { buildHwPackage } from '../src/lib/hw/exportHw.js';
import { parse, kids, kid, str } from '../src/lib/hw/sexpr.js';
import { pinPlan, pinProblems, makeFeature } from '../src/lib/devkit/features.js';
import * as lib from '../src/lib/hw/kicadLib.data.js';

let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`✓ ${name}`); } else { fails.push(name); console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`); } };
const has = (cmd) => { try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; } };
const kicad = has('kicad-cli');
const pcbnewOk = (() => { try { execFileSync('/usr/bin/python3', ['-c', 'import pcbnew'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-'));

const F = (kind, name, extra = {}) => ({ ...makeFeature(kind, name), ...extra });
const lampFeatures = [
  F('light', '전면 기상등', { id: 'f_front', face: 'front', power_w: 5 }), F('light', '후면 수면등', { id: 'f_rear', face: 'rear', power_w: 1.8 }),
  F('display', '호박색 시계', { id: 'f_clock' }), F('encoder', '다이얼 버튼', { id: 'f_dial' }), F('switch', '수면 모드 토글', { id: 'f_sleep' }), F('button', '블루투스 버튼', { id: 'f_bt' }),
  F('temp', '전면 LED 판 온도', { id: 'f_ntc_f', watch: 'f_front' }), F('temp', '후면 LED 판 온도', { id: 'f_ntc_r', watch: 'f_rear' }),
];
const lampRules = [{ id: 'r1', type: 'schedule', src: 'f_sleep', dst: '*' }];
const humidFeatures = [F('heater', '후막 히터 48 W', { power_w: 48 }), F('water', '수위 감지'), F('temp', '히터 온도'), F('button', '전원 버튼'), F('button', '모드 버튼'), F('led', '동작 표시등'), F('tilt', '넘어짐 감지'), F('buzzer', '알림 부저')];
const toyFeatures = [F('battery', '배터리'), F('motor', '구동 모터'), F('servo', '팔 서보'), F('relay', '외부 릴레이'), F('analog', '볼륨 다이얼'), F('lid', '뚜껑'), F('button', '버튼'), F('custom', '명령')];

// 1. 핀 계획
{
  const c3 = pinPlan(lampFeatures, 'esp32c3', lampRules);
  const p3 = pinProblems(c3.features, 'esp32c3', c3.i2c);
  check('무니스 조명 기능(조명 2·시계·다이얼·토글·버튼·NTC 2)은 ESP32-C3 로는 핀이 모자라다고 알린다', p3.some((t) => /핀이 (없|남지)/.test(t)), p3.join(' / '));
  const s3 = pinPlan(lampFeatures, 'esp32s3', lampRules);
  check('ESP32-S3 면 시계 I2C·다이얼 A/B·표시 4핀까지 충돌 없이 배정', pinProblems(s3.features, 'esp32s3', s3.i2c).length === 0 && s3.i2c && s3.features.find((f) => f.kind === 'encoder').pins.a != null, JSON.stringify(s3.i2c));
}

const lampMd = { template: 'round_lamp', params: {} };
const cases = [
  { name: '무니스 조명 (S3 · 12 V · 원형 받침대, 한 기판)', key: 'lamp', dev: { mcu: 'esp32s3', supply_v: 12, features: lampFeatures, rules: lampRules, mold_design: lampMd }, tight: true },
  { name: '무니스 조명 (S3 · 12 V · LED 구동 기판 분리)', key: 'lamp2', dev: { mcu: 'esp32s3', supply_v: 12, features: lampFeatures, rules: lampRules, mold_design: lampMd, hw: { split: ['light'] } } },
  { name: '가열식 가습기 (C3 · 12 V · 사각 하우징)', key: 'humid', dev: { mcu: 'esp32c3', supply_v: 12, features: humidFeatures, mold_design: { template: 'box', params: { width: 140, depth: 110, pcb_w: 110, pcb_d: 80, usb: 'hole' } } } },
  { name: '배터리 장난감 (ESP32 클래식 · 5 V · 원통)', key: 'toy', dev: { mcu: 'esp32', supply_v: 5, features: toyFeatures, mold_design: { template: 'cylinder', params: { dia: 140, pcb_d: 110, outlet_d: 0 } } } },
  { name: '외장 없음 (기본 사각 기판)', key: 'plain', dev: { mcu: 'esp32c3', supply_v: 5, features: [F('button', '버튼'), F('led', 'LED')] } },
];

for (const cs of cases) {
  const pkg = buildHwPackage({ device_name: cs.key.toUpperCase(), ...cs.dev }, lib, { title: cs.key, seed: cs.key });
  const hw = pkg.hw;
  const refs = new Set(hw.comps.map((c) => c.ref));
  check(`${cs.name}: 부품 ${hw.comps.length}개·넷 ${hw.nets.size}개·기판 ${pkg.boards.length}장, 참조 번호 중복 없음, 한 곳만 연결된 넷 없음`, refs.size === hw.comps.length && !hw.notes.some((n) => /한 곳에만/.test(n)), hw.notes.join(' / '));
  const badPin = [];
  for (const c of hw.comps) {
    if (!c.part.sym) continue;
    const symPins = c.part.sym.startsWith('custom:') ? null : new Set(lib.SYMBOLS[c.part.sym].pins.map((p) => p.num));
    const pads = new Set(lib.FOOTPRINTS[c.part.fp].pads.map((p) => p.num));
    for (const pin of Object.keys(c.conns)) if ((symPins && !symPins.has(pin)) || !pads.has(pin)) badPin.push(`${c.ref}.${pin}`);
  }
  check(`${cs.name}: 연결한 핀이 모두 기호 핀·실장 패드 번호와 맞다`, badPin.length === 0, badPin.join(', '));
  const smt = pkg.bom.filter((r) => r.smt);
  check(`${cs.name}: 부품표 ${pkg.bom.length}줄, SMT ${smt.length}줄 중 LCSC 번호 ${smt.filter((r) => r.lcsc).length}줄`, pkg.bom.length > 5 && smt.every((r) => !r.lcsc || /^C\d+$/.test(r.lcsc)));
  if (pkg.boards.length > 1) {
    const link = hw.comps.filter((c) => c.block.startsWith('link_'));
    check(`${cs.name}: 두 기판을 잇는 커넥터가 양쪽에 같은 핀 배치로 있다 (${link[0]?.note})`, link.length === 2 && JSON.stringify(link[0].conns) === JSON.stringify(link[1].conns) && link[0].board !== link[1].board);
  }
  for (const b of pkg.boards) {
    const tag = `${cs.name}${pkg.boards.length > 1 ? ` [${b.name}]` : ''}`;
    const dxf = toDxf(b.layout);
    check(`${tag}: DXF 외곽 선 ${b.layout.outline.length}개 + 구멍 ${b.layout.holes.length}개 (mm)`, (dxf.match(/\nLINE\n8\nOUTLINE/g) || []).length === b.layout.outline.length && (dxf.match(/\nCIRCLE\n8\nHOLES/g) || []).length === b.layout.holes.length && /\$INSUNITS\n70\n4/.test(dxf));
    const pl = b.pcb.place;
    console.log(`   기판 ${b.layout.size.join('×')} mm, 면적 ${Math.round(b.layout.area)} mm², 부품 자리 합 ${Math.round(pl.usedArea)} mm² (${Math.round(pl.density * 100)} %), 뒷면 ${pl.bottom.length}개, 못 넣음 ${pl.outside.join(', ') || '없음'}${pl.clash.length ? `, 앵커 겹침 ${pl.clash.join(', ')}` : ''}`);
    if (cs.tight) check(`${tag}: 한 기판이면 부품이 넘친다고 알린다 (LED 구동 기판을 나누라는 근거)`, pl.outside.length > 0 || pl.density > 0.75);
    else check(`${tag}: 부품이 모두 기판 안에 들어가고 외장 구멍 자리끼리 겹치지 않는다`, pl.outside.length === 0 && pl.clash.length === 0, `${pl.outside.join(', ')} | ${pl.clash.join(', ')}`);
    const dir = path.join(tmp, b.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${b.slug}.kicad_sch`), b.sch.text);
    fs.writeFileSync(path.join(dir, `${b.slug}.kicad_pcb`), b.pcb.text);
    fs.writeFileSync(path.join(dir, `${b.slug}.kicad_pro`), toKicadPro(b.slug));
    if (kicad) {
      execFileSync('kicad-cli', ['sch', 'export', 'netlist', '-o', path.join(dir, 'k.net'), path.join(dir, `${b.slug}.kicad_sch`)], { stdio: 'ignore' });
      const net = parse(fs.readFileSync(path.join(dir, 'k.net'), 'utf8'))[0];
      const theirs = {};
      for (const n of kids(kid(net, 'nets'), 'net')) {
        const name = str(kid(n, 'name')[1]).replace(/^\//, '');
        const nodes = kids(n, 'node').map((x) => `${str(kid(x, 'ref')[1])}.${str(kid(x, 'pin')[1])}`).filter((x) => !x.startsWith('#'));
        if (nodes.length && !/^(unconnected|Net-)/.test(name)) theirs[name] = nodes.sort();
      }
      const diff = [];
      for (const [n, list] of b.hw.nets) if (JSON.stringify(list.map((x) => `${x.ref}.${x.pin}`).sort()) !== JSON.stringify(theirs[n] || [])) diff.push(n);
      const extra = Object.keys(theirs).filter((n) => !b.hw.nets.has(n));
      check(`${tag}: KiCad(kicad-cli)가 회로도에서 읽은 넷리스트가 만든 연결과 같다 (넷 ${b.hw.nets.size}개)`, diff.length === 0 && extra.length === 0, `${diff.join(',')} | ${extra.join(',')}`);
    }
    if (pcbnewOk) {
      const py = `
import sys, pcbnew, json
b = pcbnew.LoadBoard(sys.argv[1])
pcbnew.WriteDRCReport(b, sys.argv[2], pcbnew.EDA_UNITS_MILLIMETRES, False)
fps = list(b.GetFootprints())
print(json.dumps({"fps": len(fps), "netted": sum(1 for f in fps for p in f.Pads() if p.GetNetname()), "w": pcbnew.ToMM(b.GetBoardEdgesBoundingBox().GetWidth())}))
`;
      const res = JSON.parse(execFileSync('/usr/bin/python3', ['-c', py, path.join(dir, `${b.slug}.kicad_pcb`), path.join(dir, 'drc.rpt')]).toString().trim().split('\n').pop());
      const rpt = fs.readFileSync(path.join(dir, 'drc.rpt'), 'utf8');
      const kinds = {};
      for (const m of rpt.matchAll(/^\[(\w+)\]/gm)) kinds[m[1]] = (kinds[m[1]] || 0) + 1;
      // 같은 실장 모양 안의 문제(라이브러리 부품 자체의 구멍~패드 간격 등)는 빼고 센다
      const blocks = rpt.split(/\n(?=\[)/).filter((t) => /^\[(clearance|hole_clearance|copper_edge_clearance|solder_mask_bridge|drill_out_of_range|shorting_items)\]/.test(t));
      const hard = blocks.filter((t) => { const owners = [...t.matchAll(/ of ([A-Z]+\d+)/g)].map((m) => m[1]); return !(owners.length >= 2 && owners.every((o) => o === owners[0])); }).length;
      const pads = b.hw.comps.reduce((x, c) => x + Object.keys(c.conns).length, 0);
      check(`${tag}: KiCad(pcbnew)로 열림 — 실장 모양 ${res.fps}개, 넷 붙은 패드 ${res.netted}개, 외곽 폭 ${res.w.toFixed(1)} mm`, res.fps === b.hw.comps.filter((c) => c.part.fp).length + b.layout.holes.filter((h) => h.kind === 'mount').length && res.netted >= pads * 0.9);
      check(`${tag}: DRC 구리 간격·가장자리·솔더마스크 오류 ${hard}개 (2개 이하)`, hard <= 2, JSON.stringify(kinds));
    }
  }
}
if (!kicad || !pcbnewOk) console.log('  (KiCad 7 이 없어 KiCad 재검증은 건너뜀: apt install kicad kicad-symbols kicad-footprints)');
console.log(`\n${pass}개 검산 통과${fails.length ? `, ${fails.length}개 실패` : ''}`);
if (fails.length) process.exit(1);
