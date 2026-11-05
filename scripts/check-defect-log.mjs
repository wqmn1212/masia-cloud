// 불량 기록 검산: 불량 목록 엑셀 읽기·묶기, 스티커 불량/제품 불량 반영, 성적서 불합격 자동 기록, 비슷한 과거 불량 찾기.
// 실행: npm run check:defect-log
import assert from 'node:assert/strict';
import { parseDefectSheets, groupDefects, dateFromName, tokens, findSimilar, defectLine } from '../base44/shared/defects.ts';

const call = async (fn, body) => { const m = await import('../base44/functions/' + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };

// ── 읽기
assert.equal(dateFromName('261104_불량시리얼넘버.xlsx'), '2026-11-04');
assert.equal(dateFromName('불량_20261107.xlsx'), '2026-11-07');
assert.equal(dateFromName('불량목록.xlsx'), '');
const sticker = [{ name: 'Sheet1', rows: [['연번', '불량 시리얼 넘버'], [1, 'MHAFS1AA3775'], [2, 'mhafs1aa3976 '], [3, 'MHAFS1AA3988'], [4, 'MHAFS1AA3988'], ['합계', '']] }];
let p = parseDefectSheets(sticker);
assert.deepEqual(p.items.map((x) => x.serial), ['MHAFS1AA3775', 'MHAFS1AA3976', 'MHAFS1AA3988'], '불량 시리얼 칸은 시리얼로, 중복은 한 번만');
assert.deepEqual(p.columns, ['serial']);
assert.ok(p.warnings.some((w) => w.includes('두 번')));
const detail = [{ name: '불량', rows: [['날짜', '공정', '시리얼', '불량 내용'], ['2026.11.05', '양산 검사', 'MHAFS1AA4001', 'RF 열감 출력 약함'], ['2026.11.05', '양산 검사', 'MHAFS1AA4002', 'RF 열감 출력 약함'], ['2026.11.05', '포장', 'MHAFS1AA4003', '상판 스크래치']] }];
p = parseDefectSheets(detail);
assert.equal(p.items.length, 3);
const g = groupDefects(p.items);
assert.deepEqual(g.map((x) => [x.date, x.stage, x.defect_type, x.qty]), [['2026-11-05', '양산 검사', 'RF 열감 출력 약함', 2], ['2026-11-05', '포장', '상판 스크래치', 1]]);
assert.equal(g[0].serial_range, 'MHAFS1AA4001~MHAFS1AA4002');
const noSerial = parseDefectSheets([{ name: 's', rows: [['불량 내용', '수량', '공정'], ['박스 모서리 찌그러짐', '12', '포장']] }]);
assert.deepEqual([noSerial.items[0].desc, noSerial.items[0].qty, noSerial.items[0].stage], ['박스 모서리 찌그러짐', 12, '포장'], '시리얼 없이 내용·수량만 있는 목록');
// 낱말·비슷한 불량
assert.ok(tokens('스티커 절취선이 찢어짐').has('절취선'), '조사 떼기');
assert.ok(!tokens('불량 확인').size, '흔한 말은 뺀다');
const sim = findSimilar([
  { id: 'a', source: 'DEFECT', card_id: 'c1', date: '2026-11-04', stage: '스티커 부착', title: '스티커 절취선 찢어짐', qty: 52, card_title: 'N30 박스' },
  { id: 'b', source: 'DEFECT', card_id: 'c2', date: '2026-10-01', stage: '양산 검사', title: '버튼 눌림', qty: 3 },
], { text: '개봉방지 스티커 절취선 검수' });
assert.deepEqual(sim.map((x) => x.id), ['a']);
assert.equal(defectLine(sim[0]), '2026-11-04 · 스티커 부착 중 · 스티커 절취선 찢어짐 52건 (N30 박스)');

// ── 서버
const STAFF = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1' };
globalThis.__db = {
  TaskCard: [{ id: 'n30', tenant_id: 't1', title: 'N30 박스 패키징', client_id: 'co1', factory_id: 'f1' }, { id: 'other', tenant_id: 't1', title: '다른 카드' }, { id: 'x', tenant_id: 't2', title: '남의 팀' }, { id: 'new', tenant_id: 't1', title: 'N30 2차 박스', factory_id: 'f1' }],
  ProductionUnit: [
    { id: 'u-3988', tenant_id: 't1', card_id: 'n30', serial: 'MHAFS1AA3988', verdict: 'PASS', disposition: '', pallet: 'P-1' },
    { id: 'u-4001', tenant_id: 't1', card_id: 'n30', serial: 'MHAFS1AA4001', verdict: 'PASS', disposition: '' },
    { id: 'u-4002', tenant_id: 't1', card_id: 'n30', serial: 'MHAFS1AA4002', verdict: 'PASS', disposition: '', shipped_date: '2026-11-04' },
    { id: 'u-9', tenant_id: 't1', card_id: 'other', serial: 'MHAFS1AA3775', verdict: 'PASS' },
  ],
  DefectLog: [], ProjectAuditLog: [], QCKnowledgeLog: [{ id: 'k1', tenant_id: 't1', card_id: 'other', issue_case: '스티커 절취선 운반 중 갈라짐', root_cause: '절취선이 접히는 선 위', prevention: '절취선을 4mm 안쪽으로' }], QualityClaim: [],
};
let book = sticker;
globalThis.__readWorkbook = async () => book;
globalThis.__user = { ...STAFF, account_tier: 'client' };
assert.equal((await call('defectLog', { action: 'list', card_id: 'n30' })).status, 403, '고객은 못 쓴다');
globalThis.__user = STAFF;
assert.equal((await call('defectLog', { action: 'list', card_id: 'x' })).status, 404, '남의 팀 카드');
// 미리보기: 종류를 묻고, 파일 이름의 날짜를 쓴다
let res = await call('defectLog', { action: 'parse', file_url: 'u', file_name: '261104_불량시리얼넘버.xlsx', card_id: 'n30' });
assert.equal(res.data.kind, 'DEFECT_LIST');
assert.equal(res.data.defaults.date, '2026-11-04');
assert.ok(res.data.ask.some((a) => a.startsWith('kind')), '어떤 불량인지 묻는다');
assert.deepEqual([res.data.serial_check.registered, res.data.serial_check.not_registered, res.data.serial_check.other_card], [1, 1, ['MHAFS1AA3775']]);
assert.equal(globalThis.__db.DefectLog.length, 0, '미리보기는 저장 안 함');
res = await call('defectLog', { action: 'apply', card_id: 'n30', file_url: 'u', file_name: '261104_불량시리얼넘버.xlsx' });
assert.equal(res.status, 400, '종류를 안 정하면 저장하지 않는다');
res = await call('defectLog', { action: 'apply', card_id: 'n30', file_url: 'u', file_name: '261104_불량시리얼넘버.xlsx', kind: 'STICKER' });
assert.equal(res.status, 200, JSON.stringify(res.data));
assert.deepEqual([res.data.serials.updated, res.data.serials.created, res.data.serials.conflict], [1, 1, ['MHAFS1AA3775']]);
assert.ok(globalThis.__bulkUpdates.some((b) => b.name === 'ProductionUnit'), '시리얼은 한꺼번에(bulkUpdate) 고친다 — 하나씩 고치면 1분 요청 한도에 걸린다');
const u3988 = globalThis.__db.ProductionUnit.find((x) => x.serial === 'MHAFS1AA3988');
assert.deepEqual([u3988.disposition, u3988.pallet], ['VOID', ''], '스티커 불량 표시, 파레트 해제');
assert.equal(globalThis.__db.ProductionUnit.find((x) => x.serial === 'MHAFS1AA3976').disposition, 'VOID', '등록 안 된 번호는 스티커 불량으로 새로 등록');
let log = globalThis.__db.DefectLog[0];
assert.deepEqual([log.occurred_date, log.stage, log.defect_type, log.kind, log.qty, log.card_id, log.factory_id], ['2026-11-04', '스티커 부착', '스티커 불량', 'STICKER', 3, 'n30', 'f1']);
res = await call('defectLog', { action: 'apply', card_id: 'n30', file_url: 'u', file_name: '261104_불량시리얼넘버.xlsx', kind: 'STICKER' });
assert.deepEqual([res.data.logs_created, res.data.logs_skipped], [0, 1], '같은 파일은 다시 기록하지 않는다');
// 제품 불량: 출하된 제품은 건드리지 않는다
book = detail;
res = await call('defectLog', { action: 'apply', card_id: 'n30', file_url: 'u', file_name: '불량내역.xlsx', kind: 'PRODUCT' });
assert.deepEqual(res.data.serials.shipped, ['MHAFS1AA4002']);
const u4001 = globalThis.__db.ProductionUnit.find((x) => x.serial === 'MHAFS1AA4001');
assert.deepEqual([u4001.verdict, u4001.fail_note], ['FAIL', 'RF 열감 출력 약함']);
assert.ok(u4001.history.some((h) => h.action === '불량 등록' && h.note.includes('양산 검사')));
assert.equal(globalThis.__db.DefectLog.length, 3);
// 날짜·단계가 없으면 묻는다
book = [{ name: 's', rows: [['시리얼'], ['MHAFS1AA5000']] }];
res = await call('defectLog', { action: 'apply', card_id: 'n30', file_url: 'u', file_name: '목록.xlsx', kind: 'PRODUCT', defect_type: '전원 안 켜짐' });
assert.equal(res.status, 400, '날짜·단계 없이는 저장 안 함');
// 말로 남기기
res = await call('defectLog', { action: 'record', card_id: 'n30', date: '2026-11-06', stage: '포장', defect_type: '박스 모서리 찌그러짐', qty: 4 });
assert.deepEqual([res.data.ok, res.data.qty], [true, 4]);
// 목록
res = await call('defectLog', { action: 'list', card_id: 'n30' });
assert.equal(res.data.logs.length, 4);
assert.ok(res.data.logs.some((l) => l.line === '2026-11-04 · 스티커 부착 중 · 스티커 불량 3건'));
// 비슷한 과거 불량: 새 카드 QC 검토 때 스티커 관련 불량과 사례를 알려 준다
res = await call('defectLog', { action: 'similar', card_id: 'new', text: '개봉방지 스티커 부착 검수' });
assert.ok(res.data.results.length >= 2, JSON.stringify(res.data));
assert.ok(res.data.results.some((r) => r.source === 'DEFECT' && r.card_title === 'N30 박스 패키징' && r.line.includes('스티커 부착 중')));
assert.ok(res.data.results.some((r) => r.source === 'CASE' && r.prevention.includes('4mm') && r.card_title === '다른 카드'), '사례는 카드 제목을 채운다');
assert.ok(!res.data.results.some((r) => r.title.includes('찌그러짐')), '관련 없는 불량은 빼고');
globalThis.__user = { ...STAFF, tenant_id: 't2' };
res = await call('defectLog', { action: 'similar', text: '스티커' });
assert.equal(res.data.results.length, 0, '다른 팀 기록은 보이지 않는다');
globalThis.__user = STAFF;

// ── 성적서 등록 때 불합격은 불량 기록으로
const ITEMS = ['전원', '버튼 조작', '모드 변경', '레벨 변경', '음성 안내', 'RF 열감\n출력', 'EMS/EP\n전기 출력', '스크래치', '외관 점', '먼지', '유격'];
const P = Array(11).fill('pass');
book = [{ name: '검사성적서_20261107', rows: [['작성일', '2026.11.07'], ['순서', '시리얼 번호', ...ITEMS, '종합 판정'], [1, 'MHAFS1AB0001', ...P, 'pass'], [2, 'MHAFS1AB0002', ...P.map((v, k) => (k === 5 ? 'fail' : v)), 'fail'], [3, 'MHAFS1AB0003', ...P.map((v, k) => (k === 5 ? 'fail' : v)), 'fail']] }];
res = await call('defectLog', { action: 'parse', file_url: 'u', file_name: '성적서.xlsx' });
assert.equal(res.data.kind, 'INSPECTION', '성적서는 양산 시리얼 등록으로 넘긴다');
assert.deepEqual(res.data.failed_items, { 'RF 열감 출력': 2 });
res = await call('productionUnits', { action: 'import', card_id: 'new', file_url: 'u', file_name: '성적서.xlsx' });
assert.equal(res.data.defect_logs, 1, JSON.stringify(res.data));
log = globalThis.__db.DefectLog.find((l) => l.card_id === 'new');
assert.deepEqual([log.occurred_date, log.stage, log.defect_type, log.qty, log.source], ['2026-11-07', '양산 검사', 'RF 열감 출력', 2, 'INSPECTION']);
console.log('defect-log ok');
