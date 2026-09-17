import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { bilingualFields, fillMissingTranslation } from '../../shared/bilingualTranslation.ts';
import { fillQuotationNames } from '../../shared/bilingualQuotation.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' || user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.batch_size) || 20, 50));
    const target = body.target_language || 'zh';
    if (!['ko', 'zh'].includes(target)) return Response.json({ error: 'Invalid target_language' }, { status: 400 });
    let translated = 0, skipped = 0, candidates = 0;
    for (const [name, fields] of Object.entries(bilingualFields)) {
      const query = { cn_manual: { $ne: true }, $or: fields.map(field => {
        const source = target === 'ko' ? `${field}_cn` : field;
        const dest = target === 'ko' ? field : `${field}_cn`;
        return { $and: [{ [source]: { $exists: true, $nin: ['', null] } }, { $or: [{ [dest]: { $exists: false } }, { [dest]: '' }, { [dest]: null }] }] };
      }) };
      const rows = await base44.asServiceRole.entities[name].filter(query, 'created_date', limit);
      candidates += rows.length;
      if (body.dry_run === true) continue;
      for (const row of rows) {
        if (await fillMissingTranslation(base44.asServiceRole, name, row, fields, target)) translated++;
        else skipped++;
      }
    }
    const source = target === 'ko' ? 'item_name_cn' : 'item_name_ko';
    const dest = target === 'ko' ? 'item_name_ko' : 'item_name_cn';
    const quotations = await base44.asServiceRole.entities.Quotation.filter({ line_items: { $elemMatch: { [source]: { $exists: true, $nin: ['', null] }, $or: [{ [dest]: { $exists: false } }, { [dest]: '' }, { [dest]: null }] } } }, 'created_date', limit);
    candidates += quotations.length;
    if (body.dry_run !== true) for (const row of quotations) {
      if (await fillQuotationNames(base44.asServiceRole, row, target)) translated++;
      else skipped++;
    }
    return Response.json({ translated, skipped, candidates, target_language: target, dry_run: body.dry_run === true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}