// 설계 자료실 검산: 자료 모으기(문의·시안·도면 파일·금형·BOM·회로·워크벤치)·찾기·권한·파일 열기·도면 업로드 보관
// 실행: npm run check:design-archive
import assert from 'node:assert/strict';
import * as A from '../base44/shared/designArchive.ts';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// ── 도면 파일 고르기
ok(A.isDesignFile('하우징_v3.STEP') && A.isDesignFile('base.stl') && A.isDesignFile('panel.dwg'), 'CAD·3D 확장자');
ok(A.isDesignFile('외형 도면.pdf') && A.isDesignFile('drawing-rev2.png'), '이름에 도면 낱말이 있는 PDF·이미지');
ok(!A.isDesignFile('견적서.pdf') && !A.isDesignFile('invoice.xlsx') && !A.isDesignFile('photo.jpg'), '견적서·엑셀·일반 사진은 빼기');

// ── 줄 만들기
const lead = { id: 'L1', tenant_id: 't1', company: '하늘전자', contact_name: '김하늘', detail: '휴대용 가습기 개발', inquiry_type: 'TURNKEY', submitted_at: '2026-11-10T01:00:00Z', attachments: [{ name: 'body.step', size: 2048000, url: 'private/a.step' }] };
const [lr] = A.leadRows(lead);
eq([lr.kind, lr.title, lr.who, lr.files.length, lr.files[0].ref, lr.link], ['inquiry', '휴대용 가습기 개발', '하늘전자 · 김하늘', 1, 'private/a.step', '/leads?lead=L1']);
eq(A.leadRows({ id: 'L0', tenant_id: 't1', detail: '첨부 없는 문의', attachments: [] }), [], '첨부 없는 일반 문의는 자료실에 안 나온다');
const sk = A.leadRows({ id: 'L2', tenant_id: 't1', company: '바다', detail: '탁상 선풍기', attachments: [{ name: 'sketch.jpg', size: 1000, url: 'private/s.jpg' }],
  sketch_trial: { status: 'READY', variants: [{ label: '둥근형', url: 'https://img/1.png' }, { label: '각진형', url: 'https://img/2.png' }, { label: '슬림', url: '' }], chosen: 1, inquired_at: '2026-11-11' } })[0];
eq([sk.kind, sk.files.length, sk.detail], ['sketch', 3, '시안 2장 · 고른 시안: 각진형 · 견적 문의함'], '스케치 원본 + 시안 이미지, 고른 시안');

const atts = [
  { id: 'a1', tenant_id: 't1', card_id: 'c1', file_name: '커버.stp', file_url: 'private/c.stp', uploader_role: 'CLIENT', created_date: '2026-11-09' },
  { id: 'a2', tenant_id: 't1', card_id: 'c1', file_name: '견적서.pdf', file_url: 'private/q.pdf', created_date: '2026-11-09' },
  { id: 'a3', tenant_id: 't1', card_id: 'c1', file_name: '조립 도면.pdf', file_url: 'private/d.pdf', created_date: '2026-11-12' },
  { id: 'a4', tenant_id: 't2', card_id: 'c9', file_name: 'invoice.xlsx', file_url: 'private/i.xlsx' },
];
const cf = A.cardFileRows(atts, { c1: { id: 'c1', title: 'HH-1 가습기', client_name: '하늘전자' } });
eq(cf.length, 1, '도면 없는 카드는 빠짐');
eq([cf[0].title, cf[0].who, cf[0].files.map((f) => f.name), cf[0].at, cf[0].detail], ['HH-1 가습기', '하늘전자', ['커버.stp', '조립 도면.pdf'], '2026-11-12', '도면 파일 2개 · 고객이 올린 파일 포함']);

const boms = A.bomRows([
  { tenant_id: 't1', card_id: 'c1', bom_set_id: 'B1', source_file_name: 'asm.step', source_file_url: 'private/asm.step', created_date: '2026-11-01' },
  { tenant_id: 't1', card_id: 'c1', bom_set_id: 'B1', source_file_name: 'asm.step', source_file_url: 'private/asm.step', created_date: '2026-11-01' },
  { tenant_id: 't1', card_id: 'c1', bom_set_id: 'B2', source_file_name: 'old.step', source_file_url: 'https://pub/old.step', created_date: '2026-10-01' },
]);
eq(boms.map((b) => [b.id, b.detail, b.files[0].ref]), [['B1', '부품 2개', 'private/asm.step'], ['B2', '부품 1개', 'https://pub/old.step']], 'BOM 은 부품표 묶음마다 한 줄');

