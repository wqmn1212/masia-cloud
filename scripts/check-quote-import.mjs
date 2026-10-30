// 견적서 가져오기 검산: 금액 칸 해석(단가/줄 합계), 합계 포함·선택 사양, 한·중 분리, 단위, 영업일 납기, 사양표, 조건 나누기,
// 결제 '계약 시 확정', 유효기간, 그리고 워드(.docx) 글·표 꺼내기와 파일 종류 가리기. 예시는 ZP-5B 타정기 공장 견적서.
// 실행: npm run check:quote-import
import assert from 'node:assert/strict';
import * as Q from '../base44/shared/quoteImport.ts';
import * as X from '../base44/shared/docxText.ts';

// ZP-5B 견적서를 AI 가 읽었을 때 나올 수 있는 값 (금액 칸을 단가로도 적어 버린 경우)
const terms = [
  { text_ko: '1. 수출용 목재 상자 포함', text_cn: '含出口木箱', kind: 'PACKAGING' },
  { text_ko: '2. 납기: 계약금 수령 후 20작업일', text_cn: '交期：收到预付款后 20 个工作日（以合同为准）', kind: 'DELIVERY' },
  { text_ko: '3. 금형 각인 도안은 고객 제공', text_cn: '模具刻印图案由客户提供', kind: 'CLIENT_SUPPLIED' },
  { text_ko: '4. 강제 배출 장치는 선택 사양 (별도 문의)', text_cn: '强制出料装置为选配项（另行咨询）', kind: 'OPTIONAL_EQUIPMENT' },
  { text_ko: '5. 보증·지불 조건은 계약 시 확정', text_cn: '质保与付款条件以合同为准', kind: 'PAYMENT' },
  { text_ko: '6. 이 견적 유효기간: 견적일로부터 30일', text_cn: '本报价有效期：自报价日起 30 天', kind: 'VALIDITY' },
];
const specs = [['금형 수', '冲模数', '5세트 / 5付'], ['최대 타정 압력', '最大压片压力', '60 kN'], ['최대 타정 직경', '最大压片直径', '20 mm'], ['최대 충전 깊이', '最大充填深度', '15 mm'], ['최대 정제 두께', '最大片剂厚度', '6 mm'], ['회전 테이블 회전 속도', '转台转速', '30 r/min'], ['최대 생산 능력', '最大生产能力', '9,000 정/시간 / 片/小时'], ['모터 출력', '电机功率', '2.2 kW'], ['외형 치수', '外形尺寸', '480 × 630 × 1100 mm'], ['본체 중량', '主机重量', '320 kg']];
const base = {
  supplier_name: '운용(云涌)', quote_date: '2026-10-29', currency: '人民币元', title: '최종 견적서 — 회전식 타정기 ZP-5B 및 이형 금형\n最终报价单 — 旋转式压片机 ZP-5B 及异型模具',
  product_name: '회전식 타정기', model_name: 'ZP-5B',
  stated_total: '17,000', total_note: '무도금 옵션 기준 (본체 16,000 + 금형 1,000)',
  spec_table: specs.map(([a, b, c]) => ({ label_ko: a, label_cn: b, value: c })),
  terms, notes: ['고객 확인 반영: 도금 불요 → 무도금 옵션 선택 / 已按客户确认：不需电镀 → 选择无电镀方案'],
};
const items = (mode) => [
  { name_ko: '회전식 타정기 (본체)', name_cn: '旋转式压片机（主机）', spec_ko: 'ZP-5B\n5금형 · 60kN · 9,000정/시간 · 2.2kW', spec_cn: '5冲 · 60kN · 9,000片/小时 · 2.2kW', quantity: 1, unit_label: '대', ...(mode === 'confused' ? { unit_price: 16000, amount: 16000 } : { amount: 16000 }), lead_time: '20작업일 / 20工作日', note: '수출용 목재 상자 포함 / 含出口木箱', ...(mode === 'flags' ? { in_total: true } : {}) },
  { name_ko: '이형 금형 (무도금) ★', name_cn: '异型模具（未电镀）★', spec_ko: '고객 도면 기준\n원형 Φ9mm · 분할선 · 각인 깊이 1.5mm', spec_cn: '按客户图纸\n圆形 Φ9mm · 带分线 · 刻印深度 1.5mm', quantity: '5', unit_label: '5세트', ...(mode === 'confused' ? { unit_price: 1000, amount: 1000 } : { amount: 1000 }), lead_time: '20작업일', note: '고객 확인 선택 옵션', ...(mode === 'flags' ? { in_total: true } : {}) },
  { name_ko: '이형 금형 (전기 크롬 도금)', name_cn: '异型模具（电镀铬）', spec_ko: '동일 규격\n경질 크롬 도금 처리', quantity: 5, unit_label: '세트', ...(mode === 'confused' ? { unit_price: 1200, amount: 1200 } : { amount: 1200 }), lead_time: '20작업일', ...(mode === 'flags' ? { in_total: false } : {}) },
  { name_ko: '이형 금형 (CrN 코팅)', name_cn: '异型模具（CrN涂层）', spec_ko: '동일 규격\nCrN 질화크롬 코팅 / PVD 진공 코팅', quantity: 5, unit_label: '세트', ...(mode === 'confused' ? { unit_price: 1500, amount: 1500 } : { amount: 1500 }), lead_time: '20작업일', ...(mode === 'flags' ? { in_total: false } : {}) },
];

