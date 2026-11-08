import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// 시제품 설계 검토: 등록한 회로도·사출 도면·부품표를 AI가 검토하고 기록으로 남긴다
const MODEL = 'claude_opus_5_5';
const IMAGE = /\.(png|jpe?g|webp|gif|pdf)$/i;
const TEXT = /\.(csv|tsv|txt|md|json|kicad_sch|net|xml)$/i;
const SHEET = /\.(xlsx|xls)$/i;
const REVIEW_CATS = ['SCHEMATIC', 'MOLD_DRAWING', 'BOM_FILE', 'PCB', 'DRAWING', 'CAD'];
const AREAS = ['CIRCUIT', 'MOLD', 'BOM'];
const sev = { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] };
const list = { type: 'array', items: { type: 'string' } };

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'CONDITIONAL', 'FAIL'] },
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: {
      area: { type: 'string', enum: ['CIRCUIT', 'MOLD', 'BOM', 'CROSS'] }, severity: sev, title: { type: 'string' },
      detail: { type: 'string' }, location: { type: 'string' }, recommendation: { type: 'string' } } } },
    bom_checks: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, part_no: { type: 'string' }, issue: { type: 'string' }, suggestion: { type: 'string' } } } },
    unverified: list,
    questions: list,
  },
};
const BOM_ROWS = { type: 'object', properties: { rows: { type: 'array', items: { type: 'object', properties: {
  ref: { type: 'string' }, name: { type: 'string' }, value: { type: 'string' }, part_no: { type: 'string' }, manufacturer: { type: 'string' }, qty: { type: 'number' }, footprint: { type: 'string' } } } } } };

