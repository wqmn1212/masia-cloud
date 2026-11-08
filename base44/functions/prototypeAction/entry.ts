import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const MODEL = 'claude_opus_5_5';
const AI_FILE = /\.(png|jpe?g|webp|gif|pdf)$/i;
const list = { type: 'array', items: { type: 'string' } };

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    change_note: { type: 'string' },
    operating_principle: { type: 'string' },
    architecture: { type: 'array', items: { type: 'object', properties: { block: { type: 'string' }, role: { type: 'string' } } } },
    bom: { type: 'array', items: { type: 'object', properties: {
      ref: { type: 'string' }, name: { type: 'string' }, manufacturer: { type: 'string' }, part_no: { type: 'string' }, qty: { type: 'number' },
      voltage: { type: 'string' }, current: { type: 'string' }, interface: { type: 'string' }, function: { type: 'string' },
      verify_status: { type: 'string', enum: ['VERIFIED', 'NEEDS_CHECK', 'ASSUMED'] }, basis: { type: 'string' } } } },
    connections: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, signal: { type: 'string' }, voltage: { type: 'string' }, note: { type: 'string' } } } },
    power_budget: { type: 'string' }, circuit_notes: { type: 'string' }, firmware_draft: { type: 'string' }, firmware_notes: { type: 'string' },
    mechanical_notes: { type: 'string' }, mold_notes: { type: 'string' },
    assumptions: list, missing: list, contradictions: list,
    risks: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }, title: { type: 'string' }, detail: { type: 'string' }, mitigation: { type: 'string' } } } },
  },
};

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['WORKING', 'PARTIAL', 'NOT_WORKING', 'UNKNOWN'] },
    summary: { type: 'string' },
    unverified: list,
    causes: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, evidence: { type: 'string' }, likelihood: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] } } } },
    improvements: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' }, area: { type: 'string', enum: ['CIRCUIT', 'BOM', 'FIRMWARE', 'MECHANICAL', 'MOLD', 'TEST'] }, priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] } } } },
  },
};

const RULES = `규칙:
- 한국어로 작성한다. 부품번호·규격은 실제 존재하는 범용 부품을 우선하되, 데이터시트로 확인하지 못한 값은 verify_status 를 NEEDS_CHECK, 추정이면 ASSUMED 로 둔다. 확실한 경우만 VERIFIED.
- 모든 부품에 선정 근거(basis)를 쓴다. 전압·전류는 단위를 붙인다.
- 입력에 없는 정보는 지어내지 말고 missing 에, 서로 맞지 않는 요구는 contradictions 에, 전제한 내용은 assumptions 에 적는다.
- 펌웨어 초안은 주석 달린 실행 가능한 형태(Arduino/ESP-IDF/STM32 HAL 등 적합한 것)로 핀맵을 포함한다.
- 사출 구조(두께·리브·보스·스냅·체결)와 금형 초안(파팅라인·구배·게이트·이젝터·캐비티 수·언더컷 처리)을 구체적으로 쓴다.
- 이 결과는 검토용 초안이며 실제 작동을 보장하지 않는다. 위험(risks)은 심각도와 대응을 함께 쓴다.`;

const strip = (v) => {
  if (!v) return null;
  const { id, created_date, updated_date, created_by_id, tenant_id, history, ...rest } = v;
  return rest;
};

