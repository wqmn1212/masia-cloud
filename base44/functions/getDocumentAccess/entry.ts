import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { documentUrl } from '../../shared/cardDocuments.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { kind, document_id } = await req.json();
    if (!['attachment', 'factory'].includes(kind) || typeof document_id !== 'string') return Response.json({ error: '잘못된 파일 요청입니다.' }, { status: 400 });
    const entity = kind === 'factory' ? base44.entities.FactoryDocument : base44.entities.CardAttachment;
    const doc = await entity.get(document_id);
    if (!doc || (!doc.tenant_id && user.account_tier !== 'master') || (user.account_tier !== 'master' && doc.tenant_id !== user.tenant_id)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const parent = kind === 'factory' ? await base44.entities.Company.get(doc.company_id) : await base44.entities.TaskCard.get(doc.card_id);
    if (!parent || parent.tenant_id !== doc.tenant_id || (kind === 'factory' && parent.company_type !== 'FACTORY')) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const url = await documentUrl(base44.asServiceRole, doc.file_url);
    return Response.json({ url });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}