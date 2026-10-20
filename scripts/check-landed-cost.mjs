// 물류비 계산 엔진 검산: 실제 포워더 D/O 산정표(2026-10, 인천 LCL)와 CIF $962 건을 그대로 재현하는지 확인한다.
// 실행: npm run check:landed-cost
import assert from 'node:assert/strict';
import { calcLandedCost, mergeRates } from '../src/lib/landedCost.js';
const D = (r) => r.lines.filter((l) => l.segment === 'D').reduce((s, l) => s + l.amount, 0);
const base = { mode: 'SEA_LCL', term: 'CIF', region: 'SOUTH', usdKrw: 1385 }; // 시장 환율이 달라도 D/O 는 포워더 청구 환율(1,200)로 맞아야 한다
// 1) 포워더 D/O 산정표 그대로 재현
assert.equal(D(calcLandedCost({ ...base, totalCbm: 9.5 })), 463919);
assert.equal(D(calcLandedCost({ ...base, totalCbm: 6 })), 307738);
// 1CBM 표는 BAF $13·환율 1,260 → DB 요율 덮어쓰기로 재현
const r13 = mergeRates([{ mode: 'SEA_LCL', segment: 'D', code: 'BAF_CAF', label: 'BAF', unit: 'PER_RT', amount: 13, currency: 'USD', fx_krw: 1260, verified: true }]);
assert.equal(D(calcLandedCost({ ...base, totalCbm: 1 }, r13)), 89003);
// 최소 1 R/T
assert.equal(D(calcLandedCost({ ...base, totalCbm: 0.3 })), D(calcLandedCost({ ...base, totalCbm: 1 })));
// 2) CIF $962 (A+B+C, 화남, 9.5CBM)
const r = calcLandedCost({ ...base, totalCbm: 9.5, usdKrw: 1 }); // A~C 는 USD 그대로 합산
const abc = r.lines.filter((l) => 'ABC'.includes(l.segment) && l.code !== 'INSURANCE').reduce((s, l) => s + l.amount, 0);
assert.ok(Math.abs(abc - 962) <= 1, `ABC ${abc}`);
// 3) 조건별 부담: CIF 면 A~C 판매자, D·E·F 구매자
const c = calcLandedCost({ ...base, totalCbm: 9.5, goodsValue: 10000, units: 5100 });
assert.ok(c.lines.filter((l) => 'ABC'.includes(l.segment)).every((l) => l.payer === 'SELLER'));
assert.ok(c.lines.filter((l) => 'DEF'.includes(l.segment)).every((l) => l.payer === 'BUYER'));
// DDP 면 전부 판매자
const ddp = calcLandedCost({ ...base, term: 'DDP', totalCbm: 9.5, goodsValue: 20000 });
assert.equal(ddp.totals.buyerExtra, 0);
// 4) 실제 견적 입력이 요율보다 우선
const act = calcLandedCost({ ...base, totalCbm: 9.5, actual: { D: 500000 } });
assert.equal(D(act), 500000);
// 5) 박스 치수 입력
const box = calcLandedCost({ ...base, cartons: 100, lengthCm: 50, widthCm: 40, heightCm: 30, kgPerCarton: 8 });
assert.equal(box.cbm, 6);
// 6) 항공 부피중량
const air = calcLandedCost({ ...base, mode: 'AIR', totalCbm: 1, totalKg: 50 });
assert.equal(air.basis.kg, 166.7);
// 화물 미입력
assert.equal(calcLandedCost({ ...base }).needsCargo, true);
// 부가세 분리
const v = calcLandedCost({ ...base, totalCbm: 9.5, goodsValue: 10000 });
assert.equal(v.totals.buyerExtraExVat + v.totals.buyerVat, v.totals.buyerExtra);
// 해상 전용 조건 경고
assert.ok(calcLandedCost({ ...base, mode: 'AIR', totalCbm: 1 }).warnings.some((w) => w.includes('해상 전용')));
console.log("landed cost: all checks passed");