for (const mode of ['flags', 'amounts', 'confused']) {
  const { form, checks, summary } = Q.normalizeImport({ ...base, items: items(mode) });
  const o = form.quote_options;
  assert.deepEqual(o.map((x) => [x.option_name, x.quantity, x.unit_label, x.unit_price, x.optional]), [
    ['회전식 타정기 (본체)', 1, '대', 16000, false],
    ['이형 금형 (무도금) ★', 5, '세트', 200, false],
    ['이형 금형 (전기 크롬 도금)', 5, '세트', 240, true],
    ['이형 금형 (CrN 코팅)', 5, '세트', 300, true],
  ], `${mode}: 금형 1,000은 5세트 줄 합계 → 단가 200, 합계에 안 드는 도금·코팅은 선택 사양`);
  assert.deepEqual([summary.included_total, summary.stated_total, summary.optional_total, summary.currency], [17000, 17000, 2700, 'CNY'], mode);
  assert.ok(checks.some((c) => c.level === 'info' && /합계 17,000 CNY 와 포함 항목 합이 맞습니다/.test(c.text)), mode);
  assert.equal(checks.filter((c) => c.level === 'error').length, 0, `${mode}: 오류 없음`);
  if (mode === 'confused') assert.ok(checks.some((c) => /금액 칸은 줄 합계/.test(c.text)), '헷갈린 칸은 합계로 판단');
  assert.equal(o[0].option_name_cn, '旋转式压片机（主机）');
  assert.equal(o[0].specification, 'ZP-5B\n5금형 · 60kN · 9,000정/시간 · 2.2kW\n수출용 목재 상자 포함', '줄 비고는 사양 끝에');
  assert.equal(o[0].specification_cn, '5冲 · 60kN · 9,000片/小时 · 2.2kW\n含出口木箱');
  assert.equal(o[0].currency, 'CNY');
  assert.equal(form.lead_time_business_days, 20, '20작업일 → 영업일 납기');
  assert.equal(form.shipping_days, null);
  assert.equal(form.payment_terms_pending, true, '지불 조건 계약 시 확정');
  assert.equal(form.validity_days, 30);
  assert.equal(form.factory_name, '운용(云涌)');
  assert.equal(form.factory_quote_date, '2026-10-29');
  assert.equal(form.quote_title, '최종 견적서 — 회전식 타정기 ZP-5B 및 이형 금형');
  assert.equal(form.spec_table.length, 10);
  assert.deepEqual(form.spec_table[6], { label: '최대 생산 능력', label_cn: '最大生产能力', value: '9,000 정/시간' }, '값의 중국어 쪽은 뺀다 (PDF 글꼴에 한자 없음)');
  assert.equal(form.spec_table[0].value, '5세트');
  assert.equal(form.spec_table[1].value, '60 kN');
  assert.equal(form.remarks, [
    '1. 고객 확인: 도금 불요 → 무도금 옵션 선택',
    '2. 수출용 목재 상자 포함',
    '3. 금형 각인 도안은 고객 제공',
    '4. 강제 배출 장치는 선택 사양 (별도 문의)',
    '5. 보증·지불 조건은 계약 시 확정',
  ].join('\n'), '고객용 조건: 납기·유효기간은 우리 견적서 조건 줄로 옮기고 나머지는 비고');
  assert.match(form.internal_notes, /^공장 견적: 운용\(云涌\) · 2026-10-29 · CNY/);
  assert.match(form.internal_notes, /공장 견적서 합계: 17,000 CNY \(무도금 옵션 기준/);
  assert.match(form.internal_notes, /공장 납기 조건: 2\. 납기: 계약금 수령 후 20작업일/);
  assert.match(form.internal_notes, /공장 견적 유효기간: 6\. 이 견적 유효기간/);
  assert.equal(form.incoterms, '');
  assert.ok(checks.some((c) => /인코텀즈가 적혀 있지 않습니다/.test(c.text)));
}

// 합계가 안 맞으면 오류, 유효기간이 짧으면 맞춘다, 단가·금액이 서로 다르면 경고
let r = Q.normalizeImport({ ...base, stated_total: 18000, items: items('amounts') });
assert.ok(r.checks.some((c) => c.level === 'error' && /견적서 합계 18,000/.test(c.text)));
assert.equal(r.form.quote_options.every((x) => !x.optional), true, '맞는 조합이 없으면 모두 합계에 넣고 오류로 알린다');
r = Q.normalizeImport({ ...base, terms: [{ text_ko: '유효기간 15일', kind: 'VALIDITY' }], items: items('amounts') });
assert.equal(r.form.validity_days, 15);
assert.equal(r.form.payment_terms_pending, false);
r = Q.normalizeImport({ currency: 'USD', items: [{ name_ko: 'Sealing machine', quantity: 2, unit_price: 500, amount: 1200 }] });
assert.equal(r.form.quote_options[0].unit_price, 600, '금액 기준으로 단가를 다시 계산');
assert.ok(r.checks.some((c) => /단가 500 × 수량 2 = 1000 이 금액 1200/.test(c.text)));
assert.ok(r.checks.some((c) => /합계를 찾지 못해/.test(c.text)));
r = Q.normalizeImport({ items: [{ name_cn: '包装袋', quantity: 10000, unit_price: '¥0.35' }, { name_ko: '금형비', amount: '3,000元' }] });
assert.deepEqual(r.form.quote_options.map((x) => [x.option_name, x.quantity, x.unit_price, x.currency]), [['包装袋', 10000, 0.35, 'CNY'], ['금형비', 1, 3000, 'CNY']]);
assert.ok(r.checks.some((c) => /수량이 없는 줄은 1로/.test(c.text)));
assert.deepEqual(Q.parseLeadTime('交期 35天'), { business: null, days: 35, text: '交期 35天' });
assert.equal(Q.parseLeadTime('25-30 working days').business, 30, '범위면 긴 쪽');
assert.equal(Q.parseLeadTime('선금 후 20~25영업일').business, 25);
assert.deepEqual(Q.splitKoCn('회전식 타정기\n旋转式压片机'), { ko: '회전식 타정기', cn: '旋转式压片机' });
assert.equal(Q.unitOf('5세트'), '세트');
assert.equal(Q.unitOf('1台'), '台');

// 예전 형식 (AI 비서)
const legacy = Q.legacyShape({}, Q.normalizeImport({ ...base, items: items('flags') }));
assert.deepEqual(legacy.items.map((i) => [i.option_name, i.unit_price, i.optional]), [['회전식 타정기 (본체)', 16000, false], ['이형 금형 (무도금) ★', 200, false], ['이형 금형 (전기 크롬 도금)', 240, true], ['이형 금형 (CrN 코팅)', 300, true]]);
console.log('quote-import normalize ok');

// ── 워드(.docx): 직접 만든 ZIP (본문은 deflate, 나머지는 무압축) ──
const enc = new TextEncoder();
const deflate = async (b) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
async function zip(files) {
  const parts = [], central = [];
  let off = 0;
  for (const [name, text, method] of files) {
    const raw = enc.encode(text), data = method === 8 ? await deflate(raw) : raw, nm = enc.encode(name);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(8, method, true); lh.setUint32(18, data.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, nm.length, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(10, method, true); ch.setUint32(20, data.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    parts.push(new Uint8Array(lh.buffer), nm, data); central.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
const P = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const cell = (...lines) => `<w:tc><w:tcPr/>${lines.map(P).join('')}</w:tc>`;
const docXml = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${P('最终报价单 — 旋转式压片机 ZP-5B')}<w:p><w:r><w:t>供应商：云涌</w:t><w:tab/><w:t>单位：人民币元</w:t><w:br/><w:t>报价日期 2026-10-29</w:t></w:r></w:p><w:p><w:r><w:t/></w:r></w:p>`
  + `<w:tbl><w:tr>${cell('번호', '编号')}${cell('품목', '项目')}${cell('금액', '金额')}</w:tr><w:tr>${cell('1')}${cell('회전식 타정기', '旋转式压片机（主机）')}${cell('16,000')}</w:tr><w:tr>${cell('2')}${cell('이형 금형 &amp; 무도금')}${cell('1,000')}</w:tr></w:tbl>${P('合计 17,000 &lt;无电镀&gt;')}</w:body></w:document>`;
const docx = await zip([['[Content_Types].xml', '<Types/>', 0], ['word/document.xml', docXml, 8], ['word/styles.xml', '<styles/>', 8]]);
const text = await X.docxToText(docx);
assert.equal(text, [
  '最终报价单 — 旋转式压片机 ZP-5B',
  '供应商：云涌\t单位：人民币元\n报价日期 2026-10-29',
  '번호 / 编号 | 품목 / 项目 | 금액 / 金额',
  '1 | 회전식 타정기 / 旋转式压片机（主机） | 16,000',
  '2 | 이형 금형 & 무도금 | 1,000',
  '',
  '合计 17,000 <无电镀>',
].join('\n'));
assert.equal(await X.fileKind(docx, 'quote.bin'), 'docx', 'ZIP 안에 word/document.xml 이 있으면 워드');
assert.equal(await X.fileKind(await zip([['xl/workbook.xml', '<w/>', 0]]), 'a.xlsx'), 'xlsx');
assert.equal(await X.fileKind(enc.encode('%PDF-1.7 ...'), 'x'), 'pdf');
assert.equal(await X.fileKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'x'), 'image');
assert.equal(await X.fileKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), 'old.doc'), 'doc');
assert.equal(await X.fileKind(enc.encode('a,b'), 'q.csv'), 'csv');
await assert.rejects(X.docxToText(enc.encode('not a zip at all, definitely not')), /ZIP 파일이 아닙니다/);
await assert.rejects(X.docxToText(await zip([['xl/workbook.xml', '<w/>', 0]])), /word\/document\.xml/);
console.log('quote-import docx ok');

// ── 견적 계산: 선택 사양은 합계·원가·수수료에서 빠지고, 같은 마진·수수료 비율로 '선택 시 금액'만 낸다 ──
const { calculateQuote, ceilToUnit } = await import('../src/components/quotation/quoteCurrency.js');
const imported = Q.normalizeImport({ ...base, items: items('flags') }).form;
const quoteForm = { quote_options: imported.quote_options.map((o) => ({ ...o, margin_percent: 10 })), final_currency: 'CNY', exchange_rate_usd: 1380, exchange_rate_usd_cny: 7.1, masir_fee_type: 'PERCENT', masir_fee_value: 0 };
let calc = calculateQuote(quoteForm);
assert.deepEqual(calc.lines.map((l) => [l.option_name, l.quantity, l.unit_label, l.unit_price, l.total]), [['회전식 타정기 (본체)', 1, '대', 17600, 17600], ['이형 금형 (무도금) ★', 5, '세트', 220, 1100]]);
assert.equal(calc.total, 18700, '본체 + 무도금 금형만 합계');
assert.deepEqual(calc.optionalLines.map((l) => [l.option_name, l.unit_price, l.total]), [['이형 금형 (전기 크롬 도금)', 264, 1320], ['이형 금형 (CrN 코팅)', 330, 1650]]);
assert.ok(Math.abs(calc.factoryUSD - 17000 / 7.1) < 1e-6, '공장 원가에도 선택 사양을 넣지 않는다');
assert.equal(calc.optionLine[2].optional, true);
assert.equal(calc.optionLine[1].unit_price, 220, '편집 화면 줄 번호와 금액 줄이 맞는다');
calc = calculateQuote({ ...quoteForm, masir_fee_value: 5 });
const factor = 1 + (17000 * 0.05) / (17000 * 1.1);
assert.equal(calc.lines[1].unit_price, ceilToUnit(200 * 1.1 * factor, 'CNY'), '수수료는 포함 항목 기준으로 녹인다');
assert.equal(calc.optionalLines[0].unit_price, ceilToUnit(240 * 1.1 * factor, 'CNY'), '선택 사양도 같은 비율');
assert.equal(calc.total, calc.lines.reduce((a, l) => a + l.total, 0));
const noOptional = calculateQuote({ ...quoteForm, quote_options: quoteForm.quote_options.map((o) => ({ ...o, optional: false })) });
assert.equal(noOptional.lines.length, 4);
assert.equal(noOptional.optionalLines.length, 0, '선택 사양이 없으면 예전과 같다');
console.log('quote-import calculation ok');

// ── 서버 함수 parseQuotationFile (가짜 SDK): 워드는 글로 바꿔 AI 에 주고, PDF 는 파일을 그대로 보여 준다 ──
await import('./fnmock/register.mjs');
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const files = { 'https://files.example/zp5b.docx': docx, 'https://files.example/zp5b.pdf': enc.encode('%PDF-1.7 fake') };
globalThis.fetch = async (url) => (files[url] ? new Response(files[url]) : new Response('nope', { status: 404 }));
const llmCalls = [];
globalThis.__llm = async (a) => { llmCalls.push(a); return { ...base, items: items('confused') }; };
globalThis.__db = {};
globalThis.__user = { id: 'c1', account_tier: 'client', is_active: true };
let res = await call('parseQuotationFile', { file_url: 'https://files.example/zp5b.docx' });
assert.equal(res.status, 403, '고객 계정은 쓸 수 없다');
globalThis.__user = { id: 's1', account_tier: 'sub', is_active: true, tenant_id: 't1' };
res = await call('parseQuotationFile', { file_url: 'http://files.example/zp5b.docx' });
assert.equal(res.status, 400, 'https 만');
res = await call('parseQuotationFile', { file_url: 'https://files.example/zp5b.docx', file_name: 'ZP-5B 견적.docx' });
assert.equal(res.status, 200, JSON.stringify(res.data));
assert.equal(res.data.kind, 'docx');
assert.match(llmCalls[0].prompt, /--- 견적서 내용 \(docx\) ---\n最终报价单/);
assert.equal(llmCalls[0].file_urls, undefined);
assert.equal(res.data.import.summary.included_total, 17000);
assert.deepEqual(res.data.data.items.map((i) => i.optional), [false, false, true, true], '예전 형식에도 선택 사양 표시');
res = await call('parseQuotationFile', { file_url: 'https://files.example/zp5b.pdf', file_name: 'q.pdf' });
assert.equal(res.data.kind, 'pdf');
assert.deepEqual(llmCalls[1].file_urls, ['https://files.example/zp5b.pdf'], 'PDF 는 AI 가 파일을 직접 본다');
res = await call('parseQuotationExcel', { file_url: 'https://files.example/zp5b.docx' });
assert.equal(res.status, 200, 'AI 비서용 예전 함수도 같은 추출 (워드 포함)');
assert.equal(res.data.import.form.lead_time_business_days, 20);
files['https://files.example/old.doc'] = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]);
res = await call('parseQuotationFile', { file_url: 'https://files.example/old.doc', file_name: 'old.doc' });
assert.match(res.data.error, /옛 워드\(\.doc\)/);
console.log('quote-import functions ok');
