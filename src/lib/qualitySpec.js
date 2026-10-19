// 품질 기준서(QualitySpec) 공용 값
export const SEVERITY = {
  CRITICAL: { label: '치명', cls: 'bg-destructive/15 text-destructive', hint: '안전·작동 불가. 1개도 허용하지 않음' },
  MAJOR: { label: '중결함', cls: 'bg-chart-3/15 text-chart-3', hint: '사용·판매에 지장' },
  MINOR: { label: '경결함', cls: 'bg-muted text-muted-foreground', hint: '사용에 지장 없는 외관 차이' },
};

export const SPEC_DECISION = {
  PENDING: { label: '고객 확인 대기', cls: 'bg-muted text-muted-foreground' },
  APPROVED: { label: '고객 승인', cls: 'bg-primary/15 text-primary' },
  REVISION_REQUESTED: { label: '고객 수정 요청', cls: 'bg-destructive/15 text-destructive' },
};

export const DEFAULT_AQL = { aql_level: '일반 검사 수준 II', aql_critical: 0, aql_major: 2.5, aql_minor: 4.0 };

let seq = 0;
export const newItemKey = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

export const DEFAULT_SPEC_ITEMS = () => [
  ['작동·기능', '모든 기능이 정상 작동. 전원·버튼·충전 불량 0개', 'CRITICAL'],
  ['치수', '도면 공차 이내. 조립부 유격 없음', 'MAJOR'],
  ['색상', '한도견본과 같은 색. 자연광 아래 30cm 거리에서 차이가 보이지 않을 것', 'MAJOR'],
  ['외관 스크래치·이물', '주요 외관면 30cm 거리에서 보이는 스크래치·이물 없음', 'MAJOR'],
  ['포장 박스 구김·찍힘', '단상자 모서리 찍힘·구김 없음. 마스터 박스는 내용물이 상하지 않는 정도 허용', 'MINOR'],
  ['라벨·바코드', '라벨 위치·문구 일치, 바코드 스캔 가능', 'MINOR'],
].map(([label, standard, severity]) => ({ key: newItemKey(), label, label_cn: '', standard, standard_cn: '', severity, ok_photo_url: '', ng_photo_url: '' }));

export const aqlLine = (s) => `${s.aql_level || '검사 수준 미정'} · AQL 치명 ${s.aql_critical ?? '-'} / 중결함 ${s.aql_major ?? '-'} / 경결함 ${s.aql_minor ?? '-'}`;
