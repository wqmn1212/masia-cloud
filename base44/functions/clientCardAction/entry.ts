import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient, quotationVisibleToClient } from '../../shared/clientAccess.ts';
import { notifyUsers, internalUsersOfTenant, clientUsersOfCompany } from '../../shared/notify.ts';
import { fillMissingTranslation } from '../../shared/bilingualTranslation.ts';
import { uploadPrivateAttachments, linkCardAttachments } from '../../shared/privateAttachments.ts';
import { QC_DECISIONS, SPEC_DECISIONS, latestSentSpecs } from '../../shared/clientQc.ts';
import { DEST_COST_DECISIONS, destCostState } from '../../shared/destCost.ts';
import { latestClientComparison } from '../../shared/clientComparison.ts';
import { paymentReportPatch, REMITTANCE_FOR_STAGE, STAGE_LABEL } from '../../shared/paymentRequest.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { can, approvalNeeded, canApprove, approversOf, normalizeRules, toKrw, quoteAmount, APPROVAL_KIND_LABEL } from '../../shared/clientRoles.ts';
import { normalizePins, REVIEW_DECISIONS } from '../../shared/fileReview.ts';

// 고객이 수행 가능한 쓰기 동작: 채팅 작성 · 요구사항(hq_requirements) 수정 · 공개된 검수 결과의 출고 승인/보류
// · 보낸 품질 기준서의 승인/수정 요청 · 선적 도착지 비용 예상액의 확인/문의 · 받은 물건의 불량 신고(클레임)
// · 견적 비교표에서 진행할 안 고르기 · 결제 요청에 '송금했어요' 알리기(입금 확인은 직원만)
// · 공개된 견적서 수락('이 견적으로 진행') · 디자인·도면 확인 요청에 승인/수정 요청(위치 의견 포함).
// 고객사가 역할·결재 규칙을 정했으면(clientRoles.ts) 확정하는 결정은 결재 요청(ClientApproval)이 되고,
// 결재권자가 approval_decide 로 승인할 때 그 결정이 실행된다. 재무 역할만 가진 계정은 결정할 수 없다.
// 그 외 필드는 서버에서 아예 받지 않으므로 프런트 우회로 변경할 수 없다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    // 결재 승인 때 요청 내용으로 다시 채우므로 let
    let { card_id, action, message, message_cn, hq_requirements, hq_requirements_cn, attachments, report_id, spec_id, shipment_id, sent_at, decision, note, claim, document_type, option_key, version, stage_id, paid_date, quotation_id, review_id, pins, approval_id } = await req.json();
    if (!card_id || !action) return Response.json({ error: 'card_id, action 이 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(card_id);
    if (!cardVisibleToClient(card, auth.companyId)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    let senderName = auth.user.full_name || auth.user.account_label || auth.user.email;
    // 고객 업로드 파일: 비공개 저장 후 카드 파일 탭에 고객 공개 상태로 연동
    // 고객이 고를 수 있는 파일 종류 (직접 송금한 송금확인증, 고객이 가진 사양서·인증서). 그 외는 일반 파일
    const CLIENT_DOC_TYPES: Record<string, string> = { REMITTANCE_DOWN: '송금확인증 (선금)', REMITTANCE_INTERIM: '송금확인증 (중도금)', REMITTANCE_BALANCE: '송금확인증 (잔금)', SPEC_SHEET: '사양서', CERTIFICATE: '인증서' };
    const docType = typeof document_type === 'string' && CLIENT_DOC_TYPES[document_type] ? document_type : 'GENERAL';
    const saveFiles = async (documentType = 'GENERAL') => {
      const files = await uploadPrivateAttachments(svc, attachments);
      await linkCardAttachments(svc, { tenantId: card.tenant_id, cardId: card.id, attachments: files, uploaderName: senderName, clientVisible: true, uploaderRole: null, documentType });
      return files;
    };

    // 결정 대상이 지금 판단할 수 있는 것인지 본다. 결재 요청 전과 견적 수락·디자인 확인 실행에 쓴다
    const fail = (error: string, status: number) => ({ fail: Response.json({ error }, { status }) });
    const loadTarget = async (kind: string): Promise<any> => {
      if (kind === 'comparison_choice') {
        const rec = await latestClientComparison(svc, card.id);
        if (!rec) return fail('고를 수 있는 비교표가 없습니다. 새로고침해 주세요', 404);
        if (rec.status === 'CONFIRMED') return fail('이미 확정된 비교표입니다. 바꾸려면 담당자에게 문의해 주세요', 409);
        if (Number(version) !== Number(rec.version)) return fail('담당자가 비교표를 새로 공개했습니다. 새로고침 후 다시 골라 주세요', 409);
        const opt = (rec.client_snapshot?.options || []).find((o) => o.key === option_key);
        if (!opt) return fail('고른 안을 찾을 수 없습니다', 400);
        return { id: rec.id, label: `견적 비교표 v${rec.version} ${opt.label}`, amountKrw: toKrw(opt.total, rec.client_snapshot?.base_currency, rec.client_snapshot?.fx) };
      }
      if (kind === 'quote_accept') {
        const q = typeof quotation_id === 'string' && quotation_id ? await svc.entities.Quotation.get(quotation_id).catch(() => null) : null;
        if (!q || q.card_id !== card.id || !quotationVisibleToClient(q, auth.companyId)) return fail('견적서를 찾을 수 없습니다. 새로고침해 주세요', 404);
        if (q.client_accepted_at) return fail('이미 수락한 견적서입니다', 409);
        if ((await svc.entities.Quotation.filter({ card_id: card.id }, '-created_date', 50)).some((x) => x.id !== q.id && x.client_accepted_at)) return fail('이미 다른 견적으로 진행을 요청했습니다. 바꾸려면 담당자에게 문의해 주세요', 409);
        if (await latestClientComparison(svc, card.id)) return fail('이 프로젝트는 견적 비교표에서 진행할 안을 골라 주세요', 409);
        const { amount, currency, fx } = quoteAmount(q);
        return { id: q.id, label: `견적서 ${q.quote_title || q.product_name || ''}`.trim(), amountKrw: toKrw(amount, currency, fx), record: q };
      }
      if (kind === 'qc_decision') {
        if (!QC_DECISIONS.includes(decision)) return fail('승인 또는 보류를 선택하세요', 400);
        const report = typeof report_id === 'string' && report_id ? await svc.entities.QCReport.get(report_id).catch(() => null) : null;
        if (!report || report.card_id !== card.id || report.client_visible !== true) return fail('검수 결과를 찾을 수 없습니다', 404);
        if (report.client_decision === 'APPROVED') return fail('이미 승인한 검수 결과입니다', 409);
        const sample = report.inspection_type === 'SAMPLE';
        return { id: report.id, label: `${sample ? '샘플' : '양산품'} 검수 결과 ${sample ? '샘플' : '출고'} 승인`, amountKrw: null };
      }
      if (kind === 'spec_decision') {
        if (!SPEC_DECISIONS.includes(decision)) return fail('승인 또는 수정 요청을 선택하세요', 400);
        const latest = latestSentSpecs(await svc.entities.QualitySpec.filter({ card_id: card.id, status: 'SENT' }, '-version', 10)).get(card.id);
        if (!latest || latest.id !== spec_id) return fail('최신 품질 기준서가 아닙니다. 새로고침해 주세요', 409);
        if (latest.client_decision === 'APPROVED') return fail('이미 승인한 기준서입니다', 409);
        return { id: latest.id, label: `품질 기준서 v${latest.version || 1} 승인`, amountKrw: null };
      }
      if (kind === 'file_review') {
        if (!REVIEW_DECISIONS.includes(decision)) return fail('승인 또는 수정 요청을 선택하세요', 400);
        const review = typeof review_id === 'string' && review_id ? await svc.entities.FileReview.get(review_id).catch(() => null) : null;
        if (!review || review.card_id !== card.id || review.company_id !== auth.companyId) return fail('확인 요청을 찾을 수 없습니다. 새로고침해 주세요', 404);
        if (review.status !== 'PENDING') return fail(review.status === 'CANCELED' ? '담당자가 확인 요청을 거두었습니다' : '이미 답한 확인 요청입니다', 409);
        return { id: review.id, label: `${review.file_name || '파일'} 디자인 승인`, amountKrw: null, record: review };
      }
      return fail('지원하지 않는 동작입니다', 400);
    };

    // 동작 실행 (결재가 필요하면 아래 관문이 먼저 결재 요청으로 돌린다)
    const runAction = async () => {
      if (action === 'upload_files') {
        const files = await saveFiles(docType);
        if (!files.length) return Response.json({ error: '업로드할 파일이 없습니다' }, { status: 400 });
        const staff = await internalUsersOfTenant(svc, card.tenant_id);
        await notifyUsers(svc, staff, {
          type: 'card_shared',
          title: `[고객 ${CLIENT_DOC_TYPES[docType] || '파일'}] ${card.title}`,
          body: `${senderName}: ${files.map((f) => f.name).join(', ')}`,
          link: `/task-board?card=${card.id}`,
          task_card_id: card.id,
        });
        return Response.json({ ok: true, count: files.length });
      }

      if (action === 'payment_reported') {
        // 고객이 결제 요청대로 송금했다고 알린다. 직원이 통장을 확인해 '입금 확인'을 눌러야 끝난다
        const stage = typeof stage_id === 'string' && stage_id ? await svc.entities.PaymentStage.get(stage_id).catch(() => null) : null;
        if (!stage || stage.card_id !== card.id) return Response.json({ error: '결제 단계를 찾을 수 없습니다' }, { status: 404 });
        const checked = paymentReportPatch({ paid_date, note }, { stage, today: kstToday(), by: senderName, now: new Date().toISOString() });
        if (checked.error) return Response.json({ error: checked.error }, { status: 400 });
        const files = await saveFiles(REMITTANCE_FOR_STAGE[stage.stage_type] || 'GENERAL');
        await svc.entities.PaymentStage.update(stage.id, checked.patch);
        const label = STAGE_LABEL[stage.stage_type] || '대금';
        const memo = checked.patch.client_report_note;
        try {
          await svc.entities.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'PAYMENT_REPORTED', actor_id: auth.user.id, actor_name: senderName, details: `${label} 고객 송금 알림: 송금일 ${checked.patch.client_reported_paid_date}${files.length ? ` · 송금확인증 ${files.length}개` : ''}${memo ? ` · ${memo}` : ''}` });
        } catch (_e) { /* 기록 실패가 고객 알림을 막지 않는다 */ }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'payment_reported',
            title: `[송금 알림] ${card.title} ${label}`,
            body: `${senderName}: ${checked.patch.client_reported_paid_date} 송금${files.length ? ` · 송금확인증 ${files.map((f) => f.name).join(', ')}` : ' · 송금확인증 없음'}${memo ? `\n${memo}` : ''}\n통장 입금을 확인한 뒤 정산 탭에서 입금 확인을 눌러 주세요.`,
            link: `/task-board?card=${card.id}&tab=settlement`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 고객 알림 저장을 막지 않는다 */ }
        return Response.json({ ok: true, files: files.length });
      }

      if (action === 'chat') {
        const files = await saveFiles();
        const fileNote = files.length ? `\n📎 ${files.map((f) => f.name).join(', ')}` : '';
        const text = (String(message || '').trim().slice(0, 3000) + (String(message || '').trim() || !String(message_cn || '').trim() ? fileNote : '')).trim();
        const chinese = String(message_cn || '').trim().slice(0, 3000);
        if (!text && !chinese) return Response.json({ error: '메시지를 입력하세요' }, { status: 400 });
        const saved = await svc.entities.CardChat.create({
          tenant_id: card.tenant_id,
          card_id,
          sender_name: senderName,
          sender_email: auth.user.email,
          sender_role: 'CLIENT',
          is_client_visible: true,
          message_text: text, message_text_cn: chinese,
          ...(files[0] ? { file_url: files[0].url, file_name: files[0].name } : {}),
        });
        let translationFailed = false;
        try { await fillMissingTranslation(svc, 'CardChat', saved, ['message_text'], text ? 'zh' : 'ko'); }
        catch { translationFailed = true; }
        const staff = await internalUsersOfTenant(svc, card.tenant_id);
        await notifyUsers(svc, staff, {
          type: 'chat_message',
          title: `[고객 메시지] ${card.title}`,
          body: `${senderName}: ${(text || chinese).slice(0, 300)}`,
          link: `/task-board?card=${card.id}`,
          task_card_id: card.id,
          card_title: card.title,
        });
        return Response.json({ ok: true, translation_failed: translationFailed });
      }

      if (action === 'update_requirements') {
        const patch = {};
        if (typeof hq_requirements === 'string') patch.hq_requirements = hq_requirements.slice(0, 20000);
        if (typeof hq_requirements_cn === 'string') patch.hq_requirements_cn = hq_requirements_cn.slice(0, 20000);
        if (!Object.keys(patch).length) return Response.json({ error: '요구사항이 필요합니다' }, { status: 400 });
        if ('hq_requirements' in patch && patch.hq_requirements !== card.hq_requirements && !card.cn_manual && !('hq_requirements_cn' in patch)) patch.hq_requirements_cn = '';
        const saved = await svc.entities.TaskCard.update(card_id, patch);
        let translationFailed = false;
        try {
          if (!saved.hq_requirements?.trim()) await fillMissingTranslation(svc, 'TaskCard', saved, ['hq_requirements'], 'ko');
          else if (!saved.cn_manual) await fillMissingTranslation(svc, 'TaskCard', saved, ['hq_requirements'], 'zh');
        } catch { translationFailed = true; }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'requirements_updated',
            title: `[요구사항 변경] ${card.title}`,
            body: String(saved.hq_requirements || saved.hq_requirements_cn || '').slice(0, 300),
            link: `/task-board?card=${card.id}`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 저장을 막지 않는다 */ }
        return Response.json({ ok: true, translation_failed: translationFailed });
      }

      if (action === 'qc_decision') {
        if (!QC_DECISIONS.includes(decision)) return Response.json({ error: '승인 또는 보류를 선택하세요' }, { status: 400 });
        const report = typeof report_id === 'string' && report_id ? await svc.entities.QCReport.get(report_id).catch(() => null) : null;
        // 담당자가 공개한, 이 카드의 리포트만 판단할 수 있다
        if (!report || report.card_id !== card.id || report.client_visible !== true) {
          return Response.json({ error: '검수 결과를 찾을 수 없습니다' }, { status: 404 });
        }
        if (report.client_decision === 'APPROVED') return Response.json({ error: '이미 승인한 검수 결과입니다' }, { status: 409 });
        const memo = String(note || '').trim().slice(0, 1000);
        if (decision === 'ON_HOLD' && !memo) return Response.json({ error: '보류 사유를 입력해 주세요' }, { status: 400 });
        const decidedAt = new Date().toISOString();
        await svc.entities.QCReport.update(report.id, {
          client_decision: decision,
          client_decision_note: memo,
          client_decided_at: decidedAt,
          client_decided_by_name: senderName,
        });
        // 샘플 검수 승인 = 양산 진행, 양산품 검수 승인 = 출고
        const kind = report.inspection_type === 'SAMPLE' ? '샘플' : '양산품';
        const label = `${report.inspection_type === 'SAMPLE' ? '샘플' : '출고'} ${decision === 'APPROVED' ? '승인' : '보류'}`;
        try {
          await svc.entities.ProjectAuditLog.create({
            tenant_id: card.tenant_id, card_id: card.id, event_type: 'QC_CLIENT_DECISION',
            actor_id: auth.user.id, actor_name: senderName, details: `${kind} 검수 결과 고객 ${label}${memo ? `: ${memo}` : ''}`,
          });
        } catch (_e) { /* 기록 실패가 고객 판단을 막지 않는다 */ }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'qc_decision',
            title: `[${label}] ${card.title}`,
            body: `${senderName}: ${kind} 검수 결과 ${label}${memo ? `\n${memo.slice(0, 300)}` : ''}`,
            link: `/task-board?card=${card.id}`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 고객 판단을 막지 않는다 */ }
        return Response.json({ ok: true, decision, decided_at: decidedAt });
      }

      if (action === 'spec_decision') {
        if (!SPEC_DECISIONS.includes(decision)) return Response.json({ error: '승인 또는 수정 요청을 선택하세요' }, { status: 400 });
        // 이 카드의 가장 최근에 보낸 판본만 판단할 수 있다
        const latest = latestSentSpecs(await svc.entities.QualitySpec.filter({ card_id: card.id, status: 'SENT' }, '-version', 10)).get(card.id);
        if (!latest || latest.id !== spec_id) return Response.json({ error: '최신 품질 기준서가 아닙니다. 새로고침해 주세요' }, { status: 409 });
        if (latest.client_decision === 'APPROVED') return Response.json({ error: '이미 승인한 기준서입니다' }, { status: 409 });
        const memo = String(note || '').trim().slice(0, 1000);
        if (decision === 'REVISION_REQUESTED' && !memo) return Response.json({ error: '고칠 내용을 적어 주세요' }, { status: 400 });
        const decidedAt = new Date().toISOString();
        await svc.entities.QualitySpec.update(latest.id, { client_decision: decision, client_comment: memo, client_decided_at: decidedAt, client_decided_by_name: senderName });
        const label = decision === 'APPROVED' ? '기준서 승인' : '기준서 수정 요청';
        try {
          await svc.entities.ProjectAuditLog.create({
            tenant_id: card.tenant_id, card_id: card.id, event_type: 'SPEC_CLIENT_DECISION',
            actor_id: auth.user.id, actor_name: senderName, details: `품질 기준서 v${latest.version || 1} 고객 ${label}${memo ? `: ${memo}` : ''}`,
          });
        } catch (_e) { /* 기록 실패가 고객 판단을 막지 않는다 */ }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'spec_decision',
            title: `[${label}] ${card.title}`,
            body: `${senderName}: 품질 기준서 v${latest.version || 1} ${label}${memo ? `\n${memo.slice(0, 300)}` : ''}`,
            link: `/task-board?card=${card.id}`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 고객 판단을 막지 않는다 */ }
        return Response.json({ ok: true, decision, decided_at: decidedAt });
      }

      if (action === 'dest_cost_decision') {
        if (!DEST_COST_DECISIONS.includes(decision)) return Response.json({ error: '확인 또는 문의를 선택하세요' }, { status: 400 });
        const shipment = typeof shipment_id === 'string' && shipment_id ? await svc.entities.Shipment.get(shipment_id).catch(() => null) : null;
        // 이 카드의 공개된 선적 중 담당자가 보낸 예상액만 판단할 수 있다
        if (!shipment || shipment.card_id !== card.id || shipment.client_visible !== true || ['NONE', 'DRAFT'].includes(destCostState(shipment))) {
          return Response.json({ error: '확인할 도착지 비용을 찾을 수 없습니다. 새로고침해 주세요' }, { status: 404 });
        }
        if (shipment.dest_cost_decision === 'ACKNOWLEDGED') return Response.json({ error: '이미 확인한 금액입니다' }, { status: 409 });
        // 고객이 본 금액이 담당자가 마지막으로 보낸 금액인지 확인한다 (그사이 다시 보냈으면 새로 보고 판단)
        if (sent_at !== shipment.dest_cost_sent_at) return Response.json({ error: '담당자가 금액을 새로 보냈습니다. 새로고침 후 다시 확인해 주세요' }, { status: 409 });
        const memo = String(note || '').trim().slice(0, 1000);
        if (decision === 'QUESTION' && !memo) return Response.json({ error: '궁금한 점을 적어 주세요' }, { status: 400 });
        const decidedAt = new Date().toISOString();
        await svc.entities.Shipment.update(shipment.id, {
          dest_cost_decision: decision,
          dest_cost_decided_at: decidedAt,
          dest_cost_decided_by_name: senderName,
          dest_cost_client_note: decision === 'QUESTION' ? memo : '',
        });
        const amount = Math.round(Number(shipment.dest_cost_estimate?.buyer_ex_vat) || 0).toLocaleString('ko-KR');
        const label = decision === 'ACKNOWLEDGED' ? '도착지 비용 확인' : '도착지 비용 문의';
        const what = `${shipment.label || '선적'} 한국 도착 후 별도 비용 약 ${amount}원`;
        try {
          await svc.entities.ProjectAuditLog.create({
            tenant_id: card.tenant_id, card_id: card.id, event_type: 'DEST_COST_CLIENT_DECISION',
            actor_id: auth.user.id, actor_name: senderName, details: `${what} 고객 ${label}${memo ? `: ${memo}` : ''}`,
          });
        } catch (_e) { /* 기록 실패가 고객 판단을 막지 않는다 */ }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'dest_cost_decision',
            title: `[${label}] ${card.title}`,
            body: `${senderName}: ${what} ${decision === 'ACKNOWLEDGED' ? '확인했습니다' : `문의\n${memo.slice(0, 300)}`}`,
            link: `/task-board?card=${card.id}`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 고객 판단을 막지 않는다 */ }
        return Response.json({ ok: true, decision, decided_at: decidedAt });
      }

      if (action === 'comparison_choice') {
        const rec = await latestClientComparison(svc, card.id);
        if (!rec) return Response.json({ error: '고를 수 있는 비교표가 없습니다. 새로고침해 주세요' }, { status: 404 });
        if (rec.status === 'CONFIRMED') return Response.json({ error: '이미 확정된 비교표입니다. 바꾸려면 담당자에게 문의해 주세요' }, { status: 409 });
        // 고객이 본 비교표가 담당자가 마지막으로 공개한 것인지 확인한다
        if (Number(version) !== Number(rec.version)) return Response.json({ error: '담당자가 비교표를 새로 공개했습니다. 새로고침 후 다시 골라 주세요' }, { status: 409 });
        const opt = (rec.client_snapshot?.options || []).find((o) => o.key === option_key);
        if (!opt) return Response.json({ error: '고른 안을 찾을 수 없습니다' }, { status: 400 });
        const memo = String(note || '').trim().slice(0, 500);
        const entry = { option_key: opt.key, note: memo, by_name: senderName, at: new Date().toISOString() };
        await svc.entities.QuoteComparison.update(rec.id, { client_choice: entry, choice_history: [...(rec.choice_history || []), entry], status: 'CHOSEN' });
        try {
          await svc.entities.ProjectAuditLog.create({
            tenant_id: card.tenant_id, card_id: card.id, event_type: 'COMPARISON_CLIENT_CHOICE',
            actor_id: auth.user.id, actor_name: senderName, details: `견적 비교표 v${rec.version} ${opt.label} 진행 요청${memo ? `: ${memo}` : ''}`,
          });
        } catch (_e) { /* 기록 실패가 고객 선택을 막지 않는다 */ }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'comparison_choice',
            title: `[고객 선택] ${card.title}`,
            body: `${senderName}: 견적 비교표에서 ${opt.label}으로 진행을 요청했습니다.${memo ? `\n${memo.slice(0, 300)}` : ''}`,
            link: `/task-board?card=${card.id}`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 고객 선택을 막지 않는다 */ }
        return Response.json({ ok: true, client_choice: entry });
      }

      if (action === 'claim_create') {
        const c = claim && typeof claim === 'object' ? claim : {};
        const title = String(c.title || '').trim().slice(0, 200);
        const description = String(c.description || '').trim().slice(0, 4000);
        if (!title || !description) return Response.json({ error: '불량 요약과 내용을 적어 주세요' }, { status: 400 });
        const qty = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v)));
        // 사진은 비공개 저장 후 카드 파일에 '불량 신고 사진'으로 연결 (고객·담당자 모두 열람)
        const files = await uploadPrivateAttachments(svc, attachments);
        if (files.length) {
          await svc.entities.CardAttachment.bulkCreate(files.map((f) => ({
            tenant_id: card.tenant_id, card_id: card.id, file_name: f.name, file_type: (f.name.split('.').pop() || '').toLowerCase(),
            file_url: f.url, document_type: 'CLAIM_PHOTO', client_visible: true, uploader_name: senderName,
          })));
        }
        const photos = files.length ? (await svc.entities.CardAttachment.filter({ card_id: card.id, document_type: 'CLAIM_PHOTO' }, '-created_date', 50)).filter((a) => files.some((f) => f.url === a.file_url)) : [];
        const now = new Date().toISOString();
        const saved = await svc.entities.QualityClaim.create({
          tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id, title, description,
          defect_qty: qty(c.defect_qty), received_qty: qty(c.received_qty), lot_note: String(c.lot_note || '').trim().slice(0, 300),
          photo_ids: photos.map((p) => p.id), status: 'SUBMITTED', submitted_by_name: senderName, submitted_at: now,
          history: [{ at: now, status: 'SUBMITTED', by: senderName, note: '' }],
        });
        // 공장 전달용 중국어 번역 (실패해도 접수는 유지, 담당자 화면에서 다시 번역 가능)
        try { await fillMissingTranslation(svc, 'QualityClaim', saved, ['title', 'description'], 'zh'); } catch (_e) { /* 번역 실패가 접수를 막지 않는다 */ }
        try {
          await svc.entities.ProjectAuditLog.create({
            tenant_id: card.tenant_id, card_id: card.id, event_type: 'CLAIM_SUBMITTED',
            actor_id: auth.user.id, actor_name: senderName, details: `불량 신고: ${title}${saved.defect_qty != null ? ` (불량 ${saved.defect_qty}개)` : ''}`,
          });
        } catch (_e) { /* 기록 실패가 접수를 막지 않는다 */ }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'claim_submitted',
            title: `[불량 신고] ${card.title}`,
            body: `${senderName}: ${title}${saved.defect_qty != null ? ` · 불량 ${saved.defect_qty}개` : ''}${photos.length ? ` · 사진 ${photos.length}장` : ''}\n${description.slice(0, 300)}`,
            link: `/task-board?card=${card.id}`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 접수를 막지 않는다 */ }
        return Response.json({ ok: true, id: saved.id });
      }

      if (action === 'quote_accept') {
        const t = await loadTarget('quote_accept');
        if (t.fail) return t.fail;
        const memo = String(note || '').trim().slice(0, 500);
        const acceptedAt = new Date().toISOString();
        await svc.entities.Quotation.update(t.record.id, { client_accepted_at: acceptedAt, client_accepted_by_name: senderName, client_accept_note: memo });
        try {
          await svc.entities.ProjectAuditLog.create({
            tenant_id: card.tenant_id, card_id: card.id, event_type: 'QUOTE_CLIENT_ACCEPTED',
            actor_id: auth.user.id, actor_name: senderName, details: `${t.label} 고객 수락${memo ? `: ${memo}` : ''}`,
          });
        } catch (_e) { /* 기록 실패가 고객 수락을 막지 않는다 */ }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'quote_accepted',
            title: `[견적 수락] ${card.title}`,
            body: `${senderName}: ${t.label}으로 진행을 요청했습니다.${memo ? `\n${memo.slice(0, 300)}` : ''}\n확인한 뒤 견적 상태를 수주로 바꾸고 계약서를 만들어 주세요.`,
            link: `/task-board?card=${card.id}&tab=quotation`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 고객 수락을 막지 않는다 */ }
        return Response.json({ ok: true, accepted_at: acceptedAt });
      }

      if (action === 'file_review_decision') {
        const t = await loadTarget('file_review');
        if (t.fail) return t.fail;
        const memo = String(note || '').trim().slice(0, 1000);
        const decidedAt = new Date().toISOString();
        const cleanPins = normalizePins(pins, senderName, decidedAt);
        if (decision === 'REVISION_REQUESTED' && !memo && !cleanPins.length) return Response.json({ error: '고칠 내용을 적거나 위치에 의견을 남겨 주세요' }, { status: 400 });
        const review = t.record;
        await svc.entities.FileReview.update(review.id, { status: decision, pins: cleanPins, decision_note: memo, decided_by_name: senderName, decided_at: decidedAt });
        const approved = decision === 'APPROVED';
        await svc.entities.CardAttachment.update(review.attachment_id, { client_review_id: review.id, client_review_status: decision, ...(approved ? { client_approved_at: decidedAt, client_approved_by_name: senderName } : {}) }).catch(() => null);
        const label = approved ? '디자인 승인' : '디자인 수정 요청';
        const pinNote = cleanPins.length ? ` · 위치 의견 ${cleanPins.length}개` : '';
        try {
          await svc.entities.ProjectAuditLog.create({
            tenant_id: card.tenant_id, card_id: card.id, event_type: 'FILE_REVIEW_DECISION',
            actor_id: auth.user.id, actor_name: senderName, details: `${review.file_name || '파일'} 고객 ${label}${pinNote}${memo ? `: ${memo}` : ''}`,
          });
        } catch (_e) { /* 기록 실패가 고객 판단을 막지 않는다 */ }
        try {
          const staff = await internalUsersOfTenant(svc, card.tenant_id);
          await notifyUsers(svc, staff, {
            type: 'file_review_decision',
            title: `[${label}] ${card.title}`,
            body: `${senderName}: ${review.file_name || '파일'} ${label}${pinNote}${memo ? `\n${memo.slice(0, 300)}` : ''}${cleanPins.length ? `\n${cleanPins.slice(0, 5).map((p) => `${p.n}. ${p.text.slice(0, 80)}`).join('\n')}` : ''}`,
            link: `/task-board?card=${card.id}&tab=files`,
            task_card_id: card.id,
            card_title: card.title,
          });
        } catch (_e) { /* 알림 실패가 고객 판단을 막지 않는다 */ }
        return Response.json({ ok: true, decision, decided_at: decidedAt });
      }

      return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
    };

    // ── 사내 결재 ──
    const GATED: Record<string, string> = { comparison_choice: 'comparison_choice', quote_accept: 'quote_accept', qc_decision: 'qc_decision', spec_decision: 'spec_decision', file_review_decision: 'file_review' };
    const ACTION_OF: Record<string, string> = Object.fromEntries(Object.entries(GATED).map(([a, k]) => [k, a]));
    const company = await svc.entities.Company.get(auth.companyId).catch(() => null);
    const lower = (e: unknown) => String(e || '').trim().toLowerCase();
    const myEmail = lower(auth.user.email);
    const myName = senderName;
    const audit = async (event_type: string, details: string) => {
      try { await svc.entities.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type, actor_id: auth.user.id, actor_name: myName, details }); } catch (_e) { /* 기록 실패가 결재를 막지 않는다 */ }
    };
    // 다른 사람이 같은 대상을 먼저 결정하면 걸려 있던 결재 요청은 무효가 된다
    const staleOthers = async (kind: string, keepId = '') => {
      const targetId = { quote_accept: quotation_id, qc_decision: report_id, spec_decision: spec_id, file_review: review_id }[kind];
      const open = (await svc.entities.ClientApproval.filter({ card_id: card.id, kind, status: 'PENDING' })).filter((a) => a.id !== keepId && (!targetId || a.target_id === targetId));
      for (const a of open) await svc.entities.ClientApproval.update(a.id, { status: 'STALE', reason: '다른 사람이 먼저 결정했습니다', decided_at: new Date().toISOString() });
    };

    if (action === 'approval_decide' || action === 'approval_cancel') {
      const approval = typeof approval_id === 'string' && approval_id ? await svc.entities.ClientApproval.get(approval_id).catch(() => null) : null;
      if (!approval || approval.company_id !== auth.companyId || approval.card_id !== card.id) return Response.json({ error: '결재 요청을 찾을 수 없습니다. 새로고침해 주세요' }, { status: 404 });
      if (approval.status !== 'PENDING') return Response.json({ error: '이미 처리된 결재 요청입니다. 새로고침해 주세요' }, { status: 409 });
      const now = new Date().toISOString();
      const label = approval.target_label || APPROVAL_KIND_LABEL[approval.kind] || '결정';
      const tellRequester = async (title: string, body: string) => {
        try {
          const to = (await clientUsersOfCompany(svc, auth.companyId)).filter((u) => lower(u.email) === lower(approval.requested_by_email));
          await notifyUsers(svc, to, { type: 'client_approval_decided', title, body, link: `/client/team?tab=approvals`, task_card_id: card.id, card_title: card.title }, { roleFilter: false });
        } catch (_e) { /* 알림 실패가 결재를 막지 않는다 */ }
      };
      if (action === 'approval_cancel') {
        if (lower(approval.requested_by_email) !== myEmail && !can(company, myEmail, 'manage')) return Response.json({ error: '요청한 사람이나 고객 관리자만 거둘 수 있습니다' }, { status: 403 });
        await svc.entities.ClientApproval.update(approval.id, { status: 'CANCELED', decided_by_email: myEmail, decided_by_name: myName, decided_at: now });
        await audit('CLIENT_APPROVAL_CANCELED', `${label} 결재 요청을 거둠`);
        return Response.json({ ok: true, status: 'CANCELED' });
      }
      if (!canApprove(company, myEmail, approval)) {
        const self = can(company, myEmail, 'approve');
        return Response.json({ error: self ? '자기 요청은 다른 결재권자가 결재해야 합니다' : '결재권자만 결재할 수 있습니다' }, { status: 403 });
      }
      if (decision === 'REJECT') {
        const reason = String(note || '').trim().slice(0, 500);
        if (!reason) return Response.json({ error: '반려 사유를 적어 주세요' }, { status: 400 });
        await svc.entities.ClientApproval.update(approval.id, { status: 'REJECTED', decided_by_email: myEmail, decided_by_name: myName, decided_at: now, reason });
        await audit('CLIENT_APPROVAL_REJECTED', `${label} 결재 반려 (요청 ${approval.requested_by_name || ''}): ${reason}`);
        await tellRequester(`[결재 반려] ${card.title}`, `${myName}: ${label} 결재를 반려했습니다.\n사유: ${reason}`);
        return Response.json({ ok: true, status: 'REJECTED' });
      }
      if (decision !== 'APPROVE') return Response.json({ error: '승인 또는 반려를 선택하세요' }, { status: 400 });
      // 요청 내용 그대로 결정을 실행한다. 기록에는 요청자와 결재자를 함께 남긴다
      const p = approval.payload || {};
      action = ACTION_OF[approval.kind];
      option_key = p.option_key; version = p.version; quotation_id = p.quotation_id; report_id = p.report_id; spec_id = p.spec_id; review_id = p.review_id;
      decision = p.decision; note = p.note; pins = p.pins;
      senderName = `${approval.requested_by_name || '고객'} (결재 ${myName})`;
      const res = await runAction();
      if (res.status === 200) {
        await svc.entities.ClientApproval.update(approval.id, { status: 'APPROVED', decided_by_email: myEmail, decided_by_name: myName, decided_at: now });
        await staleOthers(approval.kind, approval.id);
        await audit('CLIENT_APPROVAL_APPROVED', `${label} 결재 승인 (요청 ${approval.requested_by_name || ''})`);
        await tellRequester(`[결재 승인] ${card.title}`, `${myName}: ${label} 결재를 승인해 이지스 담당자에게 전달했습니다.`);
      } else if ([404, 409].includes(res.status)) {
        const reason = (await res.clone().json().catch(() => ({}))).error || '대상이 바뀌었습니다';
        await svc.entities.ClientApproval.update(approval.id, { status: 'STALE', decided_by_email: myEmail, decided_by_name: myName, decided_at: now, reason });
        await tellRequester(`[결재 무효] ${card.title}`, `${label} 결재 요청을 실행할 수 없어 닫았습니다.\n사유: ${reason}`);
      }
      return res;
    }

    const kind = GATED[action];
    if (kind) {
      if (!can(company, myEmail, 'decide')) return Response.json({ error: '재무 역할만 있는 계정은 결정할 수 없습니다. 실무자나 결재권자에게 요청해 주세요' }, { status: 403 });
      const positive = kind === 'comparison_choice' || kind === 'quote_accept' || decision === 'APPROVED';
      if (positive && normalizeRules(company?.approval_rules).kinds[kind]?.on) {
        const t = await loadTarget(kind);
        if (t.fail) return t.fail;
        if (approvalNeeded({ company, kind, email: myEmail, positive, amountKrw: t.amountKrw })) {
          const waiting = await svc.entities.ClientApproval.filter({ card_id: card.id, kind, target_id: t.id, status: 'PENDING' });
          if (waiting.length) return Response.json({ error: `이미 결재 요청 중입니다 (${waiting[0].requested_by_name || '동료'} 요청). 결재가 끝난 뒤 다시 해 주세요` }, { status: 409 });
          const memo = String(note || '').trim().slice(0, 1000);
          const now = new Date().toISOString();
          const payload = {
            comparison_choice: { option_key, version },
            quote_accept: { quotation_id },
            qc_decision: { report_id, decision },
            spec_decision: { spec_id, decision },
            file_review: { review_id, decision, pins: normalizePins(pins, myName, now) },
          }[kind];
          const saved = await svc.entities.ClientApproval.create({
            tenant_id: card.tenant_id, company_id: auth.companyId, card_id: card.id, card_title: card.title,
            kind, target_id: t.id, target_label: t.label, payload: { ...payload, note: memo }, amount_krw: t.amountKrw ?? null,
            status: 'PENDING', requested_by_email: myEmail, requested_by_name: myName, requested_at: now, request_note: memo,
          });
          await audit('CLIENT_APPROVAL_REQUESTED', `${t.label} — 고객사 결재 요청${memo ? `: ${memo}` : ''}`);
          try {
            const approvers = approversOf(company).filter((e) => e !== myEmail);
            const to = (await clientUsersOfCompany(svc, auth.companyId)).filter((u) => approvers.includes(lower(u.email)));
            await notifyUsers(svc, to, {
              type: 'client_approval_requested',
              title: `[결재 요청] ${card.title}`,
              body: `${myName}: ${t.label} — ${APPROVAL_KIND_LABEL[kind]} 결재를 요청했습니다.${memo ? `\n${memo.slice(0, 300)}` : ''}`,
              link: `/client/team?tab=approvals`,
              task_card_id: card.id,
              card_title: card.title,
            }, { roleFilter: false });
          } catch (_e) { /* 알림 실패가 결재 요청을 막지 않는다 */ }
          return Response.json({ ok: true, pending_approval: true, approval_id: saved.id });
        }
      }
      const res = await runAction();
      if (res.status === 200) await staleOthers(kind);
      return res;
    }

    return await runAction();
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}