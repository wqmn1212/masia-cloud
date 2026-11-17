// 미팅 준비 브리프 검산: 고객에게 물을 것 / 우리가 답할 것 / 지난 결정 / 다가오는 일정, 중복 제거, 안건 문장, 인쇄 HTML 이스케이프.
// 실행: npm run check:meeting-brief
import assert from 'node:assert/strict';
import { buildMeetingBrief, briefAgenda, briefHtml } from '../src/lib/meetingBrief.js';

const b = buildMeetingBrief({
  today: '2026-11-16',
  card: { title: '무니스 수면 조명', client_name: '무니스', due_date: '2026-12-20', hq_requirements: '지름 150mm, 무드등 3단' },
  logs: [
    { meeting_date: '2026-11-02', title: '킥오프', decisions: '옛 결정', next_steps: '' },
    { meeting_date: '2026-11-10', title: '디자인 리뷰', decisions: '- 버튼은 뒤쪽\n- 색상은 오프화이트', next_steps: '1. 수정 렌더 공유\n2. 시제품 일정 안내' },
  ],
  tasks: [
    { title: '시제품 일정 안내', status: 'TODO', due_date: '2026-11-18' },
    { title: '렌더 수정', status: 'IN_PROGRESS', due_date: '2026-11-12', assignee_name: '이호민' },
    { title: '끝난 일', status: 'DONE' },
  ],
  requests: [
    { title: '디자인 자료', status: 'OPEN', due_date: '2026-11-20', items: [
      { label: '렌더 이미지', status: 'ACCEPTED', required: true },
      { label: 'STEP 파일', status: 'WAITING', required: true },
      { label: '치수', status: 'REDO' },
    ] },
    { title: '마감됨', status: 'CLOSED', items: [{ label: '안 보임', status: 'WAITING' }] },
  ],
  decisions: [{ topic: '색상', decision: '오프화이트', status: 'CONFIRMED', decided_at: '2026-11-10T03:00:00Z' }, { topic: '취소', decision: 'x', status: 'REVERSED' }],
  milestones: [
    { label: '완료된 단계', status: 'done', planned_date: '2026-11-01' },
    { label: '시제품', status: 'pending', planned_date: '2026-11-25' },
    { label: '디자인 확정', status: 'in_progress', planned_date: '2026-11-14' },
    { label: '양산', status: 'pending' },
    { label: '선적', status: 'pending', planned_date: '2027-01-10' },
  ],
  signals: [{ k: 'client_wait', ko: '견적 회신 5일째' }, { k: 'risk', ko: '시제품 일정 2일 지남' }, { k: 'opportunity', ko: '재주문' }],
});

assert.deepEqual(b.ask.map((x) => x.text), ['STEP 파일', '치수 (다시 요청함)', '견적 회신 5일째'], '안 온 자료 + 회신 대기, 마감된 요청 제외');
assert.equal(b.ask[0].note, '디자인 자료 · 2026-11-20까지');
assert.deepEqual(b.tell.map((x) => x.text), ['렌더 수정', '시제품 일정 안내', '수정 렌더 공유', '시제품 일정 2일 지남'], '업무(기한순) + 지난 다음 액션(번호 떼고, 업무와 겹치면 한 번) + 위험');
assert.ok(b.tell[0].late, '기한 지난 업무 표시');
assert.deepEqual(b.past.map((x) => x.text), ['색상: 오프화이트', '버튼은 뒤쪽', '색상은 오프화이트'], '확정 결정만 + 가장 최근 미팅 결정');
assert.deepEqual(b.next.map((x) => x.text), ['디자인 확정', '시제품', '선적'], '끝나지 않은 일정 날짜순 3개');
assert.ok(b.next[0].late);
assert.equal(b.last.title, '디자인 리뷰');
assert.equal(b.empty, false);

const agenda = briefAgenda(b);
assert.match(agenda, /^\[고객에게 물어볼 것\]\n- STEP 파일 \(디자인 자료/);
assert.match(agenda, /\[다가오는 일정\]\n- 디자인 확정 \(2026-11-14\)/);

assert.equal(buildMeetingBrief({ card: { title: 'x' } }).empty, true, '아무것도 없으면 빈 브리프');
const html = briefHtml(buildMeetingBrief({ card: { title: '<script>' }, tasks: [{ title: 'a&b', status: 'TODO' }] }), { date: '2026-11-16' });
assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;') && html.includes('a&amp;b'), 'HTML 이스케이프');
console.log('meeting brief ok');
