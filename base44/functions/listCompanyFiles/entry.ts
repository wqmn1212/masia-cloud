import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { documentRows } from '../../shared/cardDocuments.ts';
import { validDate } from '../../shared/cardSchedule.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub', 'client'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const input = await req.json(), isClient = user.account_tier === 'client';
    const companyId = isClient ? user.company_id : input.company_id;
    if (!companyId || (isClient && input.company_id && input.company_id !== companyId)) return Response.json({ error: '고객사 접근 권한이 없습니다.' }, { status: 403 });
    const svc = base44.asServiceRole, company = await svc.entities.Company.get(companyId);
    if (!company || company.company_type !== 'CLIENT' || !company.tenant_id || (!isClient && user.account_tier !== 'master' && company.tenant_id !== user.tenant_id)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const offset = input.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0 || typeof (input.card_name || '') !== 'string') return Response.json({ error: '검색 조건을 확인하세요.' }, { status: 400 });
    for (const key of ['from_date', 'to_date']) if (input[key] && !validDate(input[key])) return Response.json({ error: '검색 날짜를 확인하세요.' }, { status: 400 });
    const types = ['GENERAL', 'INVOICE_CI', 'INVOICE_PI', 'PACKING_LIST', 'QUOTATION', 'REMITTANCE_ACCOUNT'];
    if (input.document_type && !types.includes(input.document_type)) return Response.json({ error: '문서 유형을 확인하세요.' }, { status: 400 });
    const cards = (await documentRows(svc.entities.TaskCard, { client_id: companyId, tenant_id: company.tenant_id, ...(isClient ? { client_visible: true } : {}) }, '-created_date')).filter(c => c.title?.toLowerCase().includes((input.card_name || '').toLowerCase()));
    if (!cards.length) return Response.json({ attachments: [], cards: [], has_more: false });
    const query = { tenant_id: company.tenant_id, card_id: { $in: cards.map(c => c.id) }, ...(isClient ? { client_visible: true } : {}) };
    if (input.document_type === 'GENERAL') query.$or = [{ document_type: 'GENERAL' }, { document_type: { $exists: false } }, { document_type: '' }];
    else if (input.document_type) query.document_type = input.document_type;
    if (input.from_date || input.to_date) query.created_date = { ...(input.from_date ? { $gte: new Date(input.from_date + 'T00:00:00+09:00').toISOString() } : {}), ...(input.to_date ? { $lte: new Date(input.to_date + 'T23:59:59.999+09:00').toISOString() } : {}) };
    const rows = await svc.entities.CardAttachment.filter(query, '-created_date', 51, offset);
    return Response.json({ attachments: rows.slice(0, 50).map(d => ({ id: d.id, document_id: d.id, document_kind: 'attachment', card_id: d.card_id, file_name: d.file_name, file_type: d.file_type, document_type: d.document_type || 'GENERAL', created_date: d.created_date, client_visible: d.client_visible === true })), cards: cards.map(c => ({ id: c.id, title: c.title })), has_more: rows.length > 50 });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}