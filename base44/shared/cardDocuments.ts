export async function documentRows(entity, filter, sort = 'sort_order') {
  const rows = [];
  for (let skip = 0; ; skip += 200) {
    const page = await entity.filter(filter, sort, 200, skip);
    rows.push(...page);
    if (page.length < 200) return rows;
  }
}
export function factoryIds(card) {
  return [...new Set([card.factory_id, ...(card.candidate_factory_ids || [])].filter(Boolean))];
}
// Caller must authorize every card before calling. Never include private URIs in metadata.
export async function clientCardDocuments(svc, cards) {
  if (!cards.length) return [];
  const attachments = await documentRows(svc.entities.CardAttachment, { card_id: { $in: cards.map(c => c.id) }, client_visible: true }, 'created_date');
  const ids = [...new Set(cards.flatMap(factoryIds))];
  const companies = ids.length ? await documentRows(svc.entities.Company, { id: { $in: ids }, company_type: 'FACTORY' }, 'company_name') : [];
  const docs = companies.length ? await documentRows(svc.entities.FactoryDocument, { company_id: { $in: companies.map(c => c.id) }, client_visible: true }) : [];
  return cards.flatMap(card => {
    if (!card.tenant_id) return [];
    const validFactories = companies.filter(c => c.tenant_id === card.tenant_id && factoryIds(card).includes(c.id));
    return [
      ...attachments.filter(a => a.card_id === card.id && a.tenant_id === card.tenant_id).map(a => ({ ...a, document_kind: 'attachment' })),
      ...docs.filter(d => d.tenant_id === card.tenant_id && validFactories.some(c => c.id === d.company_id)).map(d => ({ ...d, card_id: card.id, document_kind: 'factory' })),
    ];
  });
}
export function documentMetadata(doc) {
  return { id: `${doc.document_kind}:${doc.id}:${doc.card_id}`, document_id: doc.id, document_kind: doc.document_kind, card_id: doc.card_id, file_name: doc.file_name, file_type: doc.file_type, document_type: doc.document_type || 'GENERAL', created_date: doc.created_date, client_visible: true };
}
export async function documentUrl(svc, uri) {
  if (/^https?:\/\//i.test(uri || '')) return uri;
  const result = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 });
  return result.signed_url;
}