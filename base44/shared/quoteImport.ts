// 공장 견적서 가져오기 (엑셀·워드·PDF·이미지 공통). AI 가 뽑은 원문 값을 우리 견적 양식으로 정리하고 검산한다.
//  - 금액 칸이 '줄 합계'인지 '단가'인지 수량과 견적서 합계로 가려낸다 (단가 × 수량 = 금액, 포함 항목 합 = 견적서 합계)
//  - 합계에 들어가지 않는 대안 항목은 선택 사양(optional)으로 둔다
//  - 수량 단위(대·세트), 한국어/중국어 이름, 줄별 납기·비고, 기술 사양표, 견적 조건, 고객 확인 메모까지 옮긴다
//  - 조건은 고객용(견적서 비고)과 내부용(공장명·공장 견적일·공장 유효기간 등)으로 나눈다
// 검산: npm run check:quote-import
export const CURRENCIES = ['CNY', 'USD', 'KRW'];
export const TERM_KINDS = ['PACKAGING', 'DELIVERY', 'PAYMENT', 'WARRANTY', 'VALIDITY', 'CLIENT_SUPPLIED', 'OPTIONAL_EQUIPMENT', 'SHIPPING', 'OTHER'];
export const DEFAULT_VALIDITY_DAYS = 30;
const TOL = 0.005; // 금액 비교 허용 오차 0.5%

// AI 에게 주는 추출 지시와 응답 형식 (parseQuotationFile·parseQuotationExcel 공용)
export const EXTRACT_PROMPT = `아래는 공장 견적서입니다(중국어·한국어·영어 혼용 가능, 한 칸에 한국어와 중국어가 줄바꿈으로 같이 있을 수 있음).
견적서에 실제로 있는 값만 추출하고 절대 지어내지 마세요. 모르는 값은 비워 두세요.
- supplier_name: 공급업체(공장) 이름, quote_date: 견적일(YYYY-MM-DD), currency: 견적 통화(¥/元/RMB/人民币=CNY, $=USD, ₩/원=KRW)
- title, product_name, model_name, incoterms(EXW·FOB 등 적혀 있을 때만), logistics_cost(별도 운송비가 있을 때만)
- items: 합계·소계 행을 뺀 모든 품목 줄. 각 줄마다
  name_ko / name_cn: 품목명(한국어·중국어를 나눠서, 한쪽만 있으면 그쪽만), spec_ko / spec_cn: 규격·사양
  quantity: 수량 숫자, unit_label: 수량 단위(대, 세트, 개, 台, 付, pcs 등)
  unit_price: '단가' 칸 값(있을 때만), amount: '금액·합계' 칸 값(있을 때만). 칸 이름을 보고 단가인지 금액인지 구분하세요
  lead_time: 그 줄의 납기 원문(예: "20작업일 / 20工作日"), note: 그 줄의 비고
  in_total: 이 줄이 견적서 합계에 포함되면 true, 대안·선택 옵션이라 합계에서 빠지면 false, 알 수 없으면 비워 두기
- stated_total: 견적서에 적힌 합계 금액, total_note: 합계 설명(예: "무도금 옵션 기준")
- spec_table: 기술 사양표의 모든 항목 [{label_ko, label_cn, value}]
- terms: 견적 조건·주의사항 각 줄 [{text_ko, text_cn, kind}] kind: PACKAGING(포장), DELIVERY(납기), PAYMENT(지불), WARRANTY(보증), VALIDITY(견적 유효기간), CLIENT_SUPPLIED(고객 제공 자료), OPTIONAL_EQUIPMENT(선택 사양·별도 문의), SHIPPING(운송·인코텀즈), OTHER
- notes: 고객 확인 반영 사항 등 표 밖의 메모 각 줄 (원문 그대로)`;

