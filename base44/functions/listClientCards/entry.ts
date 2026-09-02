import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';

// 고객 포털 칸반 보드용 카드 목록. 내부 필드(공장명·후보공장·에이전트 노트)는 응답에 포함하지 않는다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    const svc = base44.asServiceRole;
    const cards = await svc.entities.TaskCard.filter(
      { client_id: auth.companyId, client_visible: true },
      '-updated_date',
      200
    );

    return Response.json({
      cards: cards.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        priority: c.priority || 'MEDIUM',
        due_date: c.due_date || '',
        hq_requirements: c.hq_requirements || '',
        target_machine_category: c.target_machine_category || '',
        updated_date: c.updated_date,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}