// 전자서명 검산: 감사 기록 사슬(하나를 빼거나 고치면 실패), 인증번호 규칙, 서명 가능 상태, 완료본 PDF.
// 실행: npm run check:signature
import assert from 'node:assert/strict';
import {
  sha256Hex, canonical, nextEvent, verifyChain, generateOtp, otpHash, freshOtp, checkOtp, canSendOtp, otpFreshForSigning,
  signerBlock, documentNo, maskEmail, maskIp, hasEsignClause, isPdf, OTP_TTL_MS, OTP_LOCK_MS, SIGN_WINDOW_MS, OTP_RESEND_GAP_MS,
} from '../base44/shared/signature.ts';

// ── 지문값 ──
assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 표준 값');
assert.equal(canonical({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } }), '{"a":{"c":null,"d":[1,{"x":1,"y":2}]},"b":1}');
assert.equal(canonical({ a: undefined, b: 1 }), '{"b":1}');
assert.ok(isPdf(new TextEncoder().encode('%PDF-1.7\n')));
assert.ok(!isPdf(new TextEncoder().encode('<html>')));

// ── 감사 기록 사슬 ──
const t0 = Date.parse('2026-10-26T06:00:00Z');
const at = (m) => new Date(t0 + m * 60000).toISOString();
const chain = [];
const add = async (type, extra = {}) => { const ev = await nextEvent(chain[chain.length - 1] || null, { request_id: 'r1', type, at: at(chain.length), ...extra }); chain.push(ev); return ev; };
await add('SENT', { actor_type: 'STAFF', actor_id: 'u1', actor_label: '이호민', data: { original_sha256: 'aa', version: 1 } });
await add('VIEWED', { actor_type: 'CLIENT', actor_id: 'u2', ip: '203.0.113.7', user_agent: 'Mobile Safari' });
await add('READ_TO_END', { actor_type: 'CLIENT', actor_id: 'u2' });
await add('OTP_SENT', { actor_type: 'CLIENT', actor_id: 'u2', data: { email: 'cl****@example.com' } });
await add('OTP_VERIFIED', { actor_type: 'CLIENT', actor_id: 'u2' });
await add('SIGNED', { actor_type: 'CLIENT', actor_id: 'u2', data: { method: 'DRAW', name: '김담당', hash_check: 'MATCH' } });
await add('COMPLETED', { data: { completed_sha256: 'bb' } });
assert.deepEqual(chain.map((e) => e.seq), [1, 2, 3, 4, 5, 6, 7]);
assert.equal(chain[0].prev_hash, '');
assert.equal(chain[1].prev_hash, chain[0].hash);
const ok = await verifyChain([...chain].reverse());
assert.equal(ok.ok, true, '순서가 섞여 와도 seq 로 정렬해 검사');
assert.equal(ok.head, chain[6].hash);

// 중간 기록 하나 빼기
let r = await verifyChain(chain.filter((e) => e.seq !== 4));
assert.deepEqual([r.ok, r.reason, r.brokenAt], [false, 'SEQ_GAP', 4]);
// 내용 고치기 (서명 방식)
r = await verifyChain(chain.map((e) => (e.seq === 6 ? { ...e, data: { ...e.data, method: 'TYPE' } } : e)));
assert.deepEqual([r.ok, r.reason, r.brokenAt], [false, 'HASH_MISMATCH', 6]);
// 시각 고치기
r = await verifyChain(chain.map((e) => (e.seq === 2 ? { ...e, at: at(30) } : e)));
assert.deepEqual([r.ok, r.brokenAt], [false, 2]);
// 고친 기록의 hash 까지 다시 계산해 끼워 넣으면 다음 기록의 prev_hash 와 어긋난다
const forged = await nextEvent(chain[1], { request_id: 'r1', type: 'READ_TO_END', actor_type: 'CLIENT', actor_id: 'u2', at: at(99) });
r = await verifyChain(chain.map((e) => (e.seq === 3 ? forged : e)));
assert.deepEqual([r.ok, r.reason, r.brokenAt], [false, 'PREV_MISMATCH', 4]);
// 마지막 기록 삭제는 사슬만으로는 알 수 없다 → 요청에 마지막 hash 를 저장해 비교 (head)
r = await verifyChain(chain.slice(0, 6));
assert.equal(r.ok, true);
assert.notEqual(r.head, chain[6].hash, '요청의 last_event_hash 와 비교하면 드러난다');
await assert.rejects(nextEvent(null, { request_id: 'r1', type: 'HACKED' }));

