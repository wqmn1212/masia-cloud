// 고객사 역할·사내 결재·견적 수락·디자인 확인 서버 함수 검산.
// 직원이 첫 고객 관리자 지정 → 고객 관리자가 동료 초대·역할·결재 규칙 → 실무자 결정이 결재 요청 → 결재권자 승인 시 실행·반려 시 사유
// → 재무 전용 결정 불가 → 견적 수락(비교표 있으면 비교표로) → 디자인 확인 요청·핀 의견·승인 → 역할별 알림·서명자 후보.
// 실행: npm run check:client-approvals
import assert from 'node:assert/strict';
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const as = (u) => { globalThis.__user = u; };

const STAFF = { id: 's1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', is_active: true, email: 'staff@aegis.example' };
const BOSS = { id: 'u-boss', full_name: '박대표', account_tier: 'client', tenant_id: 'ct1', company_id: 'co1', is_active: true, email: 'boss@buyer.example' };
const KIM = { id: 'u-kim', full_name: '김실무', account_tier: 'client', tenant_id: 'ct1', company_id: 'co1', is_active: true, email: 'kim@buyer.example' };
const PAY = { id: 'u-pay', full_name: '정재무', account_tier: 'client', tenant_id: 'ct1', company_id: 'co1', is_active: true, email: 'pay@buyer.example' };
const OTHER = { id: 'u-x', full_name: '남의고객', account_tier: 'client', tenant_id: 'ct9', company_id: 'co9', is_active: true, email: 'x@other.example' };
globalThis.__db = {
  Company: [
    { id: 'co1', tenant_id: 't1', company_type: 'CLIENT', company_name: '바이어상사' },
    { id: 'co9', tenant_id: 't1', company_type: 'CLIENT', company_name: '남의회사' },
  ],
  Tenant: [{ id: 'ct1', company_id: 'co1', tenant_type: 'client', seat_limit: 5 }, { id: 'ct9', company_id: 'co9', tenant_type: 'client', seat_limit: 2 }],
  User: [STAFF, BOSS, KIM, PAY, OTHER],
  PendingInvitation: [],
  TaskCard: [
    { id: 'c1', tenant_id: 't1', title: '휴대용 선풍기', client_id: 'co1', client_visible: true, status: 'PRODUCTION' },
    { id: 'c2', tenant_id: 't1', title: '드립백 포장재', client_id: 'co1', client_visible: true, status: 'REVIEW' },
  ],
  QCReport: [{ id: 'q1', tenant_id: 't1', card_id: 'c1', client_visible: true, inspection_type: 'MASS', qc_result: 'PASS' }],
  QualitySpec: [{ id: 'sp1', tenant_id: 't1', card_id: 'c1', status: 'SENT', version: 2 }],
  Quotation: [
    { id: 'qt1', tenant_id: 't1', card_id: 'c2', client_id: 'co1', client_published_at: '2026-10-20', quote_title: '드립백 1만장', rounding_version: 2, final_total: 9_000_000, final_currency: 'KRW' },
    { id: 'qt2', tenant_id: 't1', card_id: 'c1', client_id: 'co1', client_published_at: '2026-10-20', quote_title: '선풍기 A안' },
  ],
  QuoteComparison: [{ id: 'cmp1', tenant_id: 't1', card_id: 'c1', status: 'PUBLISHED', version: 1, client_snapshot: { base_currency: 'KRW', options: [{ key: 'A', label: 'A안', total: 30_000_000 }] }, created_date: '2026-10-21' }],
  CardAttachment: [
    { id: 'f1', tenant_id: 't1', card_id: 'c2', file_name: '박스_v1.pdf', file_type: 'pdf', file_url: 'private://f1', client_visible: true, factory_approved: true, revision: 1 },
    { id: 'f2', tenant_id: 't1', card_id: 'c2', file_name: '박스_v2.pdf', file_type: 'pdf', file_url: 'private://f2', client_visible: false, supersedes_id: 'f1' },
  ],
  FileReview: [], ClientApproval: [], Notification: [], ProjectAuditLog: [], PaymentStage: [], CardMilestone: [], Shipment: [], SignatureRequest: [],
  CardChat: [], QualityClaim: [], OperationSetting: [], FactoryDocument: [], PayeeAccount: [], Contract: [{ id: 'k1', tenant_id: 't1', client_id: 'co1', status: 'DRAFT' }],
};
const db = globalThis.__db;
const co = () => db.Company.find((c) => c.id === 'co1');
const notes = (type) => db.Notification.filter((n) => n.type === type);

