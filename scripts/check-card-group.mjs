// 프로젝트 그룹 검산: 문제점 엑셀 읽기(조립 문제점표·작업지도서 검토표), 값 맞추기, 중복 건너뛰기, 이슈 저장 이력, 권한·범위.
// 실행: npm run check:card-group
import assert from 'node:assert/strict';
import { parseIssueSheets, severityOf, statusOf, dateOf, changeText, issueSummary } from '../base44/shared/groupIssues.ts';

const call = async (body) => { const m = await import('../base44/functions/cardGroup/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };

// ── 값 맞추기
assert.equal(severityOf('높음'), 'HIGH'); assert.equal(severityOf(' 중간 '), 'MID'); assert.equal(severityOf('낮음'), 'LOW'); assert.equal(severityOf('??'), '');
assert.equal(statusOf('미조치'), 'OPEN'); assert.equal(statusOf('확인 필요'), 'CHECK'); assert.equal(statusOf('임시 조치'), 'TEMP'); assert.equal(statusOf('요청함'), 'DOING'); assert.equal(statusOf('완료'), 'DONE');
assert.equal(dateOf('2026.11.27'), '2026-11-27'); assert.equal(dateOf('11/27/26'), '2026-11-27'); assert.equal(dateOf('46353'), '2026-11-27'); assert.equal(dateOf('다음 주'), '');

// ── 조립 문제점 관리표 (제목 줄 3개 아래 5행 머리글) + 다른 표는 무시
const assembly = { name: '문제점 목록', rows: [
  ['N30 조립 과정 문제점 관리'], ['원문: …'], ['사진 넣기: …'], [],
  ['No', '부위', '문제점', '세부 내용 · 현장 메모', '사진 1', '사진 2', '원인 구분', '관련 업체', '영향', '개선 방안 (제안)', '중요도', '상태', '담당', '목표일', '완료일', '관련 문서'],
  [1, '배터리·백판', '백판 조립시 배터리 선이 충전단자에 걸린다.', '', '', '', '설계 (선 길이)', '东莞卓美 (배터리)', '조립 지연', '선 길이 규격 지정', '중간', '미조치', '', '', '', '9번과 동일 원인'],
  [2, '배터리', '배터리 전극이 +와 -가 바뀐상태로 온게 발견됨', '· PCB가 타버림', '', '', '부품 품질', '东莞卓美', '안전', '극성 전수 확인', '높음', '조치 중', '이호민', '2026-11-28', '', ''],
  [3, '설명서', '설명서가 너무 연하게 인쇄되었음.', '', '', '', '인쇄', '인쇄 업체', '', '반코팅', '낮음', '완료', '', '', '2026-11-10', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
] };
const summarySheet = { name: '요약', rows: [['문제점 요약'], [], [], ['중요도', '미조치', '확인 필요', '조치 중', '임시 조치', '완료', '합계'], ['높음', 15, 0, 0, 0, 0, 15]] };
const detailSheet = { name: '공정 상세', rows: [['공정', '구분', '세부', 'No', '내용', '검토'], ['1. 헤드', '작업 순서', '사진1', 1, '전극 삽입', '']] };
let p = parseIssueSheets([assembly, summarySheet, detailSheet], 'N30_조립_문제점_관리.xlsx');
assert.equal(p.items.length, 3, '빈 줄·요약표·공정 상세표는 이슈로 읽지 않는다');
assert.deepEqual(p.sheets.map((x) => [x.name, x.source, x.header_row, x.count]), [['문제점 목록', 'ASSEMBLY', 5, 3]]);
const bat = p.items[1];
assert.deepEqual([bat.area, bat.severity, bat.status, bat.assignee_name, bat.due_date, bat.vendor, bat.detail], ['배터리', 'HIGH', 'DOING', '이호민', '2026-11-28', '东莞卓美', '· PCB가 타버림']);
assert.equal(p.items[2].status, 'DONE'); assert.equal(p.items[2].done_date, '2026-11-10');

// ── 작업지도서 검토표: 공정+위치 = 부위, 문제 = 문제점, 현재 내용 = 세부, 수정 요청 = 개선
const wi = { name: '지시서 검토', rows: [['작업지도서 오류 · 누락 검토'], ['…'], [], ['No', '공정', '위치', '현재 내용', '문제', '수정 요청', '중요도', '상태', '담당', '완료일'],
  [1, '전체', '결재', '작성·검토·승인 빈칸', '승인되지 않은 지시서가 현장에 게시됨', '생산책임자 승인 후 재게시', '높음', '미조치', '', ''],
  [2, '전체', '결재', '작성·검토·승인 빈칸', '승인되지 않은 지시서가 현장에 게시됨', '중복 줄', '높음', '미조치', '', ''],
  [3, 'BRACKET-LCD 고정 (8)', '체결', '2×4mm', '공차와 나사 개수 미기재', '1.5 ±○', '보통', '요청함', '', ''],
  [4, '실리콘노브 (7)', '설비/치공구', '빈칸', '', '없음 기재', '낮음', '미조치', '', '']] };
p = parseIssueSheets([wi], 'N30_조립_작업지도서_관리.xlsx');
assert.equal(p.items.length, 3, '같은 파일 안의 같은 줄은 한 번만');
assert.equal(p.items[2].title, '빈칸', '문제 칸이 비면 현재 내용 칸을 문제점으로');
assert.ok(p.warnings.some((w) => w.includes('이미 있어')));
assert.deepEqual([p.items[0].source, p.items[0].area, p.items[0].title, p.items[0].detail, p.items[0].action_plan], ['WORK_INSTRUCTION', '전체 · 결재', '승인되지 않은 지시서가 현장에 게시됨', '작성·검토·승인 빈칸', '생산책임자 승인 후 재게시']);
assert.deepEqual([p.items[1].severity, p.items[1].status], ['MID', 'DOING'], "'보통' → 중간, '요청함' → 조치 중");
assert.ok(parseIssueSheets([detailSheet]).warnings.some((w) => w.includes('찾지 못했')));

// ── 이력 문장·집계
assert.equal(changeText({ status: 'OPEN', severity: 'MID', detail: 'a' }, { status: 'DONE', severity: 'MID', detail: 'b' }), '상태 미조치 → 완료, 세부 내용 고침');
assert.equal(changeText({ photos: [] }, { photos: [{ url: 'https://x/1.jpg' }] }), '사진 0장 → 1장');
assert.equal(changeText({ status: 'OPEN' }, { status: 'OPEN' }), '');
const sum = issueSummary([{ status: 'OPEN', severity: 'HIGH', due_date: '2026-11-20', vendor: 'BHS' }, { status: 'DOING', severity: 'MID', due_date: '2026-12-01' }, { status: 'DONE', severity: 'HIGH', due_date: '2026-11-01' }], '2026-11-25');
assert.deepEqual([sum.total, sum.open, sum.done, sum.high_open, sum.overdue, sum.by_vendor_open.BHS], [3, 2, 1, 1, 1, 1]);

// ── 서버
const STAFF = { id: 'u1', full_name: '이호민', account_tier: 'sub', tenant_id: 't1' };
globalThis.__db = {
  CardGroup: [{ id: 'g1', tenant_id: 't1', name: 'N30', card_ids: ['main', 'bat', 'x'] }, { id: 'g2', tenant_id: 't2', name: '남의 팀', card_ids: [] }],
  TaskCard: [{ id: 'main', tenant_id: 't1', title: '피부미용기기 사출 및 조립', status: 'TODO' }, { id: 'bat', tenant_id: 't1', title: 'N30 배터리', status: 'DONE' }, { id: 'x', tenant_id: 't2', title: '남의 카드' }],
  MeetingLog: [{ id: 'm1', card_id: 'main', meeting_date: '2026-11-25', title: 'AI 요약', decisions: '478대 출고' }, { id: 'm2', card_id: 'other', meeting_date: '2026-11-25', title: '다른 카드 회의' }],
  DecisionLog: [{ id: 'd1', card_id: 'bat', topic: '배터리', decision: '극성 확인', decided_at: '2026-11-24' }],
  DefectLog: [{ id: 'df1', card_id: 'main', occurred_date: '2026-11-04', stage: '스티커 부착', defect_type: '스티커 손상', qty: 52 }],
  CardAttachment: [{ id: 'f1', card_id: 'main', file_name: 'a.xlsx', file_url: 'https://f/a.xlsx', folder_id: 'fo1' }, { id: 'f0', card_id: 'main', file_name: 'old.xlsx', file_url: 'https://f/o', superseded_by_id: 'f1' }],
  CardFolder: [{ id: 'fo1', card_id: 'main', folder_name: 'N30 제조 문서' }],
  ProductionUnit: [{ id: 'u1', card_id: 'bat', serial: 'S1', verdict: 'PASS' }, { id: 'u2', card_id: 'bat', serial: 'S2', verdict: 'FAIL', disposition: 'REWORK' }, { id: 'u3', card_id: 'bat', serial: 'S3', verdict: 'PASS', shipped_date: '2026-11-24' }],
  GroupIssue: [],
};
globalThis.__user = { ...STAFF, account_tier: 'client' };
assert.equal((await call({ action: 'overview', group_id: 'g1' })).status, 403, '고객은 못 쓴다');
globalThis.__user = STAFF;
assert.equal((await call({ action: 'overview', group_id: 'g2' })).status, 404, '다른 팀 그룹은 안 보인다');
let r = await call({ action: 'overview', group_id: 'g1' });
assert.equal(r.status, 200);
assert.deepEqual(r.data.cards.map((c) => c.id), ['main', 'bat'], '그룹에 잘못 들어간 다른 팀 카드는 빼고 보여 준다');
assert.deepEqual(r.data.meetings.map((m) => m.id), ['m1'], '묶인 카드의 회의만');
assert.deepEqual(r.data.files.map((f) => [f.name, f.folder]), [['a.xlsx', 'N30 제조 문서']], '대체된 옛 파일은 뺀다');
assert.equal(r.data.defects[0].qty, 52);
r = await call({ action: 'serials', group_id: 'g1' });
assert.deepEqual(r.data.cards.map((c) => [c.card_id, c.total, c.READY, c.REWORK, c.SHIPPED]), [['bat', 3, 1, 1, 1]]);

// 가져오기: 미리보기 → 등록 → 다시 가져오면 건너뜀
globalThis.__readWorkbook = async () => [assembly];
r = await call({ action: 'import_preview', group_id: 'g1', file_url: 'https://f/x.xlsx', file_name: 'N30_조립_문제점_관리.xlsx' });
assert.deepEqual([r.data.items.length, r.data.new_count], [3, 3]);
assert.equal(globalThis.__db.GroupIssue.length, 0, '미리보기는 저장하지 않는다');
assert.equal((await call({ action: 'import_apply', group_id: 'g1', file_url: 'https://f/x.xlsx', card_id: 'zzz' })).status, 400, '그룹 밖 카드에는 못 붙인다');
r = await call({ action: 'import_apply', group_id: 'g1', file_url: 'https://f/x.xlsx', file_name: 'N30_조립_문제점_관리.xlsx', card_id: 'main' });
assert.deepEqual([r.data.created, r.data.skipped], [3, 0]);
assert.deepEqual(globalThis.__db.GroupIssue.map((i) => [i.no, i.tenant_id, i.card_id, i.history[0].by]), [[1, 't1', 'main', '이호민'], [2, 't1', 'main', '이호민'], [3, 't1', 'main', '이호민']]);
r = await call({ action: 'import_apply', group_id: 'g1', file_url: 'https://f/x.xlsx', file_name: 'N30_조립_문제점_관리.xlsx' });
assert.deepEqual([r.data.created, r.data.skipped], [0, 3], '다시 가져와도 중복되지 않는다');

// 저장: 새 이슈 번호, 상태 변경 이력, 완료일 자동, 잘못된 값 거절
r = await call({ action: 'issue_save', group_id: 'g1', fields: { title: '헤드 PCB에 나사가 없는 경우', area: '헤드 PCB', severity: 'HIGH' } });
assert.equal(r.data.issue.no, 4);
const id = r.data.issue.id;
assert.equal((await call({ action: 'issue_save', group_id: 'g1', fields: { area: '제목 없음' } })).status, 400);
assert.equal((await call({ action: 'issue_save', group_id: 'g1', issue_id: id, fields: { severity: 'URGENT' } })).status, 400);
assert.equal((await call({ action: 'issue_save', group_id: 'g1', issue_id: id, fields: { due_date: '11월 말' } })).status, 400);
r = await call({ action: 'issue_save', group_id: 'g1', issue_id: id, fields: { status: 'DONE', assignee_name: '김공장', photos: [{ url: 'https://img/1.jpg', name: '나사 없음' }, { url: 'javascript:alert(1)' }, { url: 'data:image/png;base64,xx' }] } });
const saved = r.data.issue;
assert.equal(saved.done_date.length, 10, '완료로 바꾸면 완료일이 오늘로');
assert.deepEqual(saved.photos, [{ url: 'https://img/1.jpg', name: '나사 없음' }], 'http(s) 사진만 (javascript:·data: 는 뺀다)');
assert.match(saved.history.at(-1).text, /^상태 미조치 → 완료, 담당 없음 → 김공장, 완료일 없음 → \d{4}-\d{2}-\d{2}, 사진 0장 → 1장$/);
r = await call({ action: 'issue_save', group_id: 'g1', issue_id: id, fields: { status: 'OPEN' } });
assert.equal(r.data.issue.done_date, '', '다시 열면 완료일을 지운다');
r = await call({ action: 'issue_save', group_id: 'g1', issue_id: id, fields: { status: 'OPEN' } });
assert.equal(r.data.unchanged, true, '바뀐 게 없으면 이력을 늘리지 않는다');
assert.equal((await call({ action: 'issue_save', group_id: 'g2', issue_id: id, fields: { status: 'DONE' } })).status, 404);

// 삭제: 팀원은 못 함, 팀 관리자는 됨
assert.equal((await call({ action: 'issue_delete', group_id: 'g1', issue_id: id })).status, 403);
globalThis.__user = { ...STAFF, account_tier: 'service' };
assert.equal((await call({ action: 'issue_delete', group_id: 'g1', issue_id: id })).status, 200);
r = await call({ action: 'overview', group_id: 'g1' });
assert.deepEqual([r.data.summary.total, r.data.summary.high_open, r.data.summary.done], [3, 1, 1]);

console.log('card-group: 모든 검산 통과');
