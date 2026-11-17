// 카카오톡 대화 내보내기 파일 읽기 검산: PC·안드로이드·iOS·Mac CSV, 여러 줄 메시지, 시스템 줄 빼기, 날짜 범위, 글자 한도.
// 실행: npm run check:chat-import
import assert from 'node:assert/strict';
import { parseKakao, kakaoTranscript, fitFrom } from '../src/lib/chatImport.js';

const pc = `무니스 길상현 님과 카카오톡 대화
저장한 날짜 : 2026-11-17 09:00:00

--------------- 2026년 11월 15일 토요일 ---------------
[길상현] [오전 11:02] 시안 보내드렸어요
[이호민] [오후 12:05] 확인했습니다
버튼 위치는 내일 말씀드릴게요
[길상현] [오후 12:06] 사진
--------------- 2026년 11월 16일 일요일 ---------------
[길상현] [오후 2:14] 버튼은 뒤쪽으로 옮겨 주세요
길상현님이 나갔습니다.`;
let r = parseKakao(pc);
assert.equal(r.format, 'pc');
assert.deepEqual(r.dates, ['2026-11-15', '2026-11-16']);
assert.equal(r.messages.length, 3, '사진·나갔습니다 빼기');
assert.equal(r.messages[1].time, '12:05', '오후 12시는 12시');
assert.equal(r.messages[1].text, '확인했습니다\n버튼 위치는 내일 말씀드릴게요', '여러 줄 이어 붙이기');
assert.equal(r.messages[2].time, '14:14');
const t = kakaoTranscript(r.messages);
assert.match(t, /^--- 2026-11-15 ---\n\[길상현\] \[11:02\] 시안 보내드렸어요/);
assert.equal(kakaoTranscript(r.messages, { from: '2026-11-16' }), '--- 2026-11-16 ---\n[길상현] [14:14] 버튼은 뒤쪽으로 옮겨 주세요');

const android = `무니스 3 카카오톡 대화
저장한 날짜 : 2026년 11월 17일 오전 9:00

2026년 11월 16일 일요일
2026년 11월 16일 오전 12:30, 길상현 : 늦게 죄송해요
2026년 11월 16일 오후 1:05, 이호민 : 네 괜찮습니다
2026년 11월 16일 오후 1:06, 이호민 : 이모티콘`;
r = parseKakao(android);
assert.equal(r.format, 'mobile');
assert.equal(r.messages.length, 2);
assert.equal(r.messages[0].time, '00:30', '오전 12시는 0시');
assert.equal(r.messages[1].who, '이호민');

const ios = `2026. 11. 16. 오후 3:00, 길상현 : 견적 주세요\n2026. 11. 16. 오후 3:01, 이호민 : 내일 드립니다`;
r = parseKakao(ios);
assert.equal(r.format, 'ios');
assert.equal(r.messages[0].date, '2026-11-16');

const csv = `Date,User,Message\n2026-11-16 15:00:00,"길상현","가격은, 1천개 기준으로요"\n2026-11-16 15:02:00,"이호민","네\n확인할게요"`;
r = parseKakao(csv);
assert.equal(r.format, 'csv');
assert.equal(r.messages[0].text, '가격은, 1천개 기준으로요', '쉼표 들어간 메시지');
assert.equal(r.messages[1].text, '네\n확인할게요', '따옴표 안 줄바꿈');

// 글자 한도: 최근부터 채운다
const many = Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, time: '10:00', who: 'a', text: 'x'.repeat(100) }));
const dates = many.map((m) => m.date);
const from = fitFrom(many, dates, 1200);
assert.ok(kakaoTranscript(many, { from }).length <= 1200);
assert.ok(from > '2026-10-20', '최근 날짜만');
assert.equal(fitFrom(many, dates, 1e9), '2026-10-01', '다 들어가면 처음부터');
console.log('chat import ok');
