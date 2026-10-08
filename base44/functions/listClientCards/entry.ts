import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { clientCardDocuments, documentMetadata } from '../../shared/cardDocuments.ts';

// 고객 포털 칸반 보드용 카드 목록. 내부 필드(공장명·후보공장·에이전트 노트)는 응답에 포함하지 않는다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;

    const svc = base44.asServiceRole;
    const cards = await svc.entities.TaskCard.filter(
      { client_id: auth.companyId, client_visible: true },
      '-updated_date',
      200
    );

    const documents = await clientCardDocuments(svc, cards);
    // 관리자 보드와 동일한 카테고리 목록을 사용해 저장된 키를 표시명으로 변환한다.
    const categories = await svc.entities.MachineCategory.list('label_kr', 500);
    const categoryLabels = new Map(categories.filter(c => c.key).map(c => [c.key, c.label_kr]));
    return Response.json({
      attachments: documents.map(documentMetadata),
      cards: cards.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        priority: c.priority || 'MEDIUM',
        due_date: c.due_date || '',
        hq_requirements: c.hq_requirements || '',
        target_machine_category: c.target_machine_category || '',
        category_label: categoryLabels.get(c.target_machine_category) || '',
        updated_date: c.updated_date,
        // 담당자가 안내를 보낸 공휴일 겹침만 (공장 개별 휴무 제외)
        holiday_badges: (c.holiday_conflicts || []).filter((h) => h.kind === 'holiday' && h.client_notified_at).map((h) => ({ name: h.name, start: h.start, end: h.end })),
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}