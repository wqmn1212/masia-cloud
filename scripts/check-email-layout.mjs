// 메일 공통 틀 검산: 틀 구조·글자 이스케이프·알림 메일·주간 요약·문의 접수(한·영·중)·인증번호·팀 추가 메일.
// 실행: npm run check:email-layout   (EMAIL_OUT=폴더 를 주면 만든 메일을 HTML 파일로 남긴다)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { emailLayout, textToHtml, facts, esc, appUrl, appBase } from '../base44/shared/emailLayout.ts';
import { emailBody } from '../base44/shared/notify.ts';
import { weeklyDigest, weeklyDigestHtml } from '../base44/shared/weeklyDigest.ts';

const OUT = process.env.EMAIL_OUT;
const save = (name, html) => { if (OUT) fs.writeFileSync(`${OUT}/${name}.html`, html); };
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// 틀
const html = emailLayout({ kind: '프로젝트 알림', eyebrow: '출고 전 검수', title: '검수 결과 <확인>', body: textToHtml('첫 줄\n둘째 줄\n\n새 문단 & 끝'), preheader: '미리보기' });
assert.match(html, /^<!doctype html>/);
assert.ok(html.includes('검수 결과 &lt;확인&gt;'), '제목은 이스케이프');
assert.ok(html.includes('첫 줄<br>둘째 줄') && html.includes('새 문단 &amp; 끝'), '줄바꿈·문단');
assert.ok(!/<script/i.test(emailLayout({ title: '<script>alert(1)</script>', body: textToHtml('<script>x</script>') })), '본문·제목에 태그를 넣을 수 없다');
assert.ok(html.includes('aegistrade.biz') && html.includes('회신하지'), '바닥 안내');
assert.match(html, /<img src="https:\/\/media\.base44\.com\/[^"]+" width="72" height="30" alt="AEGIS"/, '로고는 이미지 (크기 고정·alt 글자)');
assert.ok(!/>AEGIS<\/td>/.test(html), '글자 로고는 쓰지 않는다');
assert.ok(fs.readFileSync(new URL('../base44/emails/UserInvite.html', import.meta.url), 'utf8').includes('alt="AEGIS"'), '초대 메일도 이미지 로고');
assert.ok(html.includes('max-width:560px') && !/@import|<link/i.test(html), '웹 글꼴·외부 CSS 없이');
assert.equal(appUrl('/client/board'), `${appBase()}/client/board`, '앱 주소(APP_BASE_URL) 기준');
assert.equal(appUrl('https://x.example/a'), 'https://x.example/a');
assert.match(emailLayout({ title: 't', body: '', lang: 'en' }), /Please do not reply/);
assert.match(emailLayout({ title: 't', body: '', lang: 'zh' }), /请勿回复/);
assert.ok(facts([['프로젝트', esc('A&B')]]).includes('A&amp;B'));

// 알림 메일: 제목·본문·프로젝트·버튼
const n = emailBody('출고 전 검수 보고서가 등록되었습니다.\n조건부 합격 · 경미 불량 2건', '휴대용 선풍기 OEM', '/client/board?card=c1', { title: '검수 결과가 등록되었습니다' });
save('notify', n);
const np = plain(n);
assert.match(np, /검수 결과가 등록되었습니다/);
assert.match(np, /조건부 합격 · 경미 불량 2건/);
assert.match(np, /프로젝트 휴대용 선풍기 OEM/);
assert.ok(n.includes(`href="${appBase()}/client/board?card=c1"`), '버튼 주소');
// 예전 호출(제목 없이 글만)도 첫 줄을 제목으로
const old = emailBody('새 견적서가 발행되었습니다\n금액을 확인해 주세요', '', '');
assert.match(old, /<h1[^>]*>새 견적서가 발행되었습니다<\/h1>/);
assert.ok(!old.includes('프로젝트에서 확인하기'), '링크가 없으면 버튼도 없다');

// 주간 요약
const d = weeklyDigest({ name: '김담당', today: '2026-11-09', weekEnd: '2026-11-15', overview: { approvals: [{ can_approve: true, card_title: '휴대용 선풍기', target_label: '출고 승인' }], upcoming: [{ planned_date: '2026-11-12', label: '선적', card_title: '테이블 상판' }] }, changes: { arrivals: [{ date: '2026-11-07', label: '샘플', card_title: '드립백 포장재' }] } });
const w = weeklyDigestHtml(d);
save('weekly', w);
const wp = plain(w);
assert.match(wp, /11\/9 ~ 11\/15/);
assert.match(wp, /결재 요청 휴대용 선풍기 · 출고 승인/);
assert.match(wp, /11\/12 선적 테이블 상판/);
assert.match(wp, /11\/7 샘플 도착 드립백 포장재/);
assert.match(wp, /주간 요약을 끌 수 있습니다/);

// 서버에서 실제로 보내는 메일
const { inquiryReceivedEmailForCheck } = await import('../base44/functions/submitInquiry/entry.ts').then((m) => ({ inquiryReceivedEmailForCheck: m.inquiryReceivedEmail }));
for (const [lang, word] of [['ko', '1일 안에'], ['en', 'within one business day'], ['zh', '一个工作日内']]) {
  const h = inquiryReceivedEmailForCheck(lang, { company: '무니스', typeLabel: '단발 소싱', categories: ['조명'], quantity: '1,000', attachments: 1 });
  save(`inquiry-${lang}`, h);
  assert.ok(h.includes(word), `문의 접수 확인 (${lang})`);
  assert.match(h, new RegExp(`<html lang="${lang}"`));
}

console.log('email-layout: 메일 공통 틀 검산 통과');