const AREA_GUIDE = {
  CIRCUIT: '회로: 전원 계통(레귤레이터 입력 범위·발열·전류 여유), 디커플링, 보호 회로(역전압·ESD·퓨즈), 신호 레벨 호환, 풀업/풀다운, 리셋·부트 핀, 커넥터 핀아웃, 접지 분리',
  MOLD: '사출·금형: 살두께 균일성, 구배, 리브·보스 비율, 언더컷, 파팅라인, 게이트 위치, 웰드라인·싱크 위험, 공차·조립 간섭, 재질 수축률',
  BOM: '부품표: 부품번호 실존·단종 위험, 정격 전압·전류 여유, 패키지·풋프린트 일치, 수량·Ref 중복·누락, 회로도와 불일치, 대체품',
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (body.action !== 'run' || !body.project_id) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    // 사용자 권한으로 읽어 팀 격리(RLS)를 지킨다
    const project = await base44.entities.ProtoProject.get(body.project_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!project?.tenant_id) return Response.json({ error: '시제품을 찾을 수 없습니다.' }, { status: 404 });
    if (user.account_tier !== 'master' && project.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole;

    const requestId = typeof body.request_id === 'string' ? body.request_id.slice(0, 80) : '';
    if (requestId) {
      const done = await base44.entities.ProtoDesignReview.filter({ project_id: project.id, request_id: requestId }, '-created_date', 1);
      if (done[0]) return Response.json({ review: done[0], reused: true });
    }

    const areas = (Array.isArray(body.areas) ? body.areas : []).filter((a) => AREAS.includes(a));
    if (!areas.length) return Response.json({ error: '검토 범위를 하나 이상 고르세요.' }, { status: 400 });
    const ids = new Set(Array.isArray(body.file_ids) ? body.file_ids : []);
    const files = (project.files || []).filter((f) => ids.has(f.id) && REVIEW_CATS.includes(f.category) && f.uri).slice(0, 12);
    const version = body.version_id ? await base44.entities.ProtoDesignVersion.get(body.version_id).catch((e) => (e.status === 404 ? null : Promise.reject(e))) : null;
    if (version && version.project_id !== project.id) return Response.json({ error: '설계 버전이 이 시제품의 것이 아닙니다.' }, { status: 400 });
    if (!files.length && !version) return Response.json({ error: '검토할 파일이나 설계 버전을 고르세요.' }, { status: 400 });

    // 파일마다 AI가 읽을 수 있는 방식으로 준비: 이미지·PDF 는 첨부, 텍스트는 본문, 엑셀은 표로 변환
    const file_urls: string[] = [];
    const texts: string[] = [];
    let textBudget = 40000;
    const used = [];
    for (const f of files) {
      let read_as = 'unreadable';
      const { signed_url } = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri, expires_in: 900 });
      if (IMAGE.test(f.name) && file_urls.length < 8) { file_urls.push(signed_url); read_as = 'image'; }
      else if (TEXT.test(f.name) && textBudget > 0) {
        const res = await fetch(signed_url);
        if (res.ok) { const t = (await res.text()).slice(0, Math.min(15000, textBudget)); textBudget -= t.length; texts.push(`[${f.category}] ${f.name}\n${t}`); read_as = 'text'; }
      } else if (SHEET.test(f.name)) {
        const out = await svc.integrations.Core.ExtractDataFromUploadedFile({ file_url: signed_url, json_schema: BOM_ROWS });
        if (out?.status === 'success' && out.output) { const t = JSON.stringify(out.output).slice(0, 15000); texts.push(`[${f.category}] ${f.name} (표 변환)\n${t}`); read_as = 'table'; }
      }
      used.push({ id: f.id, name: f.name, category: f.category, read_as });
    }
    const unreadable = used.filter((u) => u.read_as === 'unreadable').map((u) => u.name);

    const v = version ? {
      version_no: version.version_no, operating_principle: version.operating_principle, bom: version.bom, connections: version.connections,
      power_budget: version.power_budget, circuit_notes: version.circuit_notes, mechanical_notes: version.mechanical_notes, mold_notes: version.mold_notes,
    } : null;
    const prompt = `너는 전자회로·사출금형·부품 조달을 모두 아는 시제품 설계 검토 책임자다. 담당자가 등록한 설계 자료를 검토해 양산 전 문제를 찾는다.

[시제품] ${project.title}
[목표] ${project.goal || '-'}
[사용 조건] ${project.use_conditions || '-'}
[전원] ${project.power_requirements || '-'}
[입출력] ${project.io_requirements || '-'}
[제약조건] ${project.constraints || '-'}
[검토 범위]
${areas.map((a) => `- ${AREA_GUIDE[a]}`).join('\n')}
[첨부 이미지·PDF] ${used.filter((u) => u.read_as === 'image').map((u) => `${u.name}(${u.category})`).join(', ') || '없음'}
${texts.length ? `[텍스트·표 자료]\n${texts.join('\n\n')}` : ''}
${project.pcb?.rows?.length ? `[확정 PCB 부품표]\n${JSON.stringify(project.pcb.rows).slice(0, 12000)}` : ''}
${v ? `[대조할 설계 v${v.version_no}]\n${JSON.stringify(v).slice(0, 20000)}` : ''}
${unreadable.length ? `[읽지 못한 파일] ${unreadable.join(', ')} — 이 파일 내용은 판단하지 않는다` : ''}
${body.instruction ? `[담당자 요청] ${String(body.instruction).slice(0, 3000)}` : ''}

규칙:
- 한국어로 쓴다. 자료에서 실제로 보이는 근거로만 지적하고, location 에 도면·부품 위치(Ref, 핀, 치수, 영역)를 적는다.
- 회로도·사출 도면·부품표·설계 버전 사이의 불일치는 area=CROSS 로 쓴다.
- 확인할 수 없는 항목은 단정하지 말고 unverified 에, 설계자에게 물어볼 것은 questions 에 넣는다.
- bom_checks 는 문제가 있는 부품 줄만 쓴다.
- verdict: 치명적 문제 없으면 PASS, 고치면 진행 가능하면 CONDITIONAL, 재설계가 필요하면 FAIL.`;

    const out = await svc.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA, model: MODEL, ...(file_urls.length ? { file_urls } : {}) });
    const review = await svc.entities.ProtoDesignReview.create({
      tenant_id: project.tenant_id,
      project_id: project.id,
      version_id: version?.id || null,
      version_no: version?.version_no || null,
      areas,
      files: used,
      instruction: body.instruction ? String(body.instruction).slice(0, 3000) : '',
      verdict: out.verdict,
      summary: out.summary,
      findings: (out.findings || []).map((f, i) => ({ ...f, id: `f${i + 1}`, status: 'OPEN' })),
      bom_checks: out.bom_checks || [],
      unverified: [...(out.unverified || []), ...unreadable.map((n) => `${n}: AI가 읽을 수 없는 형식이라 검토하지 못함`)],
      questions: out.questions || [],
      reviewer_name: user.full_name || user.email,
      request_id: requestId || null,
    });
    return Response.json({ review });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}