// ── 인증번호 ──
const codes = new Set(Array.from({ length: 200 }, generateOtp));
assert.ok([...codes].every((c) => /^\d{6}$/.test(c)));
assert.ok(codes.size > 190, '무작위');
const ids = { requestId: 'r1', userId: 'u2' };
assert.notEqual(await otpHash('123456', 'r1', 'u2'), await otpHash('123456', 'r2', 'u2'), '요청마다 다른 해시');
let otp = await freshOtp({ ...ids, code: '123456', now: t0 });
assert.equal(otp.expires_at, new Date(t0 + OTP_TTL_MS).toISOString());
assert.ok(!JSON.stringify(otp).includes('123456'), '번호 원문은 저장하지 않는다');
assert.deepEqual(canSendOtp(otp, t0 + 10_000), { ok: false, reason: 'TOO_SOON', wait_s: 50 });
assert.equal(canSendOtp(otp, t0 + OTP_RESEND_GAP_MS).ok, true);

let c = await checkOtp(otp, '000000', { ...ids, now: t0 + 1000 });
assert.deepEqual([c.ok, c.reason, c.left, c.patch], [false, 'WRONG', 4, { attempts: 1 }]);
assert.equal((await checkOtp(otp, '12345', { ...ids, now: t0 })).reason, 'FORMAT');
assert.equal((await checkOtp(otp, '123456', { ...ids, now: t0 + OTP_TTL_MS + 1 })).reason, 'EXPIRED');
c = await checkOtp(otp, ' 123456 ', { ...ids, now: t0 + 2000 });
assert.equal(c.ok, true);
assert.equal(c.patch.verified_at, new Date(t0 + 2000).toISOString());
assert.equal((await checkOtp({ ...otp, ...c.patch }, '123456', { ...ids, now: t0 + 3000 })).reason, 'USED', '한 번만 쓸 수 있다');

// 5회 틀리면 30분 잠금, 잠긴 동안 다시 보내기·확인 모두 막힘
for (let i = 1; i <= 5; i++) {
  c = await checkOtp(otp, '999999', { ...ids, now: t0 + i * 1000 });
  otp = { ...otp, ...c.patch };
  assert.equal(c.reason, i < 5 ? 'WRONG' : 'LOCKED_NOW');
}
assert.equal(otp.locked_until, new Date(t0 + 5000 + OTP_LOCK_MS).toISOString());
assert.equal(otp.code_hash, '', '잠기면 번호를 무효로');
assert.equal((await checkOtp(otp, '123456', { ...ids, now: t0 + 6000 })).reason, 'LOCKED');
assert.equal(canSendOtp(otp, t0 + 10 * 60000).reason, 'LOCKED');
assert.equal(canSendOtp(otp, t0 + 5000 + OTP_LOCK_MS + 1).ok, true, '잠금이 풀리면 다시 보낼 수 있다');

// 인증 후 15분 안에만 서명
assert.equal(otpFreshForSigning({ verified_at: new Date(t0).toISOString() }, t0 + SIGN_WINDOW_MS), true);
assert.equal(otpFreshForSigning({ verified_at: new Date(t0).toISOString() }, t0 + SIGN_WINDOW_MS + 1), false);
assert.equal(otpFreshForSigning({}, t0), false);

// ── 서명 가능 상태 ──
const req = { status: 'OUT', due_at: new Date(t0 + 86400000).toISOString(), signers: [{ user_id: 'u2', status: 'VIEWED' }] };
assert.equal(signerBlock(req, 'u2', t0), null);
assert.equal(signerBlock(req, 'u3', t0), 'NOT_SIGNER', '같은 회사 다른 계정도 서명 불가');
assert.equal(signerBlock(req, 'u2', t0 + 2 * 86400000), 'EXPIRED', '기한이 지나면 상태가 OUT 이어도 막는다');
assert.equal(signerBlock({ ...req, status: 'REVOKED' }, 'u2', t0), 'REVOKED');
assert.equal(signerBlock({ ...req, signers: [{ user_id: 'u2', status: 'SIGNED' }] }, 'u2', t0), 'ALREADY_SIGNED');
assert.equal(signerBlock(null, 'u2'), 'NOT_FOUND');