// ── 역할 없는 고객사는 지금처럼: 고객은 팀을 바꿀 수 없다 ──
as(KIM);
let r = await call('manageClientTeam', { action: 'list' });
assert.equal(r.status, 200);
assert.equal(r.data.has_setup, false);
assert.equal(r.data.can_manage, false);
assert.equal(r.data.members.length, 3, '같은 고객사 계정 3명');
r = await call('manageClientTeam', { action: 'set_roles', email: 'kim@buyer.example', roles: ['ADMIN'] });
assert.equal(r.status, 403, '역할이 없으면 고객이 스스로 관리자가 될 수 없다');

// ── 직원이 첫 고객 관리자 지정 ──
as(STAFF);
r = await call('manageClientTeam', { action: 'set_roles', company_id: 'co1', email: 'boss@buyer.example', roles: ['APPROVER'] });
assert.equal(r.status, 400, '처음에는 고객 관리자부터');
assert.match(r.data.error, /고객 관리자/);
r = await call('manageClientTeam', { action: 'set_roles', company_id: 'co1', email: 'boss@buyer.example', roles: ['ADMIN', 'APPROVER'] });
assert.equal(r.status, 200);
assert.equal(r.data.has_setup, true);
r = await call('manageClientTeam', { action: 'set_roles', company_id: 'co1', email: 'x@other.example', roles: ['MEMBER'] });
assert.equal(r.status, 404, '다른 회사 계정은 다룰 수 없다');

// ── 고객 관리자: 역할·초대·결재 규칙 ──
as(BOSS);
r = await call('manageClientTeam', { action: 'set_roles', email: 'kim@buyer.example', roles: ['MEMBER'] });
assert.equal(r.status, 200);
r = await call('manageClientTeam', { action: 'set_roles', email: 'pay@buyer.example', roles: ['FINANCE'] });
assert.equal(r.status, 200);
r = await call('manageClientTeam', { action: 'set_roles', email: 'boss@buyer.example', roles: ['APPROVER'] });
assert.equal(r.status, 400, '마지막 고객 관리자는 역할을 뺄 수 없다');
r = await call('manageClientTeam', { action: 'invite', emails: ['cfo@buyer.example'], roles: ['APPROVER', 'FINANCE'] });
assert.equal(r.status, 200);
assert.equal(r.data.invited[0].pending, true, '새 계정은 초대 대기');
assert.equal(db.PendingInvitation[0].company_id, 'co1');
assert.ok((globalThis.__invites || []).some((i) => i.email === 'cfo@buyer.example'), '플랫폼 초대 메일');
assert.deepEqual(r.data.members.find((m) => m.email === 'cfo@buyer.example').roles, ['APPROVER', 'FINANCE']);
r = await call('manageClientTeam', { action: 'invite', emails: ['x@other.example'] });
assert.equal(r.status, 409, '다른 회사 계정은 초대할 수 없다');
r = await call('manageClientTeam', { action: 'set_rules', rules: { kinds: { qc_decision: { on: true }, spec_decision: { on: true }, quote_accept: { on: true, min_amount_krw: 5_000_000 }, file_review: { on: true } } } });
assert.equal(r.status, 200);
assert.equal(r.data.rules.kinds.qc_decision.on, true);
as(KIM);
r = await call('manageClientTeam', { action: 'set_rules', rules: {} });
assert.equal(r.status, 403, '실무자는 규칙을 바꿀 수 없다');

