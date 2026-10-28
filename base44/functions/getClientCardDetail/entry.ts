import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { clientCardDocuments, documentMetadata, documentUrl } from '../../shared/cardDocuments.ts';
import { clientQcReport, clientQualitySpec, latestSentSpecs } from '../../shared/clientQc.ts';
import { docStatus } from '../../shared/shipments.ts';
import { clientDestCost } from '../../shared/destCost.ts';
import { clientFactoryPayment } from '../../shared/factoryAccount.ts';
import { clientFactoryCheck } from '../../shared/factoryCheck.ts';
import { clientClaim } from '../../shared/claims.ts';
import { clientImportRequirements } from '../../shared/importRequirements.ts';
import { clientPaymentStage } from '../../shared/paymentRequest.ts';
import { can, canApprove, normalizeRules } from '../../shared/clientRoles.ts';

// 고객 포털 카드 상세: 오버뷰 · 공개 채팅 · 정산 단계(읽기 전용) · 담당자가 공개한 검수 리포트.
// 내부 전용 데이터(견적 원가, BOM, 결정, 내부 채팅)는 응답에 포함하지 않는다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;

    const { card_id, include_file_urls = false } = await req.json();
    if (!card_id) return Response.json({ error: 'card_id 가 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(card_id);
    if (!cardVisibleToClient(card, auth.companyId)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await clientCardDocuments(svc, [card]);
    // Sign only on the files tab, after rechecking card and per-file visibility.
    if (include_file_urls === true) {
      const attachments = await Promise.all(documents.map(async doc => ({ ...documentMetadata(doc), file_url: await documentUrl(svc, doc.file_url) })));
      return Response.json({ attachments });
    }
    const chats = await svc.entities.CardChat.filter({ card_id }, 'created_date', 200);
    const stages = (await svc.entities.PaymentStage.filter({ card_id }, 'created_date', 20)).filter((s) => s.card_id === card.id);
    // 결제 요청의 이지스 계좌: 마스터가 등록한 같은 팀 계좌만 (결제 단계에는 계좌 ID만 있다)
    const accounts = stages.some((s) => s.payee === 'AEGIS' && s.payee_account_id)
      ? (await svc.entities.PayeeAccount.filter({ tenant_id: card.tenant_id }, '-created_date', 50)).filter((a) => a.tenant_id === card.tenant_id)
      : [];
    const qcReports = await svc.entities.QCReport.filter({ card_id, client_visible: true }, '-created_date', 50);
    // 선적: 고객 공개분만. 서류는 준비 여부만 알리고 파일·포워더·내부 메모는 보내지 않는다
    const shipments = (await svc.entities.Shipment.filter({ card_id, client_visible: true }, 'created_date', 20)).filter((s) => s.card_id === card.id);
    const attachmentTypes = shipments.length ? (await svc.entities.CardAttachment.filter({ card_id }, '-created_date', 500)).map((a) => a.document_type).filter(Boolean) : [];
    // 이 카드의 불량 신고 — 사진은 카드 파일(불량 신고 사진, 고객 공개)에서 이름만 붙여 보낸다
    const claims = (await svc.entities.QualityClaim.filter({ card_id }, '-created_date', 50)).filter((c) => c.card_id === card.id);
    const claimPhotos = claims.length ? documents.filter((d) => d.document_kind === 'attachment' && d.document_type === 'CLAIM_PHOTO') : [];
    const spec = latestSentSpecs((await svc.entities.QualitySpec.filter({ card_id, status: 'SENT' }, '-version', 10)).filter((s) => s.card_id === card.id)).get(card.id);
    // 담당 PM: 팀 운영 설정에서 켠 경우에만 이름과 답변 가능 시간 (기본은 숨김)
    const setting = (await svc.entities.OperationSetting.filter({ tenant_id: card.tenant_id }, '-updated_date', 1)).find((x) => x.tenant_id === card.tenant_id);
    const pm = setting?.client_show_pm === true && card.owner_name ? { name: card.owner_name, reply_hours: setting.client_reply_hours || '' } : null;
    // 디자인·도면 확인 요청 (거둔 것 제외). 비교할 이전 판은 고객에게 공개된 파일일 때만
    const visibleIds = new Set(documents.filter((d) => d.document_kind === 'attachment').map((d) => d.id));
    const reviews = (await svc.entities.FileReview.filter({ card_id }, '-requested_at', 20)).filter((r) => r.card_id === card.id && r.company_id === auth.companyId && r.status !== 'CANCELED' && visibleIds.has(r.attachment_id));
    // 사내 결재: 이 카드의 결재 중 요청과 내 권한 (역할을 정하지 않은 고객사는 비어 있다)
    const company = await svc.entities.Company.get(auth.companyId).catch(() => null);
    const me = String(auth.user.email || '').toLowerCase();
    const approvals = (await svc.entities.ClientApproval.filter({ card_id, status: 'PENDING' }, '-requested_at', 20)).filter((a) => a.card_id === card.id && a.company_id === auth.companyId);
    // 계획 확정 전 초안은 고객에게 보이지 않는다
    const milestones = card.plan_confirmed_at
      ? (await svc.entities.CardMilestone.filter({ card_id }, 'seq', 100)).filter((m) => m.client_visible !== false && m.status !== 'skipped')
      : [];

    return Response.json({
      attachments: documents.map(documentMetadata),
      pm,
      team: {
        can_decide: auth.user.account_tier !== 'client' || can(company, me, 'decide'),
        rules_on: Object.entries(normalizeRules(company?.approval_rules).kinds).filter(([, r]) => r.on).map(([k]) => k),
        // 결재권자이고 자기 결재를 막지 않았으면 결정이 바로 전달된다
        direct: can(company, me, 'approve') && !normalizeRules(company?.approval_rules).block_self_approval,
      },
      approvals: approvals.map((a) => ({
        id: a.id, kind: a.kind, target_id: a.target_id, target_label: a.target_label || '', requested_by_name: a.requested_by_name || '', requested_at: a.requested_at || '',
        request_note: a.request_note || '', mine: String(a.requested_by_email || '').toLowerCase() === me, can_approve: canApprove(company, me, a),
      })),
      file_reviews: reviews.map((r) => ({
        id: r.id, attachment_id: r.attachment_id, previous_attachment_id: visibleIds.has(r.previous_attachment_id) ? r.previous_attachment_id : '',
        file_name: r.file_name || '', file_type: r.file_type || '', question: r.question || '', due_date: r.due_date || '', status: r.status,
        pins: (r.pins || []).map((p) => ({ n: p.n, page: p.page, x: p.x, y: p.y, text: p.text, by_name: p.by_name || '' })),
        decision_note: r.decision_note || '', decided_by_name: r.decided_by_name || '', decided_at: r.decided_at || '',
        requested_by_name: r.requested_by_name || '', requested_at: r.requested_at || '',
      })),
      card: {
        id: card.id,
        title: card.title, title_cn: card.title_cn || '',
        status: card.status,
        priority: card.priority || 'MEDIUM',
        due_date: card.due_date || '',
        quote_deadline: card.quote_deadline || '',
        advance_paid_date: card.advance_paid_date || '',
        delivery_business_days: card.delivery_business_days ?? null,
        delivery_date: card.delivery_date || '',
        delivery_date_mode: card.delivery_date_mode || 'AUTO',
        hq_requirements: card.hq_requirements || '', hq_requirements_cn: card.hq_requirements_cn || '',
        target_machine_category: card.target_machine_category || '',
        // 기준 샘플: 사진·승인일·보관 위치 (내부 메모 제외)
        golden_sample: card.golden_sample ? {
          photos: (card.golden_sample.photos || []).map((p) => ({ url: p.url, name: p.name || '' })),
          approved_at: card.golden_sample.approved_at || '', approved_by: card.golden_sample.approved_by || '',
          seal_no: card.golden_sample.seal_no || '', locations: card.golden_sample.locations || {},
        } : null,
      },
      chats: chats
        .filter((c) => c.is_client_visible === true || c.sender_role === 'CLIENT')
        .map((c) => ({
          id: c.id,
          sender_name: c.sender_name,
          sender_role: c.sender_role || 'HQ',
          message_text: c.message_text, message_text_cn: c.message_text_cn || '',
          file_url: c.file_url || '',
          file_name: c.file_name || '',
          created_date: c.created_date,
        })),
      milestones: milestones.map((m) => ({
        id: m.id, seq: Number(m.seq) || 0, label: m.label, label_cn: m.label_cn || '', status: m.status,
        planned_date: m.planned_date || '', actual_date: m.actual_date || '',
        delay_reason: m.delay_reason_public ? (m.delay_reason || '') : '',
      })),
      // 결제 단계: 결제 요청(금액·기한·받는 계좌)과 고객 송금 알림 상태까지
      payment_stages: stages.map((s) => clientPaymentStage(s, accounts)),
      // 고객이 공장에 직접 송금하는 카드만: 이지스가 확인한 계좌와 변경 요청 여부
      factory_payment: await clientFactoryPayment(svc, card),
      // 거래 공장 확인 결과 (항목별 확인 여부만, 공장명·주소·메모 제외)
      factory_check: await clientFactoryCheck(svc, card),
      claims: claims.map((c) => clientClaim(c, claimPhotos)),
      import_requirements: clientImportRequirements(card),
      qc_reports: qcReports.filter((r) => r.card_id === card.id && r.client_visible === true).map(clientQcReport),
      quality_spec: spec ? clientQualitySpec(spec) : null,
      shipments: shipments.map((s) => ({
        id: s.id, label: s.label || '', mode: s.mode || '', status: s.status || 'PREPARING', carrier: s.carrier || '', tracking_no: s.tracking_no || '',
        port_from: s.port_from || '', port_to: s.port_to || '', etd: s.etd || '', eta: s.eta || '', atd: s.atd || '', ata: s.ata || '',
        dangerous_goods: !!s.dangerous_goods, package_note: s.package_note || '', client_note: s.client_note || '',
        docs: docStatus(s, attachmentTypes).map((d) => ({ key: d.key, label: d.label, status: d.status })),
        // 담당자가 보낸 뒤에만 보인다 (계산 입력값·요율 근거는 보내지 않는다)
        dest_cost: clientDestCost(s),
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}