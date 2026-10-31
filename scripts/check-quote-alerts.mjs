// 견적 단계 지연 알림 검산 (직원 아침 요약): 견적 기한, 공장 견적서 미회신, 공장 견적 초안·반려 확인,
// 견적 승인 대기(관리자만), 고객 견적 회신 대기, 견적 유효기간 임박·지남, 그리고 내 카드만·관리자 범위.
// 실행: npm run check:quote-alerts
import assert from 'node:assert/strict';
import * as D from '../base44/shared/opsDigest.ts';

const today = '2026-11-02';
const now = '2026-11-01T23:30:00Z';
const ME = { id: 'u1', full_name: '왕리', account_tier: 'sub' };
const BOSS = { id: 'u9', full_name: '이호민', account_tier: 'service' };
const iso = (ymd, h = 1) => `${ymd}T0${h}:00:00Z`;
const data = {
  cards: [
    { id: 'c1', title: '타정기 5구', status: 'TODO', owner_id: 'u1', quote_deadline: '2026-11-02' },
    { id: 'c2', title: '라벨 부착기', status: 'IN_PROGRESS', owner_id: 'u1', quote_deadline: '2026-10-29' },
    { id: 'c3', title: '포장기', status: 'IN_PROGRESS', owner_id: 'u1', quote_deadline: '2026-11-03' },
    { id: 'c4', title: '이미 보낸 카드', status: 'REVIEW', owner_id: 'u1', quote_deadline: '2026-10-20' },
    { id: 'c5', title: '남의 카드', status: 'TODO', owner_id: 'u2', quote_deadline: '2026-10-28' },
    { id: 'c6', title: '끝난 카드', status: 'DONE', owner_id: 'u1', quote_deadline: '2026-10-01' },
  ],
  factoryRequests: [
    { id: 'f1', card_id: 'c1', factory_name: '운용', status: 'OPEN', created_date: iso('2026-10-29'), last_opened_at: iso('2026-10-30'), expires_at: '2026-11-12T00:00:00Z', items: [{ kind: 'QUOTE', status: 'WAITING' }] },
    { id: 'f2', card_id: 'c1', factory_name: '광저우 신화', status: 'OPEN', created_date: iso('2026-11-01'), last_opened_at: iso('2026-11-01'), expires_at: '2026-11-12T00:00:00Z', items: [{ kind: 'QUOTE', status: 'WAITING' }, { kind: 'PHOTO', status: 'WAITING' }] },
    { id: 'f3', card_id: 'c3', factory_name: '선전', status: 'OPEN', created_date: iso('2026-10-20'), last_opened_at: iso('2026-10-21'), expires_at: '2026-11-12T00:00:00Z', items: [{ kind: 'QUOTE', status: 'SUBMITTED' }] },
  ],
  quotes: [
    { id: 'q1', card_id: 'c1', status: 'DRAFT', factory_request_id: 'f1', factory_name: '운용', quote_title: 'ZP-5B' },
    { id: 'q2', card_id: 'c2', status: 'DRAFT', quote_title: '라벨기 A안', review_rejected_reason: '마진 15% 이상', review_requested_by_id: 'u1' },
    { id: 'q3', card_id: 'c3', status: 'REVIEW', quote_title: '포장기 견적', review_requested_at: iso('2026-10-31'), review_requested_by_name: '왕리' },
    { id: 'q4', card_id: 'c3', status: 'REVIEW', quote_title: '방금 요청', review_requested_at: iso('2026-11-02') },
    { id: 'q5', card_id: 'c4', status: 'SENT', quote_title: '보낸 견적', client_published_at: iso('2026-10-27'), validity_days: 30 },
    { id: 'q6', card_id: 'c4', status: 'SENT', quote_title: '곧 만료', client_published_at: iso('2026-10-04'), validity_days: 30 },
    { id: 'q7', card_id: 'c4', status: 'SENT', quote_title: '만료됨', client_published_at: iso('2026-09-25'), validity_days: 30 },
    { id: 'q8', card_id: 'c4', status: 'SENT', quote_title: '수락됨', client_published_at: iso('2026-09-01'), client_accepted_at: iso('2026-09-03'), validity_days: 30 },
    { id: 'q9', card_id: 'c4', status: 'SENT', quote_title: '어제 보냄', client_published_at: iso('2026-11-01'), validity_days: 30 },
    { id: 'q10', card_id: 'c4', status: 'SENT', quote_title: '오래전 만료', client_published_at: iso('2026-08-01'), validity_days: 30 },
    { id: 'q11', card_id: 'c5', status: 'SENT', quote_title: '남의 견적', client_published_at: iso('2026-10-20'), validity_days: 60 },
  ],
};
const me = D.buildOpsDigest({ user: ME, today, now, data });
const s = me.sections;
const ko = (k) => s[k].map((x) => `${x.card_title} · ${x.ko}`);

