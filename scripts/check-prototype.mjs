// 시제품 개발 검산: PCB 부품 확정·JLCPCB 부품표, 버전 번호 겹침, 서버(파일·증거 업로드는 서버가 직접, 파일 추가·삭제, AI 초안 재요청, 승인·대체, 복제, 위험 수).
// 실행: npm run check:prototype
import assert from 'node:assert/strict';
import { normalizeLcsc, isLcsc, seedPcbRows, pcbSummary, jlcBomRows, toCsv, expandRefs, isSmt } from '../src/lib/pcb.js';
import { versionNoFix, nextVersionNo, cleanUploads, openRiskCount, PROTO_FILE_MAX_BYTES } from '../base44/shared/prototype.ts';

const call = async (body) => { const m = await import('../base44/functions/prototypeAction/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };

// ── PCB 부품 확정
assert.equal(normalizeLcsc(' c25804 '), 'C25804');
assert.equal(normalizeLcsc('25804'), 'C25804', '숫자만 넣어도 C를 붙인다');
assert.equal(normalizeLcsc('RC0603'), 'RC0603', '형식이 아니면 그대로 두고 표시만 한다');
assert.ok(isLcsc('C25804') && !isLcsc('RC0603') && !isLcsc(''));
const bom = [
  { ref: 'R1', name: '저항 10k', part_no: '0603WAF1002T5E', qty: 1 },
  { ref: 'R2', name: '저항 10k', part_no: '0603WAF1002T5E', qty: 1 },
  { ref: 'U1', name: 'MCU', part_no: 'ESP32-C3-WROOM-02-N4', manufacturer: 'Espressif', qty: 1 },
];
let rows = seedPcbRows(bom);
assert.deepEqual(rows.map((r) => r.comment), ['0603WAF1002T5E', '0603WAF1002T5E', 'ESP32-C3-WROOM-02-N4'], 'Comment 는 부품번호로 시작');
rows[0] = { ...rows[0], footprint: '0603', lcsc: 'C25804', lcsc_type: 'BASIC' };
rows[1] = { ...rows[1], footprint: '0603', lcsc: 'C25804', lcsc_type: 'BASIC' };
rows[2] = { ...rows[2], footprint: 'SMD-18', lcsc: 'RC0603' };
// 새 버전 부품표: 같은 Ref·부품명은 이어 받고, 새 부품은 비어 있다
const next = seedPcbRows([...bom.slice(0, 2), { ref: 'C1', name: '캐패시터 10uF', part_no: 'CL21A106KAYNNNE', qty: 1 }], rows);
assert.deepEqual(next.map((r) => [r.ref, r.lcsc]), [['R1', 'C25804'], ['R2', 'C25804'], ['C1', '']]);
assert.deepEqual(pcbSummary(rows), { total: 3, confirmed: 2, invalid: 1, missing: 0, basic: 2, extended: 0, noFootprint: 0, excluded: 0 });
// 실제 앱 시험에서 나온 것: 범위 표기, 조립 대상이 아닌 줄, AI 가 준 실장 모양
assert.deepEqual(expandRefs('SW1~SW3'), ['SW1', 'SW2', 'SW3']);
assert.deepEqual(expandRefs('R1-R3, C5'), ['R1', 'R2', 'R3', 'C5']);
assert.deepEqual(expandRefs('LED_F'), ['LED_F'], '범위가 아니면 그대로');
assert.deepEqual(expandRefs('R1-C3'), ['R1-C3'], '앞글자가 다른 범위는 풀지 않는다');
const aiBom = [
  { ref: 'SW1~SW3', name: '택트 스위치', part_no: 'B3F-1000', qty: 3, footprint: 'THT 6x6', smt: false },
  { ref: 'MECH', name: '힌지 축', qty: 1 },
  { ref: 'PCB_LED', name: 'Ø170mm 원판 LED 기판', qty: 1 },
  { ref: 'U1', name: 'MCU', part_no: 'ESP32-C3-MINI-1-N4', qty: 1, footprint: 'SMD-53', smt: true },
  { ref: 'D1,D2', name: '쇼트키', part_no: 'B240A-13-F', qty: 2, footprint: 'SMA' },
];
const aiRows = seedPcbRows(aiBom);
assert.deepEqual(aiRows.map((r) => [r.ref, r.smt, r.footprint]), [['SW1~SW3', false, 'THT 6x6'], ['MECH', false, ''], ['PCB_LED', false, ''], ['U1', true, 'SMD-53'], ['D1,D2', true, 'SMA']], 'AI 값이 있으면 쓰고, 없으면 기구·기판은 뺀다고 짐작');
assert.equal(isSmt({ ref: 'MECH' }), false, '예전에 저장한 줄(smt 없음)도 짐작');
assert.deepEqual(pcbSummary(aiRows).excluded, 3);
assert.deepEqual(jlcBomRows(aiRows).map((r) => r.Designator), ['D1,D2', 'U1'], '조립 대상만 내보낸다');
assert.deepEqual(jlcBomRows([{ ref: 'SW1~SW3', comment: 'TS-1187A', footprint: 'SMD-4', lcsc: 'C318884', smt: true }])[0].Designator, 'SW1,SW2,SW3', 'JLCPCB 는 범위 표기를 못 읽는다');
// JLCPCB 양식: 같은 값·실장 모양·번호는 한 줄, Designator 는 자연 순서, 잘못된 번호는 비운다
const jlc = jlcBomRows([...rows, { ref: 'R10', comment: '0603WAF1002T5E', footprint: '0603', lcsc: 'C25804' }]);
assert.deepEqual(jlc, [
  { Comment: '0603WAF1002T5E', Designator: 'R1,R2,R10', Footprint: '0603', 'LCSC Part #': 'C25804' },
  { Comment: 'ESP32-C3-WROOM-02-N4', Designator: 'U1', Footprint: 'SMD-18', 'LCSC Part #': '' },
]);
const csv = toCsv([{ Comment: '10k, 1%', Designator: 'R1', Footprint: '0603', 'LCSC Part #': 'C1' }]);
assert.ok(csv.startsWith('﻿Comment,Designator,Footprint,LCSC Part #\r\n'), '엑셀용 BOM과 머리글');
assert.ok(csv.includes('"10k, 1%",R1,0603,C1'), '쉼표가 든 값은 따옴표로 감싼다');

// ── 버전 번호·파일 정리
assert.equal(nextVersionNo([{ version_no: 2 }, { version_no: 5 }]), 6);
const twins = [{ id: 'a', version_no: 3, created_date: '2026-11-08T01:00:00Z' }, { id: 'b', version_no: 3, created_date: '2026-11-08T01:00:01Z' }, { id: 'c', version_no: 2 }];
assert.equal(versionNoFix(twins[0], twins), null, '먼저 만든 쪽은 번호를 지킨다');
assert.equal(versionNoFix(twins[1], twins), 4, '늦게 만든 쪽은 끝 번호 다음으로');
const b64 = (t) => Buffer.from(t).toString('base64');
assert.deepEqual(cleanUploads([{ name: 'a.step', data: b64('x'), category: 'CAD', uri: 'private://victim', id: 'mine', version_no: '2' }]).map((u) => [u.upload.name, u.category, u.version_no, 'uri' in u, 'id' in u, 'uri' in u.upload]), [['a.step', 'CAD', 2, false, false, false]], '주소·id 는 화면 값을 받지 않는다');
assert.deepEqual(cleanUploads([{ name: 'a.exe', data: b64('x'), category: 'EXE' }, { name: 'b.pdf', category: 'DRAWING' }]), [], '모르는 분류·내용 없는 항목은 뺀다');
assert.equal(cleanUploads([{ name: 'a.png', data: 'x', category: 'PHOTO' }, { name: 'b.png', data: 'x', category: 'PHOTO' }]).length, 1, '요청 하나에 한 파일');
assert.equal(PROTO_FILE_MAX_BYTES, 25 * 1024 * 1024, 'STEP·DWG 를 위해 파일당 25MB');
assert.equal(openRiskCount({ risks: [{ severity: 'HIGH' }, { severity: 'LOW' }] }, [{ status: 'FAIL' }, { status: 'PASS' }]), 2);

// ── 서버
const STAFF = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1' };
const db = globalThis.__db = {
  ProtoProject: [
    { id: 'p1', tenant_id: 't1', title: 'Renight 조명', stage: 'TEST', files: [{ id: 'old', name: 'spec.pdf', uri: 'private://spec', category: 'REFERENCE' }], current_version_id: 'v1', open_risk_count: 0 },
    { id: 'p2', tenant_id: 't2', title: '남의 팀', stage: 'REQUIREMENTS', files: [] },
  ],
  ProtoDesignVersion: [{ id: 'v1', tenant_id: 't1', project_id: 'p1', version_no: 1, status: 'APPROVED', risks: [{ severity: 'HIGH', title: '발열' }], history: [] }],
  ProtoTest: [{ id: 't-1', tenant_id: 't1', project_id: 'p1', version_id: 'v1', status: 'FAIL', title: '감광 깜빡임' }],
};
globalThis.__user = { ...STAFF, account_tier: 'client' };
assert.equal((await call({ action: 'sync_risk', project_id: 'p1' })).status, 403, '고객 계정은 못 쓴다');
globalThis.__user = STAFF;
assert.equal((await call({ action: 'sync_risk', project_id: 'p2' })).status, 403, '남의 팀 시제품');
assert.equal((await call({ action: 'nope', project_id: 'p1' })).status, 400);

// 위험 수: 현재 설계 높음 1 + 불합격 1
let res = await call({ action: 'sync_risk', project_id: 'p1' });
assert.equal(res.data.open_risk_count, 2);
assert.equal(db.ProtoProject[0].open_risk_count, 2);

// 파일: 서버가 직접 비공개 저장소에 올린 것만 저장한다. 화면이 보낸 주소(uri)·id 는 무시한다
const uploadedNames = [];
globalThis.__upload = ({ file }) => { uploadedNames.push(file.name); return { file_uri: `private://server/${file.name}` }; };
res = await call({ action: 'add_files', project_id: 'p1', files: [{ id: 'evil', name: 'secret.png', uri: 'private://t2/secret.png', category: 'PHOTO' }] });
assert.equal(res.status, 400, '예전 방식(files[].uri)은 받지 않는다');
assert.ok(!db.ProtoProject[0].files.some((f) => f.uri === 'private://t2/secret.png'), '화면이 보낸 남의 팀 주소는 저장되지 않는다');
res = await call({ action: 'add_files', project_id: 'p1', uploads: [{ id: 'evil', uri: 'private://t2/secret.png', name: 'front.png', type: 'image/png', data: b64('png'), category: 'PHOTO', version_no: 1 }] });
assert.equal(res.status, 200, JSON.stringify(res.data));
const front = db.ProtoProject[0].files.at(-1);
assert.deepEqual([front.name, front.uri, front.category, front.version_no, front.size, front.uploaded_by_name], ['front.png', 'private://server/front.png', 'PHOTO', 1, 3, '왕리'], '서버가 올린 주소·크기·올린 사람');
assert.ok(front.id && front.id !== 'evil', 'id 는 서버가 정한다');
assert.ok(!JSON.stringify(db.ProtoProject[0].files).includes('t2/secret'), '화면이 보낸 주소는 어디에도 남지 않는다');
// 두 사람이 따로 올려도 둘 다 남는다 (화면에 남은 옛 목록으로 덮어쓰지 않는다)
await call({ action: 'add_files', project_id: 'p1', uploads: [{ name: 'housing.step', data: b64('ISO-10303-21'), category: 'CAD' }] });
assert.deepEqual(db.ProtoProject[0].files.map((f) => f.name), ['spec.pdf', 'front.png', 'housing.step']);
assert.deepEqual(uploadedNames, ['front.png', 'housing.step'], '저장된 파일은 모두 서버가 올린 것');
assert.equal((await call({ action: 'add_files', project_id: 'p1', uploads: [{ name: 'x.exe', data: b64('x'), category: 'EXE' }] })).status, 400, '모르는 분류');
assert.equal((await call({ action: 'add_files', project_id: 'p1', uploads: [{ name: 'x.png', category: 'PHOTO' }] })).status, 400, '내용 없음');
// 크기: 25MB 넘으면 풀기 전에 거른다
const big = 'A'.repeat(Math.ceil(PROTO_FILE_MAX_BYTES / 3) * 4 + 8);
res = await call({ action: 'add_files', project_id: 'p1', uploads: [{ name: 'huge.dwg', data: big, category: 'DRAWING' }] });
assert.deepEqual([res.status, res.data.error], [400, 'huge.dwg: 파일은 25MB 이하여야 합니다']);
assert.equal((await call({ action: 'add_files', project_id: 'p1', uploads: [{ name: 'broken.png', data: '%%%', category: 'PHOTO' }] })).status, 400, '깨진 내용');
assert.equal(uploadedNames.length, 2, '거른 파일은 올리지 않는다');
assert.equal((await call({ action: 'add_files', project_id: 'p2', uploads: [{ name: 'a.png', data: b64('x'), category: 'PHOTO' }] })).status, 403, '남의 팀 시제품');
// 서명 링크는 서버가 올린 주소로만
globalThis.__signed = (uri) => `https://files.example/${uri}`;
res = await call({ action: 'sign_file', project_id: 'p1', file_id: front.id });
assert.equal(res.data.url, 'https://files.example/private://server/front.png');
assert.equal((await call({ action: 'sign_file', project_id: 'p1', file_id: 'evil' })).status, 404, '화면이 보낸 id 로는 찾지 못한다');
await call({ action: 'remove_file', project_id: 'p1', file_id: front.id });
assert.deepEqual(db.ProtoProject[0].files.map((f) => f.name), ['spec.pdf', 'housing.step']);
assert.equal((await call({ action: 'remove_file', project_id: 'p1', file_id: front.id })).status, 404);

// 시험 증거 파일: 같은 방식 — 서버가 올려 시험에 붙이고, 화면이 보낸 주소는 무시한다
res = await call({ action: 'add_evidence', project_id: 'p1', test_id: 't-1', uploads: [{ name: 'flicker.jpg', data: b64('jpg'), uri: 'private://t2/secret.png', id: 'evil' }] });
assert.equal(res.status, 200, JSON.stringify(res.data));
const ev = db.ProtoTest[0].evidence;
assert.deepEqual(ev.map((f) => [f.name, f.uri, f.size]), [['flicker.jpg', 'private://server/flicker.jpg', 3]], '서버가 올린 증거만');
assert.ok(ev[0].id !== 'evil');
assert.equal((await call({ action: 'add_evidence', project_id: 'p1', test_id: 't-1', evidence: [{ id: 'evil', name: 'secret.png', uri: 'private://t2/secret.png' }] })).status, 400, '예전 방식(evidence[].uri)은 받지 않는다');
assert.equal(db.ProtoTest[0].evidence.length, 1);
res = await call({ action: 'sign_file', project_id: 'p1', file_id: ev[0].id, test_id: 't-1' });
assert.equal(res.data.url, 'https://files.example/private://server/flicker.jpg');
db.ProtoTest.push({ id: 't-other', tenant_id: 't2', project_id: 'p2', title: '남의 시험', evidence: [] });
assert.equal((await call({ action: 'add_evidence', project_id: 'p1', test_id: 't-other', uploads: [{ name: 'a.png', data: b64('x') }] })).status, 404, '다른 시제품의 시험');
assert.equal((await call({ action: 'remove_evidence', project_id: 'p1', test_id: 't-1', file_id: 'nope' })).status, 404);
await call({ action: 'remove_evidence', project_id: 'p1', test_id: 't-1', file_id: ev[0].id });
assert.deepEqual(db.ProtoTest[0].evidence, []);
assert.equal(uploadedNames.length, 3);
globalThis.__signed = undefined;

// AI 초안: 같은 요청 번호로 다시 오면 새로 만들지 않는다. 시험 중이던 단계를 되돌리지 않는다.
let llmCalls = 0;
let llmArgs = null;
globalThis.__llm = async (args) => { llmCalls++; llmArgs = args; return { summary: '감광 회로 수정', change_note: 'PWM 주파수 상향', risks: [{ severity: 'MEDIUM', title: '부품 수급' }], bom: [] }; };
res = await call({ action: 'draft', project_id: 'p1', request_id: 'req-1', instruction: '깜빡임 개선' });
assert.equal(res.status, 200, JSON.stringify(res.data));
const v2 = res.data.version;
const bomProps = llmArgs.response_json_schema.properties.bom.items.properties;
assert.ok(bomProps.footprint && bomProps.smt, 'AI 부품표에 실장 모양·SMT 대상 여부를 받는다');
assert.ok(llmArgs.prompt.includes('쉼표로 나열'), '범위 표기 금지 지시');
assert.deepEqual([v2.version_no, v2.status, v2.request_id, v2.based_on_version_id], [2, 'DRAFT', 'req-1', 'v1'], '기본 기준은 현재 승인본');
assert.equal(db.ProtoProject[0].stage, 'TEST', '시험 중에 초안을 만들어도 단계는 그대로');
res = await call({ action: 'draft', project_id: 'p1', request_id: 'req-1' });
assert.deepEqual([res.data.reused, res.data.version.id, llmCalls], [true, v2.id, 1], '다시 눌러도 같은 버전');
// 처음 초안이면 '설계'로
db.ProtoProject.push({ id: 'p3', tenant_id: 't1', title: '새 제품', stage: 'REQUIREMENTS', files: [] });
await call({ action: 'draft', project_id: 'p3', request_id: 'req-3' });
assert.equal(db.ProtoProject.find((p) => p.id === 'p3').stage, 'DESIGN');

// 번호가 겹친 채 만들어지면 늦게 만든 쪽을 옮긴다
db.ProtoDesignVersion.push({ id: 'v-twin', tenant_id: 't1', project_id: 'p1', version_no: 3, status: 'REVIEW', created_date: '2026-01-01T00:00:00Z' });
res = await call({ action: 'duplicate_version', project_id: 'p1', version_id: 'v1' });
assert.equal(res.data.version.version_no, 4, '복제는 끝 번호 다음');
assert.deepEqual([res.data.version.status, res.data.version.source, res.data.version.based_on_version_id], ['REVIEW', 'MANUAL', 'v1']);

// 승인: 이전 승인본은 '대체됨', 현재 설계가 바뀌고 위험 수를 다시 센다
res = await call({ action: 'approve_version', project_id: 'p1', version_id: v2.id, note: '검토 완료' });
assert.equal(res.status, 200, JSON.stringify(res.data));
const byId = (id) => db.ProtoDesignVersion.find((v) => v.id === id);
assert.deepEqual([byId(v2.id).status, byId('v1').status], ['APPROVED', 'SUPERSEDED']);
assert.ok(byId('v1').history.some((h) => h.action === 'v2 승인으로 대체'));
assert.equal(db.ProtoProject[0].current_version_id, v2.id);
assert.equal(db.ProtoProject[0].stage, 'TEST', '시험 중이면 단계는 그대로');
assert.equal(db.ProtoProject[0].open_risk_count, 2, '새 설계 보통 위험 1 + 불합격 시험 1');
assert.equal((await call({ action: 'approve_version', project_id: 'p1', version_id: v2.id })).status, 409, '이미 승인');
assert.equal(db.ProtoDesignVersion.filter((v) => v.project_id === 'p1' && v.status === 'APPROVED').length, 1, '승인본은 늘 하나');

console.log('시제품 개발 검산 통과');