// ── 실무자의 출고 승인 → 결재 요청 ──
r = await call('clientCardAction', { card_id: 'c1', action: 'qc_decision', report_id: 'q1', decision: 'APPROVED', note: '포장 상태 확인함' });
assert.equal(r.status, 200);
assert.equal(r.data.pending_approval, true);
assert.equal(db.QCReport[0].client_decision, undefined, '결재 전에는 실행하지 않는다');
const ap1 = db.ClientApproval.find((a) => a.id === r.data.approval_id);
assert.equal(ap1.kind, 'qc_decision');
assert.equal(ap1.requested_by_email, 'kim@buyer.example');
assert.deepEqual(notes('client_approval_requested').map((n) => n.recipient_id), ['u-boss'], '결재권자에게만 결재 요청');
r = await call('clientCardAction', { card_id: 'c1', action: 'qc_decision', report_id: 'q1', decision: 'APPROVED' });
assert.equal(r.status, 409, '같은 대상 결재 요청은 하나만');
r = await call('clientCardAction', { card_id: 'c1', action: 'approval_decide', approval_id: ap1.id, decision: 'APPROVE' });
assert.equal(r.status, 403, '실무자는 결재할 수 없다');

// 목록·카드 상세에 결재 중으로 보인다
r = await call('listClientTodos', {});
assert.equal(r.data.approvals.length, 1);
assert.equal(r.data.approvals[0].mine, true);
assert.equal(r.data.team.can_decide, true);
assert.ok(r.data.summaries.c1.turn_reason, '고객님 차례');
as(BOSS);
r = await call('listClientTodos', {});
assert.equal(r.data.approvals[0].can_approve, true);
r = await call('getClientCardDetail', { card_id: 'c1' });
assert.equal(r.data.approvals[0].target_id, 'q1');
assert.equal(r.data.approvals[0].can_approve, true);

// 결재 승인 → 원래 결정 실행
r = await call('clientCardAction', { card_id: 'c1', action: 'approval_decide', approval_id: ap1.id, decision: 'APPROVE' });
assert.equal(r.status, 200);
assert.equal(db.QCReport[0].client_decision, 'APPROVED');
assert.equal(db.QCReport[0].client_decision_note, '포장 상태 확인함', '요청자 메모 그대로');
assert.equal(db.QCReport[0].client_decided_by_name, '김실무 (결재 박대표)');
assert.equal(ap1.status, 'APPROVED');
assert.equal(notes('client_approval_decided').at(-1).recipient_id, 'u-kim', '요청자에게 결과');
assert.ok(notes('qc_decision').length >= 1, '직원에게 출고 승인 알림');
assert.ok(db.ProjectAuditLog.some((l) => l.event_type === 'CLIENT_APPROVAL_APPROVED'));
r = await call('clientCardAction', { card_id: 'c1', action: 'approval_decide', approval_id: ap1.id, decision: 'APPROVE' });
assert.equal(r.status, 409, '이미 처리된 결재');

