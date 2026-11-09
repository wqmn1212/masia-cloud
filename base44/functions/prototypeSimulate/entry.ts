import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { simulate } from '../../shared/protoSim.ts';

// 시제품 동작 시뮬레이션 실행: 정격값으로 계산한 뒤 AI(Opus)가 단계별 설명·가정·미확인 항목을 붙여 기록한다
const MODEL = 'claude_opus_5_5';
const AI_FILE = /\.(png|jpe?g|webp|pdf)$/i;
const list = { type: 'array', items: { type: 'string' } };
const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    step_notes: { type: 'array', items: { type: 'object', properties: { step_id: { type: 'string' }, explanation: { type: 'string' }, state_change: { type: 'string' }, caution: { type: 'string' } } } },
    assumptions: list,
    unverified: list,
    limitations: list,
  },
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (body.action !== 'run' || !body.sim_id) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    // 사용자 권한으로 읽어 팀 격리(RLS)를 지킨다
    const sim = await base44.entities.ProtoSimulation.get(body.sim_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!sim) return Response.json({ error: '시나리오를 찾을 수 없습니다.' }, { status: 404 });
    const project = await base44.entities.ProtoProject.get(sim.project_id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!project || project.tenant_id !== sim.tenant_id) return Response.json({ error: '시제품을 찾을 수 없습니다.' }, { status: 404 });
    if (user.account_tier !== 'master' && project.tenant_id !== user.tenant_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!(Number(sim.supply_voltage_v) > 0) || !sim.actuators?.length || !sim.steps?.length) return Response.json({ error: '공급 전압·구동 부품·단계를 먼저 입력하세요.' }, { status: 400 });
    const svc = base44.asServiceRole;

    const vid = sim.version_id || project.current_version_id;
    const version = vid ? await base44.entities.ProtoDesignVersion.get(vid).catch((e) => (e.status === 404 ? null : Promise.reject(e))) : null;
    const computed = simulate(sim);

    const files = (project.files || []).filter((f) => ['SCHEMATIC', 'BOM_FILE', 'PCB'].includes(f.category) && AI_FILE.test(f.name || '') && f.uri).slice(0, 4);
    const signed = await Promise.allSettled(files.map((f) => svc.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri, expires_in: 900 })));
    const file_urls = signed.filter((r) => r.status === 'fulfilled' && r.value?.signed_url).map((r) => r.value.signed_url);

    const v = version?.project_id === project.id ? { version_no: version.version_no, operating_principle: version.operating_principle, bom: version.bom, connections: version.connections, power_budget: version.power_budget, circuit_notes: version.circuit_notes, mechanical_notes: version.mechanical_notes } : null;
    const prompt = `너는 전기·기구 시제품 엔지니어다. 담당자가 만든 동작 시나리오와, 앱이 정격값으로 계산한 결과를 보고 단계별로 무엇이 일어나는지 설명한다.

[시제품] ${project.title}
[목표] ${project.goal || '-'}
[사용 조건] ${project.use_conditions || '-'}
[전원 요구] ${project.power_requirements || '-'}
[입출력] ${project.io_requirements || '-'}
[담당자 메모] ${sim.notes || '-'}
[구동 부품] ${JSON.stringify(sim.actuators).slice(0, 8000)}
[시나리오 단계] ${JSON.stringify(sim.steps.map((s) => ({ id: s.id, name: s.name, duration_s: s.duration_s, trigger: s.trigger, note: s.note, states: s.states }))).slice(0, 10000)}
[앱 계산 결과 — 정격값 기반 정상 상태] ${JSON.stringify({ ...computed, series: undefined, tracks: computed.tracks.map((x) => ({ label: x.label, motion: x.motion, axis: x.axis, unit: x.unit, keyframes: x.keyframes })) }).slice(0, 15000)}
${v ? `[설계 v${v.version_no} 부품표·연결]\n${JSON.stringify(v).slice(0, 15000)}` : '[설계 버전] 없음'}
[첨부 회로·부품 이미지] ${files.map((f) => f.name).join(', ') || '없음'}

규칙:
- 한국어. step_notes 는 시나리오 단계마다 하나씩, step_id 를 그대로 쓴다. explanation 은 그 단계의 전기·기구 동작(신호 → 구동 → 움직임 → 센서 반응), state_change 는 상태 변화, caution 은 실제 위험이 보일 때만.
- 수치는 앱 계산 결과의 값만 인용한다. 새 수치(돌입 전류, 토크, 온도, 응력 등)를 만들어내지 않는다. 필요하지만 없는 값은 unverified 에 쓴다.
- 앱 계산이 다루지 않는 물리(과도 응답, 관성·마찰, 발열, 기구 간섭)는 limitations 에 쓴다.
- 해석에 둔 전제는 assumptions 에 쓴다. 회로도와 시나리오가 어긋나 보이면 caution 이나 unverified 에 근거와 함께 쓴다.`;

    let ai = null;
    let ai_error = '';
    try { ai = await svc.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA, model: MODEL, ...(file_urls.length ? { file_urls } : {}) }); }
    catch (e) { ai_error = String(e?.message || e).slice(0, 300); }

    const result = {
      ...computed, ai, ai_error, version_id: v ? version.id : null, version_no: v?.version_no || null,
      ran_at: new Date().toISOString(), ran_by_name: user.full_name || user.email, request_id: typeof body.request_id === 'string' ? body.request_id.slice(0, 80) : null,
    };
    const saved = await svc.entities.ProtoSimulation.update(sim.id, { result, status: 'RAN', result_stale: false, run_count: (Number(sim.run_count) || 0) + 1 });
    return Response.json({ sim: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}