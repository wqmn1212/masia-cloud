// 견적 비교표 검산: 앱에 있는 실제 견적(공장명만 바꿈)으로 줄 맞추기·도착 원가·경고·고객 스냅샷을 확인한다.
// 실행: npm run check:quote-compare
import assert from 'node:assert/strict';
import {
  buildSheet, computeSheet, sheetWarnings, clientView, factoryQuestions, factoryNameLeaks, defaultSelection,
  moveCell, setCellState, parseLeadTime, extractConditions, sourceHash, similarity, CELL_STATE, ROW_KIND,
} from '../src/lib/quoteCompare.js';
import { mergeRates } from '../src/lib/landedCost.js';

const rates = mergeRates();
const byId = (qs) => Object.fromEntries(qs.map((q) => [q.id, q]));
const codes = (w, opt) => w.filter((x) => !opt || x.option === opt).map((x) => x.code);
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const opt = (o) => ({ quantity: 1, margin_percent: 0, currency: 'CNY', specification: '', ...o });

// ── 1) 자동 포장기: 공장 3곳, 같은 장치를 다른 이름으로 견적 (예전 견적: 위안 기준 PDF) ──
const yun = { id: 'y', factory_name: '공장 가', status: 'REVIEW', created_date: '2026-08-20', incoterms: 'EXW', shipping_mode: 'SEA_LCL', shipping_days: 0, advance_payment_percent: 50, balance_payment_percent: 50, final_currency: 'USD', final_client_price: 231000, factory_total_cost: 220000, exchange_rate_usd: 1411.93, remarks: '',
  quote_options: [opt({ option_name: '상자 4-in-1 투입 기구', unit_price: 170000, margin_percent: 5 }), opt({ option_name: '이중 코너 라벨링기', unit_price: 50000, margin_percent: 5 })] };
const mtk = { id: 'm', factory_name: '공장 나', status: 'REVIEW', created_date: '2026-08-11', incoterms: 'EXW', shipping_mode: 'SEA_LCL', shipping_days: 45, advance_payment_percent: 50, balance_payment_percent: 50, final_currency: 'USD', final_client_price: 241500, factory_total_cost: 230000, exchange_rate_usd: 1407.7, remarks: '',
  quote_options: [opt({ option_name: '자동 포장기', specification: 'MTK-150H', unit_price: 135000, margin_percent: 5 }), opt({ option_name: '자동 마스크 급식 시스템', specification: '맞춤 제작', unit_price: 40000, margin_percent: 5 }), opt({ option_name: '코너 라벨링 기계', specification: '투명 라벨', unit_price: 55000, margin_percent: 5 })] };
const kit = { id: 'k', factory_name: '공장 다', status: 'REJECTED', created_date: '2026-08-07', incoterms: 'EXW', shipping_mode: 'SEA_LCL', shipping_days: 35, advance_payment_percent: 50, balance_payment_percent: 50, final_currency: 'USD', final_client_price: 565560, factory_total_cost: 471300, exchange_rate_usd: 1418,
  remarks: '※ 구매자는 주문 확정을 위해 50% 선불금을 지급하고, 검수 후 잔금 50%를 지급한 뒤 출고합니다.\n본 기계의 보증기간은 1년입니다.',
  quote_options: [opt({ option_name: '카토닝 기계', specification: '마스크팩 투입 장치 5세트 포함', unit_price: 263000, margin_percent: 20 }), opt({ option_name: '라벨링 기계', specification: '투명 라벨 양측 모서리 접착 라벨링기', unit_price: 89200, margin_percent: 20 }),
    opt({ option_name: '중국산 핫멜트 접착기 (접착기 둘 중 하나 선택)', specification: '선택 1번', unit_price: 30200, margin_percent: 20 }), opt({ option_name: '미국 Nordson 수입 핫멜트 접착기 (접착기 둘 중 하나 ', specification: '선택 2번', unit_price: 88900, margin_percent: 20 })] };
