// 수입 요건(인증·신고) 체크리스트. 서버 쪽 base44/shared/importRequirements.ts 와 같은 상태 규칙을 쓴다 (둘을 함께 고칠 것).
export const IMPORT_REQS = [
  { key: 'ORIGIN', label: '원산지 표시 (MADE IN CHINA)', hint: '제품·포장에 원산지 표시가 없으면 통관이 보류됩니다' },
  { key: 'LABEL', label: '한글 표시 사항', hint: '수입자·제조국·주의 문구 등 품목별 표시 기준' },
  { key: 'KC_ELEC', label: '전기용품 KC 인증', hint: '전원 어댑터·충전기·전기 제품. 품목에 따라 안전인증·안전확인·공급자적합성확인' },
  { key: 'KC_RADIO', label: '전파 적합성평가 (KC 전파인증)', hint: '블루투스·와이파이 등 무선 기능, 전자파가 나오는 전자제품' },
  { key: 'BATTERY', label: '리튬 전지 안전확인 (KC)', hint: '배터리 단품·일부 내장 배터리. 운송용 UN38.3 과는 별개입니다' },
  { key: 'KC_CHILD', label: '어린이제품 안전확인 (KC)', hint: '만 13세 이하 어린이가 쓰는 제품' },
  { key: 'FOOD', label: '식품용 기구·용기 수입신고 (식약처)', hint: '음식에 닿는 컵·용기·주방용품. 수입할 때마다 신고' },
  { key: 'LIVING_CHEM', label: '생활화학제품 안전확인 (환경부)', hint: '세정제·방향제·접착제 등' },
  { key: 'COSMETIC', label: '화장품 수입 (책임판매업)', hint: '화장품은 책임판매업 등록과 표시 기준이 필요합니다' },
];
export const REQ_STATUS = { REQUIRED: '필요', IN_PROGRESS: '진행 중', DONE: '완료', NA: '해당 없음' };
export const reqDone = (r) => r.status === 'DONE' || r.status === 'NA';
export const pendingReqs = (list = []) => list.filter((r) => !reqDone(r));
