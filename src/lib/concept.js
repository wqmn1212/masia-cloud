// 시제품 컨셉(미팅용 3D 프리뷰 + 회로·사출 검토 초안) 공용 정의
export const CONCEPT_LAYERS = { SHELL: '외장', INTERNAL: '내부 부품', PCB: '기판', UI: '조작·표시', OTHER: '기타' };

export const MOLD_CATEGORIES = {
  THICKNESS: '두께', SINK: '수축·싱크', DRAFT: '구배', GATE: '게이트', UNDERCUT: '언더컷',
  WARP: '변형', WELD: '웰드라인', EJECT: '취출', PARTING: '파팅', FLOW: '충전', OTHER: '기타',
};

export const TEXTURE_DEPTHS = [
  { value: '0', label: '없음 (광택·일반)' },
  { value: '0.025', label: '부식 0.025mm' },
  { value: '0.05', label: '부식 0.05mm' },
  { value: '0.1', label: '부식 0.1mm' },
];

// 이 화면의 결과가 무엇이 아닌지 항상 같은 문장으로 알린다
export const CONCEPT_DISCLAIMER = {
  preview: '미팅용 개념 시각화입니다. 편집 가능한 CAD 가 아니며 치수·구조는 확정 설계가 아닙니다.',
  circuit: '정격값 기반 근사 계산입니다. 과도 응답·돌입 전류·발열은 계산하지 않았으며 실제 회로 검증이 아닙니다.',
  mold: '입력한 치수·재질로 만든 검토 초안입니다. 유동 해석이 아니며 최종 판단은 금형 업체 검토가 필요합니다.',
};

export const AI_READABLE_FILE = /\.(png|jpe?g|webp|pdf)$/i;