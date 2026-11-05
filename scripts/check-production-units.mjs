// 양산 시리얼 검산: 성적서(날짜별 시트) 읽기, 판정 재계산, 등록·갱신·충돌, 파레트·불량 처리·출하, 조회.
// 실행: npm run check:production-units
import assert from 'node:assert/strict';
import { parseInspectionSheets, serialRange, expandRange, productionSummary, cellResult, toDate } from '../base44/shared/productionUnits.ts';

const call = async (fn, body) => { const m = await import('../base44/functions/' + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const ITEMS = ['전원', '버튼 조작', '모드 변경', '레벨 변경', '음성 안내', 'RF 열감\n출력', 'EMS/EP\n전기 출력', '스크래치', '외관 점', '먼지', '유격'];
const sheet = (name, date, rows, extraHead = []) => ({ name, rows: [
  [], ['N30 제조라인 검사성적서'], ['작성일', date, '', '', '', '', 'LOT', '1차'], ['시험 결과 기본값: pass'],
  ['', '', '기능 시험', '', '', '', '', '', '', '외관 시험'],
  ['순서', '시리얼 번호', ...ITEMS, '종합 판정', ...extraHead],
  ...rows.map(([serial, results, ...extra], i) => [i + 1, serial, ...(results || Array(11).fill('pass')), 'pass', ...extra]),
] });
const P = Array(11).fill('pass');
const F = (i) => P.map((v, k) => (k === i ? 'fail' : v));

// ── 읽기
assert.equal(cellResult(' PASS '), 'pass'); assert.equal(cellResult('불합격'), 'fail'); assert.equal(cellResult(''), ''); assert.equal(cellResult('??'), 'fail', '알 수 없는 값은 합격 아님');
assert.equal(toDate('2026.11.04'), '2026-11-04'); assert.equal(toDate('검사성적서_20261105'), '2026-11-05'); assert.equal(toDate(46330), '2026-11-04');
const r = parseInspectionSheets([
  sheet('검사성적서_20261104', '2026.11.04', [['MHAFS1AA5001'], ['mhafs1aa5000', F(5)], ['MHAFS1AA4999', P.map((v, k) => (k === 9 ? '' : v))], ['MHAFS1AA4998'], ['MHAFS1AA4998']]),
  sheet('검사성적서_20261105', '2026.11.04', [['MHAFS1AA5000'], ['MHAFS1AA4997', P, 'P-1105-01', '']], ['파레트', '불량 내용']),
  { name: '메모', rows: [['아무 내용']] },
]);
assert.deepEqual(r.sheets.map((x) => [x.date, x.lot, x.count, x.pass, x.fail, x.incomplete]), [['2026-11-04', '1차', 4, 2, 1, 1], ['2026-11-05', '1차', 2, 2, 0, 0], ['', '', 0, 0, 0, 0]]);
assert.equal(r.sheets[0].items[5], 'RF 열감 출력', '줄바꿈 머리글 정리');
assert.equal(r.sheets[0].range, 'MHAFS1AA4998~MHAFS1AA5001');
assert.ok(r.warnings.some((w) => w.includes('두 번')), '같은 시트 중복');
assert.ok(r.warnings.some((w) => w.includes('작성일(2026-11-04)이 시트 이름 날짜(2026-11-05)')), '날짜 불일치 경고');
assert.ok(r.warnings.some((w) => w.includes('시리얼 칸을 찾지 못해')), '형식이 다른 시트는 건너뜀');
const u = Object.fromEntries(r.units.map((x) => [x.serial, x]));
assert.equal(r.units.length, 5, '여러 시트에 같은 시리얼은 하나로');
assert.equal(u.MHAFS1AA5000.verdict, 'PASS', '뒤 시트(재검사) 결과');
assert.equal(u.MHAFS1AA5000.inspected_date, '2026-11-05');
assert.equal(u.MHAFS1AA4999.verdict, 'INCOMPLETE', '빈 항목은 미검사');
assert.equal(u.MHAFS1AA4997.pallet, 'P-1105-01', '파레트 칸이 있으면 읽는다');
assert.ok(!('파레트' in u.MHAFS1AA4997.checks), '파레트는 검사 항목이 아님');
assert.equal(serialRange(['A0003', 'A0001', 'A0002', 'A0005']), 'A0001~A0003, A0005');
assert.deepEqual(expandRange('4998-5000, 4990', 'MHAFS1AA5001'), ['MHAFS1AA4998', 'MHAFS1AA4999', 'MHAFS1AA5000', 'MHAFS1AA4990']);
assert.deepEqual(expandRange('mhafs1aa0009~MHAFS1AA0011'), ['MHAFS1AA0009', 'MHAFS1AA0010', 'MHAFS1AA0011']);

// ── 서버
const STAFF = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1' };
globalThis.__db = { TaskCard: [{ id: 'n30', tenant_id: 't1', title: 'N30 양산', client_id: 'co1', client_name: '레지에나' }, { id: 'other', tenant_id: 't1', title: '다른 카드' }, { id: 'x', tenant_id: 't2', title: '남의 팀' }], ProductionUnit: [{ id: 'pre', tenant_id: 't1', card_id: 'other', serial: 'MHAFS1AA4998', verdict: 'PASS' }], ProjectAuditLog: [] };
let book = [sheet('검사성적서_20261104', '2026.11.04', [['MHAFS1AA5001'], ['MHAFS1AA5000', F(5)], ['MHAFS1AA4999'], ['MHAFS1AA4998']])];
globalThis.__readWorkbook = async () => book;
globalThis.__user = { ...STAFF, account_tier: 'client' };
assert.equal((await call('productionUnits', { action: 'list', card_id: 'n30' })).status, 403, '고객은 못 쓴다');
globalThis.__user = STAFF;
assert.equal((await call('productionUnits', { action: 'list', card_id: 'x' })).status, 404, '남의 팀 카드');
let res = await call('productionUnits', { action: 'preview', card_id: 'n30', file_url: 'https://f/x.xlsx' });
assert.deepEqual([res.data.create, res.data.update, res.data.conflict_count], [3, 0, 1], JSON.stringify(res.data));
assert.equal(globalThis.__db.ProductionUnit.length, 1, '미리보기는 저장 안 함');
res = await call('productionUnits', { action: 'import', card_id: 'n30', file_url: 'https://f/x.xlsx', file_name: 'N30 성적서.xlsx' });
assert.equal(res.status, 200, JSON.stringify(res.data));
const mine = () => globalThis.__db.ProductionUnit.filter((x) => x.card_id === 'n30');
assert.equal(mine().length, 3);
assert.equal(globalThis.__db.ProductionUnit.find((x) => x.id === 'pre').card_id, 'other', '다른 카드 시리얼은 그대로');
assert.ok(mine().every((x) => x.tenant_id === 't1' && x.client_id === 'co1' && x.lot === '1차' && x.history.length === 1));
// 같은 파일 다시 올리면 변화 없음, 재검사 합격 시트는 갱신
res = await call('productionUnits', { action: 'preview', card_id: 'n30', file_url: 'u' });
assert.deepEqual([res.data.create, res.data.update, res.data.same], [0, 0, 3]);

// 파레트·불량 처리
res = await call('productionUnits', { action: 'assign_pallet', card_id: 'n30', serials: '4999-5001', pallet: 'P-1104-01' });
assert.equal(res.data.updated, 3, '숫자만 넣어도 시리얼 형식으로');
res = await call('productionUnits', { action: 'dispose', card_id: 'n30', serial: 'MHAFS1AA5001', disposition: 'SCRAP' });
assert.equal(res.status, 400, '합격 제품은 불량 처리 불가');
res = await call('productionUnits', { action: 'dispose', card_id: 'n30', serial: 'mhafs1aa5000', disposition: 'REWORK', note: 'RF 출력 약함' });
assert.equal(res.data.unit.status, 'REWORK');
// 출하: 불량(수리 중)은 빠진다
res = await call('productionUnits', { action: 'ship', card_id: 'n30', pallets: ['P-1104-01'], date: '2026-11-06', label: '1차 출하' });
assert.deepEqual([res.data.shipped, res.data.skipped_count], [2, 1]);
assert.equal(res.data.skipped[0].serial, 'MHAFS1AA5000');
// 수리 후 재검사 합격 → 다음 출하
res = await call('productionUnits', { action: 'dispose', card_id: 'n30', serial: 'MHAFS1AA5000', disposition: 'REPASS', note: 'RF 모듈 교체' });
assert.equal(res.data.unit.status, 'READY');
// 출하된 제품은 성적서 재등록으로 바뀌지 않는다
book = [sheet('검사성적서_20261107', '2026.11.07', [['MHAFS1AA5001', F(0)]])];
res = await call('productionUnits', { action: 'preview', card_id: 'n30', file_url: 'u' });
assert.equal(res.data.locked_count, 1, '출하된 제품 결과 변경은 막는다');
res = await call('productionUnits', { action: 'list', card_id: 'n30' });
const sm = res.data.summary;
assert.deepEqual([sm.counts.total, sm.counts.SHIPPED, sm.counts.READY], [3, 2, 1]);
assert.equal(sm.shipments[0].label, '1차 출하');
assert.equal(sm.shipments[0].range, 'MHAFS1AA4999, MHAFS1AA5001');
assert.equal(sm.pallets[0].key, 'P-1104-01');
// 조회
res = await call('productionUnits', { action: 'search', q: '5001' });
assert.equal(res.data.results[0].serial, 'MHAFS1AA5001', '끝자리로도 찾는다');
assert.equal(res.data.results[0].card_title, 'N30 양산');
assert.equal(res.data.results[0].shipped_date, '2026-11-06');
assert.ok(res.data.results[0].history.some((h) => h.action === '출하'));
res = await call('productionUnits', { action: 'unship', card_id: 'n30', serials: 'MHAFS1AA5001' });
assert.equal(res.data.updated, 1);

// ── 스티커 번호 미리 등록과 스티커 불량
globalThis.__db.TaskCard.push({ id: 'pre-card', tenant_id: 't1', title: 'N30 2차', client_id: 'co1' });
res = await call('productionUnits', { action: 'register', card_id: 'pre-card', serials: '0001-0010' });
assert.equal(res.status, 400, '처음 등록은 앞부분까지');
res = await call('productionUnits', { action: 'register', card_id: 'pre-card', serials: 'MHAFS1AB0001-MHAFS1AB0010', lot: '2차' });
assert.deepEqual([res.data.created, res.data.existing], [10, 0]);
res = await call('productionUnits', { action: 'register', card_id: 'pre-card', serials: '0009-0012' });
assert.deepEqual([res.data.created, res.data.existing], [2, 2], '숫자만 넣어도 되고 있는 번호는 건너뜀');
res = await call('productionUnits', { action: 'void', card_id: 'pre-card', serials: '0003, 0011, 0099' });
assert.deepEqual([res.data.updated, res.data.missing_count], [2, 1]);
res = await call('productionUnits', { action: 'assign_pallet', card_id: 'pre-card', serials: '0001-0004', pallet: 'P-1' });
assert.equal(res.data.updated, 0, '생산 전·스티커 불량 번호에는 파레트를 붙이지 않는다');
// 성적서 양식에 스티커 불량 번호 줄이 pass 로 남아 있어도 제품으로 보지 않는다
book = [sheet('검사성적서_20261110', '2026.11.10', [['MHAFS1AB0001'], ['MHAFS1AB0002'], ['MHAFS1AB0003']])];
res = await call('productionUnits', { action: 'import', card_id: 'pre-card', file_url: 'u', file_name: '2차.xlsx' });
assert.deepEqual([res.data.create, res.data.update, res.data.voided_count], [0, 2, 1]);
res = await call('productionUnits', { action: 'list', card_id: 'pre-card' });
const c2 = res.data.summary.counts;
assert.deepEqual([c2.total, c2.PENDING, c2.VOID, c2.READY, c2.produced], [12, 8, 2, 2, 2]);
assert.equal(res.data.units.length, 4, '생산 전 번호는 목록에서 빼고 숫자로만');
assert.equal(res.data.summary.days[0].count, 2, '일별 생산에 스티커 불량은 안 들어간다');
res = await call('productionUnits', { action: 'ship', card_id: 'pre-card', serials: '0001-0005', date: '2026-11-11' });
assert.deepEqual([res.data.shipped, res.data.skipped_count], [2, 3], '생산 전·스티커 불량은 출하 안 됨');
res = await call('productionUnits', { action: 'dispose', card_id: 'pre-card', serial: 'MHAFS1AB0003', disposition: 'CLEAR' });
assert.equal(res.data.unit.status, 'PENDING', '스티커 불량 해제');
assert.ok((globalThis.__bulkUpdates || []).length, '여러 대는 bulkUpdate 로 묶어 고친다');
console.log('production-units ok');