assert.deepEqual(ko('due_today'), ['타정기 5구 · 견적 기한 (고객에게 보낸 견적 없음)']);
assert.ok(ko('risk').includes('라벨 부착기 · 견적 기한 4일 지남 (고객에게 보낸 견적 없음)'));
assert.ok(ko('risk').includes('포장기 · 견적 기한 11/3 (내일)'));
assert.ok(!ko('risk').some((x) => x.startsWith('이미 보낸 카드 · 견적 기한')), '고객에게 견적을 보낸 카드는 견적 기한을 묻지 않는다');
assert.ok(!ko('risk').some((x) => x.startsWith('남의 카드')), '남의 카드는 내 요약에 없다');

assert.deepEqual(ko('factory_wait'), ['타정기 5구 · 운용 견적서 4일째 미회신', '타정기 5구 · 광저우 신화 견적서 기다리는 중', '타정기 5구 · 공장 미제출 1건 (기한 11/12)'], '견적서와 다른 항목을 나눠 센다');
assert.ok(ko('to_check').includes('포장기 · 공장 제출 1건 확인 대기'));
assert.ok(ko('to_check').includes('타정기 5구 · 공장 견적 초안 · 운용 (마진 확인 후 검토 요청)'));
assert.ok(ko('to_check').includes('라벨 부착기 · 견적 반려됨 · 라벨기 A안: 마진 15% 이상'));
assert.ok(!ko('to_check').some((x) => x.includes('견적 승인 대기')), '승인 대기는 관리자에게만');

assert.deepEqual(ko('client_wait'), ['이미 보낸 카드 · 견적 회신 · 6일째 · 보낸 견적'], '3일 넘게 회신이 없으면 (어제 보낸 것·수락된 것은 빼고)');
assert.ok(ko('risk').includes('이미 보낸 카드 · 견적 유효기간 11/3 만료 (1일 남음) · 곧 만료'));
assert.ok(ko('risk').includes('이미 보낸 카드 · 견적 유효기간 8일 지남 · 만료됨 (가격 재확인)'));
assert.ok(!ko('risk').some((x) => x.includes('오래전 만료')), '14일 넘게 지난 것은 더 묻지 않는다');
assert.ok(!ko('risk').some((x) => x.includes('수락됨')));

// 관리자: 승인 대기 (요청 1일 이상)
const boss = D.buildOpsDigest({ user: BOSS, admin: true, today, now, data });
const bt = boss.sections.to_check.map((x) => x.ko);
assert.deepEqual(bt.filter((x) => x.includes('승인 대기')), ['견적 승인 대기 2일째 · 포장기 견적 (요청 왕리)'], '오늘 요청한 것은 아직');
assert.ok(!boss.sections.risk.some((x) => x.ko.includes('견적 기한')), '관리자도 남의 카드 견적 기한은 팀 숫자로만');
assert.equal(boss.team.quote_overdue, 1, '라벨 부착기만 (남의 카드는 이미 견적을 보냄, 끝난 카드 제외)');
assert.match(D.digestText(boss, { name: '이호민' }).body, /견적 기한 지남 1건/);

// 메일 글
const text = D.digestText(me, { name: '왕리' });
assert.match(text.body, /■ 공장 대기 \(3\)\n- 타정기 5구 · 운용 견적서 4일째 미회신/);
const zh = D.digestText(me, { name: '王丽', lang: 'zh' });
assert.match(zh.body, /운용 报价单4天未回复/);
console.log('quote-alerts ok');
