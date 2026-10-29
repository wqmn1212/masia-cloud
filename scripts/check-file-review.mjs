// 디자인 고객 확인 규칙 검산: 핀 정리(쪽·위치·내용·개수), 요청 입력 확인, 승인본 지정 제한, 화면 사본 일치.
// 실행: npm run check:file-review
import assert from 'node:assert/strict';
import { normalizePins, reviewRequestPatch, factoryApprovalBlock, viewKind, MAX_PINS } from '../base44/shared/fileReview.ts';
import * as front from '../src/lib/fileReview.js';

const at = '2026-10-28T01:00:00.000Z';
const pins = normalizePins([{ page: 2.4, x: 1.7, y: -3, text: '  로고 2mm 위로 ' }, { x: 0.5, y: 0.5, text: '' }, { x: 0.123456, y: 0.5, text: '색상 PANTONE 186C' }], '김담당', at);
assert.equal(pins.length, 2, '내용이 빈 핀은 버린다');
assert.deepEqual(pins[0], { n: 1, page: 2, x: 1, y: 0, text: '로고 2mm 위로', by_name: '김담당', at });
assert.equal(pins[1].n, 2, '번호를 다시 매긴다');
assert.equal(pins[1].x, 0.1235);
assert.equal(normalizePins(Array.from({ length: 50 }, (_, i) => ({ text: `${i}` })), 'a', at).length, MAX_PINS);
assert.deepEqual(normalizePins('x', 'a', at), []);

const file = { id: 'f2', file_name: '박스_v2.pdf', file_type: 'PDF', supersedes_id: 'f1' };
const ok = reviewRequestPatch({ question: '인쇄 색상과 로고 위치 확인 부탁드립니다', due_date: '2026-11-03' }, { file, today: '2026-10-28', by: '이호민', now: at });
assert.equal(ok.patch.previous_attachment_id, 'f1', '이전 승인본과 비교');
assert.equal(ok.patch.file_type, 'pdf');
assert.equal(ok.patch.status, 'PENDING');
assert.match(reviewRequestPatch({ question: '' }, { file, today: '2026-10-28', by: 'a', now: at }).error, /확인받을 내용/);
assert.match(reviewRequestPatch({ question: 'q', due_date: '2026-10-01' }, { file, today: '2026-10-28', by: 'a', now: at }).error, /기한/);
assert.match(reviewRequestPatch({ question: 'q' }, { file: { ...file, superseded_by_id: 'f3' }, today: '2026-10-28', by: 'a', now: at }).error, /새 판/);

for (const impl of [factoryApprovalBlock, front.factoryApprovalBlock]) {
  assert.equal(impl({ client_review_status: 'PENDING' }, false), null, '설정이 꺼지면 제한 없음');
  assert.match(impl({ client_review_status: 'PENDING' }, true), /확인 중/);
  assert.match(impl({ client_review_status: 'REVISION_REQUESTED' }, true), /수정/);
  assert.equal(impl({ client_review_status: 'APPROVED' }, true), null);
  assert.equal(impl({}, true), null, '확인을 요청하지 않은 파일은 그대로');
  assert.equal(impl({ client_review_status: 'CANCELED' }, true), null);
}
for (const t of ['png', 'JPG', 'pdf', 'ai', '']) assert.equal(viewKind(t), front.viewKind(t));
assert.equal(viewKind('pdf'), 'pdf');
console.log('file-review: 디자인 고객 확인 규칙 검산 통과');
