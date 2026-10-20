import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';

// 고객 '내 금형': 공개된 프로젝트의 금형 대장과 고객사 중국 상표 상태.
// 공장명은 고객이 공장에 직접 송금하는 프로젝트(client_pays_factory)에서만 보낸다. 내부 메모·금형비 지급 기록은 보내지 않는다.
const TRADEMARK = ['REGISTERED', 'APPLIED', 'NOT_FILED', 'UNKNOWN'];

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    const svc = base44.asServiceRole;
    const company = await svc.entities.Company.get(auth.companyId).catch(() => null);
    const cards = (await svc.entities.TaskCard.filter({ client_id: auth.companyId, client_visible: true }, '-updated_date', 300)).filter((c: any) => cardVisibleToClient(c, auth.companyId));
    const byId = new Map(cards.map((c: any) => [c.id, c]));
    const molds = cards.length ? (await svc.entities.MoldAsset.filter({ card_id: { $in: cards.map((c: any) => c.id) } }, 'created_date', 500)).filter((m: any) => byId.has(m.card_id)) : [];
    return Response.json({
      trademark_status: TRADEMARK.includes(company?.cn_trademark_status) ? company.cn_trademark_status : 'UNKNOWN',
      molds: molds.map((m: any) => {
        const card: any = byId.get(m.card_id);
        return {
          id: m.id, card_id: m.card_id, card_title: card?.title || '', name: m.name, part_name: m.part_name || '', cavity: m.cavity ?? null, material: m.material || '',
          photos: (m.photos || []).map((p: any) => ({ url: p.url, name: p.name || '' })),
          ownership: m.ownership || 'CLIENT', ownership_confirmed: !!m.ownership_confirmed,
          ownership_doc: m.ownership_doc_id ? { id: m.ownership_doc_id, card_id: m.card_id, file_name: m.ownership_doc_name || '금형 소유 확인서' } : null,
          return_terms: m.return_terms || '', status: m.status || 'IN_USE', shot_count: m.shot_count ?? null, expected_life_shots: m.expected_life_shots ?? null,
          last_checked_at: m.last_checked_at || '',
          location: card?.client_pays_factory ? (m.factory_name || card.factory_name || '협력 공장') : '중국 협력 공장 (이지스 관리)',
        };
      }),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