const na = { ...yun, id: 'n', factory_name: 'N/A', status: 'REJECTED', created_date: '2026-08-11' };

// 거절 견적은 미리 체크하지 않는다
assert.deepEqual(defaultSelection([yun, mtk, kit, na]), ['y', 'm']);
let sheet = buildSheet({ quotations: [yun, mtk, kit], title: '자동 포장기' });
assert.deepEqual(sheet.options.map((o) => o.label), ['A안', 'B안', 'C안']);
// 자동 맞추기는 라벨러 줄만 세 안을 묶는다 (이름이 모두 달라서)
const labeler = sheet.rows.find((r) => Object.keys(r.cells).length === 3);
assert.ok(labeler && /라벨/.test(labeler.label), '라벨러 줄');
assert.ok(similarity('이중 코너 라벨링기', '라벨링 기계') >= 0.5);
// 핫멜트 접착기 두 개는 하나의 선택 품목 줄
const hot = sheet.rows.find((r) => r.kind === ROW_KIND.OPTIONAL);
assert.equal(hot.cells.C.lines.length, 2);
assert.equal(sheet.rows.length, 6);
// 직원이 본체 줄을 합치고, 투입 장치 포함 여부를 정한다 (목업과 같은 상태)
const rowOf = (s, name) => s.rows.find((r) => r.label.includes(name)).key;
sheet = moveCell(sheet, 'B', rowOf(sheet, '자동 포장기'), rowOf(sheet, '투입 기구'));
sheet = moveCell(sheet, 'C', rowOf(sheet, '카토닝'), rowOf(sheet, '투입 기구'));
const feeder = rowOf(sheet, '급식');
sheet = setCellState(sheet, feeder, 'C', CELL_STATE.INCLUDED);
sheet = setCellState(sheet, feeder, 'A', CELL_STATE.UNKNOWN);
assert.equal(sheet.rows.length, 4);
const fxMid = { usd_krw: 1385, usd_cny: 6.7, date: '2026-10-25' };
let c = computeSheet({ ...sheet, base_currency: 'CNY' }, byId([yun, mtk, kit]), { rates, fx: fxMid });
const [A, B, C] = c.options;
near(B.totalCost, 230000);
near(C.totalCost, 352200); // 선택 품목(핫멜트)은 합계에서 뺀다
assert.equal(A.scopeDiff, true); // 투입 장치 확인 필요 → 최저가 표시에서 빠짐
assert.equal(B.scopeDiff, false);
assert.equal(C.scopeDiff, false);
assert.equal(c.best.perUnitCost, 'B');
// 고객 금액: 예전 견적은 PDF 합계(위안)를 원가 비율로 나눠 줄에 배분
near(B.totalClient, 241500, 1);
assert.equal(C.optionalExcluded, true);
near(C.totalClient, 565560 * 352200 / 471300, 1);
assert.equal(C.lead.days, 35);
assert.equal(c.best.lead, 'C');
assert.equal(C.conditions.warranty, '1년');
let w = sheetWarnings(c);
assert.ok(codes(w, 'A').includes('SCOPE_UNKNOWN'));
assert.ok(codes(w, 'A').includes('NO_LEAD'));
assert.ok(codes(w).includes('MARGIN_SPREAD'));
assert.ok(codes(w, 'C').includes('OPTIONAL_EXCLUDED'));
// 선택 품목을 고르면 합계에 들어간다
const chosen = { ...sheet, base_currency: 'CNY', options: sheet.options.map((o) => (o.key === 'C' ? { ...o, choice: { [hot.key]: 2 } } : o)) };
near(computeSheet(chosen, byId([yun, mtk, kit]), { rates, fx: fxMid }).options[2].totalCost, 352200 + 30200);
// 공장 질문: 납기가 없는 안
const fq = factoryQuestions(c);
assert.ok(fq.find((x) => x.key === 'A').text.includes('交期'));

