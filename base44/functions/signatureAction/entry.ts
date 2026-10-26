import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  BLOCK_TEXT, MAX_SIGNATURE_IMAGE_BYTES, SIGN_METHODS, canSendOtp, checkOtp, freshOtp, fromBase64, generateOtp, maskEmail, otpFreshForSigning, sha256Hex, signerBlock,
} from '../../shared/signature.ts';
import { appendEvent, completeRequest, fetchPrivate, uploadPrivate } from '../../shared/signatureServer.ts';
import { internalUsersOfTenant, notifyUsers, FROM_NAME } from '../../shared/notify.ts';

// 서명자(고객 계정) 행동: read_to_end · send_otp · verify_otp · sign · decline.
// 서명자로 지정된 본인만 할 수 있고, 마스터 열람 모드·직원은 막는다. 시각·IP 는 서버가 기록한다.
const text = (v: any, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.account_tier !== 'client' || user.is_active === false) return Response.json({ error: '서명자로 지정된 고객 계정만 할 수 있습니다' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole, db = svc.entities;
    const r = body.request_id ? await db.SignatureRequest.get(body.request_id).catch(() => null) : null;
    if (!r || r.client_id !== user.company_id) return Response.json({ error: '계약서를 찾을 수 없습니다' }, { status: 404 });
    const block = signerBlock(r, user.id);
    if (block) return Response.json({ error: BLOCK_TEXT[block] || '서명할 수 없습니다', code: block }, { status: 409 });
    const me = r.signers.find((s: any) => s.user_id === user.id);
    const actor = { actor_type: 'CLIENT', actor_id: user.id, actor_label: user.full_name || user.email || '' };
    const otpRow = async () => (await db.SignatureOtp.filter({ request_id: r.id, user_id: user.id }, '-created_date', 1))[0] || null;

    switch (body.action) {
      case 'read_to_end': {
        await appendEvent(svc, r, { type: 'READ_TO_END', ...actor }, req);
        return Response.json({ ok: true });
      }

      case 'send_otp': {
        const prev = await otpRow();
        const can = canSendOtp(prev);
        if (!can.ok) return Response.json({ error: can.reason === 'LOCKED' ? '인증번호를 5회 틀려 30분 동안 잠겼습니다' : `${can.wait_s}초 뒤에 다시 보낼 수 있습니다`, code: can.reason, until: can.until || '', wait_s: can.wait_s || 0 }, { status: 429 });
        const code = generateOtp();
        const fields = await freshOtp({ requestId: r.id, userId: user.id, code });
        if (prev) await db.SignatureOtp.update(prev.id, { ...fields, locked_until: prev.locked_until || '' });
        else await db.SignatureOtp.create(fields);
        await svc.integrations.Core.SendEmail({
          to: me.email, from_name: FROM_NAME, subject: `[AEGIS] 계약서 서명 인증번호 ${code}`,
          body: `계약서 서명을 위한 인증번호입니다.\n\n인증번호: ${code}\n\n${r.document_title} (${r.document_no})\n10분 동안 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시하고 담당자에게 알려 주세요.\n이지스 직원은 인증번호를 묻지 않습니다.`,
        });
        await appendEvent(svc, r, { type: 'OTP_SENT', ...actor, data: { email: maskEmail(me.email) } }, req);
        return Response.json({ ok: true, email_masked: maskEmail(me.email), expires_at: fields.expires_at });
      }

      case 'verify_otp': {
        const otp = await otpRow();
        const res = await checkOtp(otp, text(body.code, 10), { requestId: r.id, userId: user.id });
        if (res.patch && otp) await db.SignatureOtp.update(otp.id, res.patch);
        if (!res.ok) {
          if (['WRONG', 'LOCKED_NOW'].includes(res.reason)) await appendEvent(svc, r, { type: 'OTP_FAILED', ...actor, data: { reason: res.reason, left: res.left } }, req);
          const msg = { WRONG: `인증번호가 맞지 않습니다 (남은 횟수 ${res.left}회)`, LOCKED_NOW: '5회 틀려 30분 동안 잠겼습니다', LOCKED: '잠긴 상태입니다. 잠시 뒤 다시 시도해 주세요', EXPIRED: '인증번호가 만료되었습니다. 다시 받아 주세요', USED: '이미 사용한 인증번호입니다. 다시 받아 주세요', FORMAT: '숫자 6자리를 입력해 주세요', NO_CODE: '인증번호를 먼저 받아 주세요' }[res.reason] || '인증하지 못했습니다';
          return Response.json({ error: msg, code: res.reason, left: res.left ?? null }, { status: 400 });
        }
        await appendEvent(svc, r, { type: 'OTP_VERIFIED', ...actor }, req);
        return Response.json({ ok: true, verified_at: res.patch.verified_at });
      }

      case 'sign': {
        const otp = await otpRow();
        if (!otpFreshForSigning(otp)) return Response.json({ error: '본인 확인 후 15분이 지났습니다. 인증번호를 다시 받아 주세요', code: 'OTP_REQUIRED' }, { status: 400 });
        if (Number(body.version) !== Number(r.version) || body.original_sha256 !== r.original_sha256) return Response.json({ error: '그사이 계약서가 바뀌었습니다. 화면을 새로 고쳐 다시 확인해 주세요', code: 'VERSION_CHANGED' }, { status: 409 });
        if (body.consent !== true || body.consent_text !== r.consent_text) return Response.json({ error: '동의 문구를 확인하고 체크해 주세요' }, { status: 400 });
        const name = text(body.name, 40), title = text(body.title, 40), company = text(body.company, 80);
        if (!name || !company) return Response.json({ error: '이름과 회사명을 입력해 주세요' }, { status: 400 });
        if (!SIGN_METHODS.includes(body.method)) return Response.json({ error: '서명 방식을 고르세요' }, { status: 400 });
        const img = fromBase64(body.signature_png || '');
        const isPng = img.length > 8 && img[0] === 0x89 && img[1] === 0x50 && img[2] === 0x4e && img[3] === 0x47;
        const isJpg = img.length > 3 && img[0] === 0xff && img[1] === 0xd8;
        if (!isPng && !(isJpg && body.method === 'SEAL')) return Response.json({ error: '서명 이미지를 확인해 주세요' }, { status: 400 });
        if (img.length > MAX_SIGNATURE_IMAGE_BYTES) return Response.json({ error: '서명 이미지는 600KB 이하여야 합니다' }, { status: 400 });
        // 보관된 원본을 다시 읽어 지문값을 확인한다
        const original = await fetchPrivate(svc, r.original_file_uri);
        const match = (await sha256Hex(original)) === r.original_sha256;
        if (!match) return Response.json({ error: '보관된 계약서 원본을 확인하지 못했습니다. 담당자에게 알려 주세요', code: 'HASH_MISMATCH' }, { status: 500 });
        const sigUri = await uploadPrivate(svc, img, `${r.document_no}-signature.${isJpg ? 'jpg' : 'png'}`, isJpg ? 'image/jpeg' : 'image/png');
        const signedAt = new Date().toISOString();
        const signers = r.signers.map((s: any) => (s.user_id === user.id ? { ...s, status: 'SIGNED', signed_name: name, signed_title: title, signed_company: company, method: body.method, signature_file_uri: sigUri, signed_at: signedAt } : s));
        await db.SignatureRequest.update(r.id, { signers });
        r.signers = signers;
        await db.SignatureOtp.update(otp.id, { verified_at: '', code_hash: '' }); // 인증은 한 번의 서명에만 쓴다
        await appendEvent(svc, r, { type: 'SIGNED', ...actor, data: { name, title, company, method: body.method, consent_text: r.consent_text, hash_check: 'MATCH', original_sha256: r.original_sha256, signature_sha256: await sha256Hex(img) } }, req);
        if (signers.every((s: any) => s.status === 'SIGNED')) {
          try { await completeRequest(svc, r); } catch (e) {
            // 서명 기록은 남아 있다. 직원이 완료본 발급을 다시 실행한다.
            await notifyUsers(svc, await internalUsersOfTenant(svc, r.tenant_id), { type: 'contract_signed', title: `[완료본 발급 실패] ${r.document_title}`, body: `서명은 기록됐지만 완료본을 만들지 못했습니다: ${(e as Error).message}. 계약서 화면에서 '완료본 다시 발급'을 눌러 주세요.`, link: `/contracts?contract=${r.contract_id}` }).catch(() => 0);
            return Response.json({ ok: true, completed: false });
          }
        }
        return Response.json({ ok: true, completed: r.status === 'COMPLETED', completed_at: r.completed_at || '' });
      }

      case 'decline': {
        const reason = text(body.reason, 1000);
        if (reason.length < 2) return Response.json({ error: '수정할 내용을 적어 주세요' }, { status: 400 });
        const signers = r.signers.map((s: any) => (s.user_id === user.id ? { ...s, status: 'DECLINED' } : s));
        await db.SignatureRequest.update(r.id, { status: 'DECLINED', decline_reason: reason, signers });
        r.status = 'DECLINED';
        await appendEvent(svc, r, { type: 'DECLINED', ...actor, data: { reason } }, req);
        await db.Contract.update(r.contract_id, { status: 'REVIEW' }).catch(() => null);
        await notifyUsers(svc, await internalUsersOfTenant(svc, r.tenant_id), { type: 'contract_declined', title: `[계약서 수정 요청] ${r.document_title}`, body: `${user.full_name || '고객'}님: ${reason}`, link: `/contracts?contract=${r.contract_id}`, task_card_id: r.card_id || '' }).catch(() => 0);
        return Response.json({ ok: true });
      }

      default:
        return Response.json({ error: '지원하지 않는 요청입니다' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
