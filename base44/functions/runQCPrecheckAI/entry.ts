import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// 사전 QC 점검 AI 보강: 규칙·우리 사례 점검이 끝난 기록(QCPrecheck)에 없는 위험·공장 질문만 최대 8개 더한다.
// 같은 구성품·사양으로 이미 AI 점검을 했으면 다시 호출하지 않는다 (크레딧 절약).
// 금액·마진·고객 연락처는 AI에 넘기지 않는다.
const STAGES = ['SPEC', 'MATERIAL', 'SAMPLE', 'PRODUCTION', 'PRESHIP', 'PACKING'];
const SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR'];
const KINDS = ['RISK', 'QUESTION'];
const MAX_ITEMS = 8;

const hash = (str: string) => {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
const norm = (s: unknown) => String(s || '').replace(/[\s·.,:;()'"、，。：]/g, '').toLowerCase();

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { precheck_id } = await req.json();
    if (!precheck_id) return Response.json({ error: 'precheck_id required' }, { status: 400 });
    const svc = base44.asServiceRole;
    const rec = await svc.entities.QCPrecheck.get(precheck_id);
    if (!rec) return Response.json({ error: 'Not found' }, { status: 404 });
    const card = await svc.entities.TaskCard.get(rec.card_id);
    if (!card) return Response.json({ error: 'Card not found' }, { status: 404 });
    if (user.account_tier !== 'master' && (!card.tenant_id || card.tenant_id !== user.tenant_id)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const components = rec.components || [];
    if (!components.length) return Response.json({ ok: false, error: 'no components' }, { status: 400 });
    const inputHash = hash(JSON.stringify(components.map((c: any) => [c.type, c.name, c.specs || {}])));
    if (rec.ai_status === 'DONE' && rec.ai_input_hash === inputHash) return Response.json({ ok: true, skipped: true, added: 0 });

    await svc.entities.QCPrecheck.update(rec.id, { ai_status: 'RUNNING', ai_error: '' });

    const quotation = rec.quotation_id ? await svc.entities.Quotation.get(rec.quotation_id).catch(() => null) : null;
    const lines = quotation ? [...(quotation.line_items || []).map((l: any) => ({ name: l.item_name_ko || l.item_name_cn, spec: l.specification })), ...(quotation.quote_options || []).map((o: any) => ({ name: o.option_name, spec: o.specification }))] : [];
    const cases = (await svc.entities.QCKnowledgeLog.filter(card.tenant_id ? { tenant_id: card.tenant_id } : {}, '-created_date', 100))
      .filter((k: any) => components.some((c: any) => (k.component_type || (k.target_category ? 'EQUIPMENT' : '')) === c.type))
      .slice(0, 10)
      .map((k: any) => ({ type: k.component_type || 'EQUIPMENT', issue: k.issue_case, cause: k.root_cause, decision: k.trigger_decision, prevention: k.prevention || k.solution_parameter }));
    const existing = (rec.items || []).map((i: any) => ({ kind: i.kind, component: i.component_key, title: i.title }));

    const ctx = {
      card: { title: card.title, requirements: card.hq_requirements, meeting_notes: card.agent_meeting_notes },
      components: components.map((c: any) => ({ key: c.key, type: c.type, name: c.name, quote_line: c.source_line, specs: c.specs || {} })),
      quotation: quotation ? { lines, remarks: quotation.remarks || '', incoterms: quotation.incoterms || '' } : null,
      import_requirements: (card.import_requirements || []).map((r: any) => ({ label: r.label || r.key, status: r.status })),
      our_cases: cases,
      existing_items: existing,
    };

    let result: any;
    try {
      result = await svc.integrations.Core.InvokeLLM({
        prompt: `너는 중국 광둥성 공장 제조를 관리하는 QC 책임자다. 아래 프로젝트의 구성품·사양·견적·우리 과거 불량 사례를 보고, 양산 전에 확인해야 할 위험과 공장에 물어볼 질문을 찾아라.
규칙:
- existing_items 에 이미 있는 내용은 쓰지 마라. 여기 없는 것만, 최대 ${MAX_ITEMS}개.
- 사양 확정(SPEC)·샘플(SAMPLE) 단계를 우선하고, 치명(CRITICAL)·중(MAJOR) 결함 위주로.
- 항목마다 확인 방법(how)과 합격 기준(criteria)을 구체적으로 쓴다. "상태 확인", "품질 확인" 같은 말은 쓰지 마라.
- 자료에 없는 수치(공차, 농도 값 등)는 만들지 말고 "공장과 확정 필요"라고 쓴다.
- 견적 비고에 "서면 확인 필요", "별도 확인" 같은 문구가 있으면 QUESTION 항목으로 바꾼다.
- component_key 는 components 의 key 중 하나만 쓴다.
- title·how·criteria 는 한국어, _cn 필드는 같은 내용의 중국어(간체). 공장 질문은 question_cn(중국어)과 question_ko(한국어).

프로젝트 자료:
${JSON.stringify(ctx, null, 2)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: KINDS },
                  component_key: { type: 'string' },
                  stage: { type: 'string', enum: STAGES },
                  severity: { type: 'string', enum: SEVERITIES },
                  title: { type: 'string' }, title_cn: { type: 'string' },
                  how: { type: 'string' }, how_cn: { type: 'string' },
                  criteria: { type: 'string' }, criteria_cn: { type: 'string' },
                  question_ko: { type: 'string' }, question_cn: { type: 'string' },
                },
              },
            },
          },
        },
      });
    } catch (e) {
      await svc.entities.QCPrecheck.update(rec.id, { ai_status: 'FAILED', ai_error: String((e as Error)?.message || e).slice(0, 300) });
      return Response.json({ ok: false, error: 'llm_failed' });
    }

    const keys = new Set(components.map((c: any) => c.key));
    const seen = new Set(existing.map((i: any) => norm(i.title)));
    const added: any[] = [];
    for (const it of (result?.items || [])) {
      if (added.length >= MAX_ITEMS) break;
      if (!it?.title || !keys.has(it.component_key)) continue;
      const comp = components.find((c: any) => c.key === it.component_key);
      const esc = String(comp.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const title = `${comp.name}: ${String(it.title).replace(new RegExp(`^${esc}\\s*[:：]\\s*`), '')}`;
      const n = norm(title);
      if ([...seen].some((s) => s.includes(n.slice(0, 24)) || n.includes(s.slice(0, 24)))) continue;
      seen.add(n);
      added.push({
        key: `AI:${it.component_key}:${hash(n)}`, source: 'AI', kind: KINDS.includes(it.kind) ? it.kind : 'RISK', component_key: it.component_key,
        stage: STAGES.includes(it.stage) ? it.stage : 'SPEC', severity: SEVERITIES.includes(it.severity) ? it.severity : 'MAJOR',
        title, title_cn: it.title_cn ? `${comp.name}：${it.title_cn}` : '', how: it.how || '', how_cn: it.how_cn || '', criteria: it.criteria || '', criteria_cn: it.criteria_cn || '',
        question_ko: it.question_ko || '', question_cn: it.question_cn || '', decision: 'PENDING',
      });
    }

    await svc.entities.QCPrecheck.update(rec.id, { items: [...(rec.items || []), ...added], ai_status: 'DONE', ai_ran_at: new Date().toISOString(), ai_input_hash: inputHash, ai_error: '' });
    return Response.json({ ok: true, added: added.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
