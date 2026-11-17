// 기판 제조 묶음 만들기 (GitHub Actions pcb.yml 과 로컬에서 같이 쓴다)
//   node scripts/pcb-package.mjs <요청.json> <출력 폴더> [freerouting.jar]
// 요청.json: { dev, title, seed }  (워크벤치 개발 설정 그대로)
// 기판마다: KiCad 프로젝트 → 자동 배선(Freerouting, 있으면) + GND 동박 → DRC → 거버·드릴 → JLCPCB 부품표·좌표(CPL) → zip
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as lib from '../src/lib/hw/kicadLib.data.js';
import { buildHwPackage, jlcBomCsv, fullBomCsv, readmeText } from '../src/lib/hw/exportHw.js';
import { toKicadPro, toDxf } from '../src/lib/hw/kicad.js';
import { makeZip } from '../src/lib/zipStore.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , reqPath, outDir, jar = ''] = process.argv;
const req = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
const pkg = buildHwPackage(req.dev, lib, { title: req.title || '', seed: req.seed || 'x', date: new Date().toISOString().slice(0, 10) });
fs.mkdirSync(outDir, { recursive: true });
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const read = (p) => new Uint8Array(fs.readFileSync(p));

/** KiCad 좌표 파일 → JLCPCB CPL (Designator, Mid X, Mid Y, Layer, Rotation) */
function jlcCpl(posCsv, smtRefs) {
  const lines = posCsv.trim().split('\n').slice(1).map((l) => l.split(',').map((x) => x.replace(/^"|"$/g, '')));
  const rows = [['Designator', 'Mid X', 'Mid Y', 'Layer', 'Rotation'], ...lines.filter((r) => smtRefs.has(r[0])).map((r) => [r[0], `${Number(r[3]).toFixed(3)}mm`, `${Number(r[4]).toFixed(3)}mm`, r[6] === 'bottom' ? 'Bottom' : 'Top', Number(r[5]).toFixed(1)])];
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}

const results = [];
for (const b of pkg.boards) {
  const dir = path.join(outDir, b.slug);
  fs.mkdirSync(path.join(dir, 'gerber'), { recursive: true });
  const pcbPath = path.join(dir, `${b.slug}.kicad_pcb`);
  fs.writeFileSync(path.join(dir, `${b.slug}.kicad_pro`), toKicadPro(b.slug));
  fs.writeFileSync(path.join(dir, `${b.slug}.kicad_sch`), b.sch.text);
  fs.writeFileSync(pcbPath, b.pcb.text);
  fs.writeFileSync(path.join(dir, `${b.slug}-outline.dxf`), toDxf(b.layout));
  // 배선 + GND 동박 + DRC
  execFileSync('python3', [path.join(here, 'pcb_route.py'), pcbPath, jar], { stdio: 'inherit' });
  const summary = JSON.parse(fs.readFileSync(path.join(dir, `${b.slug}-summary.json`), 'utf8'));
  // 거버·드릴·좌표
  const g = path.join(dir, 'gerber');
  execFileSync('kicad-cli', ['pcb', 'export', 'gerbers', '--layers', 'F.Cu,B.Cu,F.Paste,B.Paste,F.SilkS,B.SilkS,F.Mask,B.Mask,Edge.Cuts', '-o', `${g}/`, pcbPath], { stdio: 'ignore' });
  execFileSync('kicad-cli', ['pcb', 'export', 'drill', '--format', 'excellon', '--excellon-units', 'mm', '-o', `${g}/`, pcbPath], { stdio: 'ignore' });
  execFileSync('kicad-cli', ['pcb', 'export', 'pos', '--format', 'csv', '--units', 'mm', '--side', 'both', '-o', path.join(dir, 'pos.csv'), pcbPath], { stdio: 'ignore' });
  const smtRefs = new Set(b.bom.filter((r) => r.smt).flatMap((r) => r.refs));
  const cpl = jlcCpl(fs.readFileSync(path.join(dir, 'pos.csv'), 'utf8'), smtRefs);
  const gerbers = fs.readdirSync(g).map((f) => ({ name: f, data: read(path.join(g, f)) }));
  fs.writeFileSync(path.join(dir, `${b.slug}-gerber.zip`), makeZip(gerbers));
  fs.writeFileSync(path.join(dir, `${b.slug}-bom-jlcpcb.csv`), jlcBomCsv(b.bom));
  fs.writeFileSync(path.join(dir, `${b.slug}-cpl-jlcpcb.csv`), cpl);
  results.push({ key: b.key, slug: b.slug, name: b.name, size: b.layout.size, ...summary, gerbers: gerbers.length });
}
// 전체 묶음 (워크벤치가 받는 파일 하나)
const files = [];
for (const r of results) {
  const dir = path.join(outDir, r.slug);
  for (const f of fs.readdirSync(dir)) if (!fs.statSync(path.join(dir, f)).isDirectory() && f !== 'pos.csv' && !/\.(dsn|ses)$/.test(f)) files.push({ name: `${r.slug}/${f}`, data: read(path.join(dir, f)) });
}
files.push({ name: 'bom-all.csv', data: new TextEncoder().encode(fullBomCsv(pkg.bom)) });
files.push({ name: 'README.txt', data: new TextEncoder().encode(`${readmeText(pkg, req.title || '')}\n[제조 묶음]\n${results.map((r) => `- ${r.name} (${r.slug}/): ${r.routed ? `자동 배선 ${r.tracks}개 선·비아 ${r.vias}개, 남은 미연결 ${r.unconnected}개` : '배선 안 함 (KiCad 에서 배선하세요)'} · 거버 ${r.gerbers}개 파일 · ${r.slug}-gerber.zip / -bom-jlcpcb.csv / -cpl-jlcpcb.csv 를 JLCPCB 에 올립니다.`).join('\n')}\n`) });
files.push({ name: 'summary.json', data: new TextEncoder().encode(JSON.stringify(results, null, 1)) });
fs.writeFileSync(path.join(outDir, 'pcb-package.zip'), makeZip(files));
console.log(JSON.stringify(results.map(({ router_log: _r, ...x }) => x)));