// ── 반려: 사유 필수, 실행하지 않는다 ──
as(KIM);
r = await call('clientCardAction', { card_id: 'c1', action: 'spec_decision', spec_id: 'sp1', decision: 'APPROVED' });
assert.equal(r.data.pending_approval, true);
const ap2 = r.data.approval_id;
r = await call('clientCardAction', { card_id: 'c1', action: 'spec_decision', spec_id: 'sp1', decision: 'REVISION_REQUESTED', note: '치수 공차 추가' });
assert.equal(r.status, 200, '수정 요청은 결재 없이 바로 전달');
assert.equal(db.QualitySpec[0].client_decision, 'REVISION_REQUESTED');
assert.equal(db.ClientApproval.find((a) => a.id === ap2).status, 'STALE', '먼저 결정되면 걸린 결재는 무효');
r = await call('clientCardAction', { card_id: 'c1', action: 'spec_decision', spec_id: 'sp1', decision: 'APPROVED' });
const ap3 = r.data.approval_id;
as(BOSS);
r = await call('clientCardAction', { card_id: 'c1', action: 'approval_decide', approval_id: ap3, decision: 'REJECT' });
assert.equal(r.status, 400, '반려 사유 필수');
r = await call('clientCardAction', { card_id: 'c1', action: 'approval_decide', approval_id: ap3, decision: 'REJECT', note: '공차 확인 후 다시' });
assert.equal(r.status, 200);
assert.equal(db.QualitySpec[0].client_decision, 'REVISION_REQUESTED', '반려는 실행하지 않는다');
assert.match(notes('client_approval_decided').at(-1).body, /공차 확인 후 다시/);
as(KIM);
r = await call('listClientTodos', {});
assert.ok(r.data.approvals.some((a) => a.status === 'REJECTED' && a.reason === '공차 확인 후 다시'), '요청자는 반려를 본다');

// ── 재무 전용 계정은 결정할 수 없다 ──
as(PAY);
r = await call('clientCardAction', { card_id: 'c1', action: 'spec_decision', spec_id: 'sp1', decision: 'APPROVED' });
assert.equal(r.status, 403);
assert.match(r.data.error, /재무/);

// ── 견적 수락: 금액 기준 아래는 바로, 비교표가 있으면 비교표로 ──
as(KIM);
r = await call('listClientQuotations', { card_id: 'c2' });
assert.equal(r.data.has_comparison, false);
r = await call('clientCardAction', { card_id: 'c1', action: 'quote_accept', quotation_id: 'qt2' });
assert.equal(r.status, 409, '비교표가 있는 카드는 비교표에서 고른다');
assert.match(r.data.error, /비교표/);
r = await call('clientCardAction', { card_id: 'c1', action: 'quote_accept', quotation_id: 'qt1' });
assert.equal(r.status, 404, '다른 카드 견적');
db.Company[0].approval_rules.kinds.quote_accept.min_amount_krw = 10_000_000;
r = await call('clientCardAction', { card_id: 'c2', action: 'quote_accept', quotation_id: 'qt1', note: '11월 첫 주 발주 예정' });
assert.equal(r.status, 200);
assert.equal(r.data.pending_approval, undefined, '900만원 < 기준 1,000만원 → 바로 수락');
assert.equal(db.Quotation[0].client_accepted_by_name, '김실무');
assert.equal(db.Quotation[0].client_accept_note, '11월 첫 주 발주 예정');
assert.match(notes('quote_accepted').at(-1).link, /tab=quotation/);
assert.match(notes('quote_accepted').at(-1).body, /계약서/);
r = await call('clientCardAction', { card_id: 'c2', action: 'quote_accept', quotation_id: 'qt1' });
assert.equal(r.status, 409, '이미 수락');

