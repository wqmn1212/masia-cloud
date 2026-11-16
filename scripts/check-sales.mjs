// 영업 파이프라인 계산 검산: 영업일 계산, 다음 연락일 기본값, 오늘·밀린 연락, 엑셀 붙여넣기, 메일 문안.
// 실행: npm run check:sales
import assert from 'node:assert/strict';
import * as S from '../src/lib/salesPipeline.js';

assert.equal(S.addBusinessDays('2026-11-13', 1), '2026-11-16', '금요일 다음 영업일은 월요일');
assert.equal(S.addBusinessDays('2026-11-16', 4), '2026-11-20');
assert.equal(S.defaultFollowUp('SENT', '2026-11-16'), '2026-11-20', '첫 메일 뒤 4영업일');
assert.equal(S.defaultFollowUp('MEETING', '2026-11-20'), '2026-11-24', '미팅 뒤 2영업일 (주말 건너뜀)');
assert.equal(S.defaultFollowUp('WON', '2026-11-20'), '', '끝난 단계는 다음 연락 없음');
assert.equal(S.kstToday(new Date('2026-11-15T16:00:00Z')), '2026-11-16', '한국 날짜');

assert.deepEqual(S.followUpState({ stage: 'SENT', next_follow_up: '2026-11-16' }, '2026-11-16'), { today: true });
assert.deepEqual(S.followUpState({ stage: 'REPLIED', next_follow_up: '2026-11-13' }, '2026-11-16'), { late: true, days: 3 });
assert.equal(S.followUpState({ stage: 'LOST', next_follow_up: '2026-11-13' }, '2026-11-16'), null, '보류는 알리지 않음');
assert.equal(S.followUpState({ stage: 'SENT', next_follow_up: '2026-11-20' }, '2026-11-16'), null);
assert.equal(S.outreachCount({ touches: [{ kind: 'email' }, { kind: 'note' }, { kind: 'call' }] }), 2);

const withHead = S.parseProspects('회사\t담당자\t이메일\t업종\n무니스\t길상현\tkil@example.com\t조명\n\n바이어상사\t김담당\t잘못된메일\t생활용품');
assert.deepEqual(withHead, [{ company: '무니스', contact_name: '길상현', email: 'kil@example.com', industry: '조명' }, { company: '바이어상사', contact_name: '김담당', industry: '생활용품' }], '머리글로 칸 맞춤, 잘못된 이메일은 버림');
assert.deepEqual(S.parseProspects('에이컴퍼니,박대리,a@b.co'), [{ company: '에이컴퍼니', contact_name: '박대리', email: 'a@b.co' }], '머리글 없으면 기본 순서');
assert.deepEqual(S.parseProspects('담당자\t이메일\n홍길동\th@x.co'), [], '회사명이 없으면 넣지 않음');

const t = S.mailTemplates({ company: '무니스', contact_name: '길상현', contact_title: '대표', product_idea: '수면 조명' }, { sender: '이호민', deck: 'https://deck.example' });
assert.deepEqual(t.map((x) => x.key), ['first', 'follow1', 'follow2', 'thanks']);
assert.match(t[0].subject, /무니스 수면 조명/);
assert.match(t[0].body, /^길상현 대표님, /);
assert.match(t[0].body, /https:\/\/deck\.example/);
assert.match(S.mailTemplates({ company: 'X' })[0].body, /^담당자님, .*\[보내는 사람\]/s, '빈 칸은 대괄호로 남긴다');
console.log('sales pipeline ok');
