import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { card_id } = await req.json();
    if (!card_id) return Response.json({ error: 'card_id required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(card_id);
    if (!card) return Response.json({ error: 'Card not found' }, { status: 404 });

    const [meetings, items, proposals, quotations, qcReports, payments] = await Promise.all([
      svc.entities.MeetingLog.filter({ card_id }, 'meeting_date'),
      svc.entities.TaskItem.filter({ card_id }),
      svc.entities.AIProposal.filter({ card_id }, '-email_date', 30),
      svc.entities.Quotation.filter({ card_id }),
      svc.entities.QCReport.filter({ card_id }),
      svc.entities.PaymentStage.filter({ card_id }),
    ]);

    const ctx = {
      today: new Date().toISOString().slice(0, 10),
      card: {
        title: card.title, status: card.status, priority: card.priority, due_date: card.due_date,
        client: card.client_name, factory: card.factory_name,
        requirements: card.hq_requirements, meeting_notes: card.agent_meeting_notes,
      },
      meetings: meetings.map(m => ({ date: m.meeting_date, type: m.meeting_type, title: m.title, notes: m.notes, decisions: m.decisions, next_steps: m.next_steps })),
      tasks: items.map(t => ({ title: t.title, status: t.status, due_date: t.due_date, assignee: t.assignee_name })),
      emails: proposals.map(p => ({ date: p.email_date, subject: p.email_subject, requirements: p.client_requirements, commitments: p.our_commitments })),
      quotations: quotations.map(q => ({ factory: q.factory_name, status: q.status, final_price_usd: q.final_price_usd })),
      qc: qcReports.map(q => ({ type: q.inspection_type, result: q.qc_result, comments: q.comments })),
      payments: payments.map(p => ({ stage: p.stage_type, percent: p.percentage, status: p.approval_status })),
    };

    const result = await svc.integrations.Core.InvokeLLM({
      prompt: `너는 중국 설비 소싱 프로젝트를 관리하는 PM 전문가다. 아래 프로젝트 데이터(미팅 이력, 이메일 정리, 세부 업무, 견적, QC, 결제 단계)를 종합 분석해라.
한국어로 작성하고, 데이터에 근거한 사실만 쓴다. 근거가 없는 내용은 만들지 마라.

프로젝트 데이터:
${JSON.stringify(ctx, null, 2)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          health: { type: 'string', enum: ['GOOD', 'WATCH', 'RISK'] },
          progress_percent: { type: 'number' },
          summary: { type: 'string', description: '현재까지의 업무 진행 내역 요약 (5~8줄)' },
          timeline: {
            type: 'array', description: '일자별 주요 진행 내역',
            items: { type: 'object', properties: { date: { type: 'string' }, event: { type: 'string' } } }
          },
          risks: { type: 'array', items: { type: 'string' }, description: '지연·병목·충돌되는 요구사항' },
          open_items: { type: 'array', items: { type: 'string' }, description: '아직 처리되지 않은 고객 요구/약속' },
          recommendations: {
            type: 'array', description: '앞으로 해야 할 추천 업무',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
                due_date: { type: 'string', description: 'YYYY-MM-DD, 없으면 빈 문자열' }
              }
            }
          }
        }
      }
    });

    return Response.json({
      analysis: result,
      counts: { meetings: meetings.length, tasks: items.length, emails: proposals.length },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}