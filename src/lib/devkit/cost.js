// 수량별 원가 추정 (원화, 초기 견적 전 감 잡기용 — 실제 견적으로 바꿔 넣는다)
// 사출: 금형비(크기·슬라이드·캐비티) + 개당 재료비·사출비 / 기판: 기판비(면적) + SMT 조립(준비비 + 접점) + 부품비 / 조립·포장
// 단가표는 COST_DEFAULTS 로 두고 화면에서 바꿀 수 있다.
import { estimateCavityCount, estimateCycleTimeSec, estimateMachineClass } from '../moldEstimate.js';

export const COST_DEFAULTS = {
  resin_krw_per_kg: { ABS: 3200, PC: 4800, 'PC/ABS': 4200, PP: 2200, 'PC 확산': 5200, 'PC 유백': 5200 },
  machine_krw_per_hour: { small: 22000, medium: 32000, large: 48000 },
  mold_base_krw: 2500000, mold_per_mm_krw: 30000, slide_krw: 800000, cavity_extra: 0.6,
  pcb_setup_krw: 60000, pcb_krw_per_cm2: 12, smt_setup_krw: 45000, smt_krw_per_joint: 2.5, tht_krw_per_part: 60,
  assembly_krw: 1500, packaging_krw: 900, scrap: 0.05, qtys: [500, 1000, 3000, 10000],
};

// 부품 단가 (원, 1천 개 기준 대략) — LCSC 실제 가격으로 바꿔 넣는다
const PART_PRICE = [
  [/ESP32-S3/, 4600], [/ESP32-C3/, 3000], [/ESP32-WROOM/, 3600], [/TYPE-C/, 160], [/USBLC6/, 90], [/ME6211|AP2112/, 70], [/TPS54202/, 420],
  [/AL8860/, 650], [/LM393/, 60], [/PCF8563/, 420], [/32\.768/, 70], [/TP4056/, 140], [/CH340/, 380], [/AO340/, 35], [/S8050/, 12],
  [/SS34/, 25], [/1N4148/, 8], [/^R|Ω|k$/, 2], [/uF|nF|pF/, 6], [/uH/, 90], [/LED/, 8], [/TS-1187|SKRT/, 35], [/SS12D|OS1020/, 90],
  [/EC11|PEC09/, 650], [/DC-005|잭/, 160], [/B\dB-|XH|PH/, 55], [/부저|buzzer/i, 160], [/NTC/, 18], [/CR1220|CR2032/, 110], [/100uF/, 35],
];
export const partPrice = (c) => { const t = `${c.value} ${c.part?.value || ''} ${c.part?.search || ''}`; const hit = PART_PRICE.find(([re]) => re.test(t)); return hit ? hit[1] : 50; };
/** 단가표에 있는 부품만 값, 모르면 null (모르는 부품을 50원으로 채우지 않기 위해) */
// 설계 부품표에는 부품 번호가 분명한 항목만 쓴다 (‘LED’, ‘uF’ 같은 넓은 규칙은 ‘마이크로 OLED’ 를 8원으로 잡는 식의 오판을 낸다)
const GENERIC = new Set(['^R|Ω|k$', 'uF|nF|pF', 'uH', 'LED', 'DC-005|잭', 'B\\dB-|XH|PH', '부저|buzzer', '100uF', '32\\.768', 'NTC']);
const PART_NO_PRICE = PART_PRICE.filter(([re]) => !GENERIC.has(re.source));
export const knownPartPrice = (partNo) => { const t = String(partNo || '').trim(); if (!t) return null; const hit = PART_NO_PRICE.find(([re]) => re.test(t)); return hit ? hit[1] : null; };
export const bomKey = (l) => String(l?.part_no || l?.name || l?.ref || '').trim();

/**
 * 승인된 설계 버전의 부품표(lines: {ref, name, part_no, qty})로 부품비를 계산한다.
 * prices: { [bomKey]: 원 } — 화면에서 넣은 단가. 없으면 단가표에서 찾고, 그래도 없으면 '단가 없음' 으로 센다.
 */
export function designBomCost(lines, prices = {}) {
  const rows = (lines || []).filter((l) => l && (l.name || l.part_no)).map((l) => {
    const key = bomKey(l); const qty = Number(l.qty) > 0 ? Number(l.qty) : 1;
    const typed = Number(prices?.[key]);
    const unit = Number.isFinite(typed) && typed > 0 ? typed : knownPartPrice(l.part_no);
    return { key, ref: l.ref || '', name: l.name || l.part_no, part_no: l.part_no || '', qty, unit, source: Number.isFinite(typed) && typed > 0 ? 'typed' : unit != null ? 'table' : 'none', total: unit != null ? unit * qty : 0 };
  });
  const unpriced = rows.filter((r) => r.unit == null);
  return { rows, total: Math.round(rows.reduce((n, r) => n + r.total, 0)), priced: rows.length - unpriced.length, unpriced: unpriced.map((r) => r.name) };
}

/**
 * moldSummary: dev.mold_design.summary ({ parts: [{name, material, mold, weight, size, slides, hi}] })
 * hw: buildHwPackage 결과 (hw.comps, boards[].layout.area) — 없으면 기판 비용 빼고
 */
