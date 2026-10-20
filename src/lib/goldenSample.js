// 기준 샘플(골든 샘플): 고객이 승인한 샘플을 사진·보관 위치와 함께 남겨, 양산 검수 때 나란히 비교한다.
export const SAMPLE_LOCATIONS = { CLIENT: '고객사 보관', FACTORY: '공장 보관', AEGIS: '이지스 보관' };
export const hasGoldenSample = (g) => !!g && (!!g.approved_at || !!g.photos?.length);