async function signedInputs(svc, files) {
  const picks = (files || []).filter((f) => ['DRAWING', 'PHOTO', 'REFERENCE'].includes(f.category) && AI_FILE.test(f.name || '') && f.uri).slice(0, 6);
  const out = await Promise.allSettled(picks.map((f) => svc.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri, expires_in: 900 })));
  return out.filter((r) => r.status === 'fulfilled' && r.value?.signed_url).map((r) => r.value.signed_url);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { action, project_id } = body;
    if (!project_id || !['draft', 'analyze_test', 'sign_file'].includes(action)) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    // 사용자 권한으로 읽어 팀 격리(RLS)를 지킨다
    const project = await base44.entities.ProtoProject.get(project_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!project?.tenant_id) return Response.json({ error: '시제품을 찾을 수 없습니다.' }, { status: 404 });
    if (user.account_tier !== 'master' && project.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole;

    if (action === 'sign_file') {
      const { file_id, test_id } = body;
      let file = (project.files || []).find((f) => f.id === file_id);
      if (!file && test_id) {
        const test = await base44.entities.ProtoTest.get(test_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
        if (test?.project_id === project.id) file = (test.evidence || []).find((f) => f.id === file_id);
      }
      if (!file?.uri) return Response.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
      const { signed_url } = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: file.uri, expires_in: 600 });
      return Response.json({ url: signed_url }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const versions = await base44.entities.ProtoDesignVersion.filter({ project_id: project.id }, '-version_no', 50);

    if (action === 'draft') {
      const base = body.base_version_id ? versions.find((v) => v.id === body.base_version_id) : versions.find((v) => v.id === project.current_version_id);
      let sourceTest = null;
      if (body.source_test_id) {
        sourceTest = await base44.entities.ProtoTest.get(body.source_test_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
        if (sourceTest && sourceTest.project_id !== project.id) sourceTest = null;
      }
      const files = (project.files || []).map((f) => `- [${f.category}] ${f.name}${f.note ? ` (${f.note})` : ''}`).join('\n') || '(없음)';
      const prompt = `너는 전자·펌웨어·기구·사출금형을 모두 다루는 시제품 개발 수석 엔지니어다. 아래 요구사항과 첨부 자료로 시제품 설계 초안을 만든다.

[시제품] ${project.title}
[제품 목표] ${project.goal || '-'}
[사용 조건] ${project.use_conditions || '-'}
[전원 요구] ${project.power_requirements || '-'}
[입출력] ${project.io_requirements || '-'}
[제약조건] ${project.constraints || '-'}
[첨부 파일 목록]
${files}
${base ? `\n[기준 설계 v${base.version_no}] 이 설계를 바탕으로 고친다. 그대로 둘 부분은 유지한다.\n${JSON.stringify(strip(base)).slice(0, 24000)}` : ''}
${sourceTest ? `\n[시험 결과] ${sourceTest.title} — ${sourceTest.status}\n불량: ${sourceTest.defects || '-'}\n측정: ${JSON.stringify(sourceTest.measurements || [])}\n분석: ${JSON.stringify(sourceTest.ai_analysis || {})}` : ''}
${body.instruction ? `\n[담당자 지시] ${String(body.instruction).slice(0, 4000)}` : ''}

${RULES}
change_note 에는 기준 설계 대비 바뀐 점(처음이면 '첫 초안')을 쓴다.`;
      const file_urls = await signedInputs(svc, project.files);
      const draft = await svc.integrations.Core.InvokeLLM({ prompt, response_json_schema: DRAFT_SCHEMA, model: MODEL, ...(file_urls.length ? { file_urls } : {}) });
      const now = new Date().toISOString();
      const by = user.full_name || user.email;
      const version = await svc.entities.ProtoDesignVersion.create({
        ...draft,
        tenant_id: project.tenant_id,
        project_id: project.id,
        version_no: (versions[0]?.version_no || 0) + 1,
        source: 'AI',
        status: 'DRAFT',
        based_on_version_id: base?.id || null,
        source_test_id: sourceTest?.id || null,
        created_by_name: by,
        history: [{ at: now, by, action: 'AI 초안 생성', note: body.instruction ? String(body.instruction).slice(0, 300) : '' }],
      });
      await svc.entities.ProtoProject.update(project.id, { stage: 'DESIGN' });
      if (sourceTest) await svc.entities.ProtoTest.update(sourceTest.id, { improvement_version_id: version.id });
      return Response.json({ version });
    }

    // analyze_test
    const test = await base44.entities.ProtoTest.get(body.test_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!test || test.project_id !== project.id) return Response.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });
    const version = versions.find((v) => v.id === test.version_id);
    const evidence = (test.evidence || []).filter((f) => /\.(png|jpe?g|webp|gif|pdf)$/i.test(f.name || '')).slice(0, 5);
    const signed = await Promise.allSettled(evidence.map((f) => svc.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri, expires_in: 900 })));
    const file_urls = signed.filter((r) => r.status === 'fulfilled' && r.value?.signed_url).map((r) => r.value.signed_url);
    const prompt = `너는 시제품 시험 분석 엔지니어다. 설계와 시험 증거만 근거로 작동 여부를 판단한다. 증거가 없는 항목은 단정하지 말고 unverified 에 넣는다.

[시제품] ${project.title} / 목표: ${project.goal || '-'}
[설계 v${version?.version_no || '?'}] ${version ? JSON.stringify(strip(version)).slice(0, 20000) : '(연결된 설계 없음)'}
[제작 기록] ${JSON.stringify(project.build || {}).slice(0, 4000)}
[시험] ${test.title}
조건: ${test.conditions || '-'}
절차: ${test.procedure || '-'}
합격 기준: ${test.expected || '-'}
판정: ${test.status}
측정값: ${JSON.stringify(test.measurements || [])}
결과 메모: ${test.result_note || '-'}
불량: ${test.defects || '-'}
재현 절차: ${test.repro_steps || '-'}
로그: ${(test.log_text || '-').slice(0, 6000)}

한국어로 verdict, summary, 미확인 항목(unverified), 원인 후보(causes: 근거와 가능성), 개선안(improvements: 영역·우선순위·구체적 변경)을 작성한다.`;
    const analysis = await svc.integrations.Core.InvokeLLM({ prompt, response_json_schema: ANALYSIS_SCHEMA, model: MODEL, ...(file_urls.length ? { file_urls } : {}) });
    const ai_analysis = { ...analysis, analyzed_at: new Date().toISOString() };
    await svc.entities.ProtoTest.update(test.id, { ai_analysis });
    return Response.json({ ai_analysis });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}