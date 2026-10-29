import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { CONSENT_TEXT, DEFAULT_DUE_DAYS, MAX_PDF_BYTES, documentNo, fromBase64, hasEsignClause, isPdf, maskEmail, sha256Hex } from '../../shared/signature.ts';
import { appendEvent, signatureSettings, staffCanAccess, uploadPrivate } from '../../shared/signatureServer.ts';
import { notifyUsers } from '../../shared/notify.ts';
import { approversOf } from '../../shared/clientRoles.ts';

// 직원: 계약서 PDF 를 고정해 고객 서명을 요청한다.
//  mode 'signers' — 계약 고객사의 서명 가능한 계정 목록 / mode 'send' — 요청 발송
// 고객사가 결재권자를 정했으면 서명자는 결재권자 중에서만 고른다.
// 지문값은 서버가 받은 바이트로 계산한다 (화면이 보낸 값은 쓰지 않는다).
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole, db = svc.entities;
    const contract = body.contract_id ? await db.Contract.get(body.contract_id).catch(() => null) : null;
    if (!staffCanAccess(user, contract)) return Response.json({ error: '계약서에 접근할 수 없습니다' }, { status: 403 });
    if (!contract.client_id) return Response.json({ error: '계약서에 고객사를 먼저 연결하세요' }, { status: 400 });

    const active = (await db.User.filter({ account_tier: 'client', company_id: contract.client_id })).filter((u: any) => u.is_active !== false && u.company_id === contract.client_id);
    const approvers = approversOf(await db.Company.get(contract.client_id).catch(() => null));
    const clients = approvers.length ? active.filter((u: any) => approvers.includes(String(u.email || '').toLowerCase())) : active;
    if (body.mode === 'signers') {
      return Response.json({ approvers_only: approvers.length > 0, signers: clients.map((u: any) => ({ id: u.id, name: u.full_name || '', email: u.email || '', shared: /^(info|office|admin|contact|sales|cs|help)@/i.test(u.email || '') })) });
    }

    // ── 발송 ──
    if (!['DRAFT', 'REVIEW'].includes(contract.status)) return Response.json({ error: contract.status === 'SENT' ? '이미 서명 요청 중입니다. 회수한 뒤 다시 보내세요' : '체결되었거나 취소된 계약서입니다' }, { status: 409 });
    if (!hasEsignClause(contract.body)) return Response.json({ error: '계약서에 전자서명 조항이 없습니다. "제○조 (전자서명)" 조항을 넣고 저장한 뒤 보내세요', code: 'NO_ESIGN_CLAUSE' }, { status: 400 });
    if (contract.contract_type === 'TRIPARTITE') return Response.json({ error: '공장이 당사자인 3자 계약은 2단계부터 전자서명을 지원합니다. PDF 로 진행해 주세요' }, { status: 400 });
    const signer = clients.find((u: any) => u.id === body.signer_user_id);
    if (!signer?.email) return Response.json({ error: approvers.length ? '서명자는 계약 고객사의 결재권자여야 합니다' : '서명자는 계약 고객사의 활성 계정이어야 합니다' }, { status: 400 });
    const open = await db.SignatureRequest.filter({ contract_id: contract.id, status: 'OUT' }, '-created_date', 1);
    if (open.length) return Response.json({ error: '진행 중인 서명 요청이 있습니다' }, { status: 409 });

    const bytes = fromBase64(body.pdf_base64);
    if (!isPdf(bytes)) return Response.json({ error: 'PDF 파일이 아닙니다' }, { status: 400 });
    if (bytes.length > MAX_PDF_BYTES) return Response.json({ error: 'PDF 는 10MB 이하여야 합니다' }, { status: 400 });
    const sha = await sha256Hex(bytes);
    const days = Math.min(60, Math.max(1, Number(body.due_days) || DEFAULT_DUE_DAYS));
    const now = new Date();
    const due = new Date(now.getTime() + days * 86400000);
    due.setUTCHours(14, 59, 59, 0); // 기한 날짜의 한국 시각 23:59:59
    const year = Number(new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 4));
    const yearCount = (await db.SignatureRequest.filter({ tenant_id: contract.tenant_id }, '-created_date', 1000)).filter((r: any) => String(r.document_no || '').startsWith(`SG-${year}-`)).length;
    const version = (await db.SignatureRequest.filter({ contract_id: contract.id }, '-created_date', 100)).length + 1;
    const docNo = documentNo(year, yearCount + 1);
    const uri = await uploadPrivate(svc, bytes, `${docNo}-v${version}.pdf`, 'application/pdf');
    const settings = await signatureSettings(svc, contract.tenant_id);

    const request = await db.SignatureRequest.create({
      tenant_id: contract.tenant_id, contract_id: contract.id, card_id: contract.card_id || '', client_id: contract.client_id,
      version, document_no: docNo, document_title: contract.contract_title || '계약서', page_count: Math.max(1, Math.min(500, Number(body.page_count) || 1)),
      original_file_uri: uri, original_sha256: sha, original_bytes: bytes.length,
      signers: [{ order: 1, user_id: signer.id, email: signer.email, name: signer.full_name || '', status: 'PENDING' }],
      aegis_signer: { name: settings.signature_rep_name || '', title: settings.signature_rep_title || '대표', company: settings.signature_company || 'DONGGUAN AEGIS TRADE CO., LTD', seal_uri: settings.signature_seal_uri || '' },
      consent_text: CONSENT_TEXT, due_at: due.toISOString(), status: 'OUT', sent_by_id: user.id, sent_by_name: user.full_name || user.email || '', reminders_sent: [],
    });
    await appendEvent(svc, request, { type: 'SENT', actor_type: 'STAFF', actor_id: user.id, actor_label: user.full_name || user.email || '', data: { version, original_sha256: sha, bytes: bytes.length, signer_email: maskEmail(signer.email), due_at: request.due_at } }, req);
    await db.Contract.update(contract.id, { status: 'SENT', current_request_id: request.id });

    const card = contract.card_id ? await db.TaskCard.get(contract.card_id).catch(() => null) : null;
    await notifyUsers(svc, [signer], {
      type: 'contract_sent', title: `[계약서 서명 요청] ${request.document_title}`,
      body: `${user.full_name || '담당자'}님이 계약서 서명을 요청했습니다. 포털에 로그인해 계약서를 읽고, 이메일 인증번호로 본인 확인을 한 뒤 서명해 주세요. 서명 기한: ${due.toISOString().slice(0, 10)}\n메일에는 계약서를 붙이지 않습니다.`,
      link: `/client/dashboard?sign=${request.id}`, task_card_id: card?.id || '', card_title: card?.title || '',
    }).catch(() => 0);

    return Response.json({ ok: true, request_id: request.id, document_no: docNo, version, original_sha256: sha, due_at: request.due_at });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
