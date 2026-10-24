// 사전 QC 점검 검산: 앱에 있는 실제 견적(N30 포장, 블리스터 포장기)으로 규칙만으로 핵심 위험이 잡히는지 확인한다.
// 실행: npm run check:qc-precheck
import assert from 'node:assert/strict';
import { detectComponents, evaluatePrecheck, mergeDecisions, quotationHash, summarize, factoryQuestions, UNKNOWN } from '../src/lib/qcPrecheck.js';

const types = (cs) => cs.map((c) => c.type);
const risk = (items, id) => items.find((i) => i.rule_id === id);

// 1) N30 포장 견적 — 품목 사양은 치수·페이지·재질뿐 (실제 데이터 그대로)
const n30 = {
  id: 'q-n30',
  line_items: [
    { item_name_ko: 'Base Color Box (Two-piece)', specification: '238*118*73mm' },
    { item_name_ko: 'Instruction Manual', specification: '107*200MM(40P)' },
    { item_name_ko: 'Blister', specification: 'PS' },
    { item_name_ko: 'Paper frame', specification: 'paper frame' },
    { item_name_ko: 'USB-C Cable', specification: '(L)=500mm' },
  ],
};
const { components } = detectComponents({ quotation: n30 });
assert.deepEqual(types(components), ['PAPER_BOX', 'PRINTED', 'PLASTIC_PACK', 'PAPER_BOX', 'ELECTRONICS']);
assert.equal(components[0].specs.structure, 'LID_BASE');
assert.equal(components[1].specs.pages, 40);
assert.equal(components[2].specs.material, 'PS');
assert.equal(components[4].specs.cable, '500mm');
// 견적만으로는 위험 규칙 대신 '정하지 않은 사양'이 먼저 나와야 한다
let items = evaluatePrecheck({ components });
const boxMissing = items.find((i) => i.kind === 'MISSING_SPEC' && i.component_key === 'c1');
assert.ok(boxMissing.fields.includes('paper_surface') && boxMissing.fields.includes('gsm') && boxMissing.fields.includes('crease'));
assert.equal(risk(items, 'R01'), undefined);

// 담당자가 실제로 정한 사양을 넣으면 두 불량 위험이 모두 나와야 한다
const n30Filled = components.map((c) => (c.key === 'c1' ? { ...c, specs: { ...c.specs, structure: 'RIGID', paper: '스노우지', gsm: 180, thickness: 2.6, print: 'CMYK' } }
  : c.key === 'c2' ? { ...c, specs: { ...c.specs, paper: '모조지', paper_surface: 'UNCOATED', print: 'CMYK', binding: 'SADDLE' } } : c));
items = evaluatePrecheck({ components: n30Filled });
assert.equal(risk(items, 'R02')?.component_key, 'c1', '접힘 주름 위험');
assert.equal(risk(items, 'R01')?.component_key, 'c2', '인쇄 연함 위험');
assert.equal(risk(items, 'R05')?.component_key, 'c2', '40쪽 중철');
// 우리 사례가 있으면 근거가 '우리 사례'로 바뀐다
const cases = [{ id: 'k1', component_type: 'PAPER_BOX', tags: ['합지', '괘선'], issue_case: '사바리 박스 접힘 주름', severity: 'MEDIUM' }];
items = evaluatePrecheck({ components: n30Filled, cases });
assert.equal(risk(items, 'R02').source, 'CASE');
assert.equal(risk(items, 'R02').case_id, 'k1');
// 사양을 넣기 전에도 사례는 같은 유형 구성품 중 한 곳에만 한 번 뜬다 (박스가 2개여도)
assert.equal(evaluatePrecheck({ components, cases }).filter((i) => i.case_id === 'k1').length, 1);
// V커팅을 지정하면 접힘 위험은 사라진다
const vcut = n30Filled.map((c) => (c.key === 'c1' ? { ...c, specs: { ...c.specs, crease: 'VCUT' } } : c));
assert.equal(risk(evaluatePrecheck({ components: vcut }), 'R02'), undefined);

// 2) 블리스터 포장기 견적 — 비고에 '220V/60Hz 맞춤 제작 필요', 목재 케이스
const blister = {
  id: 'q-bl',
  quote_options: [{ option_name: '블리스터 포장기', specification: '성형 면적(판) 160×100mm' }, { option_name: '냉수기(칠러)', specification: '블리스터 포장기 동반 설비' }],
  remarks: '1. 가격조건: EXW 공장 인도가, 수출용 목재 케이스 포장 포함.\n4. 전원은 한국 220V/60Hz 맞춤 제작이 필요하며, 추가 비용과 제작 기간은 별도 확인 후 안내드립니다.',
};
const bl = detectComponents({ quotation: blister });
assert.equal(bl.components[0].type, 'EQUIPMENT');
assert.equal(bl.components[0].specs.frequency, 'CUSTOM_60');
assert.equal(bl.components[0].specs.packing, 'WOOD');
assert.equal(bl.components[0].specs.voltage, '220_1P');
items = evaluatePrecheck({ components: bl.components });
assert.equal(risk(items, 'R07').severity, 'CRITICAL');
assert.ok(risk(items, 'R07').question_cn.includes('60Hz'));
// 예전 라벨기 사례(태그 없음)는 포장기에 붙지 않는다
assert.equal(evaluatePrecheck({ components: bl.components, cases: [{ id: 'old', target_category: 'DESKTOP_LABELER', issue_case: '라벨 들뜸', severity: 'MEDIUM' }] }).filter((i) => i.case_id === 'old').length, 0);
// 'PRICE' 같은 단어가 CE 인증으로 읽히면 안 된다
assert.equal(detectComponents({ quotation: { quote_options: [{ option_name: '포장기', specification: 'PRICE' }] } }).components[0].specs.safety, undefined);

// 3) 모델명뿐인 견적은 카드 분류로 보조 추정
const model = detectComponents({ quotation: { quote_options: [{ option_name: '', specification: 'T-506' }] }, card: { title: '90도 라벨' }, categoryLabel: '산업기계' });
assert.equal(model.components[0]?.type, 'EQUIPMENT');
// 배송비 줄은 구성품이 아니다
assert.equal(detectComponents({ quotation: { quote_options: [{ option_name: '배송비', specification: '선전 -> 인천' }] } }).components.length, 0);

// 4) 다시 점검해도 결정은 이어진다, 모름은 공장 질문으로
const first = evaluatePrecheck({ components: n30Filled }).map((i) => (i.rule_id === 'R02' ? { ...i, decision: 'DISMISSED', dismiss_reason: '이미 V커팅' } : i));
const again = mergeDecisions(evaluatePrecheck({ components: n30Filled }), first);
assert.equal(risk(again, 'R02').decision, 'DISMISSED');
const unk = n30Filled.map((c) => (c.key === 'c3' ? { ...c, specs: { ...c.specs, thickness: UNKNOWN } } : c));
const q = evaluatePrecheck({ components: unk }).find((i) => i.kind === 'QUESTION');
assert.ok(q && q.question_cn.includes('厚度'));
assert.ok(factoryQuestions([q]).text.includes('厚度'));
assert.equal(summarize(evaluatePrecheck({ components: unk })).questions, 1);

// 5) 견적 해시: 금액만 바뀌면 같고, 사양이 바뀌면 다르다
assert.equal(quotationHash(n30), quotationHash({ ...n30, final_total: 999 }));
assert.notEqual(quotationHash(n30), quotationHash({ ...n30, line_items: [...n30.line_items, { item_name_ko: 'Sticker', specification: '' }] }));

console.log('qc precheck: all checks passed');