// ── 디자인 확인: 직원 요청 → 실무자 수정 요청(핀) → 새 판 → 실무자 승인은 결재 → 결재 승인 ──
as(STAFF);
r = await call('requestFileReview', { action: 'request', card_id: 'c2', attachment_id: 'f2', question: '로고 위치와 색상 확인 부탁드립니다', due_date: '2099-01-10' });
assert.equal(r.status, 200);
const review1 = db.FileReview.find((x) => x.id === r.data.review_id);
assert.equal(review1.previous_attachment_id, 'f1', '이전 승인본과 비교');
assert.equal(db.CardAttachment[1].client_visible, true, '확인 요청한 파일은 고객에게 공개');
assert.equal(db.CardAttachment[1].client_review_status, 'PENDING');
assert.deepEqual(notes('file_review_requested').map((n) => n.recipient_id).sort(), ['u-boss', 'u-kim'], '결정 요청은 실무자·결재권자 (재무 제외)');
r = await call('requestFileReview', { action: 'request', card_id: 'c2', attachment_id: 'f2', question: '다시' });
assert.equal(r.status, 409, '확인 중인 파일');
as(KIM);
r = await call('getClientCardDetail', { card_id: 'c2' });
assert.equal(r.data.file_reviews[0].previous_attachment_id, 'f1');
r = await call('listClientTodos', {});
assert.equal(r.data.file_review_pending[0].review_id, review1.id);
r = await call('clientCardAction', { card_id: 'c2', action: 'file_review_decision', review_id: review1.id, decision: 'REVISION_REQUESTED' });
assert.equal(r.status, 400, '수정 요청은 내용이나 핀이 있어야');
r = await call('clientCardAction', { card_id: 'c2', action: 'file_review_decision', review_id: review1.id, decision: 'REVISION_REQUESTED', pins: [{ page: 1, x: 0.4, y: 0.2, text: '로고 2mm 위로' }] });
assert.equal(r.status, 200);
assert.equal(review1.status, 'REVISION_REQUESTED');
assert.equal(review1.pins[0].text, '로고 2mm 위로');
assert.equal(db.CardAttachment[1].client_review_status, 'REVISION_REQUESTED');
assert.match(notes('file_review_decision').at(-1).body, /1\. 로고 2mm 위로/);
db.CardAttachment.push({ id: 'f3', tenant_id: 't1', card_id: 'c2', file_name: '박스_v3.pdf', file_type: 'pdf', file_url: 'private://f3', client_visible: false });
as(STAFF);
r = await call('requestFileReview', { action: 'request', card_id: 'c2', attachment_id: 'f3', question: '수정본입니다', previous_attachment_id: 'f2' });
const review2 = r.data.review_id;
as(KIM);
r = await call('clientCardAction', { card_id: 'c2', action: 'file_review_decision', review_id: review2, decision: 'APPROVED', note: '이대로 인쇄' });
assert.equal(r.data.pending_approval, true, '디자인 승인도 결재 규칙을 따른다');
as(BOSS);
r = await call('clientCardAction', { card_id: 'c2', action: 'approval_decide', approval_id: r.data.approval_id, decision: 'APPROVE' });
assert.equal(r.status, 200);
const f3 = db.CardAttachment.find((a) => a.id === 'f3');
assert.equal(f3.client_review_status, 'APPROVED');
assert.equal(f3.client_approved_by_name, '김실무 (결재 박대표)');
assert.ok(f3.client_approved_at);
as(STAFF);
r = await call('requestFileReview', { action: 'request', card_id: 'c2', attachment_id: 'f3', question: '한 번 더' });
assert.equal(r.status, 409, '승인한 판은 다시 요청하지 않는다');

// ── 다른 고객사는 결재·확인 요청에 손댈 수 없다 ──
as(OTHER);
r = await call('clientCardAction', { card_id: 'c2', action: 'approval_cancel', approval_id: ap3 });
assert.equal(r.status, 403);