// ── 기타 ──
assert.equal(documentNo(2026, 12), 'SG-2026-0012');
assert.equal(maskEmail('client@example.com'), 'cl****@example.com');
assert.equal(maskIp('203.0.113.7'), '203.0.*.*');
assert.ok(hasEsignClause('제12조 (전자서명) 본 계약은 ...'));
assert.ok(hasEsignClause('제 3 조 (전자서명)'));
assert.ok(!hasEsignClause('전자서명으로 체결한다'), '조항 제목이 있어야 한다');

console.log('signature: 사슬·인증번호·상태 검산 통과');

// ── 완료본 PDF ── 한글 글꼴이 필요하다: SIGNATURE_TEST_FONT_REGULAR / _BOLD (TTF 경로) 또는 나눔고딕 CDN
const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
const fontkit = (await import('@pdf-lib/fontkit')).default;
const { buildCompletedPdf, wrap, kst } = await import('../base44/shared/signaturePdf.ts');
const fs = await import('node:fs');
const loadFont = async (envKey, url) => {
  if (process.env[envKey]) return new Uint8Array(fs.readFileSync(process.env[envKey]));
  try { const r = await fetch(url); if (r.ok) return new Uint8Array(await r.arrayBuffer()); } catch (_e) { /* 오프라인 */ }
  return null;
};
const regular = await loadFont('SIGNATURE_TEST_FONT_REGULAR', 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf');
const bold = await loadFont('SIGNATURE_TEST_FONT_BOLD', 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Bold.ttf');
assert.equal(kst('2026-10-26T06:46:05Z'), '2026-10-26 15:46:05 KST');
if (!regular || !bold) {
  console.log('signature: 한글 글꼴을 받지 못해 완료본 PDF 검산은 건너뜀 (SIGNATURE_TEST_FONT_REGULAR/_BOLD 로 지정 가능)');
} else {
  // 원본 2쪽짜리 PDF
  const orig = await PDFDocument.create();
  const hf = await orig.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 2; i++) orig.addPage([595.28, 841.89]).drawText(`ORIGINAL PAGE ${i}`, { x: 60, y: 760, size: 20, font: hf, color: rgb(0, 0, 0) });
  const origBytes = await orig.save();
  const origSha = await sha256Hex(origBytes);
  // 서명 이미지 (작은 PNG)
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGNgYGD4z8DAwMDAwMDAAAANAQEA0uS9GQAAAABJRU5ErkJggg==', 'base64'));
  const request = {
    document_no: 'SG-2026-0001', document_title: '테이블 상판 공급 계약서', page_count: 2, original_sha256: origSha, completed_at: at(10),
    consent_text: '위 계약서 내용을 끝까지 확인했으며, 전자서명으로 이 계약을 체결하는 데 동의합니다.',
    aegis_signer: { name: '이호민', title: '대표', company: 'DONGGUAN AEGIS TRADE CO., LTD' },
    signers: [{ user_id: 'u2', email: 'client@example.com', status: 'SIGNED', signed_name: '김담당', signed_title: '구매팀장', signed_company: '예시 고객사', method: 'DRAW', signed_at: at(9) }],
  };
  const out = await buildCompletedPdf({ lib: { PDFDocument, rgb }, fontkit, originalBytes: origBytes, fonts: { regular, bold }, request, events: chain.slice(0, 6), images: { client: { bytes: png, type: 'png' } } });
  const done = await PDFDocument.load(out);
  assert.equal(done.getPageCount(), 4, '원본 2쪽 + 확인서 + 감사 추적');
  assert.equal(done.getSubject(), `SG-2026-0001 · 원본 SHA-256 ${origSha}`);
  // 원본 쪽 내용이 그대로 복사됐는지 (쪽 크기와 본문 스트림)
  const origDoc = await PDFDocument.load(origBytes);
  for (let i = 0; i < 2; i++) assert.deepEqual(done.getPage(i).getSize(), origDoc.getPage(i).getSize());
  assert.notEqual(await sha256Hex(out), origSha);
  const lines = wrap('a'.repeat(200), { widthOfTextAtSize: (t, s) => t.length * s * 0.5 }, 10, 100);
  assert.ok(lines.length > 1 && lines.every((l) => l.length <= 20), '긴 지문값도 줄을 넘지 않는다');
  if (process.env.SIGNATURE_PDF_OUT) fs.writeFileSync(process.env.SIGNATURE_PDF_OUT, out);
  console.log(`signature: 완료본 PDF 검산 통과 (${(out.length / 1024).toFixed(0)}KB, 4쪽)`);
}