// ── 2) 90도 라벨기: 같은 공장 두 모델 (안 비교), 새 견적 규칙(price_lines) ──
const remarksY = '6\t사용 전원\t220V/50Hz\n\n1. 결제 조건: 계약 체결 후 30% 선금.\n2. 납기: 선금 입금 후 20~25영업일 이내 발송한다.\n\n4. 애프터서비스: (1) 기계 전체는 1년간 무상 보증한다.';
const remarksS = '6. 사용 전원\t220V/50HZ\n\n2. 납기: 선금 입금 후 15영업일 이내에 출고합니다.\n\n4. 애프터서비스: (1) 완제품은 1년간 무상 보증합니다.';
const dbl = { id: 'd', factory_name: '공장 라', status: 'SENT', created_date: '2026-10-22', incoterms: 'CIF', shipping_mode: 'SEA_LCL', shipping_days: 0, advance_payment_percent: 30, balance_payment_percent: 70, final_currency: 'USD', final_total: 9214.49, rounding_version: 2, exchange_rate_usd: 1325.92, exchange_rate_usd_cny: 6.68, remarks: remarksY,
  price_lines: [{ option_name: '90도 양면 라벨부착기', specification: 'T-506', quantity: 1, unit_price: 8757.49, total: 8757.49 }, { option_name: '배송비', specification: '', quantity: 1, unit_price: 457, total: 457 }],
  quote_options: [opt({ option_name: '90도 양면 라벨부착기', specification: 'T-506', unit_price: 45000, margin_percent: 30 }), opt({ option_name: '배송비', unit_price: 457, currency: 'USD' })] };
const sgl = { id: 's', factory_name: '공장 라', status: 'SENT', created_date: '2026-10-21', incoterms: 'CIF', shipping_mode: 'SEA_LCL', shipping_days: 0, advance_payment_percent: 30, balance_payment_percent: 70, final_currency: 'USD', final_total: 5452.89, rounding_version: 2, exchange_rate_usd: 1325.92, exchange_rate_usd_cny: 6.68, remarks: remarksS, logistics_cost: 2625.24,
  price_lines: [{ option_name: '90도 단면라벨부착기', specification: 'T-512A', quantity: 1, unit_price: 5059.89, total: 5059.89 }, { option_name: '물류비 (Logistics & Shipping)', specification: 'CIF', quantity: 1, unit_price: 393, total: 393 }],
  quote_options: [opt({ option_name: '90도 단면라벨부착기', specification: 'T-512A', unit_price: 26000, margin_percent: 30 })] };
assert.deepEqual(parseLeadTime(dbl), { days: 25, unit: 'WORKDAY', text: '20~25영업일', source: 'REMARKS' });
assert.equal(parseLeadTime(sgl).days, 15);
// 날짜는 납기로 읽지 않는다
assert.equal(parseLeadTime({ remarks: '2026년 7월 15일 견적 기준' }), null);
sheet = buildSheet({ quotations: [dbl, sgl] });
assert.equal(sheet.rows.length, 1); // 양면·단면 부착기는 같은 줄
c = computeSheet({ ...sheet, base_currency: 'USD' }, byId([dbl, sgl]), { rates, fx: { usd_krw: 1325.92, usd_cny: 6.68 } });
assert.equal(c.rows[0].specDiff, true);
near(c.options[0].totalClient, 9214.49); // PDF 합계와 같아야 한다
near(c.options[1].totalClient, 5452.89); // 견적서에만 있는 물류비 줄도 포함
assert.equal(c.options[1].optionalExcluded, false);
assert.equal(c.options[0].landedStatus, 'NO_CARGO');
assert.equal(c.best.perUnit, 'B');
assert.equal(c.best.lead, 'B');
w = sheetWarnings(c);
assert.ok(codes(w, 'A').includes('POWER_50HZ'));
assert.ok(codes(w, 'A').includes('NO_CARGO'));
assert.equal(c.options[0].conditions.warranty, '1년');

