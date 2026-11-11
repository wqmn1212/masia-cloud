import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { simulate } from '../../shared/protoSim.ts';
import { moldRuleChecks, MOLD_MATERIAL_KEYS } from '../../shared/protoMold.ts';
import { BRIEF_SCHEMA, SCENE_SCHEMA, SCENE_RULES, cleanScene, strList } from '../../shared/protoConcept.ts';
import { VISION_PROMPT, VISION_SCHEMA, MAX_VISION_IMAGES, imageSize, b64Bytes, cleanVision, measureVision, visionHint, fitScene } from '../../shared/protoVision.ts';
import { uploadPrivateAttachments } from '../../shared/privateAttachments.ts';

// 시제품 컨셉: 아이디어 정리(brief) → 미팅용 3D 프리뷰(generate·revise) → 렌더 이미지(render) → 회로 검토(circuit) → 사출·금형 검토(mold)
// 렌더 이미지는 형상과 따로 render 요청으로 만든다 (형상 생성과 한 요청에 묶으면 실행 시간 제한에 걸린다).
// generate 와 사진을 첨부한 revise 는 preview.render_pending 을 켜 두고, 화면(또는 AI 비서)이 이어서 render 를 호출한다.
// 사진 없이 바꾼 revise 는 이전 렌더를 '이전 버전 기준'으로 남긴다.
// 결과는 모두 검토용 초안이며, 가정·미확인 항목을 따로 기록한다.
const MODEL = 'claude_opus_5_5';
// 3D 형상과 렌더 이미지 설명처럼 이미지를 다루는 단계는 이 모델로 만든다
const IMAGE_MODEL = 'gpt_6_astra';
const ACTIONS = ['brief', 'generate', 'revise', 'render', 'circuit', 'mold'];
const MAX_UPLOADS = 5;
const AI_FILE = /\.(png|jpe?g|webp|pdf)$/i;
const PHOTO_FILE = /\.(png|jpe?g|webp)$/i;
// base64 문자열의 실제 바이트 수 (같은 파일을 다시 올렸는지 비교용)
const b64Size = (d) => (typeof d === 'string' ? Math.floor((d.length * 3) / 4) - (d.endsWith('==') ? 2 : d.endsWith('=') ? 1 : 0) : 0);
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
// #RRGGBB → 이미지 생성용 색 이름 (예: light warm gray)
const colorName = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const tone = l > 0.85 ? 'very light' : l > 0.65 ? 'light' : l > 0.4 ? 'medium' : l > 0.2 ? 'dark' : 'very dark';
  if (d < 0.03) return l > 0.93 ? 'white' : l < 0.1 ? 'black' : `${tone} neutral gray`;
  const h = ((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
  if (d < 0.15) return `${tone} ${h < 90 || h > 300 ? 'warm' : 'cool'} gray`;
  const hue = h < 20 ? 'red' : h < 45 ? 'orange' : h < 70 ? 'yellow' : h < 165 ? 'green' : h < 200 ? 'cyan' : h < 260 ? 'blue' : h < 300 ? 'purple' : h < 340 ? 'pink' : 'red';
  return `${tone} ${hue}`;
};
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
    const llm = (prompt, schema, file_urls, model = MODEL) => svc.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema, model, ...(file_urls?.length ? { file_urls } : {}) });
    // 사용자 권한으로 읽어 팀 격리(RLS)를 지킨다
    const loadProject = async (id) => {
      const p = await base44.entities.ProtoProject.get(id).catch(notFound);
      return p?.tenant_id && (user.account_tier === 'master' || p.tenant_id === user.tenant_id) ? p : null;
    };
    const nextNo = async (projectId) => Math.max(0, ...(await base44.entities.ProtoConcept.filter({ project_id: projectId }, '-version_no', 100)).map((c) => Number(c.version_no) || 0)) + 1;
    // 렌더 이미지: AI 가 형상·자료를 읽어 쓴 외형 설명(renderPrompt)으로 만든다.
    // 사용자가 그 버전에 직접 첨부한 사진만 참고 이미지로 함께 넣는다. 도면·PDF 처럼 치수선·글자가 있는 자료는 넣지 않는다 (그림에 그대로 찍힌다)
    const renderImage = (text: string, refs: string[] = []) => svc.integrations.Core.GenerateImage({
      prompt: `Photorealistic industrial design concept render of a single product, three-quarter view, soft studio lighting, clean light gray seamless background, no people. A clean product photograph only: no callouts, dimension lines, arrows, captions, spec labels or any overlay text anywhere; the only lettering allowed is what is physically printed or displayed on the product itself.${refs.length ? ' Use the attached reference photo as the visual guide for the product\'s shape, proportions, colors, materials and finish, and follow the description below where they differ. Do not copy any background, hands, text, arrows or annotations from the reference.' : ''} Product: ${text.slice(0, 2800)}`,
      ...(refs.length ? { existing_image_urls: refs } : {}),
    });
    // 참고 자료: 프로젝트에 올린 사진·도면을 AI 가 읽을 수 있게 서명 링크로 바꾼다 (최근에 올린 것부터 6개)
    const refFiles = (p) => (p?.files || []).filter((f) => f.uri && AI_FILE.test(f.name || '') && ['DRAWING', 'PHOTO', 'REFERENCE', 'SCHEMATIC', 'MOLD_DRAWING'].includes(f.category)).slice(-6);
    // 새로 올린 참고 자료는 서버가 직접 비공개 저장소에 올린다 (화면이 보낸 파일 주소는 받지 않는다)
    const saveUploads = async (list?) => {
      const uploads = list || (Array.isArray(body.uploads) ? body.uploads : []).filter((u) => AI_FILE.test(str(u?.name, 200))).slice(0, MAX_UPLOADS);
      return (await uploadPrivateAttachments(svc, uploads)).map((a) => {
        // 사진은 픽셀 크기를 같이 남긴다 (이미지 측정에 쓴다)
        const src = uploads.find((u) => str(u?.name, 200) === a.name);
        const px = PHOTO_FILE.test(a.name) && src ? imageSize(b64Bytes(src.data)) : null;
        return {
          id: crypto.randomUUID(), name: a.name, uri: a.url, category: 'REFERENCE', size: a.size, version_no: null, note: '컨셉 참고 자료',
          uploaded_at: now(), uploaded_by_name: by, ...(px ? { width_px: px.w, height_px: px.h } : {}),
        };
      });
    };
    // 프로젝트 파일에 넣어 이후 형상·렌더·검토 단계에서도 쓴다.
    // 실패 후 같은 파일로 다시 시도해도 두 번 저장하지 않는다: 이름·크기가 같은 기존 파일은 그대로 다시 쓴다
    const addUploads = async (p) => {
      const files = p.files || [];
      const same = (u) => files.find((f) => f.name === str(u?.name, 200) && Number(f.size) === b64Size(u?.data) && f.note === '컨셉 참고 자료');
      const list = (Array.isArray(body.uploads) ? body.uploads : []).filter((u) => AI_FILE.test(str(u?.name, 200))).slice(0, MAX_UPLOADS);
      const reused = list.map(same).filter(Boolean);
      const fresh = await saveUploads(list.filter((u) => !same(u)));
      const added = [...reused, ...fresh];
      return { project: fresh.length ? await svc.entities.ProtoProject.update(p.id, { files: [...files, ...fresh] }) : p, added };
    };
    // 이번 요청에 올린 사진 → 렌더 참고 이미지로 쓸 파일 id
    const photoIds = (added) => added.filter((f) => PHOTO_FILE.test(f.name || '')).map((f) => f.id).slice(0, 3);
    // 이미지 분석: AI 는 시점·위치 상자·적힌 치수만 기록하고, 비율·위치 계산은 앱이 한다 (protoVision.ts)
    const analyzeImages = async (files) => {
      const imgs = files.filter((f) => f.uri && PHOTO_FILE.test(f.name || '')).slice(-MAX_VISION_IMAGES);
      if (!imgs.length) return null;
      const list = [];
      for (const f of imgs) {
        const url = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri, expires_in: 900 }).then((r) => r?.signed_url || null).catch(() => null);
        if (!url) continue;
        let file = f;
        // 픽셀 크기가 없는 예전 파일은 앞부분만 받아 머리말에서 읽는다
        if (!(Number(f.width_px) > 0)) {
          const px = await fetch(url, { headers: { Range: 'bytes=0-262143' } }).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? imageSize(new Uint8Array(b)) : null)).catch(() => null);
          if (px) file = { ...f, width_px: px.w, height_px: px.h };
        }
        list.push({ file, url });
      }
      if (!list.length) return null;
      try {
        const vision = cleanVision(await llm(VISION_PROMPT, VISION_SCHEMA, list.map((x) => x.url), IMAGE_MODEL), list.map((x) => x.file));
        return { vision, measure: measureVision(vision), names: list.map((x) => x.file.name) };
      } catch (e) {
        return { vision: null, measure: null, names: list.map((x) => x.file.name), error: String(e?.message || e).slice(0, 160) };
      }
    };
    // 형상에 측정값을 맞추고 화면에 보여 줄 기록을 붙인다
    const applyVision = (scene, va) => {
      if (!va) return scene;
      if (!va.measure) return { ...scene, image_fit: { files: va.names, warnings: [`이미지 분석에 실패해 이미지 측정 없이 만들었습니다: ${va.error || '알 수 없는 오류'}`] } };
      const { scene: fitted, fit } = fitScene(scene, va.measure);
      return {
        ...fitted,
        image_fit: fit ? { ...fit, files: va.names, analyzed_at: now() } : { files: va.names, warnings: va.measure.warnings },
        vision_appearance: va.vision.appearance || '',
        vision_text: [...new Set(va.vision.images.flatMap((i) => i.product_text))].slice(0, 10),
      };
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
      // 기존 시제품이면 바로 프로젝트 파일에 넣는다 (같은 파일을 다시 올리면 기존 것을 쓴다)
      let newFiles;
      if (project) ({ project, added: newFiles } = await addUploads(project));
      else newFiles = await saveUploads();
      const attach = [...new Map([...refFiles(project), ...newFiles].map((f) => [f.id, f])).values()];
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
    // 렌더 이미지용 설명: 지금 버전의 형상(요약·변경 내용·겉으로 보이는 부품)을 앞에 두고, 처음 아이디어는 배경으로만 쓴다.
    // 처음 아이디어를 앞에 두면 이후 버전에서 바꾼 재질·버튼 배치가 렌더에 반영되지 않는다
    const renderText = (preview, change) => {
      const o = preview.overall_mm;
      // 색상 코드·치수를 그대로 넣으면 이미지에 글자로 찍힌다: 색은 이름으로, 크기는 비율로만 알려 준다
      const parts = (preview.parts || []).filter((p) => p.layer === 'SHELL' || p.layer === 'UI').slice(0, 14)
        .map((p) => `${p.name} [${p.shape}, proportions ${p.size.x}:${p.size.y}:${p.size.z}, ${colorName(p.color)}, ${p.finish}${p.material ? `, ${p.material}` : ''}]`).join('; ');
      return `${concept.title || ''}. CURRENT DESIGN (authoritative): ${str(preview.summary, 600)}${o ? ` Overall proportions width:height:depth = ${o.x}:${o.y}:${o.z}.` : ''}${change ? ` Latest change: ${str(change, 200)}. ${str(preview.change_summary, 500)}` : ''} Visible parts with exact colors and finishes: ${parts}. Background only, ignore wherever it conflicts with the current design: ${str(concept.idea, 300)}`;
    };
    // 렌더 프롬프트: AI 가 지금 형상 데이터와 참고 자료를 읽고 외형을 글로 풀어 쓴다 (실패하면 renderText 로 만든다)
    const renderPrompt = async (preview, change) => {
      const visible = (preview.parts || []).filter((p) => p.layer === 'SHELL' || p.layer === 'UI').slice(0, 20)
        .map((p) => ({ name: p.name, role: p.role, shape: p.shape, size: p.size, position: p.position, rotation_deg: p.rotation_deg, color: colorName(p.color), finish: p.finish, material: p.material }));
      const ai = await llm(`You write the text prompt for a photorealistic product render. Describe ONLY the final appearance of the product in plain English prose, 120 to 200 words: overall silhouette and proportions, every visible exterior part and exactly where it sits (front, back, side, top; on the main body or on the base), colors as plain color words, materials and finishes, and any lettering physically shown on the product (display digits, logo).

Rules:
- No dimensions, no numbers with units, no hex codes, no part ids, no callouts or annotations.
- The design data below is authoritative. Coordinates are in mm, Y is up, the origin is the center of the bottom face, +Z is the front.
- Attached reference files may be design sheets with notes, arrows and small photos of an older design. Use them only to understand the revised target look (shape, proportions, colors, materials). Never describe the notes or the older design.

[Product] ${concept.title || ''}
[Current design summary] ${str(preview.summary, 1200)}
[Latest change] ${str(change, 300) || 'none'} ${str(preview.change_summary, 1200)}
[Overall size] ${JSON.stringify(preview.overall_mm || {})}
[Visible parts] ${JSON.stringify(visible).slice(0, 9000)}${preview.vision_appearance ? `\n[Appearance read from the reference images] ${str(preview.vision_appearance, 1200)}` : ''}${preview.vision_text?.length ? `\n[Lettering on the product] ${preview.vision_text.join(', ')}` : ''}`, { type: 'object', properties: { description: { type: 'string' } } }, await refUrls(refFiles(project)), IMAGE_MODEL).catch(() => null);
      return str(ai?.description, 2500) || renderText(preview, change);
    };

    // ── 2. 사용자가 조건을 확인한 뒤 미팅용 3D 프리뷰를 만든다
    if (action === 'generate') {
      const answers = Array.isArray(body.answers) ? body.answers : [];
      const questions = (concept.questions || []).map((q) => { const a = answers.find((x) => x?.id === q.id); return { ...q, answer: a ? str(a.answer, 500).trim() : (q.answer || '') }; });
      const up = await addUploads(project);
      project = up.project;
      const genFiles = refFiles(project);
      const va = await analyzeImages(genFiles);
      const hint = va?.measure ? visionHint(va.vision, va.measure) : '';
      const [sceneR] = await Promise.allSettled([
        llm(`너는 산업 디자이너다. 아래 아이디어를 기본 도형 부품으로 조립한 3D 컨셉 형상으로 만든다.\n\n${briefText(questions)}\n[첨부 자료] ${genFiles.map((f) => f.name).join(', ') || '없음'}\n${hint}\n\n${SCENE_RULES}\n- (가정)으로 표시된 조건을 쓴 부분은 assumptions 에 다시 적는다.\n- 첨부 자료의 치수·비율·형태를 형상에 반영한다. 자료에 없는 치수는 지어내지 않고 가정으로 둔다.`, SCENE_SCHEMA, await refUrls(genFiles), IMAGE_MODEL),
      ]);
      if (sceneR.status !== 'fulfilled') throw sceneR.reason;
      const raw = cleanScene(sceneR.value);
      if (!raw.parts.length) return Response.json({ error: '3D 형상을 만들지 못했습니다. 아이디어를 조금 더 구체적으로 적어 다시 시도해 주세요.' }, { status: 422 });
      const scene = applyVision(raw, va);
      // 렌더 이미지는 이 형상이 저장된 뒤 render 로 만든다 (형상과 같은 모양이 되도록 형상 설명으로 만든다)
      const preview = { title: concept.title, ...scene, render_url: '', render_version: null, render_error: '', render_pending: true, render_ref_ids: photoIds(up.added), generated_at: now(), generated_by_name: by };
      const saved = await svc.entities.ProtoConcept.update(concept.id, { questions, preview, status: 'READY', confirmed_at: now(), confirmed_by_name: by, last_request_id: rid });
      return Response.json({ concept: saved, link, summary: scene.summary, part_count: scene.parts.length, render_pending: true, next: '이어서 action=render(concept_id)로 렌더 이미지를 만듭니다. 그다음 컨셉 스튜디오(link)에서 3D 프리뷰를 확인하고 회로 검토와 사출·금형 검토를 실행합니다. 미팅용 개념 시각화이며 CAD 가 아닙니다.' });
    }

    // ── 3. 변경 요청 → 새 버전
    if (action === 'revise') {
      const hasUploads = Array.isArray(body.uploads) && body.uploads.some((u) => AI_FILE.test(str(u?.name, 200)));
      const change = str(body.change_request, 2000).trim() || (hasUploads ? '새로 첨부한 자료의 형태·치수에 맞춰 형상을 수정' : '');
      if (!change) return Response.json({ error: '변경 요청을 입력해 주세요.' }, { status: 400 });
      if (!concept.preview?.parts?.length) return Response.json({ error: '먼저 3D 프리뷰를 만들어 주세요.' }, { status: 400 });
      const up = await addUploads(project);
      project = up.project;
      const refIds = photoIds(up.added);
      const addedNames = up.added.map((f) => f.name).join(', ');
      // 이번에 새로 첨부한 이미지만 측정한다 (글로만 바꾼 변경은 예전 사진에 다시 맞추지 않는다)
      const va = await analyzeImages(up.added);
      const hint = va?.measure ? visionHint(va.vision, va.measure) : '';
      const [sceneR] = await Promise.allSettled([
        llm(`너는 산업 디자이너다. 기존 3D 컨셉 형상에 변경 요청을 반영한 새 형상 전체를 만든다.\n\n${briefText(concept.questions)}\n[첨부 자료] ${refFiles(project).map((f) => f.name).join(', ') || '없음'}\n[이번 변경 요청과 함께 새로 첨부한 자료] ${addedNames || '없음'}\n[기존 형상 v${concept.version_no}] ${JSON.stringify({ overall_mm: concept.preview.overall_mm, parts: concept.preview.parts }).slice(0, 14000)}\n[변경 요청] ${change}\n${hint}\n\n${SCENE_RULES}\n- 변경 요청과 관계없는 부품은 그대로 둔다. change_summary 에 무엇을 어떻게 바꿨는지 쓴다.\n- 새로 첨부한 자료가 있으면 그 사진·도면의 형태·비율·치수·표기를 먼저 읽고 형상을 그에 맞게 고친다. 자료에서 읽은 내용은 change_summary 에, 자료에 없어 추정한 치수는 assumptions 에 적는다.`, SCENE_SCHEMA, await refUrls(refFiles(project)), IMAGE_MODEL),
      ]);
      if (sceneR.status !== 'fulfilled') throw sceneR.reason;
      const raw = cleanScene(sceneR.value);
      if (!raw.parts.length) return Response.json({ error: '변경한 3D 형상을 만들지 못했습니다. 요청을 조금 더 구체적으로 적어 주세요.' }, { status: 422 });
      const scene = applyVision(raw, va);
      const versionNo = await nextNo(project.id);
      // 렌더 이미지: 이전 렌더를 남겨 어느 버전 기준인지 표시한다. 사진을 첨부했으면 render_pending 을 켜고 이어서 render 로 그 사진을 참고해 다시 만든다
      const render = { render_url: concept.preview.render_url || '', render_version: concept.preview.render_url ? (concept.preview.render_version ?? concept.version_no) : null, render_error: '', render_pending: refIds.length > 0, render_ref_ids: refIds };
      const created = await svc.entities.ProtoConcept.create({
        tenant_id: project.tenant_id, project_id: project.id, version_no: versionNo, based_on_id: concept.id, change_request: change, status: 'READY',
        title: concept.title, idea: concept.idea, known_info: concept.known_info, brief_summary: concept.brief_summary, questions: concept.questions || [], assumptions: concept.assumptions || [],
        confirmed_at: now(), confirmed_by_name: by, created_by_name: by, last_request_id: rid,
        preview: { title: concept.title, ...scene, ...render, generated_at: now(), generated_by_name: by },
        // 이전 검토는 참고용으로 넘기되 '형상이 바뀜' 표시를 붙인다
        ...(concept.circuit ? { circuit: { ...concept.circuit, stale: true } } : {}),
        ...(concept.mold ? { mold: { ...concept.mold, stale: true } } : {}),
      });
      return Response.json({ concept: created, link, change_summary: scene.change_summary, render_pending: render.render_pending, ...(render.render_pending ? { next: '첨부한 사진으로 렌더 이미지를 다시 만들려면 이어서 action=render(concept_id=새 버전 id)를 호출합니다.' } : {}) });
    }

    // ── 3-1. 렌더 이미지: 사용자가 요청할 때만 지금 버전의 형상 설명으로 다시 만든다
    if (action === 'render') {
      if (!concept.preview?.parts?.length) return Response.json({ error: '먼저 3D 프리뷰를 만들어 주세요.' }, { status: 400 });
      try {
        // 그 버전에 첨부한 사진을 참고 이미지로 넣는다 (프로젝트 파일에 남아 있는 것만)
        const ids = Array.isArray(concept.preview.render_ref_ids) ? concept.preview.render_ref_ids : [];
        const photos = (project.files || []).filter((f) => ids.includes(f.id) && f.uri && PHOTO_FILE.test(f.name || ''));
        const img = await renderImage(await renderPrompt(concept.preview, concept.change_request), await refUrls(photos));
        if (!img?.url) throw new Error('이미지 주소를 받지 못했습니다');
        const saved = await svc.entities.ProtoConcept.update(concept.id, { preview: { ...concept.preview, render_url: img.url, render_version: concept.version_no, render_error: '', render_pending: false }, last_request_id: rid });
        return Response.json({ concept: saved, link });
      } catch (e) {
        await svc.entities.ProtoConcept.update(concept.id, { preview: { ...concept.preview, render_error: String(e?.message || e).slice(0, 200), render_pending: false } }).catch(() => {});
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