export const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    supplier_name: { type: 'string' }, quote_date: { type: 'string' }, currency: { type: 'string' },
    title: { type: 'string' }, product_name: { type: 'string' }, model_name: { type: 'string' },
    incoterms: { type: 'string' }, logistics_cost: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name_ko: { type: 'string' }, name_cn: { type: 'string' }, spec_ko: { type: 'string' }, spec_cn: { type: 'string' },
          quantity: { type: 'number' }, unit_label: { type: 'string' }, unit_price: { type: 'number' }, amount: { type: 'number' },
          currency: { type: 'string' }, lead_time: { type: 'string' }, note: { type: 'string' }, in_total: { type: 'boolean' },
        },
      },
    },
    stated_total: { type: 'number' }, total_note: { type: 'string' },
    spec_table: { type: 'array', items: { type: 'object', properties: { label_ko: { type: 'string' }, label_cn: { type: 'string' }, value: { type: 'string' } } } },
    terms: { type: 'array', items: { type: 'object', properties: { text_ko: { type: 'string' }, text_cn: { type: 'string' }, kind: { type: 'string' } } } },
    notes: { type: 'array', items: { type: 'string' } },
  },
};

const s = (v: unknown, max = 500) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
// "16,000" "¥1,000" "1000元" 같은 값도 숫자로
export const num = (v: unknown) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(/[,，\s]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const round2 = (v: number) => Math.round(v * 100) / 100;
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * TOL);
const currencyOf = (v: unknown, fallback = 'CNY') => {
  const t = s(v, 30).toUpperCase();
  if (/CNY|RMB|元|¥|人民币|위안/.test(t) || t === 'CN') return 'CNY';
  if (/USD|\$|美元|달러/.test(t)) return 'USD';
  if (/KRW|₩|원|韩元/.test(t)) return 'KRW';
  return fallback;
};
// 한 칸에 "한국어\n중국어" 또는 "한국어 / 중국어" 가 같이 있으면 나눈다 (한글이 있는 쪽 / 한자만 있는 쪽)
const HANGUL = /[\uac00-\ud7a3]/;
const HAN = /[\u4e00-\u9fff]/;
const isCn = (t: string) => HAN.test(t) && !HANGUL.test(t);
export function splitKoCn(text: string) {
  const ko: string[] = [], cn: string[] = [];
  for (const line of s(text, 2000).split('\n').map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split(/\s+\/\s+/);
    if (parts.length > 1 && parts.some(isCn) && parts.some((p) => !isCn(p))) {
      ko.push(parts.filter((p) => !isCn(p)).join(' / '));
      cn.push(parts.filter(isCn).join(' / '));
    } else (isCn(line) ? cn : ko).push(line);
  }
  return { ko: ko.join('\n'), cn: cn.join('\n') };
}
// "5세트" "1台" "3 pcs" → 단위
export const unitOf = (v: unknown) => (s(v, 40).replace(/[\d.,\s]/g, '').split(/[\n/]/)[0] || '').slice(0, 10);

// "20작업일" "20工作日" "20 working days" → { business: 20 }, "30天" "30일" → { days: 30 }
// "25~30 작업일" 처럼 범위면 긴 쪽을 쓴다 (고객에게 약속하는 납기이므로)
export function parseLeadTime(text: unknown) {
  const raw = s(text, 300);
  if (!raw) return null;
  const t = raw.replace(/(\d+)\s*[-~～–]\s*(\d+)/g, (_m, a, b) => String(Math.max(Number(a), Number(b))));
  const b = t.match(/(\d+)\s*(?:작업일|영업일|근무일|工作日|個工作日|个工作日|working\s*days?|business\s*days?)/i);
  if (b) return { business: Number(b[1]), days: null, text: raw };
  const w = t.match(/(\d+)\s*(?:주|周|weeks?)/i);
  if (w) return { business: null, days: Number(w[1]) * 7, text: raw };
  const d = t.match(/(\d+)\s*(?:일|天|日|days?)/i);
  if (d) return { business: null, days: Number(d[1]), text: raw };
  return { business: null, days: null, text: raw };
}
const validityDays = (text: string) => { const m = text.match(/(\d+)\s*(?:일|天|日|days?)/i); return m ? Number(m[1]) : null; };
// '계약 시 확정' 류: 지불·보증 조건이 아직 정해지지 않았다는 문장
const TBD = /계약\s*시|추후|별도\s*협의|협의|以合同为准|合同为准|另议|待定|to be confirmed|tbc|tbd/i;