// ── 3) 테이블상판: 같은 공장, 배송비 줄이 있는 안과 없는 안, 마진 0% 초안 ──
const remarksT = '※ 배송비는 인천 항구까지만 포함\n- 한국 배송비 별도 (착불로 진행)\n※ 결제 조건\n- 선금 30% $1,643.94';
const tDraft = { id: 't1', factory_name: '공장 마', status: 'DRAFT', created_date: '2026-10-02', incoterms: 'CIF', shipping_mode: 'SEA_LCL', shipping_days: 25, advance_payment_percent: 30, balance_payment_percent: 70, final_currency: 'USD', final_price_usd: 1643.94, exchange_rate_usd: 1370, exchange_rate_usd_cny: 6.7, remarks: remarksT,
  quote_options: [{ option_name: '라운드 테이블', specification: '750mm', quantity: 300, unit_price: 5.4798, currency: 'USD', margin_percent: 0, total_usd: 1643.94 }] };
const tAcc = { id: 't2', factory_name: '공장 마', status: 'ACCEPTED', created_date: '2026-09-30', incoterms: 'CIF', shipping_mode: 'SEA_LCL', shipping_days: 25, advance_payment_percent: 30, balance_payment_percent: 70, final_currency: 'USD', final_price_usd: 5479.8, exchange_rate_usd: 1370, exchange_rate_usd_cny: 6.7, remarks: remarksT,
  quote_options: [{ option_name: '라운드 테이블', specification: '750mm', quantity: 300, unit_price: 11.5, currency: 'USD', margin_percent: 40, total_usd: 3450 }, { option_name: '파레트', quantity: 7, unit_price: 10.5, currency: 'USD', margin_percent: 20, total_usd: 73.5 }, { option_name: '배송비', specification: '선전 -> 인천', quantity: 1, unit_price: 468, currency: 'USD', margin_percent: 20, total_usd: 468 }] };
sheet = buildSheet({ quotations: [tDraft, tAcc] });
assert.equal(sheet.rows.length, 1); // 배송비·파레트는 품목 줄이 아니다
sheet = { ...sheet, options: sheet.options.map((o) => ({ ...o, cargo: { cbm: 3, kg: 900 } })) };
c = computeSheet(sheet, byId([tDraft, tAcc]), { rates, fx: { usd_krw: 1385, usd_cny: 6.7 } });
const [T1, T2] = c.options;
near(T2.totalClient, 5479.8 * 1385, 1);
assert.equal(T2.calcTerm, 'CIF'); // CIF 견적의 배송비는 이미 운임 → 도착지 비용만 더함
assert.equal(T2.scopeAsk, false);
assert.ok(T2.landedExtra > 0 && T2.landedClient === T2.totalClient + T2.landedExtra);
assert.equal(c.qtyDiff, false);
w = sheetWarnings(c);
assert.ok(codes(w, 'A').includes('MARGIN_ZERO'));
assert.ok(codes(w).includes('MARGIN_SPREAD'));
assert.equal(c.allLanded, true);
assert.equal(c.best.landedPerUnit, 'A');

// ── 4) N30 포장재: 부분 견적, 사양 차이, 같은 공장 두 번, 수량 차이, 부가세 포함 견적 ──
const aegis = { id: 'n1', factory_name: 'DONGGUAN AEGIS TRADE CO.,LTD', status: 'DRAFT', created_date: '2026-10-20', incoterms: 'CIF', final_currency: 'USD',
  quote_options: [{ option_name: 'Base Color Box (Two-piece)', specification: '238*118*73mm', quantity: 3192, unit_price: 1.072, currency: 'USD', margin_percent: null }] };