const proj = { id: 'P1', tenant_id: 't1', title: '가열식 가습기 HH-1', updated_date: '2026-11-13',
  dev: { mcu: 'esp32c3', supply_v: 24, features: [{ id: 'f1' }, { id: 'f2' }], rules: [{}, {}, {}], sim_params: { reg: 'buck', case_hc: 4 }, updated_at: '2026-11-14T02:00:00Z', updated_by_name: '이지스' },
  files: [{ id: 'x1', name: 'HH-1 본체 도면.pdf', uri: 'private/dw.pdf', category: 'DRAWING', size: 200000, uploaded_at: '2026-11-14T01:00:00Z' }, { id: 'x2', name: '현장 사진.jpg', uri: 'private/p.jpg', category: 'PHOTO' }] };
const pr = A.projectRows(proj);
eq(pr.map((r) => r.kind), ['workbench', 'proto_file']);
eq(pr[0].detail, '기능 2개 · ESP32C3 · 24 V · 동작 규칙 3개 · 시뮬레이션 부품 값 2개 수정');
eq([pr[0].link, pr[1].files.map((f) => f.name)], ['/prototypes/P1/develop', ['HH-1 본체 도면.pdf']], '사진은 빼고 설계 파일만');
eq(A.projectRows({ id: 'P2', tenant_id: 't1', title: '빈 시제품' }), [], '워크벤치·설계 파일이 없으면 안 나옴');

const up = A.uploadRows([{ id: 'U1', tenant_id: 't1', source: 'mold_review', file_name: 'cover.stp', file_uri: 'private/u.stp', size: 900000, part_name: '커버', account_tier: 'client', uploaded_by_name: '김하늘', summary: { weight_g: 32.5, high_count: 1, caution_count: 2 } }])[0];
eq([up.title, up.who, up.detail, up.meta.client], ['커버', '김하늘 · 고객', '금형 사전 검토에 올린 파일 · 32.5 g · 높음 1 · 주의 2', true]);
const md = A.moldRows([{ id: 'M1', tenant_id: 't1', part_name: '하판', source_file_name: 'base.step', source_file_uri: 'private/b.step', snapshot_url: 'private/s.png', high_count: 0, caution_count: 3, material: 'ABS', card_id: 'c1' }])[0];
eq([md.files.map((f) => f.name), md.link], [['base.step', '검토 캡처.png'], '/task-board?card=c1']);
eq(A.moldRows([{ id: 'M0', tenant_id: 't1', part_name: '예전 검토' }])[0].files, [], '원본 uri 가 없던 예전 검토는 파일 없이');

// ── 찾기·종류별 개수
const all = [lr, sk, ...cf, ...boms, ...pr, up, md, ...A.circuitRows([{ id: 'C1', tenant_id: 't2', title: 'LED 드라이버', part_count: 7, autosaved: true, updated_date: '2026-11-14T03:00:00Z' }])];
let f = A.filterArchive(all, {});
eq(f.total, all.length);
eq(f.items[0].kind, 'circuit', '최근 것이 위');
eq(f.counts.bom, 2);
f = A.filterArchive(all, { q: '하늘전자' });
eq(f.items.map((r) => r.kind).sort(), ['card_file', 'inquiry'], '고객 이름으로 찾기');
f = A.filterArchive(all, { q: 'cover.stp' });
eq(f.items.map((r) => r.key), ['upload:U1'], '파일 이름으로 찾기');
f = A.filterArchive(all, { kind: 'bom', q: 'step' });
eq([f.items.length, f.counts.inquiry, f.counts.bom], [2, 1, 2], '종류를 골라도 다른 종류 개수는 남는다');
f = A.filterArchive(all, { q: '알파팀', tenantNames: { t2: '알파팀' } });
eq(f.items.map((r) => r.key), ['circuit:C1'], '팀 이름으로 찾기');
eq(A.circuitRows([{ id: 'C1', title: 'x', part_count: 3, autosaved: true }])[0].detail, '부품 3개 · 자동 저장');