// 합계에 넣을 줄 조합: 표시가 true 인 줄 + 표시 없는 줄 전부, 안 맞으면 표시 없는 줄을 앞에서부터 이어 붙여 견적서 합계와 맞는 곳까지.
// 맞는 조합이 없으면 null (in_total=false 로 표시된 줄은 항상 뺀다)
function totalFit(rows: any[], total: number, amountOf: (x: any) => number) {
  const fixed = rows.filter((x) => x.in_total === true);
  const open = rows.filter((x) => x.in_total === null);
  const sum = (list: any[]) => list.reduce((a, x) => a + (amountOf(x) || 0), 0);
  if (near(sum([...fixed, ...open]), total)) return new Set([...fixed, ...open]);
  for (let i = 0; i < open.length; i++) if (near(sum([...fixed, ...open.slice(0, i + 1)]), total)) return new Set([...fixed, ...open.slice(0, i + 1)]);
  if (!open.length && near(sum(fixed), total)) return new Set(fixed);
  return null;
}

/**
 * AI 응답(raw)을 우리 견적 양식으로. 반환:
 *  form  — 견적 화면에 채울 값 (quote_options 는 공장 원가 그대로, 마진 0)
 *  checks — [{ level: 'error'|'warn'|'info', text }] 직원이 적용 전에 봐야 할 것
 *  summary — { currency, included_total, stated_total, optional_total, items, optional }
 */
