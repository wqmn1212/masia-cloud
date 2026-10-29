// 문의 양식 검산: 카테고리별 사양 질문, 빠진 답, 인증·샘플·날짜 정리, 수입 요건 미리 넣기, 화면 사본 일치, 소싱 진행률.
// 실행: npm run check:inquiry-form
import assert from 'node:assert/strict';
import * as S from '../base44/shared/inquiryForm.ts';
import * as F from '../src/lib/inquiryForm.js';
import { sourcingProgress } from '../base44/shared/clientSummary.ts';

const r = S.cleanInquiry({ categories: ['전자 · 전기', '리빙 · 공구', '없는분류'], spec_answers: { '재질': 'ABS', '충전 단자': 'USB-C', 'x': 'y' }, certifications: ['KC_ELEC', 'KC_RADIO', 'UNKNOWN', 'HACK'], sample: 'NEED', desired_date: '2026-10-01', destination: ' 김포 ', quantity: '3,000개' }, '2026-10-29');
assert.deepEqual(r.details.categories, ['전자 · 전기', '리빙 · 공구']);
assert.deepEqual(r.details.spec_answers, { '충전 단자': 'USB-C', '재질': 'ABS' }, '질문에 없는 답은 버린다');
assert.equal(r.missing.length, 5, '전자 4 + 리빙 3 − 답한 2');
assert.equal(r.details.desired_date, '', '지난 날짜는 버린다');
assert.equal(r.details.destination, '김포');
assert.deepEqual(r.details.certifications, ['KC_ELEC', 'KC_RADIO', 'UNKNOWN']);
assert.deepEqual(r.importReqs.map((x) => x.key), ['KC_ELEC', 'KC_RADIO'], '모름은 수입 요건에 넣지 않는다');
assert.ok(r.lines.some((l) => l.startsWith('필요한 인증: 전기용품 KC 인증, 전파')));
assert.ok(r.lines.includes('- 재질: ABS'));
assert.equal(S.cleanInquiry({ categories: [] }, '2026-10-29').missing.length, 0, '카테고리가 없으면 질문 없음 (금형 검토 요청)');
assert.deepEqual(F.cleanInquiry({ categories: ['정밀가공'], spec_answers: { '재질': 'SUS304' } }, '2026-10-29'), S.cleanInquiry({ categories: ['정밀가공'], spec_answers: { '재질': 'SUS304' } }, '2026-10-29'));
assert.deepEqual(F.CERT_OPTIONS, S.CERT_OPTIONS);
assert.deepEqual(F.SPEC_QUESTIONS, S.SPEC_QUESTIONS);

// 소싱 진행률
assert.equal(sourcingProgress({ card: { status: 'REVIEW' } }), null, '소싱 중 카드만');
const sp = sourcingProgress({ card: { status: 'IN_PROGRESS', candidate_factory_ids: ['f1', 'f2', 'f3'], quote_deadline: '2026-11-05' }, quotes: 2 });
assert.deepEqual(sp.steps.map((x) => x.label), ['요구사항 확인', '공장 후보 3곳', '견적 2건 받음', '비교표 준비']);
assert.equal(sp.at, 3);
assert.equal(sp.due, '', '견적 마감일은 공개로 켠 경우만');
const sp2 = sourcingProgress({ card: { status: 'IN_PROGRESS', candidate_factory_names: ['A'], quote_deadline: '2026-11-05', quote_deadline_client_visible: true }, quotes: 0, comparison: false });
assert.deepEqual([sp2.at, sp2.due, sp2.steps[2].label], [2, '2026-11-05', '견적 받는 중']);
assert.equal(JSON.stringify(sp2).includes('"A"'), false, '공장 이름은 보내지 않는다');
console.log('inquiry-form: 문의 양식·소싱 진행률 검산 통과');
