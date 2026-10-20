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
    const stages = await svc.entities.PaymentStage.filter({ card_id }, 'created_date', 20);
    const qcReports = await svc.entities.QCReport.filter({ card_id, client_visible: true }, '-created_date', 50);
    // 선적: 고객 공개분만. 서류는 준비 여부만 알리고 파일·포워더·내부 메모는 보내지 않는다
    const shipments = (await svc.entities.Shipment.filter({ card_id, client_visible: true }, 'created_date', 20)).filter((s) => s.card_id === card.id);
    const attachmentTypes = shipments.length ? (await svc.entities.CardAttachment.filter({ card_id }, '-created_date', 500)).map((a) => a.document_type).filter(Boolean) : [];
    // 이 카드의 불량 신고 — 사진은 카드 파일(불량 신고 사진, 고객 공개)에서 이름만 붙여 보낸다
    const claims = (await svc.entities.QualityClaim.filter({ card_id }, '-created_date', 50)).filter((c) => c.card_id === card.id);
    const claimPhotos = claims.length ? documents.filter((d) => d.document_kind === 'attachment' && d.document_type === 'CLAIM_PHOTO') : [];
    const spec = latestSentSpecs((await svc.entities.QualitySpec.filter({ card_id, status: 'SENT' }, '-version', 10)).filter((s) => s.card_id === card.id)).get(card.id);
    // 계획 확정 전 초안은 고객에게 보이지 않는다
    const milestones = card.plan_confirmed_at
      ? (await svc.entities.CardMilestone.filter({ card_id }, 'seq', 100)).filter((m) => m.client_visible !== false && m.status !== 'skipped')
      : [];

    return Response.json({
      attachments: documents.map(documentMetadata),
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
      payment_stages: stages.map((s) => ({
        id: s.id,
        stage_type: s.stage_type,
        percentage: Number(s.percentage) || 0,
        amount: s.amount ?? null,
        currency: s.currency || '',
        approval_status: s.approval_status,
        approved_at: s.approved_at || '',
      })),
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