import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { clientCardDocuments, documentMetadata } from '../../shared/cardDocuments.ts';
import { missingSharedDocs } from '../../shared/shipments.ts';

// 고객 서류함: 주문(공개 카드)별로 고객에게 공개된 파일과 체결된 계약서를 모으고, 선적에 필요한데 아직 공유되지 않은 서류를 알려 준다.
// 파일 주소는 보내지 않는다 (내려받을 때 getClientCardDetail(include_file_urls)·getSignatureRequest(purpose:'download') 로 5분짜리 링크를 받는다).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    const svc = base44.asServiceRole;
    const cards = (await svc.entities.TaskCard.filter({ client_id: auth.companyId, client_visible: true }, '-updated_date', 200)).filter((c) => c.client_visible === true && c.client_id === auth.companyId);
    const ids = new Set(cards.map((c) => c.id));
    const documents = await clientCardDocuments(svc, cards);
    const shipments = cards.length ? (await svc.entities.Shipment.filter({ card_id: { $in: [...ids] }, client_visible: true }, 'created_date', 500)).filter((s) => ids.has(s.card_id) && s.client_visible === true) : [];
    // 체결된 계약서 (카드에 붙은 것은 주문 안에, 월 계약처럼 카드가 없는 것은 따로)
    const contracts = (await svc.entities.SignatureRequest.filter({ client_id: auth.companyId, status: 'COMPLETED' }, '-completed_at', 100))
      .filter((r) => r.client_id === auth.companyId && r.status === 'COMPLETED' && r.completed_file_uri)
      .map((r) => ({ request_id: r.id, card_id: ids.has(r.card_id) ? r.card_id : '', document_title: r.document_title || '계약서', document_no: r.document_no || '', completed_at: r.completed_at || '' }));
    return Response.json({
      orders: cards.map((c) => {
        const docs = documents.filter((d) => d.card_id === c.id);
        return {
          id: c.id, title: c.title, status: c.status, updated_date: c.updated_date,
          documents: docs.map(documentMetadata),
          contracts: contracts.filter((k) => k.card_id === c.id),
          missing: missingSharedDocs(shipments.filter((s) => s.card_id === c.id), docs.filter((d) => d.document_kind === 'attachment').map((d) => d.document_type)),
        };
      }),
      contracts: contracts.filter((k) => !k.card_id),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
