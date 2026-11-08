// 시제품 개발 공용 정의: 단계·상태·검증 표시·파일 분류
export const PROTO_STAGES = [
  { key: 'REQUIREMENTS', label: '요구사항' },
  { key: 'DESIGN', label: '설계' },
  { key: 'BUILD', label: '제작' },
  { key: 'TEST', label: '시험' },
  { key: 'IMPROVE', label: '개선' },
];
export const stageIndex = (key) => Math.max(0, PROTO_STAGES.findIndex((s) => s.key === key));
export const stageLabel = (key) => PROTO_STAGES.find((s) => s.key === key)?.label || '요구사항';

export const VERSION_STATUS = {
  DRAFT: { label: 'AI 초안', className: 'bg-chart-4/10 text-chart-4' },
  REVIEW: { label: '검토 중', className: 'bg-warning/15 text-warning-text' },
  APPROVED: { label: '승인', className: 'bg-success/15 text-success-text' },
  REJECTED: { label: '반려', className: 'bg-destructive/10 text-destructive' },
};

// AI 가 낸 항목의 신뢰 표시 — 외부 규격·데이터시트 확인 전에는 '검증 필요'
export const VERIFY_STATUS = {
  VERIFIED: { label: '검증됨', className: 'bg-success/15 text-success-text' },
  NEEDS_CHECK: { label: '검증 필요', className: 'bg-warning/15 text-warning-text' },
  ASSUMED: { label: '가정', className: 'bg-muted text-muted-foreground' },
};

export const SEVERITY = {
  HIGH: { label: '높음', className: 'bg-destructive/10 text-destructive' },
  MEDIUM: { label: '보통', className: 'bg-warning/15 text-warning-text' },
  LOW: { label: '낮음', className: 'bg-muted text-muted-foreground' },
};

export const TEST_STATUS = {
  PLANNED: { label: '계획', className: 'bg-muted text-muted-foreground' },
  PASS: { label: '합격', className: 'bg-success/15 text-success-text' },
  PARTIAL: { label: '부분 합격', className: 'bg-warning/15 text-warning-text' },
  FAIL: { label: '불합격', className: 'bg-destructive/10 text-destructive' },
};

export const FILE_CATEGORIES = [
  { key: 'DRAWING', label: '도면' },
  { key: 'PHOTO', label: '사진' },
  { key: 'REFERENCE', label: '참고 문서' },
  { key: 'CAD', label: 'CAD' },
  { key: 'PCB', label: 'PCB·회로' },
  { key: 'CODE', label: '펌웨어 코드' },
  { key: 'MFG', label: '제조 산출물' },
  { key: 'MODEL3D', label: '3D 모델 (STEP·STL)' },
];
export const fileCategoryLabel = (key) => FILE_CATEGORIES.find((c) => c.key === key)?.label || key;
export const INPUT_CATEGORIES = ['DRAWING', 'PHOTO', 'REFERENCE'];
export const ARTIFACT_CATEGORIES = ['CAD', 'PCB', 'CODE', 'MFG', 'MODEL3D'];

// 자동 생성 가능한 범위와 외부 도구가 필요한 산출물을 구분해 보여 준다
export const OUTPUT_SCOPE = [
  { label: '부품표·연결 관계·동작 원리', auto: true },
  { label: '회로 블록·전원 예산 초안', auto: true },
  { label: '펌웨어 구조·핀맵 초안 코드', auto: true },
  { label: '사출 구조·금형 방향(구배·파팅·게이트) 검토', auto: true },
  { label: 'STEP/STL 3D 형상 보기·부품 탐색', auto: true },
  { label: 'PCB 아트웍(거버)·회로도 원본', auto: false, tool: 'KiCad·Altium' },
  { label: '사출품·금형 3D 모델링 및 금형 도면', auto: false, tool: 'SolidWorks·NX·Fusion' },
  { label: '전기·기구 물리 시뮬레이션', auto: false, tool: 'SPICE·FEA·Moldflow' },
];

export const fmtDate = (v) => (v ? String(v).slice(0, 10) : '-');