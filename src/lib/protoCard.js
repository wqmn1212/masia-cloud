// 시제품 개발 ↔ 업무 카드 연동: 카드에 보여 줄 개발 현황 요약과 카드 소통 탭 기록 문구 (React 없이 계산만)

/** 워크벤치 공장 시험이 남기는 ProductionUnit 시트 이름 (devkit/factoryTest.js unitRecord) */
export const WORKBENCH_SHEET = '출하 검사 (워크벤치)';
export const STAGE_LABEL = { REQUIREMENTS: '요구사항', CONCEPT: '컨셉', DESIGN: '설계', BUILD: '제작', TEST: '시험', IMPROVE: '개선', DONE: '완료' };
const TEMPLATE_LABEL = { round_lamp: '원형 양면 조명', sphere_lamp: '구형 셸 조명', box: '사각 하우징', cylinder: '원통형', handheld: '손잡이형' };

/**
 * 카드 '시제품 개발' 칸에 보일 요약.
 * concepts: 이 프로젝트의 ProtoConcept (순서 무관), units: 이 카드의 ProductionUnit (공장 시험 기록)
 */
export function protoSummary(project, { concepts = [], units = [] } = {}) {
  const dev = project?.dev || {};
  const latest = [...concepts].sort((a, b) => (b.version_no || 0) - (a.version_no || 0))[0] || null;
  const ecos = dev.ecos || [];
  const openEcos = ecos.filter((e) => e.status === 'OPEN' || e.status === 'WAIT_CLIENT');
  const waitClient = ecos.filter((e) => e.status === 'WAIT_CLIENT').length;
  const md = dev.mold_design || null;
  const tested = units.filter((u) => u.sheet === WORKBENCH_SHEET);
  const pass = tested.filter((u) => u.verdict === 'PASS').length;
  const fail = tested.filter((u) => u.verdict === 'FAIL').length;
  return {
    stage: STAGE_LABEL[project?.stage] || project?.stage || '',
    concept: latest ? { version: latest.version_no, title: latest.title || latest.preview?.title || '', status: latest.status, at: latest.created_date || null, parts: latest.preview?.parts?.length || 0, size: latest.preview?.overall_mm || null } : null,
    conceptCount: concepts.length,
    freeze: dev.freeze ? { version: dev.freeze.version, at: dev.freeze.at, by: dev.freeze.by } : null,
    ecoOpen: openEcos.length, ecoWaitClient: waitClient, ecoTotal: ecos.length,
    mold: md?.template ? { template: md.template, label: TEMPLATE_LABEL[md.template] || md.template, dia: md.params?.dia || null, summary: md.summary || null } : null,
    features: (dev.features || []).length,
    device: dev.device_name || '',
    tests: { total: tested.length, pass, fail },
    archived: (dev.archive || []).length,
  };
}

/** 요약에서 '지금 챙길 것' 한 줄씩 (카드 지금 탭에 보여 준다) */
export function protoAttention(sum) {
  const out = [];
  if (!sum.concept) out.push('컨셉 3D 형상이 아직 없습니다');
  if (sum.ecoWaitClient) out.push(`고객 확인을 기다리는 설계 변경 ${sum.ecoWaitClient}건`);
  if (sum.ecoOpen - sum.ecoWaitClient > 0) out.push(`검토할 설계 변경 ${sum.ecoOpen - sum.ecoWaitClient}건`);
  if (sum.tests.fail) out.push(`공장 시험 불합격 ${sum.tests.fail}대`);
  return out;
}

/** 카드 소통 탭에 남길 문구 (서버 shared/protoCardNote.ts 와 같은 머리말) */
export const protoNoteText = (project, text) => `[시제품 · ${String(project?.title || '').slice(0, 60)}] ${String(text || '').slice(0, 900)}`;

/** 워크벤치 단계 바로가기 */
export const protoLinks = (projectId) => [
  { key: 'concept', label: '컨셉', to: `/prototypes/${projectId}/develop?step=concept` },
  { key: 'cad', label: '3D 도면', to: `/prototypes/${projectId}/develop?step=cad` },
  { key: 'sim', label: '동작 시뮬레이션', to: `/prototypes/${projectId}/develop?step=sim` },
  { key: 'test', label: '시험·양산', to: `/prototypes/${projectId}/develop?step=test` },
];