const xhsAcc = { id: 'n2', factory_name: '공장 바', status: 'ACCEPTED', created_date: '2026-08-26', incoterms: 'CIF', shipping_mode: 'SEA_LCL', shipping_days: 20, advance_payment_percent: 50, balance_payment_percent: 50, final_currency: 'USD', final_price_usd: 9945, exchange_rate_usd: 1346.09, exchange_rate_usd_cny: 6.7, remarks: '※ 인천항까지 배송비 포함 (CIF)\n※ 조립비 포함',
  quote_options: [{ option_name: '싸바리박스', specification: '180G 스노우지 + 1700G 단면 백판지 238*118*73, 자재 두께:2.6mm', quantity: 5100, unit_price: 6, currency: 'CNY', margin_percent: 20, total_usd: 4567.164179104478 },
    { option_name: '설명서40p', specification: '128g 양면아트지', quantity: 5100, unit_price: 1.47, currency: 'CNY', margin_percent: 20, total_usd: 1118.955223880597 }] };
const xhsDraft = { ...xhsAcc, id: 'n3', status: 'DRAFT', created_date: '2026-08-07' };
const dot = { id: 'n4', factory_name: '.', status: 'DRAFT', created_date: '2026-08-12', incoterms: 'EXW', shipping_mode: 'SEA_LCL', shipping_days: 0, advance_payment_percent: 30, balance_payment_percent: 70, final_currency: 'USD', final_price_usd: 8256, final_client_price: 55772.0823798627, factory_total_cost: 46476.73531655225, exchange_rate_usd: 1417, remarks: '',
  quote_options: [{ option_name: '싸바리', quantity: 5000, unit_price: 0.863, currency: 'USD', margin_percent: 20, total_usd: 4315 }, { option_name: '설명서', quantity: 5000, unit_price: 0.088, currency: 'USD', margin_percent: 20, total_usd: 440 }, { option_name: '배송비', quantity: 1, unit_price: 1100, currency: 'USD', margin_percent: 20, total_usd: 1100 }] };
const dgs = { id: 'n5', factory_name: '공장 사', status: 'REJECTED', created_date: '2026-07-15', incoterms: 'EXW', shipping_days: 30, advance_payment_percent: 50, balance_payment_percent: 50, final_currency: 'USD', final_price_usd: 4673.99, final_client_price: 31868.1, factory_total_cost: 26556.75, exchange_rate_usd: 1500,
  remarks: '- 재질 스노우지로 변경함.\n\n해당 공장의 수출 권한이 없어 다른 중국 법인에서 매입 후 수출을 하게 됩니다. 위 비용은 부가세 포함 금액입니다.',
  quote_options: [{ option_name: '싸바리박스 5,000개', specification: '157G 스노우지 + 1200G 단면 백판지', quantity: 5000, unit_price: 0.72, currency: 'USD', margin_percent: 20, total_usd: 3600 }, { option_name: '시제품 제작', specification: '샘플 4개', quantity: 1, unit_price: 294.99, currency: 'USD', margin_percent: 20, total_usd: 294.99 }] };
const gd = { id: 'n6', factory_name: '공장 아', status: 'REJECTED', created_date: '2026-08-04', incoterms: 'EXW', final_currency: 'USD', remarks: '',
  quote_options: [{ option_name: '게또바시', specification: 'MOQ 10,000개이며, 금형비용 없음', quantity: 10000, unit_price: 1.3, currency: 'CNY', margin_percent: 20 }] };
