// 시제품 개발 검산: PCB 부품 확정·JLCPCB 부품표, 버전 번호 겹침, 서버(파일 추가·삭제, AI 초안 재요청, 승인·대체, 복제, 위험 수).
// 실행: npm run check:prototype
import assert from 'node:assert/strict';
import { normalizeLcsc, isLcsc, seedPcbRows, pcbSummary, jlcBomRows, toCsv } from '../src/lib/pcb.js';
import { versionNoFix, nextVersionNo, cleanFiles, openRiskCount } from '../base44/shared/prototype.ts';

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
assert.deepEqual(pcbSummary(rows), { total: 3, confirmed: 2, invalid: 1, missing: 0, basic: 2, extended: 0, noFootprint: 0 });
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
assert.deepEqual(cleanFiles([{ id: 'f', name: 'a.pdf', uri: 'private://a', category: 'DRAWING', size: '12', extra: 'x' }, { id: 'g', name: 'b', uri: '', category: 'DRAWING' }, { id: 'h', name: 'c', uri: 'u', category: 'EXE' }]).map((f) => [f.id, f.size, 'extra' in f]), [['f', 12, false]], '모양이 틀린 파일·모르는 분류는 뺀다');
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

// 파일: 두 사람이 따로 올려도 둘 다 남는다 (화면에 남은 옛 목록으로 덮어쓰지 않는다)
await call({ action: 'add_files', project_id: 'p1', files: [{ id: 'f-a', name: 'front.png', uri: 'private://front', category: 'PHOTO' }] });
await call({ action: 'add_files', project_id: 'p1', files: [{ id: 'f-b', name: 'pcb.zip', uri: 'private://pcb', category: 'PCB' }, { id: 'bad', name: 'x', uri: 'u', category: 'EXE' }] });
assert.deepEqual(db.ProtoProject[0].files.map((f) => f.id), ['old', 'f-a', 'f-b']);
assert.equal((await call({ action: 'add_files', project_id: 'p1', files: [{ id: 'bad', category: 'EXE' }] })).status, 400);
await call({ action: 'remove_file', project_id: 'p1', file_id: 'f-a' });
assert.deepEqual(db.ProtoProject[0].files.map((f) => f.id), ['old', 'f-b']);
assert.equal((await call({ action: 'remove_file', project_id: 'p1', file_id: 'f-a' })).status, 404);

// AI 초안: 같은 요청 번호로 다시 오면 새로 만들지 않는다. 시험 중이던 단계를 되돌리지 않는다.
let llmCalls = 0;
globalThis.__llm = async () => { llmCalls++; return { summary: '감광 회로 수정', change_note: 'PWM 주파수 상향', risks: [{ severity: 'MEDIUM', title: '부품 수급' }], bom: [] }; };
res = await call({ action: 'draft', project_id: 'p1', request_id: 'req-1', instruction: '깜빡임 개선' });
assert.equal(res.status, 200, JSON.stringify(res.data));
const v2 = res.data.version;
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
