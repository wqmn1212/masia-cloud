// 회로도·기판 내보내기 한 번에: 기능 설정(dev) → 넷리스트 → 기판 외곽(금형용 설계) → KiCad·DXF·부품표 파일
import { buildHardware, hwBom, boardView, BOARD_NAME } from './netlist.js';
import { toKicadSch, toKicadPcb, toKicadPro, toDxf } from './kicad.js';
import { pcbLayout, defaultLayout } from '../cad/pcbLayout.js';

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const projectSlug = (title) => (String(title || 'aegis').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 32) || 'aegis');

/** JLCPCB 조립용 부품표 (Comment, Designator, Footprint, LCSC Part #) — SMT 부품만 */
export function jlcBomCsv(bom) {
  const rows = [['Comment', 'Designator', 'Footprint', 'LCSC Part #'], ...bom.filter((r) => r.smt).map((r) => [r.value, r.refs.join(','), r.footprint, r.lcsc])];
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}
/** 전체 부품표 (손으로 다는 부품 포함, 사람이 읽는 용) */
export function fullBomCsv(bom) {
  const rows = [['참조', '수량', '값', '실장 모양', 'LCSC', '구분', 'SMT', '찾을 이름', '설명'], ...bom.map((r) => [r.refs.join(','), r.qty, r.value, r.footprint, r.lcsc, r.lcsc_type === 'BASIC' ? '기본' : r.lcsc_type === 'EXTENDED' ? '확장' : '', r.smt ? 'Y' : '수작업', r.search, r.desc])];
  return `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}

export function buildHwPackage(dev, lib, { title = '', seed = 'x', date = '' } = {}) {
  const md = dev?.mold_design;
  const tplLayout = md?.template ? pcbLayout(md.template, md.params) : null;
  const sideways = (tplLayout?.anchors || []).filter((a) => a.sideways).map((a) => a.kind);
  const split = dev?.hw?.split || [];
  const hw = buildHardware(dev, { symbols: lib.SYMBOLS, sideways, split, compact: !!tplLayout && tplLayout.area < 4500, lcsc: dev?.hw?.lcsc || {} });
  const slug = projectSlug(dev?.device_name || title);
  // KiCad 기본 글꼴에는 한글이 없어 제목은 장치 이름(영문)으로
  const kTitle = /^[\x20-\x7e]+$/.test(title) ? title : `${dev?.device_name || slug}`;
  const areaOf = (comps) => comps.reduce((s, c) => { const b = c.part.fp && lib.FOOTPRINTS[c.part.fp]?.bbox; return s + (b ? (b[2] - b[0]) * (b[3] - b[1]) : 0); }, 0);
  const boards = hw.boards.map((key) => {
    const view = boardView(hw, key);
    const layout = key === 'main' && tplLayout ? tplLayout : defaultLayout(areaOf(view.comps));
    if (key === 'aux') layout.notes = ['LED 구동 기판은 본체 안(LED 판 가까이)에 둡니다. 외곽은 부품 면적에 맞춘 사각이니 본체 안 자리에 맞춰 바꾸세요.'];
    const bslug = key === 'main' ? slug : `${slug}-led-driver`;
    const t = `${kTitle} ${key === 'main' ? 'control board' : 'LED driver board'}`;
    const sch = toKicadSch(view, lib, { title: t, project: bslug, seed: `${seed}|${key}`, date });
    const pcb = toKicadPcb(view, lib, layout, { schPlaced: sch.placed, project: bslug, seed: `${seed}|${key}`, title: t });
    return { key, name: BOARD_NAME[key], hw: view, layout, sch, pcb, bom: hwBom(view), slug: bslug };
  });
  const main = boards[0];
  return { hw, boards, layout: main.layout, sch: main.sch, pcb: main.pcb, bom: hwBom(hw), slug, split };
}

export function readmeText(pkg, title) {
  const { hw, layout, pcb, bom } = pkg;
  const L = [`${title} — 제어 기판 설계 초안 (AEGIS 개발 워크벤치)`, '', '[파일]',
    `- ${pkg.slug}.kicad_pro / .kicad_sch / .kicad_pcb : KiCad 7 이상에서 프로젝트 파일을 엽니다.${pkg.boards.length > 1 ? ' 기판이 둘이라 폴더마다 프로젝트가 하나씩 있습니다.' : ''}`,
    '  회로도와 기판이 연결되어 있어, 기판에서 배선(라우팅)만 하면 됩니다. 부품은 외곽 안에 임시로 늘어놓았습니다.',
    `- ${pkg.slug}-outline.dxf : 기판 외곽·구멍·외장 구멍 자리 (mm, ${layout.source})`,
    `- ${pkg.slug}-bom-jlcpcb.csv : JLCPCB SMT 조립 부품표 (LCSC 번호가 빈 줄은 PCB 부품 탭에서 확정)`,
    `- ${pkg.slug}-bom.csv : 전체 부품표 (손으로 다는 커넥터·스위치 포함)`, '',
    '[요약]', `- MCU ${hw.module} · 입력 ${hw.supplyV} V · 부품 ${hw.comps.length}개 · 넷 ${hw.nets.size}개 · 부품표 ${bom.length}줄`,
    `- 기판 ${layout.size.join(' × ')} mm, 부품 자리 합 ${Math.round(pcb.place.usedArea)} mm² / 기판 ${Math.round(layout.area)} mm² (${Math.round(pcb.place.density * 100)} %)`,
    `- 뒷면에 놓은 부품 ${pcb.place.bottom.length}개${pcb.place.outside.length ? ` · 기판에 못 넣은 부품: ${pcb.place.outside.join(', ')} (기판 오른쪽 밖에 둠)` : ''}`,
    ...pkg.boards.slice(1).map((b) => `- ${b.name} (${b.slug}/): ${b.layout.size.join(' × ')} mm, 부품 ${b.hw.comps.length}개 — 두 기판은 커넥터로 잇습니다 (${hw.comps.filter((c) => c.block === 'link_main').map((c) => c.note).join('')})`), '',
    '[GPIO]', ...hw.pinMap.map((p) => `- GPIO${p.gpio} → ${p.net} (${p.role})`)];
  const notes = [...hw.notes, ...layout.notes, ...(pcb.place.clash.length ? [`외장 구멍 자리에 맞춘 부품끼리 겹칩니다: ${pcb.place.clash.join(', ')} — 3D 도면에서 구멍 위치를 벌리거나 부품을 바꾸세요.`] : []),
    'ESP32 모듈 안테나 쪽은 기판 가장자리에 두고 아래·옆에 구리를 두지 마세요 (금지 구역을 작은 기판에 맞춰 줄여 잡았습니다).',
    '값은 데이터시트 권장 회로 기준 초안입니다. 발주 전에 회로 설계자가 검토하세요.'];
  L.push('', '[확인할 것]', ...notes.map((n) => `- ${n}`));
  if (hw.offboard.length) { L.push('', '[별도 기판]'); hw.offboard.forEach((o) => { L.push(`- ${o.name}: ${o.note}`); o.parts.forEach(([n, q]) => L.push(`  · ${n} × ${q}`)); }); }
  return `${L.join('\n')}\n`;
}

export function hwFiles(pkg, title) {
  const enc = new TextEncoder();
  const s = pkg.slug;
  const files = [];
  for (const b of pkg.boards) {
    const dir = pkg.boards.length > 1 ? `${s}/${b.slug}` : s;
    files.push(
      { name: `${dir}/${b.slug}.kicad_pro`, data: enc.encode(toKicadPro(b.slug)) },
      { name: `${dir}/${b.slug}.kicad_sch`, data: enc.encode(b.sch.text) },
      { name: `${dir}/${b.slug}.kicad_pcb`, data: enc.encode(b.pcb.text) },
      { name: `${dir}/${b.slug}-outline.dxf`, data: enc.encode(toDxf(b.layout)) },
      { name: `${dir}/${b.slug}-bom-jlcpcb.csv`, data: enc.encode(jlcBomCsv(b.bom)) },
    );
  }
  files.push({ name: `${s}/${s}-bom.csv`, data: enc.encode(fullBomCsv(pkg.bom)) }, { name: `${s}/README.txt`, data: enc.encode(readmeText(pkg, title)) });
  return files;
}