export function normalizeImport(raw: any) {
  const r = raw || {};
  const checks: { level: string; text: string }[] = [];
  const currency = currencyOf(r.currency, (r.items || []).map((i: any) => currencyOf(i?.currency, '')).find(Boolean) || 'CNY');
  const statedTotal = num(r.stated_total);

  // 1) 줄 정리: 이름·사양 한/중 분리, 수량·단위, 단가·금액 후보
  const rows = (Array.isArray(r.items) ? r.items : []).slice(0, 100).map((it: any, idx: number) => {
    const nameSplit = splitKoCn(`${s(it?.name_ko)}\n${s(it?.name_cn)}`);
    const specSplit = splitKoCn(`${s(it?.spec_ko, 1500)}\n${s(it?.spec_cn, 1500)}`);
    const qtyRaw = num(it?.quantity);
    const qty = qtyRaw && qtyRaw > 0 ? qtyRaw : 1;
    return {
      idx,
      name_ko: nameSplit.ko || nameSplit.cn,
      name_cn: nameSplit.cn,
      spec_ko: specSplit.ko || specSplit.cn,
      spec_cn: specSplit.cn,
      qty,
      qtyGuessed: !(qtyRaw && qtyRaw > 0),
      unit_label: unitOf(it?.unit_label),
      unit_price: num(it?.unit_price),
      amount: num(it?.amount),
      currency: currencyOf(it?.currency, currency),
      lead: parseLeadTime(it?.lead_time),
      note: splitKoCn(s(it?.note, 500)),
      in_total: typeof it?.in_total === 'boolean' ? it.in_total : null,
    };
  }).filter((x: any) => x.name_ko || x.unit_price || x.amount);

  // 2) 단가·금액 가리기. 둘 다 있으면 곱셈 검산, 하나만 있으면 칸 이름대로.
  //    단가와 금액이 같은 값으로 왔는데 수량이 1보다 크면(칸을 헷갈린 경우) 견적서 합계로 어느 쪽인지 정한다
  const ambiguous: any[] = [];
  for (const x of rows) {
    if (x.unit_price != null && x.amount != null) {
      if (x.qty > 1 && near(x.unit_price, x.amount)) { ambiguous.push(x); continue; }
      if (!near(x.unit_price * x.qty, x.amount)) checks.push({ level: 'warn', text: `${x.name_ko}: 단가 ${x.unit_price} × 수량 ${x.qty} = ${round2(x.unit_price * x.qty)} 이 금액 ${x.amount} 와 다릅니다. 금액 기준으로 단가를 다시 계산했습니다.` });
      x.unit_price = round2(x.amount / x.qty);
    } else if (x.amount != null) {
      x.unit_price = round2(x.amount / x.qty);
    } else if (x.unit_price != null) {
      x.amount = round2(x.unit_price * x.qty);
    } else {
      x.unit_price = 0; x.amount = 0;
      checks.push({ level: 'error', text: `${x.name_ko}: 금액을 찾지 못했습니다. 직접 넣어 주세요.` });
    }
  }
  if (ambiguous.length) {
    // 두 해석(줄 합계 / 단가) 중 견적서 합계와 맞는 쪽 (합계에 들어가는 항목 조합까지 함께 본다)
    const lineFits = statedTotal != null && totalFit(rows, statedTotal, (x: any) => x.amount) !== null;
    const unitFits = statedTotal != null && totalFit(rows, statedTotal, (x: any) => (ambiguous.includes(x) ? x.amount * x.qty : x.amount)) !== null;
    for (const x of ambiguous) {
      if (unitFits && !lineFits) x.amount = round2(x.amount * x.qty);
      x.unit_price = round2(x.amount / x.qty);
    }
    if (!lineFits && !unitFits) checks.push({ level: 'warn', text: `${ambiguous.map((x) => x.name_ko).join(', ')}: 금액 칸이 단가인지 줄 합계인지 견적서 합계로도 가려지지 않아 줄 합계로 보았습니다. 원본을 확인해 주세요.` });
    else checks.push({ level: 'info', text: `${ambiguous.map((x) => x.name_ko).join(', ')}: 견적서 합계와 맞춰 보니 금액 칸은 ${unitFits && !lineFits ? '단가' : '줄 합계'}입니다.` });
  }

  // 3) 합계 포함 여부: AI 표시가 없는 줄은 견적서 합계와 맞는 조합으로 정한다 (전부, 또는 앞에서부터 이어진 줄까지)
  if (statedTotal != null) {
    const fit = totalFit(rows, statedTotal, (x: any) => x.amount);
    if (fit) rows.filter((x: any) => x.in_total === null).forEach((x: any) => { x.in_total = fit.has(x); });
  }
  rows.forEach((x: any) => { if (x.in_total === null) x.in_total = true; });
  const included = rows.filter((x: any) => x.in_total);
  const optional = rows.filter((x: any) => !x.in_total);
  const includedTotal = round2(included.reduce((a: number, x: any) => a + x.amount, 0));
  const optionalTotal = round2(optional.reduce((a: number, x: any) => a + x.amount, 0));
  if (statedTotal != null) {
    if (near(includedTotal, statedTotal)) checks.push({ level: 'info', text: `견적서 합계 ${statedTotal.toLocaleString()} ${currency} 와 포함 항목 합이 맞습니다.${optional.length ? ` 합계에 들어가지 않는 ${optional.length}개 항목은 선택 사양으로 두었습니다.` : ''}` });
    else checks.push({ level: 'error', text: `포함 항목 합 ${includedTotal.toLocaleString()} 이 견적서 합계 ${statedTotal.toLocaleString()} ${currency} 와 다릅니다. 합계에 넣을 항목과 금액을 확인해 주세요.` });
  } else if (rows.length) checks.push({ level: 'warn', text: '견적서에서 합계를 찾지 못해 검산하지 못했습니다. 항목 금액을 원본과 대조해 주세요.' });
  if (rows.some((x: any) => x.qtyGuessed)) checks.push({ level: 'warn', text: `수량이 없는 줄은 1로 두었습니다: ${rows.filter((x: any) => x.qtyGuessed).map((x: any) => x.name_ko).join(', ')}` });
  if (new Set(rows.map((x: any) => x.currency)).size > 1) checks.push({ level: 'warn', text: '항목마다 통화가 다릅니다. 통화를 확인해 주세요.' });

  // 4) 납기: 포함 항목 중 가장 긴 영업일, 조건 문장도 본다
  const terms = (Array.isArray(r.terms) ? r.terms : []).map((t: any) => {
    const sp = splitKoCn(`${s(t?.text_ko)}\n${s(t?.text_cn)}`);
    return { ko: sp.ko || sp.cn, cn: sp.cn, kind: TERM_KINDS.includes(t?.kind) ? t.kind : 'OTHER' };
  }).filter((t: any) => t.ko);
  const leads = [...included.map((x: any) => x.lead), ...terms.filter((t: any) => t.kind === 'DELIVERY').map((t: any) => parseLeadTime(`${t.ko} ${t.cn}`))].filter(Boolean);
  const leadBusiness = Math.max(0, ...leads.map((l: any) => l.business || 0)) || null;
  const leadDays = leadBusiness ? null : Math.max(0, ...leads.map((l: any) => l.days || 0)) || null;

  // 5) 조건 나누기
  const clientLines: string[] = [];
  const internalLines: string[] = [];
  let paymentPending = false;
  let factoryValidity: number | null = null;
  for (const t of terms) {
    const text = t.ko;
    if (t.kind === 'DELIVERY') { internalLines.push(`공장 납기 조건: ${text}`); continue; } // 우리 견적서의 납기 줄로 옮긴다
    if (t.kind === 'VALIDITY') { factoryValidity = validityDays(`${t.ko} ${t.cn}`); internalLines.push(`공장 견적 유효기간: ${text}`); continue; }
    if (t.kind === 'PAYMENT' || t.kind === 'WARRANTY') {
      if (TBD.test(`${t.ko} ${t.cn}`)) { paymentPending = paymentPending || t.kind === 'PAYMENT' || /지불|결제|付款|支付|payment/i.test(`${t.ko} ${t.cn}`); clientLines.push(text); }
      else clientLines.push(text);
      continue;
    }
    if (t.kind === 'SHIPPING') { internalLines.push(`공장 운송 조건: ${text}`); continue; }
    clientLines.push(text);
  }
  const notes = (Array.isArray(r.notes) ? r.notes : []).map((n: any) => splitKoCn(s(n, 600))).map((n: any) => n.ko || n.cn).filter(Boolean);
  // 줄별 비고는 사양 끝에 붙인다 (예: '수출용 목재 상자 포함')
  const options = rows.map((x: any) => ({
    option_name: x.name_ko,
    option_name_cn: x.name_cn,
    specification: [x.spec_ko, x.note.ko].filter(Boolean).join('\n'),
    specification_cn: [x.spec_cn, x.note.cn].filter(Boolean).join('\n'),
    quantity: x.qty,
    unit_label: x.unit_label,
    unit_price: x.unit_price,
    currency: x.currency,
    margin_percent: 0,
    optional: !x.in_total,
    lead_time: x.lead?.text || '',
  }));
  const specTable = (Array.isArray(r.spec_table) ? r.spec_table : []).map((row: any) => {
    const lab = splitKoCn(`${s(row?.label_ko, 120)}\n${s(row?.label_cn, 120)}`);
    // 값에 '5세트 / 5付' 처럼 중국어가 같이 있으면 한국어 쪽만 (견적서 PDF 글꼴에 한자가 없다)
    const val = splitKoCn(s(row?.value, 200));
    return { label: lab.ko || lab.cn, label_cn: lab.cn, value: (val.ko || val.cn).replace(/\s*\n\s*/g, ' / ') };
  }).filter((row: any) => row.label && row.value).slice(0, 40);

  const supplier = s(r.supplier_name, 200);
  const quoteDate = /^\d{4}-\d{2}-\d{2}$/.test(s(r.quote_date, 10)) ? s(r.quote_date, 10) : '';
  const validity = factoryValidity ? Math.min(DEFAULT_VALIDITY_DAYS, factoryValidity) : DEFAULT_VALIDITY_DAYS;
  if (factoryValidity && factoryValidity < DEFAULT_VALIDITY_DAYS) checks.push({ level: 'warn', text: `공장 견적 유효기간이 ${factoryValidity}일이라 우리 견적 유효기간도 ${factoryValidity}일로 맞췄습니다.` });
  if (paymentPending) checks.push({ level: 'info', text: '공장 견적에 지불 조건이 "계약 시 확정"이라 우리 견적서에도 결제 조건을 "계약 시 확정"으로 표시합니다.' });
  if (leadBusiness) checks.push({ level: 'info', text: `납기를 "선금 입금 후 ${leadBusiness}영업일"로 옮겼습니다 (달력 기준 약 ${Math.ceil(leadBusiness * 7 / 5)}일 이상, 중국 휴무가 끼면 더 깁니다).` });
  if (!s(r.incoterms, 20)) checks.push({ level: 'info', text: '인코텀즈가 적혀 있지 않습니다. 견적 화면에서 정해 주세요.' });

  const remarks = [
    ...notes.map((n: string) => `고객 확인: ${n.replace(/^고객 확인\s*(반영)?\s*[:：]?\s*/, '')}`),
    ...clientLines.map((t) => t.replace(/^\d+[.)]\s*/, '')),
  ].map((t, i) => `${i + 1}. ${t}`).join('\n');
  const internal = [
    supplier && `공장 견적: ${supplier}${quoteDate ? ` · ${quoteDate}` : ''} · ${currency}`,
    statedTotal != null && `공장 견적서 합계: ${statedTotal.toLocaleString()} ${currency}${s(r.total_note, 200) ? ` (${s(r.total_note, 200)})` : ''}`,
    ...internalLines,
  ].filter(Boolean).join('\n');

  return {
    form: {
      factory_name: supplier,
      product_name: s(r.product_name, 200),
      model_name: s(r.model_name, 200),
      quote_title: splitKoCn(s(r.title, 300)).ko || s(r.title, 300),
      incoterms: s(r.incoterms, 20).toUpperCase(),
      logistics_cost: num(r.logistics_cost),
      quote_options: options,
      spec_table: specTable,
      remarks,
      internal_notes: internal,
      lead_time_business_days: leadBusiness,
      shipping_days: leadDays,
      validity_days: validity,
      payment_terms_pending: paymentPending,
      factory_quote_date: quoteDate,
      factory_cost_currency: currency,
    },
    checks,
    summary: { currency, included_total: includedTotal, stated_total: statedTotal, optional_total: optionalTotal, items: included.length, optional: optional.length },
  };
}

// 예전 parseQuotationExcel 응답 형식 (AI 비서가 쓴다): 선택 사양도 표시해서 돌려준다
export function legacyShape(raw: any, normalized: any) {
  const f = normalized.form;
  return {
    factory_name: f.factory_name, product_name: f.product_name, model_name: f.model_name, incoterms: f.incoterms, logistics_cost: f.logistics_cost ?? undefined,
    items: f.quote_options.map((o: any) => ({ option_name: o.option_name, specification: o.specification, quantity: o.quantity, unit_label: o.unit_label, unit_price: o.unit_price, currency: o.currency, optional: o.optional })),
  };
}