// ── 결재권자 본인 결정은 바로 실행, 자기 결재 막기 ──
as(BOSS);
const cfoRoles = co().client_roles.find((m) => m.email === 'cfo@buyer.example');
co().client_roles = co().client_roles.filter((m) => m !== cfoRoles);
r = await call('manageClientTeam', { action: 'set_rules', rules: { ...co().approval_rules, block_self_approval: true } });
assert.equal(r.status, 400, '결재권자가 한 명뿐이면 자기 결재를 막을 수 없다');
assert.match(r.data.error, /두 명/);
co().client_roles.push(cfoRoles);
db.User.push({ id: 'u-cfo', full_name: '최이사', account_tier: 'client', tenant_id: 'ct1', company_id: 'co1', is_active: true, email: 'cfo@buyer.example' });
r = await call('manageClientTeam', { action: 'set_rules', rules: { ...co().approval_rules, block_self_approval: true } });
assert.equal(r.status, 200, '결재권자 두 명(대표·이사)');
db.QCReport.push({ id: 'q2', tenant_id: 't1', card_id: 'c1', client_visible: true, inspection_type: 'SAMPLE' });
r = await call('clientCardAction', { card_id: 'c1', action: 'qc_decision', report_id: 'q2', decision: 'APPROVED' });
assert.equal(r.data.pending_approval, true, '자기 결재를 막으면 대표도 결재 요청');
const ap4 = r.data.approval_id;
r = await call('clientCardAction', { card_id: 'c1', action: 'approval_decide', approval_id: ap4, decision: 'APPROVE' });
assert.equal(r.status, 403);
assert.match(r.data.error, /다른 결재권자/);
assert.deepEqual(notes('client_approval_requested').at(-1).recipient_id, 'u-cfo');
as(db.User.find((u) => u.id === 'u-cfo'));
r = await call('clientCardAction', { card_id: 'c1', action: 'approval_decide', approval_id: ap4, decision: 'APPROVE' });
assert.equal(r.status, 200);
assert.equal(db.QCReport[1].client_decision, 'APPROVED');

// ── 역할별 알림: 결제 요청은 재무·실무자, 진행 알림은 실무자 ──
const before = db.Notification.length;
const { notifyUsers, clientUsersOfCompany } = await import('../base44/shared/notify.ts');
const svc = { entities: new Proxy({}, { get: (_, n) => ({ filter: async (q) => (db[n] || []).filter((x) => Object.entries(q).every(([k, v]) => x[k] === v)), get: async (id) => (db[n] || []).find((x) => x.id === id), create: async (d) => { db[n].push(d); return d; } }) }), integrations: { Core: { SendEmail: async () => ({}) } } };
await notifyUsers(svc, await clientUsersOfCompany(svc, 'co1'), { type: 'payment_requested', title: 't', task_card_id: 'c1' });
assert.deepEqual(db.Notification.slice(before).map((n) => n.recipient_id).sort(), ['u-cfo', 'u-kim', 'u-pay']);
const mid = db.Notification.length;
await notifyUsers(svc, await clientUsersOfCompany(svc, 'co1'), { type: 'card_moved', title: 't', task_card_id: 'c1' });
assert.deepEqual(db.Notification.slice(mid).map((n) => n.recipient_id), ['u-kim']);
await notifyUsers(svc, [STAFF], { type: 'card_moved', title: 't' });
assert.equal(db.Notification.at(-1).recipient_id, 's1', '직원은 그대로');

// ── 전자서명 서명자 후보는 결재권자 ──
as({ ...STAFF, account_tier: 'master' });
r = await call('sendSignatureRequest', { mode: 'signers', contract_id: 'k1' });
assert.equal(r.data.approvers_only, true);
assert.deepEqual(r.data.signers.map((s) => s.id).sort(), ['u-boss', 'u-cfo']);

// ── 사용 중지: 마지막 결재권자 보호, 자리 비움 ──
as(BOSS);
r = await call('manageClientTeam', { action: 'set_active', email: 'boss@buyer.example', active: false });
assert.equal(r.status, 400, '자기 계정은 사용 중지 못 함');
r = await call('manageClientTeam', { action: 'set_active', email: 'pay@buyer.example', active: false });
assert.equal(r.status, 200);
assert.equal(db.User.find((u) => u.id === 'u-pay').is_active, false);
assert.equal(r.data.members.find((m) => m.email === 'pay@buyer.example').roles.length, 0, '사용 중지하면 역할도 뺀다');
r = await call('manageClientTeam', { action: 'set_active', email: 'cfo@buyer.example', active: false });
assert.equal(r.status, 400, '자기 결재를 막은 상태에서 결재권자 두 명 아래로 못 내린다');
console.log('client-approvals: 고객사 역할·사내 결재·견적 수락·디자인 확인 함수 검산 통과');
