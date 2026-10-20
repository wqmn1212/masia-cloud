import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';
import { fillMissingTranslation } from '../../shared/bilingualTranslation.ts';
import { uploadPrivateAttachments, linkCardAttachments } from '../../shared/privateAttachments.ts';
import { QC_DECISIONS, SPEC_DECISIONS, latestSentSpecs } from '../../shared/clientQc.ts';
import { DEST_COST_DECISIONS, destCostState } from '../../shared/destCost.ts';

// 고객이 수행 가능한 쓰기 동작: 채팅 작성 · 요구사항(hq_requirements) 수정 · 공개된 검수 결과의 출고 승인/보류
// · 보낸 품질 기준서의 승인/수정 요청 · 선적 도착지 비용 예상액의 확인/문의 · 받은 물건의 불량 신고(클레임).
// 그 외 필드는 서버에서 아예 받지 않으므로 프런트 우회로 변경할 수 없다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    const { card_id, action, message, message_cn, hq_requirements, hq_requirements_cn, attachments, report_id, spec_id, shipment_id, sent_at, decision, note, claim } = await req.json();
    if (!card_id || !action) return Response.json({ error: 'card_id, action 이 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(card_id);
    if (!cardVisibleToClient(card, auth.companyId)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const senderName = auth.user.full_name || auth.user.account_label || auth.user.email;
    // 고객 업로드 파일: 비공개 저장 후 카드 파일 탭에 고객 공개 상태로 연동
    const saveFiles = async () => {
      const files = await uploadPrivateAttachments(svc, attachments);
      await linkCardAttachments(svc, { tenantId: card.tenant_id, cardId: card.id, attachments: files, uploaderName: senderName, clientVisible: true, uploaderRole: null });
      return files;
    };

    if (action === 'upload_files') {
      const files = await saveFiles();
      if (!files.length) return Response.json({ error: '업로드할 파일이 없습니다' }, { status: 400 });
      const staff = await internalUsersOfTenant(svc, card.tenant_id);
      await notifyUsers(svc, staff, {
        type: 'card_shared',
        title: `[고객 파일] ${card.title}`,
        body: `${senderName}: ${files.map((f) => f.name).join(', ')}`,
        link: `/task-board?card=${card.id}`,
        task_card_id: card.id,
      });
      return Response.json({ ok: true, count: files.length });
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

    return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}