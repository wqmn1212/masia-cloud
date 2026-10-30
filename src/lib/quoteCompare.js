// 견적 비교표 엔진: 한 카드의 견적 여러 건을 같은 줄에 세우고, 한국 도착 원가·개당 금액으로 맞춰 비교한다.
// 금액의 출처는 언제나 견적 하나다. 비교표는 '어떤 견적을 어떻게 놓았는지'와 견적에 없는 조건만 저장한다.
// AI 는 쓰지 않는다. 규칙은 scripts/check-quote-compare.mjs 가 실제 견적 데이터로 검산한다.
import { calcLandedCost, MODES } from './landedCost.js';
import { toUSD, fromUSD, CURRENCY_DIGITS } from '../components/quotation/quoteCurrency.js';

export const MAX_OPTIONS = 5;
export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];
export const ROW_KIND = { ITEM: 'ITEM', OPTIONAL: 'OPTIONAL', ONE_TIME: 'ONE_TIME', LOGISTICS: 'LOGISTICS' };
export const CELL_STATE = { PRICED: 'PRICED', INCLUDED: 'INCLUDED', NOT_INCLUDED: 'NOT_INCLUDED', UNKNOWN: 'UNKNOWN' };
export const BASE_CURRENCIES = ['KRW', 'USD', 'CNY'];
export const CONDITION_KEYS = ['lead', 'payment', 'warranty', 'power', 'packing', 'valid', 'moq', 'tax'];
export const DEFAULT_DUTY_RATE = 8;

// ── 품목 줄 분류 ────────────────────────────────────────────────
const LOGISTICS_RE = /배송|운임|운송비|물류|shipping|freight|logistics|运费|物流|파레트|팔레트|pallet|托盘/i;
const ONE_TIME_RE = /금형|몰드|mold|mould|模具|开模|샘플|시제품|sample|样品|打样|인증비|certification|认证费|개발비|설계비|版费|制版|setup\s*fee/i;
const OPTIONAL_RE = /둘\s*중|택\s*1|선택\s*\d|선택\s*사항|옵션\s*\d|二选一|任选|可选|选配|\boptional\b/i;
export const isLogisticsLine = (name = '', spec = '') => LOGISTICS_RE.test(name) || (!name.trim() && LOGISTICS_RE.test(spec));
export const isOneTimeLine = (name = '', spec = '') => ONE_TIME_RE.test(`${name} ${spec}`);
export const isOptionalLine = (name = '', spec = '') => OPTIONAL_RE.test(`${name} ${spec}`);
export function lineKind(name, spec) {
  if (isLogisticsLine(name, spec)) return ROW_KIND.LOGISTICS;
  if (isOptionalLine(name, spec)) return ROW_KIND.OPTIONAL;
  if (isOneTimeLine(name, spec)) return ROW_KIND.ONE_TIME;
  return ROW_KIND.ITEM;
}

// 공백·기호·괄호 안 설명을 빼고 비교한다 ('상자 4-in-1 투입 기구' → '상자4in1투입기구')
export const normName = (s = '') => String(s).toLowerCase().replace(/\(.*?\)|（.*?）/g, '').replace(/[\s·.,:;'"、，。：\-_/+*×()（）[\]]/g, '');
const bigrams = (s) => { const out = []; for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2)); return out.length ? out : (s ? [s] : []); };
export function similarity(a, b) {
  const x = bigrams(normName(a)); const y = bigrams(normName(b));
  if (!x.length || !y.length) return 0;
  const pool = [...y]; let hit = 0;
  for (const g of x) { const i = pool.indexOf(g); if (i >= 0) { hit += 1; pool.splice(i, 1); } }
  return (2 * hit) / (x.length + y.length);
}
export const MATCH_THRESHOLD = 0.5;

// ── 견적 읽기 ───────────────────────────────────────────────────
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 공장 원가 줄: quote_options 우선, 없으면 line_items. 원가는 줄 통화 그대로 둔다. 선택 사양(합계 미포함)은 비교에서 뺀다.
export function costLines(q) {
  const opts = (q?.quote_options || []).filter((o) => !o.optional && ((o.option_name || '').trim() || num(o.unit_price)));
  if (opts.length) {
    return opts.map((o, idx) => ({
      idx, name: o.option_name || '', spec: o.specification || '', qty: num(o.quantity),
      unit: num(o.unit_price), currency: o.currency || 'CNY', margin: o.margin_percent == null ? null : num(o.margin_percent),
    }));
  }
  return (q?.line_items || []).filter((l) => (l.item_name_ko || l.item_name_cn || '').trim()).map((l, idx) => ({
    idx, name: l.item_name_ko || l.item_name_cn || '', spec: l.specification || '', qty: num(l.quantity),
    unit: num(l.unit_price_cny), currency: l.currency && l.currency !== 'USD' ? l.currency : (num(l.unit_price_cny) ? 'CNY' : 'USD'), margin: null,
  }));
}

