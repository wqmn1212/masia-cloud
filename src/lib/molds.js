// 금형 대장 공용 값. 서버 쪽 base44/functions/listClientMolds 와 같은 라벨을 쓴다.
export const MOLD_OWNER = { CLIENT: '고객사 소유', AEGIS: '이지스 소유', FACTORY: '공장 소유' };
export const MOLD_STATUS = { IN_USE: '사용 중', IDLE: '대기', RETURNED: '반환', SCRAPPED: '폐기' };
export const TRADEMARK_STATUS = { REGISTERED: '중국 상표 등록됨', APPLIED: '중국 상표 출원 중', NOT_FILED: '중국 상표 미출원', UNKNOWN: '중국 상표 미확인' };
// 수명 대비 사용률 (예상 수명이 있을 때만)
export const lifeUsed = (m) => (Number(m.expected_life_shots) > 0 && Number(m.shot_count) >= 0 ? Number(m.shot_count) / Number(m.expected_life_shots) : null);