/**
 * quotes (dev.cost_quotes): 공장 견적으로 추정치를 바꾼다.
 *   { factory, date, currency: 'KRW' | 'CNY' | 'USD', fx (통화 1 단위 = 원), parts: { [부품 이름]: { mold, unit, cavities } } }
 */
export function estimateCost({ moldSummary, hwPkg, settings = {}, quotes = null, designBom = null, bomPrices = null }) {
  const fx = quotes && quotes.currency && quotes.currency !== 'KRW' ? Number(quotes.fx) || 0 : 1;
  const qOf = (name) => { const q = quotes?.parts?.[name]; return q && fx > 0 ? q : null; };
  const S = { ...COST_DEFAULTS, ...settings };
  const molded = (moldSummary?.parts || []).filter((p) => p.mold);
  const moldRows = molded.map((p) => {
    const edge = Math.max(...(p.size || [50, 50, 20]));
    const cav = estimateCavityCount(edge);
    const cycle = estimateCycleTimeSec(p.weight * cav);
    const mc = estimateMachineClass(p.weight * cav, edge);
    const cls = /small|소형/i.test(mc) ? 'small' : /large|대형/i.test(mc) ? 'large' : 'medium';
    const resin = S.resin_krw_per_kg[p.material] ?? S.resin_krw_per_kg[String(p.material).split(' ')[0]] ?? 3500;
    const material = (p.weight / 1000) * resin * (1 + S.scrap);
    const press = (cycle / cav / 3600) * S.machine_krw_per_hour[cls];
    const mold = Math.round((S.mold_base_krw + edge * S.mold_per_mm_krw + (p.slides || 0) * S.slide_krw) * (1 + (cav - 1) * S.cavity_extra) / 10000) * 10000;
    const est = { mold, unit: Math.round(material + press) };
    const q = qOf(p.name);
    const qMold = Number(q?.mold) > 0 ? Math.round(Number(q.mold) * fx) : null, qUnit = Number(q?.unit) > 0 ? Math.round(Number(q.unit) * fx) : null;
    return { name: p.name, material: p.material, weight: p.weight, cavities: Number(q?.cavities) > 0 ? Number(q.cavities) : cav, cycle: Math.round(cycle), machine: cls, slides: p.slides || 0, mold: qMold ?? est.mold, unit: qUnit ?? est.unit, est, source: { mold: qMold != null ? 'quote' : 'estimate', unit: qUnit != null ? 'quote' : 'estimate' } };
  });
  const boards = (hwPkg?.boards || []).map((b) => {
    const comps = b.hw.comps.filter((c) => c.part.fp && c.part.cat !== 'H');
    const smt = comps.filter((c) => !/^(Connector_JST|Connector_BarrelJack|Rotary_Encoder|Buzzer_Beeper|Button_Switch_THT|Battery)/.test(c.part.fp));
    const joints = smt.reduce((n, c) => n + Object.keys(c.conns).length, 0);
    const parts = comps.reduce((n, c) => n + partPrice(c), 0);
    const area = (b.layout.size[0] * b.layout.size[1]) / 100;
    return { name: b.name, area_cm2: Math.round(area), parts_count: comps.length, joints, pcb: Math.round(area * S.pcb_krw_per_cm2), smt: Math.round(joints * S.smt_krw_per_joint + (comps.length - smt.length) * S.tht_krw_per_part), parts: Math.round(parts), setup: S.pcb_setup_krw + S.smt_setup_krw };
  });
  const tooling = moldRows.reduce((n, r) => n + r.mold, 0);
  const setup = boards.reduce((n, b) => n + b.setup, 0);
  // 부품비 기준: 승인된 설계 부품표가 있으면 그것(실제 제품 부품), 없으면 워크벤치 범용 회로
  const design = designBom?.length ? designBomCost(designBom, bomPrices || {}) : null;
  const partsBasis = design ? 'design' : 'generic';
  const partsCost = design ? design.total : boards.reduce((n, b) => n + b.parts, 0);
  const unit = moldRows.reduce((n, r) => n + r.unit, 0) + boards.reduce((n, b) => n + b.pcb + b.smt, 0) + partsCost + S.assembly_krw + S.packaging_krw;
  const byQty = S.qtys.map((q) => ({ qty: q, unit, tooling_per_unit: Math.round((tooling + setup) / q), total_per_unit: Math.round(unit + (tooling + setup) / q), total: Math.round(unit * q + tooling + setup) }));
  const quoted = moldRows.filter((r) => r.source.mold === 'quote').length;
  const estTooling = moldRows.reduce((n, r) => n + r.est.mold, 0);
  return { partsBasis, design, partsCost, quote: quotes && quoted ? { factory: quotes.factory || '', date: quotes.date || '', quoted, of: moldRows.length, tooling_diff: tooling - estTooling } : null, moldRows, boards, tooling, setup, unit, byQty, settings: S, missing: [...(!molded.length ? ['사출 부품 (3D 도면 → 금형용 설계를 한 번 열어 계산)'] : []), ...(!boards.length ? ['기판 (회로 설계 단계)'] : []), ...(design?.unpriced.length ? [`단가 없는 부품 ${design.unpriced.length}개 (0원으로 빠짐)`] : [])] };
}
