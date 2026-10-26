import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { BLOCK_TEXT, maskEmail, maskIp, otpFreshForSigning, signerBlock, verifyChain } from '../../shared/signature.ts';
import { STAFF_TIERS, appendEvent, listEvents, signedUrl, staffCanAccess } from '../../shared/signatureServer.ts';

// 서명 요청 조회.
//  직원: { contract_id } → 그 계약의 요청 전체(버전별)와 감사 기록·사슬 검사 / { request_id, purpose:'download' } → 완료본 링크
//  고객: { list: true } → 자기 회사의 서명 대기·체결 목록 / { request_id } → 열람(서명자가 처음 열면 VIEWED 기록), purpose:'download' → 완료본 링크(DOWNLOADED 기록)
// PDF 는 비공개 저장소의 5분짜리 링크로만 준다.
const effective = (r: any) => (r.status === 'OUT' && r.due_at && Date.parse(r.due_at) < Date.now() ? 'EXPIRED' : r.status);

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole, db = svc.entities;

    // ── 직원 ──
    if (STAFF_TIERS.includes(user.account_tier) && !body.view_company_id) {
      if (body.request_id) {
        const r = await db.SignatureRequest.get(body.request_id).catch(() => null);
        if (!staffCanAccess(user, r)) return Response.json({ error: 'Forbidden' }, { status: 403 });
        const uri = body.purpose === 'download' && r.completed_file_uri ? r.completed_file_uri : r.original_file_uri;
        return Response.json({ url: await signedUrl(svc, uri) }, { headers: { 'Cache-Control': 'no-store' } });
      }
      const contract = body.contract_id ? await db.Contract.get(body.contract_id).catch(() => null) : null;
      if (!staffCanAccess(user, contract)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const list = (await db.SignatureRequest.filter({ contract_id: contract.id }, '-version', 50)).filter((r: any) => r.tenant_id === contract.tenant_id);
      const requests = await Promise.all(list.map(async (r: any) => {
        const events = await listEvents(svc, r.id);
        const chain = await verifyChain(events);
        return {
          id: r.id, version: r.version, document_no: r.document_no, document_title: r.document_title, status: effective(r), raw_status: r.status,
          due_at: r.due_at, created_date: r.created_date, sent_by_name: r.sent_by_name, revoked_by_name: r.revoked_by_name || '', decline_reason: r.decline_reason || '',
          original_sha256: r.original_sha256, completed_sha256: r.completed_sha256 || '', completed_at: r.completed_at || '', page_count: r.page_count,
          signers: (r.signers || []).map((s: any) => ({ user_id: s.user_id, name: s.name, email: s.email, status: s.status, viewed_at: s.viewed_at || '', signed_name: s.signed_name || '', signed_title: s.signed_title || '', signed_company: s.signed_company || '', method: s.method || '', signed_at: s.signed_at || '' })),
          chain_ok: chain.ok && chain.head === (r.last_event_hash || ''), chain_reason: chain.ok ? (chain.head === (r.last_event_hash || '') ? '' : 'TAIL_MISSING') : chain.reason,
          events: events.map((e: any) => ({ seq: e.seq, type: e.type, actor_type: e.actor_type, actor_label: e.actor_label, at: e.at, ip: maskIp(e.ip), user_agent: e.user_agent, data: e.data || {} })),
          last_reminded_at: r.last_reminded_at || '',
        };
      }));
      return Response.json({ requests });
    }

    // ── 고객 ──
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    const viewing = auth.user.account_tier === 'master'; // 마스터 열람 모드: 보기만, 기록 남기지 않음
    if (body.list) {
      const rows = (await db.SignatureRequest.filter({ client_id: auth.companyId }, '-created_date', 100)).filter((r: any) => r.client_id === auth.companyId);
      // 같은 계약은 최신 버전만, 회수된 요청은 숨긴다
      const latest = new Map();
      for (const r of rows) if (!latest.has(r.contract_id)) latest.set(r.contract_id, r);
      return Response.json({
        requests: [...latest.values()].filter((r: any) => r.status !== 'REVOKED').map((r: any) => {
          const me = (r.signers || []).find((s: any) => s.user_id === auth.user.id);
          return { id: r.id, document_no: r.document_no, document_title: r.document_title, status: effective(r), due_at: r.due_at, completed_at: r.completed_at || '', created_date: r.created_date, is_signer: !!me && !viewing, my_status: me?.status || '', signer_name: (r.signers || [])[0]?.name || '' };
        }),
      });
    }

    const r = body.request_id ? await db.SignatureRequest.get(body.request_id).catch(() => null) : null;
    if (!r || r.client_id !== auth.companyId) return Response.json({ error: '계약서를 찾을 수 없습니다' }, { status: 404 });
    const me = (r.signers || []).find((s: any) => s.user_id === auth.user.id);
    const isSigner = !!me && !viewing;
    const status = effective(r);
    if (r.status === 'REVOKED' && !isSigner) return Response.json({ error: '회수된 계약서입니다' }, { status: 404 });

    if (body.purpose === 'download') {
      if (r.status !== 'COMPLETED') return Response.json({ error: '체결된 뒤에 내려받을 수 있습니다' }, { status: 409 });
      if (!viewing) await appendEvent(svc, r, { type: 'DOWNLOADED', actor_type: 'CLIENT', actor_id: auth.user.id, actor_label: auth.user.full_name || auth.user.email || '' }, req);
      return Response.json({ url: await signedUrl(svc, r.completed_file_uri) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const block = isSigner ? signerBlock(r, auth.user.id) : (viewing ? 'VIEW_ONLY' : 'NOT_SIGNER');
    if (isSigner && !block && me.status === 'PENDING') {
      const now = new Date().toISOString();
      const signers = r.signers.map((s: any) => (s.user_id === auth.user.id ? { ...s, status: 'VIEWED', viewed_at: now } : s));
      await db.SignatureRequest.update(r.id, { signers });
      r.signers = signers;
      await appendEvent(svc, r, { type: 'VIEWED', actor_type: 'CLIENT', actor_id: auth.user.id, actor_label: auth.user.full_name || auth.user.email || '' }, req);
    }
    let otp: any = null, readToEnd = false;
    if (isSigner && !block) {
      otp = (await db.SignatureOtp.filter({ request_id: r.id, user_id: auth.user.id }, '-created_date', 1))[0] || null;
      readToEnd = (await listEvents(svc, r.id)).some((e: any) => e.type === 'READ_TO_END' && e.actor_id === auth.user.id);
    }
    const contract = await db.Contract.get(r.contract_id).catch(() => null);
    const company = await db.Company.get(r.client_id).catch(() => null);
    return Response.json({
      request: {
        id: r.id, document_no: r.document_no, document_title: r.document_title, version: r.version, page_count: r.page_count, status, due_at: r.due_at,
        original_sha256: r.original_sha256, completed_sha256: r.completed_sha256 || '', completed_at: r.completed_at || '', consent_text: r.consent_text,
        aegis_company: r.aegis_signer?.company || '', sent_by_name: r.sent_by_name || '', decline_reason: r.decline_reason || '',
        is_signer: isSigner, block, block_text: block ? (BLOCK_TEXT[block] || (block === 'VIEW_ONLY' ? '관리자 열람 모드에서는 서명할 수 없습니다' : '')) : '',
        my: me ? { status: me.status, name: me.name || auth.user.full_name || '', email_masked: maskEmail(me.email), signed_name: me.signed_name || '', signed_at: me.signed_at || '' } : null,
        company_name: company?.company_name || '', read_to_end: readToEnd,
        otp: otp ? { sent_at: otp.sent_at || '', expires_at: otp.expires_at || '', locked_until: otp.locked_until || '', verified: otpFreshForSigning(otp) } : null,
        amount_usd: contract?.amount_usd ?? null,
      },
      file_url: await signedUrl(svc, r.status === 'COMPLETED' ? r.completed_file_uri : r.original_file_uri),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
