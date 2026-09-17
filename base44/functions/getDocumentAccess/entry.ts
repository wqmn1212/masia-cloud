import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { documentUrl, factoryIds } from '../../shared/cardDocuments.ts';
import { cardVisibleToClient } from '../../shared/clientAccess.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub', 'client'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { kind, document_id, card_id, company_id } = await req.json();
    if (!['attachment', 'factory', 'bank'].includes(kind) || typeof document_id !== 'string') return Response.json({ error: '잘못된 파일 요청입니다.' }, { status: 400 });
    const svc = base44.asServiceRole, isClient = user.account_tier === 'client';
    if (kind === 'bank') {
      if (isClient || typeof company_id !== 'string') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const company = await base44.entities.Company.get(company_id);
      if (!company || !company.tenant_id || (user.account_tier !== 'master' && company.tenant_id !== user.tenant_id)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const bank = (company.remittance_documents || []).find(d => d.id === document_id);
      if (!bank) return Response.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
      return Response.json({ url: await documentUrl(svc, bank.file_uri) });
    }
    const doc = await (kind === 'factory' ? svc.entities.FactoryDocument : svc.entities.CardAttachment).get(document_id);
    if (!doc || !doc.tenant_id || (!isClient && user.account_tier !== 'master' && doc.tenant_id !== user.tenant_id)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const parent = kind === 'factory' ? await svc.entities.Company.get(doc.company_id) : await svc.entities.TaskCard.get(doc.card_id);
    if (!parent || parent.tenant_id !== doc.tenant_id || (kind === 'factory' && parent.company_type !== 'FACTORY')) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (isClient) {
      if (!user.company_id || doc.client_visible !== true) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const card = kind === 'attachment' ? parent : typeof card_id === 'string' ? await svc.entities.TaskCard.get(card_id) : null;
      if (!cardVisibleToClient(card, user.company_id) || card.tenant_id !== doc.tenant_id || (kind === 'factory' && !factoryIds(card).includes(doc.company_id))) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    return Response.json({ url: await documentUrl(svc, doc.file_url) });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}