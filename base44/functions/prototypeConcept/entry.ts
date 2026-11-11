import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { simulate } from '../../shared/protoSim.ts';
import { moldRuleChecks, MOLD_MATERIAL_KEYS } from '../../shared/protoMold.ts';
import { BRIEF_SCHEMA, SCENE_SCHEMA, SCENE_RULES, cleanScene, strList } from '../../shared/protoConcept.ts';
import { uploadPrivateAttachments } from '../../shared/privateAttachments.ts';

// 시제품 컨셉: 아이디어 정리(brief) → 미팅용 3D 프리뷰(generate·revise) → 렌더 이미지(render) → 회로 검토(circuit) → 사출·금형 검토(mold)
// 렌더 이미지는 처음 만들 때(generate)와 render 요청 때만 만든다. 변경(revise)은 형상만 새로 만들고 이전 렌더를 '이전 버전 기준'으로 남긴다.
// 결과는 모두 검토용 초안이며, 가정·미확인 항목을 따로 기록한다.
const MODEL = 'claude_opus_5_5';
const ACTIONS = ['brief', 'generate', 'revise', 'render', 'circuit', 'mold'];
const MAX_UPLOADS = 5;
const AI_FILE = /\.(png|jpe?g|webp|pdf)$/i;
const KINDS = ['ROTARY_MOTOR', 'SERVO', 'LINEAR', 'SOLENOID', 'PUMP_FAN', 'HEATER', 'LED', 'SENSOR', 'OTHER'];
const SEV = ['HIGH', 'MEDIUM', 'LOW'];
const MOLD_CATS = ['THICKNESS', 'SINK', 'DRAFT', 'GATE', 'UNDERCUT', 'WARP', 'WELD', 'EJECT', 'PARTING', 'FLOW', 'OTHER'];
const list = { type: 'array', items: { type: 'string' } };
const risks = { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: SEV }, title: { type: 'string' }, detail: { type: 'string' }, mitigation: { type: 'string' } } } };

const CIRCUIT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    blocks: { type: 'array', items: { type: 'object', properties: { block: { type: 'string' }, role: { type: 'string' } } } },
    components: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, name: { type: 'string' }, function: { type: 'string' }, voltage: { type: 'string' }, current: { type: 'string' }, verify_status: { type: 'string', enum: ['NEEDS_CHECK', 'ASSUMED'] }, basis: { type: 'string' } } } },
    connections: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, signal: { type: 'string' }, voltage: { type: 'string' }, note: { type: 'string' } } } },
    actuators: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, ref: { type: 'string' }, kind: { type: 'string', enum: KINDS }, rated_voltage_v: { type: 'number' }, rated_current_a: { type: 'number' }, idle_current_a: { type: 'number' }, value_source: { type: 'string', enum: ['USER', 'ASSUMED'] } } } },
    steps: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, duration_s: { type: 'number' }, trigger: { type: 'string' }, note: { type: 'string' }, states: { type: 'array', items: { type: 'object', properties: { actuator_id: { type: 'string' }, on: { type: 'boolean' }, duty_pct: { type: 'number' } } } } } } },
    risks, assumptions: list, unverified: list, limitations: list,
  },
};

const MOLD_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'CONDITIONAL', 'FAIL'] },
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: { part_id: { type: 'string' }, location: { type: 'string' }, category: { type: 'string', enum: MOLD_CATS }, severity: { type: 'string', enum: SEV }, title: { type: 'string' }, basis: { type: 'string' }, recommendation: { type: 'string' }, needs_vendor_check: { type: 'boolean' } } } },
    gate_candidates: { type: 'array', items: { type: 'object', properties: { part_id: { type: 'string' }, location: { type: 'string' }, type: { type: 'string' }, reason: { type: 'string' }, constraint: { type: 'string' } } } },
    parting_line: { type: 'string' },
    assumptions: list, unverified: list, vendor_checks: list,
  },
};

