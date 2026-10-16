import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';
import { fillMissingTranslation } from '../../shared/bilingualTranslation.ts';
import { uploadPrivateAttachments, linkCardAttachments } from '../../shared/privateAttachments.ts';
import { QC_DECISIONS, SPEC_DECISIONS, latestSentSpecs } from '../../shared/clientQc.ts';

// 고객이 수행 가능한 쓰기 동작: 채팅 작성 · 요구사항(hq_requirements) 수정 · 공개된 검수 결과의 출고 승인/보류
// · 보낸 품질 기준서의 승인/수정 요청.
// 그 외 필드는 서버에서 아예 받지 않으므로 프런트 우회로 변경할 수 없다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    const { card_id, action, message, message_cn, hq_requirements, hq_requirements_cn, attachments, report_id, spec_id, decision, note } = await req.json();
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

    return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}