// ── 서버
const call = async (body) => { const m = await import('../base44/functions/designArchive/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
globalThis.__db = {
  Tenant: [{ id: 't1', name: '이지스 본사' }, { id: 't2', name: '알파팀' }, { id: 'td', name: '데모', is_demo: true }],
  ManufacturingLead: [lead, { id: 'L3', tenant_id: 't2', detail: '알파 문의', attachments: [{ name: 'alpha.step', size: 10, url: 'private/alpha.step' }], created_date: '2026-11-05' }],
  CardAttachment: atts, TaskCard: [{ id: 'c1', tenant_id: 't1', title: 'HH-1 가습기', client_name: '하늘전자' }],
  DesignUpload: [], MoldReview: [], BomItem: [], CircuitDesign: [{ id: 'C1', tenant_id: 't2', title: 'LED 드라이버', part_count: 7 }], ProtoProject: [proj], ProtoConcept: [],
};
const CLIENT = { id: 'k1', email: 'kim@sky.co', full_name: '김하늘', account_tier: 'client', tenant_id: 't1' };
const SUB = { id: 's1', email: 'w@aegis.co', account_tier: 'sub', tenant_id: 't1' };
const SERVICE = { id: 'v1', email: 'boss@aegis.co', account_tier: 'service', tenant_id: 't1' };
const MASTER = { id: 'm1', email: 'root@aegis.co', account_tier: 'master', tenant_id: 't1' };

globalThis.__user = null;
eq((await call({ action: 'list' })).status, 401, '로그인 필요');
globalThis.__user = CLIENT;
let r = await call({ action: 'store_upload', source: 'mold_review', file_uri: 'private/k.stp', file_name: 'knob.stp', size: 5000, part_name: '노브', summary: { weight_g: 4.2, high_count: 0, caution_count: 1, size_mm: [30, 30, 12], extra: 'x' } });
eq(r.status, 200, '고객도 금형 검토 도면을 보관할 수 있다');
const saved = globalThis.__db.DesignUpload[0];
eq([saved.tenant_id, saved.account_tier, saved.uploaded_by_name, saved.summary.weight_g, saved.summary.extra], ['t1', 'client', '김하늘', 4.2, undefined]);
r = await call({ action: 'store_upload', source: 'mold_review', file_uri: 'private/k2.stp', file_name: 'knob.stp', size: 5000, part_name: '노브 (다른 부품)' });
eq([r.data.reused, globalThis.__db.DesignUpload.length, globalThis.__db.DesignUpload[0].part_name], [true, 1, '노브 (다른 부품)'], '같은 파일을 곧 다시 올리면 하나로');
eq((await call({ action: 'store_upload', file_uri: 'https://evil/x.stp', file_name: 'x.stp' })).status, 400, '공개 주소는 받지 않음');
eq((await call({ action: 'list' })).status, 403, '고객은 자료실을 못 본다');
globalThis.__user = SUB;
eq((await call({ action: 'list' })).status, 403, '팀원도 못 본다');

globalThis.__user = SERVICE;
r = await call({ action: 'list' });
eq(r.status, 200);
ok(r.data.items.every((x) => x.tenant_id === 't1'), '팀 관리자는 자기 팀 자료만');
eq(r.data.items.some((x) => x.kind === 'upload' && x.who === '김하늘 · 고객'), true, '고객이 올린 도면이 보인다');
eq(r.data.tenants, [], '팀 목록은 대표에게만');
eq((await call({ action: 'list', tenant_id: 't2' })).data.items.every((x) => x.tenant_id === 't1'), true, '팀 관리자는 다른 팀을 고를 수 없다');
r = await call({ action: 'sign', ref: 'private/a.step' });
eq([r.status, r.data.url], [200, 'https://files.example/private/a.step'], '자기 팀 파일 열기');
eq((await call({ action: 'sign', ref: 'private/alpha.step' })).status, 404, '다른 팀 파일은 못 연다');
eq((await call({ action: 'sign', ref: 'private/unknown' })).status, 404, '목록에 없는 파일은 못 연다');
r = await call({ action: 'sign', ref: 'https://img/1.png' });
eq(r.status, 404, '목록에 없는 공개 주소도 거절');

globalThis.__user = MASTER;
r = await call({ action: 'list' });
ok(r.data.items.some((x) => x.tenant_id === 't2') && r.data.items.some((x) => x.tenant_id === 't1'), '대표는 모든 팀');
eq(r.data.tenants.map((t) => t.name), ['알파팀', '이지스 본사'], '데모 팀은 빼고 이름 순');
eq(r.data.items.find((x) => x.key === 'lead:L3').tenant_name, '알파팀');
r = await call({ action: 'list', tenant_id: 't2' });
ok(r.data.items.length > 0 && r.data.items.every((x) => x.tenant_id === 't2'), '대표가 팀을 고르면 그 팀만');
eq((await call({ action: 'sign', ref: 'private/alpha.step' })).status, 200, '대표는 다른 팀 파일도 연다');
r = await call({ action: 'list', kind: 'workbench' });
eq([r.data.items.length, r.data.items[0].title], [1, '가열식 가습기 HH-1']);

console.log(`${n}개 검산 통과`);