// 같은 공장은 최신만, 공장명 '.' 은 따로, 거절 제외
assert.deepEqual(defaultSelection([aegis, xhsAcc, xhsDraft, dot, dgs, gd]), ['n1', 'n2', 'n4']);
assert.equal(extractConditions(gd).conditions.moq, '10,000');
assert.ok(/부가세 포함|수출 권한/.test(extractConditions(dgs).conditions.tax));
sheet = buildSheet({ quotations: [xhsAcc, dot, dgs, aegis] });
const box = sheet.rows.find((r) => r.label === '싸바리박스');
assert.deepEqual(Object.keys(box.cells).sort(), ['A', 'B', 'C']); // '싸바리'·'싸바리박스 5,000개' 같은 줄
assert.ok(sheet.rows.some((r) => r.kind === ROW_KIND.ONE_TIME && r.cells.C)); // 시제품 제작 = 일회성
c = computeSheet(sheet, byId([xhsAcc, dot, dgs, aegis]), { rates, fx: fxMid });
assert.equal(c.rows.find((r) => r.label === '싸바리박스').specDiff, true);
assert.equal(c.qtyDiff, true); // 5,100 vs 5,000
assert.equal(c.options[0].units, 5100);
assert.equal(c.options[3].priced, false); // 금액이 확정되지 않은 견적
assert.equal(c.options[1].scopeAsk, true); // EXW 견적의 배송비가 어디까지인지 모름
w = sheetWarnings(c);
assert.ok(codes(w, 'D').includes('NO_PRICE'));
assert.ok(codes(w, 'B').includes('SCOPE_ASK'));
assert.ok(codes(w).includes('QTY'));
// 배송비 범위를 '항구까지'로 정하면 CIF 로 계산
const scoped = { ...sheet, options: sheet.options.map((o) => (o.key === 'B' ? { ...o, logistics_scope: 'PORT', cargo: { cbm: 11 } } : o)) };
const cB = computeSheet(scoped, byId([xhsAcc, dot, dgs, aegis]), { rates, fx: fxMid }).options[1];
assert.equal(cB.calcTerm, 'CIF');
assert.equal(cB.landedStatus, 'OK');
// 예전 견적(위안 PDF)도 PDF 합계를 그대로 쓴다: 55,772.08위안 → 원화
near(c.options[1].totalClient, 55772.0823798627 / 6.7 * 1385, 2);

// ── 5) 고객 스냅샷: 원가·마진·공장명·견적 ID 가 한 글자도 없어야 한다 ──
c = computeSheet({ ...sheet, recommendation: 'A안 추천' }, byId([xhsAcc, dot, dgs, aegis]), { rates, fx: fxMid });
const snap = clientView(c, { ...sheet, recommendation: 'A안 추천', title: 'N30' });
const text = JSON.stringify(snap);
for (const banned of ['margin', 'cost', 'quotation_id', '"n2"', '공장 바', '공장 사', 'factory_total']) assert.ok(!text.includes(banned), `스냅샷에 ${banned}`);
assert.equal(snap.options.length, 3); // 금액 없는 안은 공개하지 않음
assert.equal(snap.options[0].factory_name, '');
assert.equal(snap.recommendation, 'A안 추천');
// 공장명 보여 주기를 켠 안만 이름이 나간다
const shown = { ...sheet, options: sheet.options.map((o) => (o.key === 'A' ? { ...o, show_factory_name: true } : o)) };
assert.equal(clientView(computeSheet(shown, byId([xhsAcc, dot, dgs, aegis]), { rates, fx: fxMid }), shown).options[0].factory_name, '공장 바');
// 사양 글자에 공장명이 섞여 있으면 공개 전에 잡는다
const leaky = { ...xhsAcc, quote_options: [{ ...xhsAcc.quote_options[0], specification: '공장 바 정품 박스' }, xhsAcc.quote_options[1]] };
const cl = computeSheet(buildSheet({ quotations: [leaky, dot] }), byId([leaky, dot]), { rates, fx: fxMid });
assert.deepEqual(factoryNameLeaks(clientView(cl, buildSheet({ quotations: [leaky, dot] })), cl), ['공장 바']);

// ── 6) 견적 변경 감지 ──
assert.equal(sourceHash(tAcc), sourceHash({ ...tAcc, status: 'SENT' }));
assert.notEqual(sourceHash(tAcc), sourceHash({ ...tAcc, final_price_usd: 5600 }));
const cT = computeSheet(buildSheet({ quotations: [tDraft, tAcc] }), byId([tDraft, { ...tAcc, final_price_usd: 5600 }]), { rates, fx: fxMid });
assert.ok(codes(sheetWarnings(cT, { publishedHashes: { B: sourceHash(tAcc) } }), 'B').includes('STALE'));

console.log('quote compare: all checks passed');