const str = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const notFound = (e) => (e.status === 404 ? null : Promise.reject(e));
const partBrief = (parts) => JSON.stringify((parts || []).map((p) => ({ id: p.id, name: p.name, role: p.role, layer: p.layer, shape: p.shape, size: p.size, position: p.position, material: p.material })));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    if (!ACTIONS.includes(action)) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const svc = base44.asServiceRole;
    const by = user.full_name || user.email;
    const rid = typeof body.request_id === 'string' ? body.request_id.slice(0, 80) : null;
    const now = () => new Date().toISOString();
    const llm = (prompt, schema, file_urls) => svc.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema, model: MODEL, ...(file_urls?.length ? { file_urls } : {}) });
    // 사용자 권한으로 읽어 팀 격리(RLS)를 지킨다
    const loadProject = async (id) => {
      const p = await base44.entities.ProtoProject.get(id).catch(notFound);
      return p?.tenant_id && (user.account_tier === 'master' || p.tenant_id === user.tenant_id) ? p : null;
    };
    const nextNo = async (projectId) => Math.max(0, ...(await base44.entities.ProtoConcept.filter({ project_id: projectId }, '-version_no', 100)).map((c) => Number(c.version_no) || 0)) + 1;
    // 참고 사진이 있으면 렌더 이미지가 그 형태·비율을 따르게 한다
    const renderImage = (text: string, refs: string[] = []) => svc.integrations.Core.GenerateImage({
      prompt: `Photorealistic industrial design concept render of a single product, three-quarter view, soft studio lighting, clean light gray seamless background, no text, no logos, no people.${refs.length ? ' Match the shape, proportions and details shown in the attached reference images.' : ''} Product: ${text.slice(0, 1500)}`,
      ...(refs.length ? { existing_image_urls: refs } : {}),
    });
    // 참고 자료: 프로젝트에 올린 사진·도면을 AI 가 읽을 수 있게 서명 링크로 바꾼다 (최근에 올린 것부터 6개)
    const refFiles = (p) => (p?.files || []).filter((f) => f.uri && AI_FILE.test(f.name || '') && ['DRAWING', 'PHOTO', 'REFERENCE', 'SCHEMATIC', 'MOLD_DRAWING'].includes(f.category)).slice(-6);
    const photoFiles = (p) => refFiles(p).filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name || '') && ['PHOTO', 'REFERENCE'].includes(f.category)).slice(-3);
    // 새로 올린 참고 자료는 서버가 직접 비공개 저장소에 올린다 (화면이 보낸 파일 주소는 받지 않는다)
    const saveUploads = async () => {
      const uploads = (Array.isArray(body.uploads) ? body.uploads : []).filter((u) => AI_FILE.test(str(u?.name, 200))).slice(0, MAX_UPLOADS);
      return (await uploadPrivateAttachments(svc, uploads)).map((a) => ({
        id: crypto.randomUUID(), name: a.name, uri: a.url, category: 'REFERENCE', size: a.size, version_no: null, note: '컨셉 참고 자료',
        uploaded_at: now(), uploaded_by_name: by,
      }));
    };
    // 프로젝트 파일에 넣어 이후 형상·렌더·검토 단계에서도 쓴다
    const addUploads = async (p) => {
      const added = await saveUploads();
      return added.length ? { project: await svc.entities.ProtoProject.update(p.id, { files: [...(p.files || []), ...added] }), added } : { project: p, added };
    };
    const refUrls = async (list) => (await Promise.allSettled(list.map((f) => svc.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri, expires_in: 900 }))))
      .filter((r) => r.status === 'fulfilled' && r.value?.signed_url).map((r) => r.value.signed_url);

    // ── 1. 아이디어 정리: 확인 질문과 가정을 뽑는다 (아직 아무것도 확정하지 않는다)
    if (action === 'brief') {
      const idea = str(body.idea, 4000).trim();
      if (idea.length < 5) return Response.json({ error: '아이디어를 입력해 주세요.' }, { status: 400 });
      const known = str(body.known_info, 3000).trim();
      let project = null;
      if (body.project_id) {
        project = await loadProject(body.project_id);
        if (!project) return Response.json({ error: '시제품을 찾을 수 없습니다.' }, { status: 404 });
      } else if (!user.tenant_id) return Response.json({ error: '소속 팀이 없어 시제품을 만들 수 없습니다.' }, { status: 400 });
      const newFiles = await saveUploads();
      const attach = [...refFiles(project), ...newFiles];
      const attachUrls = await refUrls(attach);
      const attachNames = attach.map((f) => f.name).join(', ') || '없음';

      const ai = await llm(`너는 제품 개발 PM이다. 고객 미팅에서 보여 줄 컨셉 3D 시각화를 만들기 전에 아이디어를 정리한다.

[아이디어] ${idea}
[사용자가 알려 준 정보] ${known || '없음'}
[첨부 자료] ${attachNames}
${project ? `[시제품 요구사항] 목표: ${project.goal || '-'} / 사용 조건: ${project.use_conditions || '-'} / 전원: ${project.power_requirements || '-'} / 입출력: ${project.io_requirements || '-'} / 제약: ${project.constraints || '-'}` : ''}

규칙:
- 한국어. title 은 제품을 부르는 짧은 이름, summary 는 이해한 내용 2~3문장.
- 첨부 자료가 있으면 그 안의 치수·형태·표기·재질을 먼저 읽고 아이디어 이해에 반영한다. 자료에서 확인한 내용은 summary 에 적고, 자료가 없어 추정한 부분은 assumptions 에 쓴다. 자료에 없는 치수를 지어내지 않는다.
- questions: 형상·크기·재료·전원·입출력·사용 환경 중 결과를 크게 바꾸는데 아직 모르는 조건만 최대 6개. 사용자가 이미 말한 것은 묻지 않는다. why 는 왜 필요한지 한 줄, default_assumption 은 답이 없을 때 둘 기본 가정.
- assumptions: 질문과 별개로 네가 전제한 내용. 사실처럼 쓰지 말고 '~로 가정' 형태로 쓴다.`, BRIEF_SCHEMA, attachUrls);

      if (!project) {
        project = await base44.entities.ProtoProject.create({
          tenant_id: user.tenant_id, title: str(body.title, 120).trim() || str(ai?.title, 120) || idea.slice(0, 40), goal: idea, stage: 'REQUIREMENTS',
          owner_id: user.id, owner_name: by, files: newFiles, open_risk_count: 0,
        });
      } else if (newFiles.length) {
        const ids = new Set((project.files || []).map((f) => f.id));
        project = await svc.entities.ProtoProject.update(project.id, { files: [...(project.files || []), ...newFiles.filter((f) => !ids.has(f.id))] });
      }
      const concept = await svc.entities.ProtoConcept.create({
        tenant_id: project.tenant_id, project_id: project.id, version_no: await nextNo(project.id), status: 'BRIEF',
        title: str(body.title, 120).trim() || str(ai?.title, 120) || project.title, idea, known_info: known, brief_summary: str(ai?.summary, 1200),
        questions: (Array.isArray(ai?.questions) ? ai.questions : []).filter((q) => q?.question).slice(0, 6).map((q, i) => ({ id: `q${i + 1}`, question: str(q.question, 300), why: str(q.why, 300), default_assumption: str(q.default_assumption, 300), answer: '' })),
        assumptions: strList(ai?.assumptions), created_by_name: by, last_request_id: rid,
      });
      return Response.json({ concept, project_id: project.id, link: `/prototypes/${project.id}/concept`, next: '질문에 답을 받고 사용자가 확인하면 action=generate 로 3D 프리뷰를 만듭니다. 답이 없는 질문은 default_assumption 이 가정으로 쓰입니다.' });
    }

    const concept = body.concept_id ? await base44.entities.ProtoConcept.get(body.concept_id).catch(notFound) : null;
    if (!concept) return Response.json({ error: '컨셉을 찾을 수 없습니다.' }, { status: 404 });
    let project = await loadProject(concept.project_id);
    if (!project || project.tenant_id !== concept.tenant_id) return Response.json({ error: '시제품을 찾을 수 없습니다.' }, { status: 404 });
    const link = `/prototypes/${project.id}/concept`;
    const conditions = (qs) => (qs || []).map((q) => (q.answer ? `- ${q.question} → ${q.answer} (사용자 확인)` : `- ${q.question} → ${q.default_assumption || '미정'} (가정)`)).join('\n') || '없음';
    const briefText = (qs) => `[아이디어] ${concept.idea || project.goal || project.title}
[사용자가 알려 준 정보] ${concept.known_info || '없음'}
[조건]
${conditions(qs)}
[AI가 둔 가정] ${(concept.assumptions || []).join(' / ') || '없음'}`;

    // ── 2. 사용자가 조건을 확인한 뒤 미팅용 3D 프리뷰를 만든다
    if (action === 'generate') {
      const answers = Array.isArray(body.answers) ? body.answers : [];
      const questions = (concept.questions || []).map((q) => { const a = answers.find((x) => x?.id === q.id); return { ...q, answer: a ? str(a.answer, 500).trim() : (q.answer || '') }; });
      ({ project } = await addUploads(project));
      const genFiles = refFiles(project);
      const photoUrls = await refUrls(photoFiles(project));
      const [sceneR, imgR] = await Promise.allSettled([
        llm(`너는 산업 디자이너다. 아래 아이디어를 기본 도형 부품으로 조립한 3D 컨셉 형상으로 만든다.\n\n${briefText(questions)}\n[첨부 자료] ${genFiles.map((f) => f.name).join(', ') || '없음'}\n\n${SCENE_RULES}\n- (가정)으로 표시된 조건을 쓴 부분은 assumptions 에 다시 적는다.\n- 첨부 자료의 치수·비율·형태를 형상에 반영한다. 자료에 없는 치수는 지어내지 않고 가정으로 둔다.`, SCENE_SCHEMA, await refUrls(genFiles)),
        renderImage(`${concept.idea}. ${concept.known_info || ''} ${questions.filter((q) => q.answer).map((q) => q.answer).join(', ')}`, photoUrls),
      ]);
      if (sceneR.status !== 'fulfilled') throw sceneR.reason;
      const scene = cleanScene(sceneR.value);
      if (!scene.parts.length) return Response.json({ error: '3D 형상을 만들지 못했습니다. 아이디어를 조금 더 구체적으로 적어 다시 시도해 주세요.' }, { status: 422 });
      const preview = { title: concept.title, ...scene, render_url: imgR.status === 'fulfilled' ? imgR.value?.url || '' : '', render_version: concept.version_no, render_error: imgR.status === 'rejected' ? String(imgR.reason?.message || imgR.reason).slice(0, 200) : '', generated_at: now(), generated_by_name: by };
      const saved = await svc.entities.ProtoConcept.update(concept.id, { questions, preview, status: 'READY', confirmed_at: now(), confirmed_by_name: by, last_request_id: rid });
      return Response.json({ concept: saved, link, summary: scene.summary, part_count: scene.parts.length, next: '컨셉 스튜디오(link)에서 3D 프리뷰를 확인하고 회로 검토와 사출·금형 검토를 실행합니다. 미팅용 개념 시각화이며 CAD 가 아닙니다.' });
    }

    // ── 3. 변경 요청 → 새 버전
    if (action === 'revise') {
      const hasUploads = Array.isArray(body.uploads) && body.uploads.length > 0;
      const change = str(body.change_request, 2000).trim() || (hasUploads ? '새로 첨부한 자료의 형태·치수에 맞춰 형상을 수정' : '');
      if (!change) return Response.json({ error: '변경 요청을 입력해 주세요.' }, { status: 400 });
      if (!concept.preview?.parts?.length) return Response.json({ error: '먼저 3D 프리뷰를 만들어 주세요.' }, { status: 400 });
      const up = await addUploads(project);
      project = up.project;
      const addedNames = up.added.map((f) => f.name).join(', ');
      const [sceneR] = await Promise.allSettled([
        llm(`너는 산업 디자이너다. 기존 3D 컨셉 형상에 변경 요청을 반영한 새 형상 전체를 만든다.\n\n${briefText(concept.questions)}\n[첨부 자료] ${refFiles(project).map((f) => f.name).join(', ') || '없음'}\n[이번 변경 요청과 함께 새로 첨부한 자료] ${addedNames || '없음'}\n[기존 형상 v${concept.version_no}] ${JSON.stringify({ overall_mm: concept.preview.overall_mm, parts: concept.preview.parts }).slice(0, 14000)}\n[변경 요청] ${change}\n\n${SCENE_RULES}\n- 변경 요청과 관계없는 부품은 그대로 둔다. change_summary 에 무엇을 어떻게 바꿨는지 쓴다.\n- 새로 첨부한 자료가 있으면 그 사진·도면의 형태·비율·치수·표기를 먼저 읽고 형상을 그에 맞게 고친다. 자료에서 읽은 내용은 change_summary 에, 자료에 없어 추정한 치수는 assumptions 에 적는다.`, SCENE_SCHEMA, await refUrls(refFiles(project))),
      ]);
      if (sceneR.status !== 'fulfilled') throw sceneR.reason;
      const scene = cleanScene(sceneR.value);
      if (!scene.parts.length) return Response.json({ error: '변경한 3D 형상을 만들지 못했습니다. 요청을 조금 더 구체적으로 적어 주세요.' }, { status: 422 });
      const created = await svc.entities.ProtoConcept.create({
        tenant_id: project.tenant_id, project_id: project.id, version_no: await nextNo(project.id), based_on_id: concept.id, change_request: change, status: 'READY',
        title: concept.title, idea: concept.idea, known_info: concept.known_info, brief_summary: concept.brief_summary, questions: concept.questions || [], assumptions: concept.assumptions || [],
        confirmed_at: now(), confirmed_by_name: by, created_by_name: by, last_request_id: rid,
        // 렌더 이미지는 다시 만들지 않는다. 이전 렌더를 남기고 어느 버전 기준인지 표시한다 (필요하면 action=render)
        preview: { title: concept.title, ...scene, render_url: concept.preview.render_url || '', render_version: concept.preview.render_url ? (concept.preview.render_version ?? concept.version_no) : null, render_error: '', generated_at: now(), generated_by_name: by },
        // 이전 검토는 참고용으로 넘기되 '형상이 바뀜' 표시를 붙인다
        ...(concept.circuit ? { circuit: { ...concept.circuit, stale: true } } : {}),
        ...(concept.mold ? { mold: { ...concept.mold, stale: true } } : {}),
      });
      return Response.json({ concept: created, link, change_summary: scene.change_summary });
    }

    // ── 3-1. 렌더 이미지: 사용자가 요청할 때만 지금 버전의 형상 설명으로 다시 만든다
    if (action === 'render') {
      if (!concept.preview?.parts?.length) return Response.json({ error: '먼저 3D 프리뷰를 만들어 주세요.' }, { status: 400 });
      const answers = (concept.questions || []).filter((q) => q.answer).map((q) => q.answer).join(', ');
      const parts = concept.preview.parts.filter((p) => p.layer === 'SHELL' || p.layer === 'UI').slice(0, 12).map((p) => `${p.name}(${p.shape}, ${p.color}${p.material ? `, ${p.material}` : ''})`).join(', ');
      const text = `${concept.idea}. ${concept.known_info || ''} ${answers}. ${concept.preview.summary || ''}${concept.change_request ? ` Latest change: ${concept.change_request}.` : ''} Visible parts: ${parts}`;
      try {
        const img = await renderImage(text, await refUrls(photoFiles(project)));
        if (!img?.url) throw new Error('이미지 주소를 받지 못했습니다');
        const saved = await svc.entities.ProtoConcept.update(concept.id, { preview: { ...concept.preview, render_url: img.url, render_version: concept.version_no, render_error: '' }, last_request_id: rid });
        return Response.json({ concept: saved, link });
      } catch (e) {
        await svc.entities.ProtoConcept.update(concept.id, { preview: { ...concept.preview, render_error: String(e?.message || e).slice(0, 200) } }).catch(() => {});
        return Response.json({ error: `렌더 이미지를 만들지 못했습니다: ${String(e?.message || e).slice(0, 120)}` }, { status: 502 });
      }
    }

    // ── 4. 회로 구성 제안 + 정격값 기반 동작 계산
    if (action === 'circuit') {
      const inp = body.inputs || {};
      const V = num(inp.supply_voltage_v);
      if (!(V > 0)) return Response.json({ error: '공급 전압을 입력해 주세요.' }, { status: 400 });
      const inputs = { supply_voltage_v: V, supply_limit_a: num(inp.supply_limit_a), power_source: str(inp.power_source, 500), components: str(inp.components, 3000), io: str(inp.io, 2000), scenario: str(inp.scenario, 3000) };
      const ai = await llm(`너는 전자 회로 설계 엔지니어다. 컨셉 단계 제품의 회로 구성을 제안하고, 앱이 정격값으로 계산할 수 있게 전기 부하와 동작 단계를 정리한다.

${briefText(concept.questions)}
[컨셉 부품] ${partBrief((concept.preview?.parts || []).filter((p) => p.layer !== 'SHELL'))}
[전원] 공급 ${V}V, 허용 전류 ${inputs.supply_limit_a ?? '미입력'}A, 전원 종류: ${inputs.power_source || '미입력'}
[사용자가 정한 부품] ${inputs.components || '미입력'}
[입출력] ${inputs.io || project.io_requirements || '미입력'}
[동작 시나리오] ${inputs.scenario || '미입력 — 대표적인 사용 순서를 제안하고 assumptions 에 적는다'}

규칙:
- 한국어. blocks 는 회로 블록과 역할, components 는 주요 부품(선정 근거 basis 포함), connections 는 신호·전원 연결.
- components.verify_status: 데이터시트 확인이 필요하면 NEEDS_CHECK, 추정이면 ASSUMED. 확정이라고 쓰지 않는다.
- actuators: 전류를 쓰는 부하(모터·팬·히터·LED·솔레노이드·MCU·센서 등). id 는 a1, a2… rated_voltage_v·rated_current_a·idle_current_a 는 사용자가 준 값이면 value_source=USER, 네가 일반적인 값으로 정했으면 ASSUMED 로 두고 assumptions 에도 적는다. 전혀 알 수 없으면 값을 비운다.
- steps: 동작 시나리오를 순서대로 3~10단계. 각 단계의 states 에 켜지는 부하를 {actuator_id, on, duty_pct} 로 쓴다. note 는 그 단계에서 일어나는 전기 동작.
- 수치를 계산하지 않는다(전류 합계·전력은 앱이 계산한다). 돌입 전류·과도 응답·발열처럼 이 계산이 다루지 않는 것은 limitations 에, 입력에 없어 판단 못 한 것은 unverified 에 쓴다.
- risks: 회로 구성에서 보이는 위험과 대응.`, CIRCUIT_SCHEMA);

      const idMap = {};
      const actuators = (Array.isArray(ai?.actuators) ? ai.actuators : []).slice(0, 30).map((a, i) => {
        const id = `a${i + 1}`;
        if (a?.id) idMap[a.id] = id;
        return { id, label: str(a?.label, 80) || `부하 ${i + 1}`, ref: str(a?.ref, 40), kind: KINDS.includes(a?.kind) ? a.kind : 'OTHER', rated_voltage_v: num(a?.rated_voltage_v), rated_current_a: num(a?.rated_current_a), idle_current_a: num(a?.idle_current_a), value_source: a?.value_source === 'USER' ? 'USER' : 'ASSUMED', motion: 'NONE' };
      });
      const steps = (Array.isArray(ai?.steps) ? ai.steps : []).slice(0, 40).map((s, i) => ({
        id: `s${i + 1}`, name: str(s?.name, 80) || `단계 ${i + 1}`, duration_s: num(s?.duration_s) || 1, trigger: str(s?.trigger, 200), note: str(s?.note, 600),
        states: (Array.isArray(s?.states) ? s.states : []).filter((x) => idMap[x?.actuator_id]).map((x) => ({ actuator_id: idMap[x.actuator_id], on: !!x.on, duty_pct: num(x.duty_pct) })),
      }));
      const { tracks, ...calc } = simulate({ supply_voltage_v: V, supply_limit_a: inputs.supply_limit_a, actuators, steps });
      const pickRows = (v, keys, max = 40) => (Array.isArray(v) ? v : []).slice(0, max).map((r) => Object.fromEntries(keys.map((k) => [k, str(r?.[k], 400)])));
      const circuit = {
        inputs, summary: str(ai?.summary, 1500), blocks: pickRows(ai?.blocks, ['block', 'role'], 20),
        components: pickRows(ai?.components, ['ref', 'name', 'function', 'voltage', 'current', 'verify_status', 'basis']),
        connections: pickRows(ai?.connections, ['from', 'to', 'signal', 'voltage', 'note'], 60),
        actuators, steps, calc,
        risks: (Array.isArray(ai?.risks) ? ai.risks : []).slice(0, 20).map((r) => ({ severity: SEV.includes(r?.severity) ? r.severity : 'MEDIUM', title: str(r?.title, 200), detail: str(r?.detail, 600), mitigation: str(r?.mitigation, 600) })),
        assumptions: strList(ai?.assumptions), unverified: strList(ai?.unverified), limitations: strList(ai?.limitations),
        stale: false, generated_at: now(), generated_by_name: by,
      };
      const saved = await svc.entities.ProtoConcept.update(concept.id, { circuit, last_request_id: rid });
      return Response.json({ concept: saved, link });
    }

    // ── 5. 사출·금형 검토 초안: 규칙 계산 + AI 위치별 검토
    const inp = body.inputs || {};
    const inputs = {
      material: MOLD_MATERIAL_KEYS.includes(inp.material) ? inp.material : 'ABS',
      length_mm: num(inp.length_mm), width_mm: num(inp.width_mm), height_mm: num(inp.height_mm),
      wall_mm: num(inp.wall_mm), wall_max_mm: num(inp.wall_max_mm), wall_min_mm: num(inp.wall_min_mm), rib_mm: num(inp.rib_mm),
      draft_deg: num(inp.draft_deg), texture_depth_mm: num(inp.texture_depth_mm) || 0,
      undercuts: str(inp.undercuts, 500), structure: str(inp.structure, 3000), conditions: str(inp.conditions, 1000),
    };
    const rules = moldRuleChecks(inputs);
    const fileIds = Array.isArray(inp.file_ids) ? inp.file_ids : [];
    const files = (project.files || []).filter((f) => fileIds.includes(f.id) && AI_FILE.test(f.name || '') && f.uri).slice(0, 4);
    const signed = await Promise.allSettled(files.map((f) => svc.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri, expires_in: 900 })));
    const file_urls = signed.filter((r) => r.status === 'fulfilled' && r.value?.signed_url).map((r) => r.value.signed_url);
    const shellParts = (concept.preview?.parts || []).filter((p) => p.layer === 'SHELL' || p.layer === 'UI');

    const ai = await llm(`너는 사출 금형 설계 엔지니어다. 컨셉 단계 제품을 사출 성형으로 만들 때 걸리는 부분을 위치별로 찾아 해결안을 낸다.

${briefText(concept.questions)}
[사출 대상 형상 부품 — part_id 로 쓸 id] ${partBrief(shellParts)}
[입력 조건] ${JSON.stringify(inputs)}
[앱 규칙 계산 결과 — 일반 설계 기준과 비교한 값] ${JSON.stringify(rules)}
[첨부 도면] ${files.map((f) => f.name).join(', ') || '없음'}

규칙:
- 한국어. findings 는 문제 위치마다 하나씩: 두께 편차·수축(싱크·보이드), 구배 부족, 게이트 위치 제약, 언더컷, 변형, 웰드라인, 취출(이젝터 자국), 파팅라인 등 사출과 금형 제작에서 걸리는 것을 모두 본다.
- part_id 는 위 형상 부품의 id 중 해당하는 것, 특정 부품이 아니면 빈 문자열. location 은 그 부품의 어느 부분인지.
- basis 에는 입력 수치나 앱 규칙 계산 결과를 근거로 쓴다. 충전 압력·냉각 시간·변형량 같은 새 수치를 지어내지 않는다. 규칙 계산이 이미 찾은 문제는 위치와 해결안을 구체화한다.
- recommendation 은 형상·금형에서 어떻게 고치는지 구체적으로 (예: 살 빼기, 리브 두께, 구배 값, 슬라이드 방향).
- gate_candidates 는 1~3개: 위치, 방식(사이드·핀포인트·서브마린·핫러너 등), 이유, 위치 제약(외관면·웰드라인·두꺼운 곳에서 얇은 곳으로 흐름).
- 형상이 기본 도형 수준이라 판단할 수 없는 것은 unverified 에, 금형 업체가 실제 금형 설계·유동 해석으로 확인해야 하는 것은 vendor_checks 에 쓰고 해당 finding 은 needs_vendor_check=true.
- verdict: 그대로 진행 가능 PASS, 보완 후 진행 CONDITIONAL, 형상 재검토 필요 FAIL. 이 결과는 검토 초안이다.`, MOLD_SCHEMA, file_urls);

    const partIds = new Set((concept.preview?.parts || []).map((p) => p.id));
    const mold = {
      inputs, rules, verdict: ['PASS', 'CONDITIONAL', 'FAIL'].includes(ai?.verdict) ? ai.verdict : 'CONDITIONAL', summary: str(ai?.summary, 1500),
      findings: (Array.isArray(ai?.findings) ? ai.findings : []).slice(0, 30).map((f, i) => ({
        id: `f${i + 1}`, part_id: partIds.has(f?.part_id) ? f.part_id : '', location: str(f?.location, 200), category: MOLD_CATS.includes(f?.category) ? f.category : 'OTHER',
        severity: SEV.includes(f?.severity) ? f.severity : 'MEDIUM', title: str(f?.title, 200), basis: str(f?.basis, 800), recommendation: str(f?.recommendation, 800), needs_vendor_check: !!f?.needs_vendor_check,
      })),
      gate_candidates: (Array.isArray(ai?.gate_candidates) ? ai.gate_candidates : []).slice(0, 4).map((g) => ({ part_id: partIds.has(g?.part_id) ? g.part_id : '', location: str(g?.location, 200), type: str(g?.type, 80), reason: str(g?.reason, 500), constraint: str(g?.constraint, 500) })),
      parting_line: str(ai?.parting_line, 600),
      assumptions: strList(ai?.assumptions), unverified: strList(ai?.unverified), vendor_checks: strList(ai?.vendor_checks),
      files: files.map((f) => ({ id: f.id, name: f.name })), stale: false, generated_at: now(), generated_by_name: by,
    };
    const saved = await svc.entities.ProtoConcept.update(concept.id, { mold, last_request_id: rid });
    return Response.json({ concept: saved, link });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}