// 고객에게 보이는 금액: 견적서 PDF(getQuotationPresentation)와 같은 규칙으로 만든다. 한 원도 달라지면 안 된다.
export function clientLines(q) {
  const usdToKrw = num(q.exchange_rate_usd); const usdToCny = num(q.exchange_rate_usd_cny);
  const options = (Array.isArray(q.quote_options) ? q.quote_options : []).filter((o) => !o.optional);
  const baseOf = (o) => o.total_usd ?? num(o.quantity) * num(o.unit_price ?? o.unit_price_usd);
  let lines = []; let total = 0; let currency = 'USD';
  const v2 = q.rounding_version === 2 && q.final_total != null;
  if (v2) {
    currency = ['CNY', 'KRW'].includes(q.final_currency) ? q.final_currency : 'USD';
    lines = (Array.isArray(q.price_lines) ? q.price_lines : []).map((l) => ({ name: l.option_name || '', spec: l.specification || '', qty: l.quantity ?? null, unit: l.unit_price ?? null, total: num(l.total) }));
    total = num(q.final_total);
  } else if (options.length > 0 && usdToCny > 0) {
    const feeUSD = num(q.final_price_usd) > 0 ? 0 : num(q.masir_fee_amount_cny) / usdToCny;
    const withMarginUSD = options.reduce((s, o) => s + baseOf(o) * (1 + num(o.margin_percent) / 100), 0);
    const totalUSD = num(q.final_price_usd) > 0 ? num(q.final_price_usd) : withMarginUSD + feeUSD;
    const factor = withMarginUSD > 0 ? totalUSD / withMarginUSD : 1;
    lines = options.map((o) => {
      const t = baseOf(o) * (1 + num(o.margin_percent) / 100) * factor; const qty = num(o.quantity);
      return { name: o.option_name || '', spec: o.specification || '', qty: o.quantity ?? null, unit: qty > 0 ? t / qty : t, total: t };
    });
    total = totalUSD;
  } else if (usdToCny > 0) {
    const t = num(q.final_client_price) || num(q.final_price_usd);
    lines = [{ name: q.product_name || '장비 본체 일체', spec: q.model_name || '-', qty: 1, unit: t, total: t }];
    total = t;
  } else {
    currency = 'CNY';
    const fee = num(q.masir_fee_amount_cny); const product = num(q.factory_total_cost) + fee; const logi = num(q.logistics_cost);
    if (product > 0) lines.push({ name: q.product_name || '장비 본체 일체', spec: q.model_name || '-', qty: 1, unit: product, total: product });
    if (logi > 0) lines.push({ name: '물류비 (Logistics & Shipping)', spec: q.incoterms || '-', qty: 1, unit: logi, total: logi });
    total = num(q.final_client_price) || product + logi;
  }
  const target = ['CNY', 'KRW'].includes(q.final_currency) ? q.final_currency : 'USD';
  const rate = target === 'CNY' ? usdToCny : target === 'KRW' ? usdToKrw : 1;
  if (!v2 && currency === 'USD' && target !== 'USD' && rate > 0) {
    lines = lines.map((l) => ({ ...l, unit: l.unit == null ? null : l.unit * rate, total: l.total * rate }));
    total *= rate; currency = target;
  }
  const separate = v2 && q.logistics_separate && num(q.logistics_total) > 0
    ? { amount: num(q.logistics_total), currency: q.logistics_cost_currency || 'CNY' } : null;
  return { currency, lines, total, separate, priced: total > 0 };
}

// 공장명이 공장을 가리키지 않는 값('.', '1', '합산', 'Multiple Suppliers' 등)
const PLACEHOLDER_FACTORY = /^(?:[\s.\-_·0-9]*|n\/?a|미기재|미정|합산|multiple\s*suppliers?|\d+\s*곳|공장|factory)$/i;
export const isPlaceholderFactory = (name) => PLACEHOLDER_FACTORY.test(String(name || '').trim());

