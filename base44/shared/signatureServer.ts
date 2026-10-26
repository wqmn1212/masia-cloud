// 전자서명 서버 공용: 감사 기록 추가, 권한 확인, 비공개 파일, 완료본 발급.
// 감사 기록(SignatureEvent)과 인증번호(SignatureOtp)는 RLS 로 화면에서 만들 수 없고 이 모듈(asServiceRole)만 쓴다.
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { nextEvent, sha256Hex, clientIp, userAgent } from './signature.ts';
import { buildCompletedPdf } from './signaturePdf.ts';
import { notifyUsers, clientUsersOfCompany, internalUsersOfTenant } from './notify.ts';

export const STAFF_TIERS = ['master', 'service', 'sub'];
const FONT_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf';

export const staffCanAccess = (user: any, rec: any) => !!rec && STAFF_TIERS.includes(user?.account_tier) && user.is_active !== false && (user.account_tier === 'master' || rec.tenant_id === user.tenant_id);

// 요청의 마지막 기록 뒤에 새 기록을 붙이고, 요청의 last_event_* 를 갱신한다.
export async function appendEvent(svc: any, request: any, fields: any, req?: Request) {
  const prev = request.last_event_seq ? { seq: request.last_event_seq, hash: request.last_event_hash } : null;
  const ev = await nextEvent(prev, { request_id: request.id, ...(req ? { ip: clientIp(req), user_agent: userAgent(req) } : {}), ...fields });
  await svc.entities.SignatureEvent.create({ tenant_id: request.tenant_id, ...ev });
  await svc.entities.SignatureRequest.update(request.id, { last_event_seq: ev.seq, last_event_hash: ev.hash });
  request.last_event_seq = ev.seq;
  request.last_event_hash = ev.hash;
  return ev;
}

export async function listEvents(svc: any, requestId: string) {
  return (await svc.entities.SignatureEvent.filter({ request_id: requestId }, 'seq', 500)).filter((e: any) => e.request_id === requestId);
}

export async function signedUrl(svc: any, uri: string, seconds = 300) {
  if (!uri) return '';
  return (await svc.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: seconds })).signed_url;
}

export async function fetchPrivate(svc: any, uri: string) {
  const url = await signedUrl(svc, uri, 120);
  const res = await fetch(url);
  if (!res.ok) throw new Error('보관된 파일을 읽지 못했습니다');
  return new Uint8Array(await res.arrayBuffer());
}

export async function uploadPrivate(svc: any, bytes: Uint8Array, name: string, type: string) {
  const out = await svc.integrations.Core.UploadPrivateFile({ file: new File([bytes], name, { type }) });
  if (!out?.file_uri) throw new Error('파일을 보관하지 못했습니다');
  return out.file_uri;
}

export async function signatureSettings(svc: any, tenantId: string) {
  return (await svc.entities.OperationSetting.filter({ tenant_id: tenantId }, '-updated_date', 1))[0] || {};
}

let fontCache: Uint8Array | null = null;
async function koreanFont() {
  if (!fontCache) {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error('완료본 글꼴을 불러오지 못했습니다');
    fontCache = new Uint8Array(await res.arrayBuffer());
  }
  return fontCache;
}

const imageType = (bytes: Uint8Array) => (bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : 'png');

// 마지막 서명 뒤: 원본 지문값 재확인 → 완료본 생성·보관 → COMPLETED 기록 → 계약 체결 → 알림.
// 실패해도 서명 기록은 남아 있으므로 completeSignature 함수로 다시 실행할 수 있다.
export async function completeRequest(svc: any, request: any) {
  if (request.status === 'COMPLETED') return request;
  const original = await fetchPrivate(svc, request.original_file_uri);
  if ((await sha256Hex(original)) !== request.original_sha256) throw new Error('보관된 원본의 지문값이 다릅니다. 완료본을 만들지 않았습니다');
  const signer = (request.signers || []).find((s: any) => s.status === 'SIGNED');
  const images: any = {};
  if (signer?.signature_file_uri) { const b = await fetchPrivate(svc, signer.signature_file_uri); images.client = { bytes: b, type: imageType(b) }; }
  if (request.aegis_signer?.seal_uri) { try { const b = await fetchPrivate(svc, request.aegis_signer.seal_uri); images.seal = { bytes: b, type: imageType(b) }; } catch (_e) { /* 직인 없이 발급 */ } }
  const completedAt = new Date().toISOString();
  const events = await listEvents(svc, request.id);
  const bytes = await buildCompletedPdf({ lib: { PDFDocument, rgb }, fontkit, originalBytes: original, fonts: { regular: await koreanFont() }, request: { ...request, completed_at: completedAt }, events, images });
  const completedSha = await sha256Hex(bytes);
  const uri = await uploadPrivate(svc, bytes, `${request.document_no}-signed.pdf`, 'application/pdf');
  await svc.entities.SignatureRequest.update(request.id, { status: 'COMPLETED', completed_file_uri: uri, completed_sha256: completedSha, completed_at: completedAt });
  Object.assign(request, { status: 'COMPLETED', completed_file_uri: uri, completed_sha256: completedSha, completed_at: completedAt });
  await appendEvent(svc, request, { type: 'COMPLETED', actor_type: 'SYSTEM', actor_label: '이지스 클라우드', data: { completed_sha256: completedSha, original_sha256: request.original_sha256 } });

  const contract = await svc.entities.Contract.get(request.contract_id).catch(() => null);
  if (contract) {
    await svc.entities.Contract.update(contract.id, { status: 'SIGNED', signed_at: completedAt, signed_file_uri: uri, current_request_id: request.id });
    // 월 구독 계약서: 연결된 구독 계약을 시작한다
    if (contract.contract_type === 'SERVICE' && contract.service_agreement_id) {
      const ag = await svc.entities.ServiceAgreement.get(contract.service_agreement_id).catch(() => null);
      if (ag && ag.status === 'DRAFT' && ag.tenant_id === request.tenant_id) await svc.entities.ServiceAgreement.update(ag.id, { status: 'ACTIVE' });
    }
  }
  const card = request.card_id ? await svc.entities.TaskCard.get(request.card_id).catch(() => null) : null;
  const hasDeposit = card ? (await svc.entities.PaymentStage.filter({ card_id: card.id, stage_type: 'DOWN_PAYMENT' }, 'created_date', 1)).some((s: any) => s.approval_status !== 'APPROVED') : false;
  const title = `[계약 체결] ${request.document_title}`;
  try {
    await notifyUsers(svc, await clientUsersOfCompany(svc, request.client_id), {
      type: 'contract_signed', title,
      body: `전자서명으로 계약이 체결되었습니다 (${request.document_no}). 서명 확인서와 감사 추적이 붙은 완료본을 포털에서 내려받으실 수 있습니다.${hasDeposit ? '\n다음 단계: 프로젝트 결제 탭에서 선금 안내를 확인해 주세요.' : ''}`,
      link: `/client/dashboard?sign=${request.id}`, task_card_id: card?.id || '', card_title: card?.title || '',
    });
    await notifyUsers(svc, await internalUsersOfTenant(svc, request.tenant_id), {
      type: 'contract_signed', title, body: `${signer?.signed_name || ''}${signer?.signed_company ? ` (${signer.signed_company})` : ''}님이 서명해 계약이 체결되었습니다.${hasDeposit ? ' 선금 입금을 확인해 주세요.' : ''}`,
      link: `/contracts?contract=${request.contract_id}`, task_card_id: card?.id || '', card_title: card?.title || '',
    });
  } catch (_e) { /* 알림 실패가 체결을 막지 않는다 */ }
  return request;
}
