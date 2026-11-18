// 시제품 ↔ 업무 카드 연동 검산: 카드에 보일 개발 현황 요약, 챙길 일, 소통 탭 문구 (서버와 같은 머리말)
// 실행: npm run check:proto-card
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { protoSummary, protoAttention, protoNoteText, protoLinks, WORKBENCH_SHEET } from '../src/lib/protoCard.js';
import { unitRecord } from '../src/lib/devkit/factoryTest.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

const project = {
  id: 'p1', title: '무드등 개발 (무니스)', stage: 'DESIGN', card_id: 'c1', tenant_id: 't1',
  dev: {
    device_name: 'RENIGHT-S1', features: [{ id: 'a' }, { id: 'b' }],
    freeze: { version: 2, at: '2026-11-10T01:00:00Z', by: '김' },
    ecos: [{ no: 'ECO-001', status: 'APPROVED' }, { no: 'ECO-002', status: 'WAIT_CLIENT' }, { no: 'ECO-003', status: 'OPEN' }, { no: 'ECO-004', status: 'REJECTED' }],
    mold_design: { template: 'sphere_lamp', params: { dia: 180 } },
    archive: [{ device_name: 'RENIGHT-L1' }],
  },
};
const concepts = [{ version_no: 2, preview: { parts: [1, 2] } }, { version_no: 3, title: 'Ø180', preview: { parts: [1, 2, 3] } }, { version_no: 1 }];
const units = [
  { sheet: WORKBENCH_SHEET, verdict: 'PASS' }, { sheet: WORKBENCH_SHEET, verdict: 'PASS' }, { sheet: WORKBENCH_SHEET, verdict: 'FAIL' },
  { sheet: '외주 성적서', verdict: 'FAIL' }, // 양산 성적서는 워크벤치 시험이 아님
];

ok('요약: 최신 컨셉 v3, 확정본 v2, 진행 중 설계 변경 2 (고객 대기 1), 금형 형상, 공장 시험 2/3', () => {
  const s = protoSummary(project, { concepts, units });
  assert.equal(s.concept.version, 3); assert.equal(s.concept.parts, 3); assert.equal(s.conceptCount, 3);
  assert.equal(s.freeze.version, 2);
  assert.deepEqual([s.ecoOpen, s.ecoWaitClient, s.ecoTotal], [2, 1, 4]);
  assert.equal(s.mold.label, '구형 셸 조명'); assert.equal(s.mold.dia, 180);
  assert.deepEqual(s.tests, { total: 3, pass: 2, fail: 1 });
  assert.equal(s.stage, '설계'); assert.equal(s.device, 'RENIGHT-S1'); assert.equal(s.archived, 1);
});

ok('챙길 일: 고객 대기·검토할 변경·불합격, 컨셉 없으면 그것부터', () => {
  assert.deepEqual(protoAttention(protoSummary(project, { concepts, units })), ['고객 확인을 기다리는 설계 변경 1건', '검토할 설계 변경 1건', '공장 시험 불합격 1대']);
  assert.deepEqual(protoAttention(protoSummary({ dev: {} }, {})), ['컨셉 3D 형상이 아직 없습니다']);
});

ok('공장 시험 기록(unitRecord)의 시트 이름이 요약이 세는 이름과 같다', () => {
  const plan = { auto: [{ id: 'x', label: ['전원'] }], press: [], outputs: [] };
  const u = unitRecord({ project, plan, serial: 'S1', results: { x: true }, values: {} });
  assert.equal(u.sheet, WORKBENCH_SHEET); assert.equal(u.card_id, 'c1');
});

ok('소통 탭 문구: [시제품 · 제목] 머리말, 서버 helper 와 같은 형식', () => {
  assert.equal(protoNoteText(project, '설계 확정본 v2'), '[시제품 · 무드등 개발 (무니스)] 설계 확정본 v2');
  const server = fs.readFileSync(new URL('../base44/shared/protoCardNote.ts', import.meta.url), 'utf8');
  assert.ok(server.includes('`[시제품 · ${String(project?.title || \'\').slice(0, 60)}] ${String(text || \'\').slice(0, 900)}`'), '서버 문구 형식이 같다');
  assert.ok(server.includes("is_client_visible: false"), '고객 비공개');
  assert.ok(protoNoteText({ title: 'x' }, 'y'.repeat(2000)).length < 1000);
});

ok('바로가기: 워크벤치 단계 키가 실제 단계와 같다', () => {
  const page = fs.readFileSync(new URL('../src/pages/PrototypeDevelop.jsx', import.meta.url), 'utf8');
  for (const l of protoLinks('p1')) assert.ok(page.includes(`key: '${l.to.split('step=')[1]}'`), l.to);
});

console.log(`\n${n}개 검산 통과`);