// 처음 비교표를 만들 때 미리 체크할 견적: 거절 제외, 같은 공장은 최신 1건, 최대 5건
export function defaultSelection(quotations = []) {
  const sorted = [...quotations].filter((q) => q.status !== 'REJECTED').sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
  const seen = new Set(); const out = [];
  for (const q of sorted) {
    const f = String(q.factory_name || '').trim().toLowerCase();
    if (!isPlaceholderFactory(f)) { if (seen.has(f)) continue; seen.add(f); }
    out.push(q.id);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

// ── 거래 조건 → 계산기 조건 ─────────────────────────────────────
const TERM_MAP = {
  EXW: ['EXW', false], FCA: ['FCA', false], FOB: ['FOB', false], FOB_SHANGHAI: ['FOB', false], FOB_GUANGZHOU: ['FOB', false],
  CFR: ['CFR', false], CIF: ['CIF', false], CPT: ['CFR', true], CIP: ['CIF', true], DAP: ['DAP', false], DPU: ['DAP', true],
  DDP: ['DDP', false], FAS: ['FOB', true],
};
export function normalizeTerm(incoterms) {
  const [term, approx] = TERM_MAP[incoterms] || ['EXW', !!incoterms];
  const region = incoterms === 'FOB_SHANGHAI' ? 'EAST' : 'SOUTH';
  return { term, approx, region, known: !!TERM_MAP[incoterms] };
}
const MODE_MAP = { SEA_LCL: 'SEA_LCL', SEA_FCL_20: 'SEA_FCL20', SEA_FCL_40: 'SEA_FCL40', AIR: 'AIR', EXPRESS: 'EXPRESS' };
export const engineMode = (shippingMode) => MODE_MAP[shippingMode] || 'SEA_LCL';

// ── 견적 비고·사양에서 조건 미리 채우기 (직원이 확인해야 고객에게 보인다) ───────
const sentences = (text) => String(text || '').split(/\n|(?<=[.。])\s+|\t/).map((s) => s.replace(/^[\s※\-•*\d.)]+/, '').trim()).filter(Boolean);
const firstSentence = (text, re, max = 80) => { const s = sentences(text).find((x) => re.test(x)); return s ? (s.length > max ? `${s.slice(0, max)}…` : s) : ''; };

const LEAD_RE = /납기|交期|交货|出货|발송|출고|출하|생산\s*기간|lead\s*time|生产周期/i;
export function parseLeadTime(q) {
  if (num(q.shipping_days) > 0) return { days: num(q.shipping_days), unit: 'DAY', text: `${num(q.shipping_days)}일`, source: 'QUOTE' };
  // 날짜('7월 15일')를 납기로 읽지 않도록 납기 문장 안에서만 찾는다
  const t = sentences(q.remarks).filter((s) => LEAD_RE.test(s)).join('\n');
  const m = t.match(/(\d{1,3})\s*(?:~|-|–|∼|到|至)\s*(\d{1,3})\s*(영업일|工作日|working\s*days?|일|天|days?)/i) || t.match(/(\d{1,3})()\s*(영업일|工作日|working\s*days?|일|天|days?)/i);
  if (!m) return null;
  const days = num(m[2] || m[1]);
  if (!(days > 0)) return null;
  const work = /영업일|工作日|working/i.test(m[3]);
  return { days, unit: work ? 'WORKDAY' : 'DAY', text: m[2] ? `${m[1]}~${m[2]}${work ? '영업일' : '일'}` : `${days}${work ? '영업일' : '일'}`, source: 'REMARKS' };
}

export function parsePower(text) {
  const m = String(text || '').match(/(\d{3})\s*V\s*[/,\s]*\s*(50|60)\s*Hz/i);
  if (!m) return null;
  return { text: `${m[1]}V/${m[2]}Hz`, hz: Number(m[2]), warn: m[2] === '50' };
}

// 견적에서 비교 조건을 읽는다. 값마다 출처(QUOTE: 견적 필드, REMARKS: 비고 문장)를 붙인다.
export function extractConditions(q) {
  const remarks = String(q.remarks || '');
  const specs = costLines(q).map((l) => `${l.name} ${l.spec}`).join('\n');
  const all = `${remarks}\n${specs}`;
  const out = {}; const src = {};
  const set = (k, v, s) => { if (v) { out[k] = v; src[k] = s; } };
  const lead = parseLeadTime(q);
  if (lead) set('lead', lead.text, lead.source);
  if (q.advance_payment_percent != null && q.advance_payment_percent !== '') set('payment', `${num(q.advance_payment_percent)} / ${num(q.balance_payment_percent)}`, 'QUOTE');
  const w = all.match(/(\d+)\s*(년|개월|個月|个月|年|months?|years?)\s*(?:간)?\s*(?:무상)?\s*(?:보증|保修|质保|warranty)/i) || all.match(/(?:보증|保修|质保|warranty)[^\d\n]{0,10}(\d+)\s*(년|개월|个月|年|months?|years?)/i);
  set('warranty', w ? `${w[1]}${/개월|个月|個月|month/i.test(w[2]) ? '개월' : '년'}` : firstSentence(remarks, /보증|保修|质保|warranty/i, 60), 'REMARKS');
  const p = parsePower(all);
  set('power', p ? p.text : '', 'REMARKS');
  set('packing', firstSentence(remarks, /목재|나무\s*상자|wood|木箱|파레트|팔레트|pallet|托盘|포장\s*(?:포함|방식)/i, 60), 'REMARKS');
  set('valid', firstSentence(remarks, /유효|有效|valid/i, 60), 'REMARKS');
  const moq = all.match(/MOQ\s*[:：]?\s*([\d,]+)/i) || all.match(/최소\s*(?:주문|발주)\s*(?:수량)?\s*[:：]?\s*([\d,]+)/);
  set('moq', moq ? moq[1] : '', 'REMARKS');
  set('tax', firstSentence(remarks, /부가세\s*포함|增值税|含税|수출\s*권한|수출권|出口权/i, 70), 'REMARKS');
  return { conditions: out, source: src, power: p };
}

// 견적 안의 배송비 줄이 어디까지인지 (PORT: 항구까지, DOOR: 문 앞까지, null: 모름)
export function logisticsScopeOf(q, lines) {
  const text = `${lines.map((l) => `${l.name} ${l.spec}`).join(' ')} ${q.remarks || ''}`;
  if (/문\s*앞|door|도어|D2D|DDP|门到门/i.test(text)) return 'DOOR';
  if (/항구|항까지|인천항|부산항|평택항|port|港/i.test(text)) return 'PORT';
  return null;
}

// ── 비교표 만들기 ───────────────────────────────────────────────
const rowKey = (n) => `r${n}`;

// 안마다 품목 줄을 비교 행에 세운다. 같은 안의 줄은 한 행에 두 번 들어가지 않는다(선택 품목은 한 행에 묶음).
export function matchLines(options) {
  const rows = []; let n = 0;
  for (const o of options) {
    let lastOptionalRow = null;
    for (const l of o.lines) {
      const kind = lineKind(l.name, l.spec);
      if (kind === ROW_KIND.LOGISTICS) continue;
      if (kind === ROW_KIND.OPTIONAL && lastOptionalRow && lastOptionalRow.cells[o.key]) { lastOptionalRow.cells[o.key].lines.push(l.idx); continue; }
      let best = null; let bestScore = 0;
      for (const r of rows) {
        if (r.kind !== kind || r.cells[o.key]) continue;
        const s = Math.max(...r.names.map((x) => similarity(x, l.name || l.spec)));
        if (s > bestScore) { best = r; bestScore = s; }
      }
      const target = best && bestScore >= MATCH_THRESHOLD ? best : null;
      // 선택 품목 줄 이름에서 '(둘 중 하나 선택)' 같은 설명은 뺀다
      const label = kind === ROW_KIND.OPTIONAL ? (l.name || l.spec).replace(/\s*[(（].*$/, '').trim() || l.name : l.name || l.spec;
      const row = target || { key: rowKey(++n), label, kind, cells: {}, names: [] };
      if (!target) rows.push(row);
      row.cells[o.key] = { lines: [l.idx], state: CELL_STATE.PRICED, auto: !!target };
      row.names.push(l.name || l.spec);
      if (kind === ROW_KIND.OPTIONAL) lastOptionalRow = row;
    }
  }
  return rows.map(({ names, ...r }) => r);
}

export function buildSheet({ quotations = [], title = '' } = {}) {
  const qs = quotations.slice(0, MAX_OPTIONS);
  const options = qs.map((q, i) => {
    const { conditions, source } = extractConditions(q);
    return {
      key: OPTION_KEYS[i], label: `${OPTION_KEYS[i]}안`, quotation_id: q.id, show_factory_name: false,
      cargo: {}, conditions, condition_source: source, extra: {}, choice: {}, logistics_scope: null,
    };
  });
  const rows = matchLines(qs.map((q, i) => ({ key: OPTION_KEYS[i], lines: costLines(q) })));
  return { title, base_currency: 'KRW', duty_rate: DEFAULT_DUTY_RATE, options, rows, extra_conditions: [], recommendation: '', staff_note: '' };
}

// 직원이 셀 하나를 다른 행으로 옮김 (rowFrom 의 optionKey 칸 → rowTo). rowTo 가 없으면 새 행.
export function moveCell(sheet, optionKey, fromKey, toKey) {
  const rows = sheet.rows.map((r) => ({ ...r, cells: { ...r.cells } }));
  const from = rows.find((r) => r.key === fromKey);
  if (!from?.cells[optionKey]) return sheet;
  const cell = { ...from.cells[optionKey], auto: false };
  delete from.cells[optionKey];
  let to = rows.find((r) => r.key === toKey);
  if (!to) {
    const next = Math.max(0, ...rows.map((r) => Number(String(r.key).slice(1)) || 0)) + 1;
    to = { key: rowKey(next), label: from.label, kind: from.kind, cells: {} };
    rows.push(to);
  }
  if (to.cells[optionKey]?.lines?.length) cell.lines = [...to.cells[optionKey].lines, ...cell.lines];
  to.cells[optionKey] = cell;
  return { ...sheet, rows: rows.filter((r) => Object.keys(r.cells).length > 0) };
}

export function setCellState(sheet, rowKeyValue, optionKey, state) {
  return {
    ...sheet,
    rows: sheet.rows.map((r) => {
      if (r.key !== rowKeyValue) return r;
      const cells = { ...r.cells };
      const prev = cells[optionKey];
      if (state === CELL_STATE.PRICED && !prev?.lines?.length) return r;
      cells[optionKey] = { ...(prev || { lines: [] }), state, auto: false };
      if (state !== CELL_STATE.PRICED && !(prev?.lines?.length)) cells[optionKey].lines = [];
      return { ...r, cells };
    }),
  };
}

// ── 계산 ────────────────────────────────────────────────────────
const round = (v, cur) => { const f = 10 ** (CURRENCY_DIGITS[cur] ?? 2); return Math.round(v * f) / f; };

function cargoOf(option, q) {
  const c = option.cargo || {};
  const cbm = num(c.cbm) || num(q.cargo_cbm);
  const kg = num(c.kg) || num(q.cargo_chargeable_kg) || num(q.cargo_weight_kg) * (num(q.cargo_quantity) || 1);
  return { cbm, kg, source: num(c.cbm) || num(c.kg) ? 'SHEET' : cbm || kg ? 'QUOTE' : null };
}

// 고객 금액 줄을 원가 줄에 맞춘다 (같은 개수면 순서, 아니면 이름). 남는 고객 줄은 따로 돌려준다.
function alignClient(cost, client) {
  if (client.lines.length === cost.length) return { aligned: cost.map((_, i) => client.lines[i]), leftover: [] };
  const used = new Set();
  const aligned = cost.map((l) => {
    const i = client.lines.findIndex((c, j) => !used.has(j) && normName(c.name) === normName(l.name));
    if (i < 0) return null;
    used.add(i);
    return client.lines[i];
  });
  return { aligned, leftover: client.lines.filter((_, j) => !used.has(j)) };
}

export function computeSheet(sheet, quotationsById, { rates, fx = {} } = {}) {
  const base = BASE_CURRENCIES.includes(sheet.base_currency) ? sheet.base_currency : 'KRW';
  const usdKrw = num(fx.usd_krw); const usdCny = num(fx.usd_cny);
  const toBase = (v, cur) => {
    if (cur === base) return num(v);
    const usd = toUSD(v, cur, usdKrw, usdCny);
    if (base !== 'USD' && !(base === 'KRW' ? usdKrw : usdCny)) return null;
    if (cur !== 'USD' && !(cur === 'KRW' ? usdKrw : usdCny)) return null;
    return fromUSD(usd, base, usdKrw, usdCny);
  };
  const toKrw = (v, cur) => { const usd = toUSD(v, cur, usdKrw, usdCny); return usdKrw ? usd * usdKrw : null; };
  const fromKrw = (v) => (base === 'KRW' ? v : usdKrw ? fromUSD(v / usdKrw, base, usdKrw, usdCny) : null);

  const options = sheet.options.map((o) => {
    const q = quotationsById[o.quotation_id];
    if (!q) return { ...o, missing: true };
    const cost = costLines(q);
    const client = clientLines(q);
    const { aligned, leftover } = alignClient(cost, client);
    const lineInfo = cost.map((l, i) => {
      const c = aligned[i];
      return {
        ...l, kind: lineKind(l.name, l.spec),
        costBase: toBase(l.unit * l.qty, l.currency),
        clientBase: c ? toBase(c.total, client.currency) : null,
      };
    });
    // 견적서가 줄을 합쳐 보여 주는 경우(예전 견적: '장비 본체 일체' 한 줄)는 고객 금액을 원가 비율로 나눈다
    const leftLogi = leftover.filter((c) => isLogisticsLine(c.name, c.spec));
    const leftGoods = leftover.filter((c) => !isLogisticsLine(c.name, c.spec));
    const open = lineInfo.filter((l) => l.clientBase == null);
    if (client.priced && open.length) {
      const shown = client.lines.reduce((s, c) => s + num(c.total), 0);
      const pool = toBase(leftGoods.reduce((s, c) => s + num(c.total), 0) + (client.total - shown), client.currency);
      const w = open.reduce((s, l) => s + (l.costBase || 0), 0);
      for (const l of open) { l.clientBase = pool == null ? null : w > 0 ? pool * (l.costBase || 0) / w : pool / open.length; l.allocated = true; }
    }
    // 견적서에만 있는 물류비 줄 (원가 쪽은 견적의 물류비 필드, 없으면 같은 금액)
    leftLogi.forEach((c, i) => {
      const clientBase = toBase(c.total, client.currency);
      const costBase = num(q.logistics_cost) > 0 && i === 0 ? toBase(num(q.logistics_cost), 'CNY') : clientBase;
      lineInfo.push({ idx: 1000 + i, name: c.name, spec: c.spec || '', qty: num(c.qty) || 1, unit: num(c.unit), currency: client.currency, margin: null, kind: ROW_KIND.LOGISTICS, costBase, clientBase });
    });
    return { ...o, q, cost: lineInfo, client };
  });

  const live = options.filter((o) => !o.missing);
  const rowsOut = sheet.rows.map((r) => {
    const cells = {};
    for (const o of live) {
      const cell = r.cells[o.key];
      if (!cell) { cells[o.key] = { state: CELL_STATE.NOT_INCLUDED, missing: true }; continue; }
      const ls = (cell.lines || []).map((idx) => o.cost.find((l) => l.idx === idx)).filter(Boolean);
      const optional = r.kind === ROW_KIND.OPTIONAL;
      const chosen = optional && o.choice?.[r.key] != null ? ls.filter((l) => l.idx === o.choice[r.key]) : ls;
      const sum = (arr, k) => (arr.some((l) => l[k] == null) ? null : arr.reduce((s, l) => s + l[k], 0));
      const qty = ls.length ? Math.max(...ls.map((l) => l.qty)) : 0;
      cells[o.key] = {
        state: cell.state, auto: !!cell.auto, lines: ls.map((l) => ({ idx: l.idx, name: l.name, spec: l.spec, qty: l.qty, costBase: l.costBase, clientBase: l.clientBase, currency: l.currency, unit: l.unit })),
        qty, spec: ls.map((l) => l.spec).filter(Boolean).join(' / '),
        costBase: cell.state === CELL_STATE.PRICED ? sum(chosen, 'costBase') : null,
        clientBase: cell.state === CELL_STATE.PRICED ? sum(chosen, 'clientBase') : null,
        alternatives: optional && ls.length > 1 && o.choice?.[r.key] == null,
      };
    }
    // 같은 줄의 사양이 서로 다르면 표시 (빈 사양은 비교하지 않음)
    const specs = Object.values(cells).map((c) => normName(c.spec || '')).filter(Boolean);
    const specDiff = new Set(specs).size > 1;
    // 줄마다 가장 유리한 칸 (개당 원가 기준)
    let best = null; let bestVal = Infinity;
    for (const [k, c] of Object.entries(cells)) {
      if (c.state !== CELL_STATE.PRICED || c.costBase == null || r.kind === ROW_KIND.OPTIONAL) continue;
      const v = c.qty > 0 ? c.costBase / c.qty : c.costBase;
      if (v < bestVal) { bestVal = v; best = k; }
    }
    const pricedCount = Object.values(cells).filter((c) => c.state === CELL_STATE.PRICED).length;
    return { ...r, cells, specDiff, best: pricedCount > 1 ? best : null };
  });

  const itemRows = rowsOut.filter((r) => r.kind === ROW_KIND.ITEM);
  const computedOptions = options.map((o) => {
    if (o.missing) return o;
    const q = o.q;
    const inRow = new Set(rowsOut.flatMap((r) => (r.cells[o.key]?.lines || []).map((l) => l.idx)));
    const logistics = o.cost.filter((l) => l.kind === ROW_KIND.LOGISTICS);
    const unplaced = o.cost.filter((l) => l.kind !== ROW_KIND.LOGISTICS && !inRow.has(l.idx));
    const sumRows = (kinds, k) => rowsOut.filter((r) => kinds.includes(r.kind)).reduce((s, r) => {
      const c = r.cells[o.key]; if (!c || c.state !== CELL_STATE.PRICED) return s;
      if (r.kind === ROW_KIND.OPTIONAL && c.alternatives) return s;
      if (r.kind === ROW_KIND.OPTIONAL && o.choice?.[r.key] == null) return s;
      return s == null || c[k] == null ? null : s + c[k];
    }, 0);
    const sumLines = (arr, k) => (arr.some((l) => l[k] == null) ? null : arr.reduce((s, l) => s + l[k], 0));
    const itemsCost = sumRows([ROW_KIND.ITEM, ROW_KIND.OPTIONAL], 'costBase');
    const itemsClient = sumRows([ROW_KIND.ITEM, ROW_KIND.OPTIONAL], 'clientBase');
    const oneTimeCost = sumRows([ROW_KIND.ONE_TIME], 'costBase');
    const oneTimeClient = sumRows([ROW_KIND.ONE_TIME], 'clientBase');
    const logiCost = sumLines(logistics, 'costBase');
    const logiClient = sumLines(logistics, 'clientBase');
    const unplacedCost = sumLines(unplaced, 'costBase');
    const unplacedClient = sumLines(unplaced, 'clientBase');
    const add = (...xs) => (xs.some((x) => x == null) ? null : xs.reduce((s, x) => s + x, 0));
    const totalCost = add(itemsCost, oneTimeCost, logiCost, unplacedCost);
    let totalClient = add(itemsClient, oneTimeClient, logiClient, unplacedClient);
    // 별도 물류비(견적 합계 밖)는 물류비로 더한다
    const separateBase = o.client.separate ? toBase(o.client.separate.amount, o.client.separate.currency) : 0;
    if (totalClient != null && separateBase) totalClient += separateBase;
    const pdfTotalBase = o.client.priced ? toBase(o.client.total, o.client.currency) : null;
    const optionalExcluded = pdfTotalBase != null && totalClient != null && Math.abs(pdfTotalBase + (separateBase || 0) - totalClient) > Math.max(1, pdfTotalBase * 0.001);

    // 기준 수량: 금액이 가장 큰 품목 줄의 수량 (장비처럼 1대면 1)
    const mainLine = [...o.cost].filter((l) => l.kind === ROW_KIND.ITEM).sort((a, b) => (b.costBase || 0) - (a.costBase || 0))[0];
    const units = Math.max(1, num(mainLine?.qty) || 1);

    // 마진: 품목 줄 원가 가중 평균
    const marginLines = o.cost.filter((l) => l.kind === ROW_KIND.ITEM && l.margin != null && l.costBase);
    const marginW = marginLines.reduce((s, l) => s + l.costBase, 0);
    const margin = marginW > 0 ? marginLines.reduce((s, l) => s + l.margin * l.costBase, 0) / marginW : null;

    // 한국 도착 원가 (부가세 제외)
    const t = normalizeTerm(q.incoterms);
    const scope = o.logistics_scope || (logistics.length || separateBase ? logisticsScopeOf(q, logistics) : null);
    let calcTerm = t.term;
    let scopeAsk = false;
    if ((logistics.length || separateBase) && ['EXW', 'FCA', 'FOB'].includes(t.term)) {
      if (scope === 'PORT') calcTerm = 'CIF';
      else if (scope === 'DOOR') calcTerm = 'DAP';
      else scopeAsk = true;
    }
    const cargo = cargoOf(o, q);
    const mode = engineMode(q.shipping_mode);
    const landedFor = (goodsBase) => {
      if (goodsBase == null) return null;
      if (calcTerm === 'DDP') return { extra: 0, range: { low: 0, high: 0 }, status: 'OK' };
      if (!cargo.cbm && !cargo.kg) return { extra: null, status: 'NO_CARGO' };
      if (scopeAsk) return { extra: null, status: 'SCOPE_ASK' };
      const goodsKrw = toKrw(goodsBase, base) ?? null;
      if (goodsKrw == null) return { extra: null, status: 'NO_FX' };
      const res = calcLandedCost({ mode, term: calcTerm, region: t.region, goodsValue: goodsKrw, goodsCurrency: 'KRW', usdKrw, totalCbm: cargo.cbm, totalKg: cargo.kg, units, dutyRate: num(sheet.duty_rate ?? DEFAULT_DUTY_RATE) }, rates);
      const ex = res.totals.buyerExtraExVat; const rg = res.totals.buyerExtraExVatRange;
      return { extra: fromKrw(ex), range: { low: fromKrw(rg.low), high: fromKrw(rg.high) }, status: 'OK', verifiedShare: res.totals.verifiedShare };
    };
    const landedClient = landedFor(totalClient);
    const landedCost = landedFor(totalCost);
    const landedTotal = (l, goods) => (l && l.extra != null && goods != null ? goods + l.extra : null);
    const lClient = landedTotal(landedClient, totalClient);
    const lCost = landedTotal(landedCost, totalCost);

    const lead = parseLeadTime(q);
    const conditions = { ...extractConditions(q).conditions, ...(o.conditions || {}) };
    const power = parsePower(conditions.power || '');
    const advance = q.advance_payment_percent == null ? null : num(q.advance_payment_percent);

    return {
      key: o.key, label: o.label, quotation_id: o.quotation_id, factory_name: q.factory_name || '', status: q.status,
      show_factory_name: !!o.show_factory_name, incoterms: q.incoterms || '', term: t, calcTerm, mode, cargo, scope, scopeAsk,
      currency: o.client.currency, pdfTotal: o.client.priced ? o.client.total : null, pdfTotalBase, separateBase, optionalExcluded,
      priced: o.client.priced && totalClient != null && totalClient > 0,
      units, totalCost, totalClient, oneTimeClient, oneTimeCost, logiClient, logiCost,
      perUnitCost: totalCost != null ? totalCost / units : null, perUnitClient: totalClient != null ? totalClient / units : null,
      landedStatus: landedClient?.status || null, landedExtra: landedClient?.extra ?? null, landedRange: landedClient?.range || null,
      landedClient: lClient, landedCost: lCost,
      landedPerUnitClient: lClient != null ? lClient / units : null, landedPerUnitCost: lCost != null ? lCost / units : null,
      margin, lead, advance, deposit: advance != null && totalClient != null ? totalClient * advance / 100 : null,
      conditions, condition_source: { ...extractConditions(q).source, ...Object.fromEntries(Object.keys(o.conditions || {}).map((k) => [k, 'MANUAL'])) },
      power, unplaced: unplaced.map((l) => l.name), hash: sourceHash(q),
    };
  });

  const liveOpts = computedOptions.filter((o) => !o.missing);
  // 범위 다름: 다른 안에 있는 품목 줄이 이 안에는 없거나 확인이 필요함
  for (const o of liveOpts) {
    o.scopeDiff = itemRows.some((r) => {
      const c = r.cells[o.key];
      const others = liveOpts.some((x) => x.key !== o.key && [CELL_STATE.PRICED, CELL_STATE.INCLUDED].includes(r.cells[x.key]?.state));
      return others && (!c || [CELL_STATE.NOT_INCLUDED, CELL_STATE.UNKNOWN].includes(c.state));
    });
    o.unknownScope = itemRows.some((r) => r.cells[o.key]?.state === CELL_STATE.UNKNOWN);
  }
  const unitsSet = new Set(liveOpts.filter((o) => o.priced).map((o) => o.units));
  const qtyDiff = unitsSet.size > 1;
  const comparable = liveOpts.filter((o) => o.priced && !o.scopeDiff);
  const allLanded = comparable.length > 0 && comparable.every((o) => o.landedClient != null);
  const sameTerm = new Set(comparable.map((o) => o.calcTerm)).size <= 1;
  const pick = (arr, f) => { let b = null; let v = Infinity; for (const o of arr) { const x = f(o); if (x != null && x < v) { v = x; b = o.key; } } return arr.length > 1 ? b : null; };
  const best = {
    landedPerUnit: allLanded ? pick(comparable, (o) => o.landedPerUnitClient) : null,
    perUnit: sameTerm || allLanded ? pick(comparable, (o) => o.perUnitClient) : null,
    perUnitCost: sameTerm || allLanded ? pick(comparable, (o) => (allLanded ? o.landedPerUnitCost : o.perUnitCost)) : null,
    lead: (() => {
      const withLead = liveOpts.filter((o) => o.lead);
      if (new Set(withLead.map((o) => o.lead.unit)).size > 1) return null;
      return pick(withLead, (o) => o.lead.days);
    })(),
    advance: pick(liveOpts.filter((o) => o.advance != null), (o) => o.advance),
  };
  return {
    base, fx: { usd_krw: usdKrw || null, usd_cny: usdCny || null, date: fx.date || null },
    options: computedOptions, rows: rowsOut, qtyDiff, sameTerm, allLanded, best,
    extra_conditions: sheet.extra_conditions || [], recommendation: sheet.recommendation || '',
  };
}

// ── 경고 ────────────────────────────────────────────────────────
export function sheetWarnings(computed, { publishedHashes = null } = {}) {
  const w = [];
  const opts = computed.options.filter((o) => !o.missing);
  for (const o of computed.options.filter((x) => x.missing)) w.push({ code: 'MISSING_QUOTE', level: 'error', option: o.key, text: `${o.label}: 견적이 삭제되었습니다` });
  for (const o of opts) {
    if (!o.priced) w.push({ code: 'NO_PRICE', level: 'error', option: o.key, text: `${o.label}: 고객 제안가가 없는 견적입니다 (견적에서 금액을 확정하세요)` });
    if (o.unknownScope) w.push({ code: 'SCOPE_UNKNOWN', level: 'warn', option: o.key, text: `${o.label}: 포함 여부를 확인해야 하는 품목이 있습니다` });
    else if (o.scopeDiff) w.push({ code: 'SCOPE', level: 'warn', option: o.key, text: `${o.label}: 다른 안에 있는 품목이 빠져 있어 합계를 그대로 비교할 수 없습니다` });
    if (!o.lead) w.push({ code: 'NO_LEAD', level: 'warn', option: o.key, text: `${o.label}: 납기가 견적에 없습니다` });
    if (o.landedStatus === 'NO_CARGO' && o.calcTerm !== 'DDP') w.push({ code: 'NO_CARGO', level: 'info', option: o.key, text: `${o.label}: 포장 부피·무게가 없어 물류비를 계산하지 못했습니다` });
    if (o.scopeAsk) w.push({ code: 'SCOPE_ASK', level: 'warn', option: o.key, text: `${o.label}: 견적의 배송비가 어디까지인지(항구/문 앞) 정해 주세요` });
    if (o.margin != null && o.margin <= 0) w.push({ code: 'MARGIN_ZERO', level: 'warn', option: o.key, text: `${o.label}: 마진이 0%입니다. 공개하면 공장 원가가 그대로 보입니다` });
    if (o.power?.warn) w.push({ code: 'POWER_50HZ', level: 'warn', option: o.key, text: `${o.label}: 전원 ${o.power.text} — 한국은 60Hz, 사용 가능 여부를 확인하세요` });
    if (o.optionalExcluded) w.push({ code: 'OPTIONAL_EXCLUDED', level: 'info', option: o.key, text: `${o.label}: 선택 품목을 빼서 견적서 합계와 다릅니다` });
    if (o.term.approx) w.push({ code: 'TERM_APPROX', level: 'info', option: o.key, text: `${o.label}: ${o.incoterms} 를 ${o.term.term} 로 근사해 계산했습니다` });
    if (publishedHashes && publishedHashes[o.key] && publishedHashes[o.key] !== o.hash) w.push({ code: 'STALE', level: 'warn', option: o.key, text: `${o.label}: 공개한 뒤 견적이 바뀌었습니다. 다시 공개하세요` });
  }
  const margins = opts.map((o) => o.margin).filter((m) => m != null);
  if (margins.length > 1 && Math.max(...margins) - Math.min(...margins) >= 5) w.push({ code: 'MARGIN_SPREAD', level: 'warn', text: `마진이 안마다 다릅니다 (${Math.round(Math.min(...margins))}%~${Math.round(Math.max(...margins))}%). 고객 비교에서 순서가 바뀔 수 있습니다` });
  if (computed.qtyDiff) w.push({ code: 'QTY', level: 'info', text: '안마다 수량이 달라 개당 금액으로 비교합니다' });
  if (!computed.sameTerm && !computed.allLanded) w.push({ code: 'TERM_MIX', level: 'warn', text: '거래 조건이 달라 금액을 그대로 비교할 수 없습니다. 포장 부피·무게를 넣어 도착 원가로 맞추세요' });
  return w;
}

// ── 공장 질문 ───────────────────────────────────────────────────
export function factoryQuestions(computed) {
  return computed.options.filter((o) => !o.missing).map((o) => {
    const zh = []; const ko = [];
    if (!o.lead) { zh.push('交期（下单付款后几天出货）'); ko.push('납기 (발주·선금 후 며칠 안에 출하)'); }
    if (o.landedStatus === 'NO_CARGO' && o.calcTerm !== 'DDP') { zh.push('外箱尺寸、毛重和箱数'); ko.push('포장 박스 치수·총중량·박스 수'); }
    if (!o.conditions.warranty) { zh.push('保修期'); ko.push('보증 기간'); }
    if (o.power?.warn) { zh.push('能否做220V/60Hz（韩国电源）及费用'); ko.push('한국 전원 220V/60Hz 제작 가능 여부와 비용'); }
    if (o.scopeAsk) { zh.push('运费包含到哪里（港口／门到门）'); ko.push('배송비가 어디까지 포함인지 (항구 / 문 앞)'); }
    if (['CIF', 'CFR'].includes(o.calcTerm) && !o.logiCost && o.landedStatus !== 'NO_CARGO') { zh.push('单价是否已含运费'); ko.push('단가에 운임이 포함되었는지'); }
    if (!o.conditions.valid) { zh.push('报价有效期'); ko.push('견적 유효기간'); }
    return { key: o.key, label: o.label, factory_name: o.factory_name, count: zh.length, text: zh.length ? `请确认以下信息：${zh.join('、')}。\n(${ko.join(', ')})` : '' };
  }).filter((x) => x.count > 0);
}

// ── 고객용 스냅샷 (원가·마진·공장명·견적 ID 없음) ─────────────────
const CLIENT_CONDITIONS = ['warranty', 'power', 'packing', 'valid', 'moq'];
export function clientView(computed, sheet, { version = 1 } = {}) {
  const cur = computed.base;
  const r = (v) => (v == null ? null : round(v, cur));
  const opts = computed.options.filter((o) => !o.missing && o.priced);
  const extraLabels = Object.fromEntries((sheet.extra_conditions || []).map((c) => [c.key, c.label]));
  return {
    title: sheet.title || '', version, base_currency: cur, fx: computed.fx,
    recommendation: sheet.recommendation || '', qty_diff: computed.qtyDiff,
    best: { landed_per_unit: computed.best.landedPerUnit, per_unit: computed.best.perUnit, lead: computed.best.lead },
    options: opts.map((o) => {
      const src = sheet.options.find((x) => x.key === o.key) || {};
      return {
        key: o.key, label: o.label, factory_name: o.show_factory_name ? o.factory_name : '',
        quote_currency: o.currency, quote_total: o.pdfTotal == null ? null : round(o.pdfTotal, o.currency),
        total: r(o.totalClient), per_unit: r(o.perUnitClient), units: o.units,
        landed_total: r(o.landedClient), landed_per_unit: r(o.landedPerUnitClient), landed_status: o.landedStatus,
        landed_extra: r(o.landedExtra), landed_range: o.landedRange ? { low: r(o.landedRange.low), high: r(o.landedRange.high) } : null,
        one_time: r(o.oneTimeClient), incoterms: o.incoterms, lead: o.lead ? o.lead.text : '',
        payment: o.advance != null ? `${o.advance} / ${100 - o.advance}` : '', deposit: r(o.deposit),
        conditions: Object.fromEntries(CLIENT_CONDITIONS.filter((k) => o.conditions[k]).map((k) => [k, String(o.conditions[k])])),
        extra: Object.fromEntries(Object.entries(src.extra || {}).filter(([k, v]) => extraLabels[k] && v).map(([k, v]) => [k, String(v)])),
        scope_diff: !!o.scopeDiff, power_warn: !!o.power?.warn,
      };
    }),
    extra_conditions: (sheet.extra_conditions || []).map((c) => ({ key: c.key, label: c.label })),
    rows: computed.rows.filter((row) => row.kind !== ROW_KIND.LOGISTICS).map((row) => ({
      key: row.key, label: row.label, kind: row.kind, spec_diff: row.specDiff,
      cells: Object.fromEntries(opts.map((o) => {
        const c = row.cells[o.key] || { state: CELL_STATE.NOT_INCLUDED };
        return [o.key, { state: c.state, amount: c.state === CELL_STATE.PRICED && !c.alternatives ? r(c.clientBase) : null, alternatives: c.alternatives ? c.lines.map((l) => ({ name: l.name, amount: r(l.clientBase) })) : null, qty: c.qty || null, spec: c.spec || '' }];
      })),
    })),
  };
}

// 고객에게 보일 글자에 공장명이 들어 있는지 (공개 전 경고)
export function factoryNameLeaks(snapshot, computed) {
  const names = computed.options.filter((o) => !o.missing && !o.show_factory_name && o.factory_name && !isPlaceholderFactory(o.factory_name)).map((o) => o.factory_name.trim()).filter((n) => n.length >= 2);
  const text = JSON.stringify({ ...snapshot, options: snapshot.options.map(({ factory_name, ...rest }) => rest) }).toLowerCase();
  return names.filter((n) => text.includes(n.toLowerCase()));
}

// 견적 변경 감지용 해시 (금액·품목·조건)
export function sourceHash(q) {
  const s = JSON.stringify([
    costLines(q).map((l) => [l.name, l.spec, l.qty, l.unit, l.currency, l.margin]),
    q.price_lines || null, q.final_total ?? null, q.final_price_usd ?? null, q.incoterms || '', q.shipping_days ?? null,
    q.advance_payment_percent ?? null, q.remarks || '', q.shipping_mode || '', q.cargo_cbm ?? null,
  ]);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export const transitLabel = (mode) => MODES.find((m) => m.value === mode)?.transit || '';
