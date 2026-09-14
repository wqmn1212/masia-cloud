import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { editableFields, restrictedFields, changedFields, historyVersion } from '../../shared/quotationHistory.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { action, quotation_id, data, expected_updated_date, reason, revision_id, before_revision } = await req.json();
    if (!['master', 'service', 'sub'].includes(user.account_tier) || user.is_active === false) return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    if (!['update', 'list', 'snapshot'].includes(action) || typeof quotation_id !== 'string' || !quotation_id) return Response.json({ error: '견적서와 작업을 지정해주세요.' }, { status: 400 });
    const q = await base44.entities.Quotation.get(quotation_id);
    if (!q) return Response.json({ error: '견적서를 찾을 수 없습니다.' }, { status: 404 });
    if (!q.tenant_id || (user.account_tier !== 'master' && q.tenant_id !== user.tenant_id)) return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    if (action !== 'update' && user.account_tier === 'sub') return Response.json({ error: '원가가 포함된 이력은 팀 관리자 전용입니다.' }, { status: 403 });
    const revisions = base44.asServiceRole.entities.QuotationRevision;
    const scope = { quotation_id, tenant_id: q.tenant_id };
    if (action === 'snapshot') {
      if (typeof revision_id !== 'string') return Response.json({ error: '버전을 선택해주세요.' }, { status: 400 });
      const rows = await revisions.filter({ ...scope, id: revision_id }, '-revision_no', 1);
      if (!rows[0]) return Response.json({ error: '이력을 찾을 수 없습니다.' }, { status: 404 });
      const result = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: rows[0].snapshot_uri, expires_in: 300 });
      return Response.json(result);
    }
    const latest = (await revisions.filter(scope, '-revision_no', 1))[0];
    if (action === 'list') {
      const query = { ...scope, ...(Number.isFinite(before_revision) ? { revision_no: { $lt: before_revision } } : {}) };
      const rows = await revisions.filter(query, '-revision_no', 31);
      return Response.json({ current: q, current_version: historyVersion(q, latest), has_more: rows.length > 30, revisions: rows.slice(0, 30).filter(r => r.source_updated_date !== q.updated_date).map(({ snapshot_uri, ...meta }) => meta) });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof expected_updated_date !== 'string') return Response.json({ error: '수정 내용과 수정 전 시점이 필요합니다.' }, { status: 400 });
    if (q.updated_date !== expected_updated_date) return Response.json({ error: '다른 변경이 먼저 저장되었습니다. 견적 목록을 새로고침한 후 다시 수정해주세요.' }, { status: 409 });
    const patch = Object.fromEntries(Object.entries(data).filter(([k]) => editableFields.includes(k) && (user.account_tier !== 'sub' || !restrictedFields.has(k))));
    const fields = changedFields(q, patch);
    if (!fields.length && (patch.status === undefined || patch.status === q.status)) return Response.json({ saved: true, unchanged: true });
    if (fields.length) {
      // Read the complete record only after tenant/role authorization. Sub users never receive the snapshot.
      const full = await base44.asServiceRole.entities.Quotation.get(quotation_id);
      if (full.updated_date !== expected_updated_date) return Response.json({ error: '견적이 변경되었습니다. 새로고침 후 다시 수정해주세요.' }, { status: 409 });
      const existing = await revisions.filter({ ...scope, source_updated_date: expected_updated_date }, '-revision_no', 1);
      if (!existing.length) {
        const file = new File([JSON.stringify(full)], `quotation-${quotation_id}.json`, { type: 'application/json' });
        const { file_uri } = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
        await revisions.create({ ...scope, card_id: full.card_id || '', revision_no: historyVersion(q, latest), source_updated_date: expected_updated_date, snapshot_uri: file_uri, changed_by_id: user.id, changed_by_name: user.full_name || user.email, reason: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 2000) : '견적 내용 수정', changed_fields: fields });
      }
    }
    const fresh = await base44.entities.Quotation.get(quotation_id);
    if (fresh.updated_date !== expected_updated_date) return Response.json({ error: '다른 변경이 먼저 저장되었습니다. 새로고침 후 다시 수정해주세요.' }, { status: 409 });
    await base44.entities.Quotation.update(quotation_id, patch);
    return Response.json({ saved: true, archived: fields.length > 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}