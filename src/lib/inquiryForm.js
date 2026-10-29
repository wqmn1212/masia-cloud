// 고객 신규 문의 양식 (3단계 G). 카테고리를 고르면 필수 사양 질문이 나오고, 희망 입고일·도착지·필요한 인증·샘플 여부를 묻는다.
// 서버 base44/shared/inquiryForm.ts 와 같은 목록 (화면용 사본). 검산: npm run check:inquiry-form
export const INQUIRY_CATEGORIES = ['기계설비', '정밀가공', '전자 · 전기', '뷰티 · 의료', '리빙 · 공구', '굿즈 · 조형', '기타'];
// 카테고리별로 견적 전에 꼭 필요한 사양 (답을 모르면 '모름'으로 적어도 된다)
export const SPEC_QUESTIONS = {
  '기계설비': ['처리할 제품과 크기', '시간당 생산량', '전원 (전압·상)', '설치 공간'],
  '정밀가공': ['재질', '공차', '표면 처리', '도면 유무 (2D·3D)'],
  '전자 · 전기': ['전원 방식 (어댑터·배터리)', '무선 기능 (블루투스·와이파이)', '충전 단자', '정격 전압·전력'],
  '뷰티 · 의료': ['피부에 닿는 부분과 재질', '의료기기 해당 여부', '전원 방식'],
  '리빙 · 공구': ['재질', '음식에 닿는지', '크기·무게'],
  '굿즈 · 조형': ['재질', '인쇄 방식·색상 수', '포장 방식'],
  '기타': [],
};
// 필요한 인증 (수입 요건 목록 + 모름). 키는 수입 요건(importRequirements) 키와 같다
export const CERT_OPTIONS = [
  ['KC_ELEC', '전기용품 KC 인증'], ['KC_RADIO', '전파 적합성평가 (KC 전파인증)'], ['BATTERY', '리튬 전지 안전확인 (KC)'], ['KC_CHILD', '어린이제품 안전확인 (KC)'],
  ['FOOD', '식품용 기구·용기 수입신고 (식약처)'], ['LIVING_CHEM', '생활화학제품 안전확인 (환경부)'], ['COSMETIC', '화장품 수입 (책임판매업)'], ['UNKNOWN', '모름 (담당자가 확인)'],
];
export const SAMPLE_OPTIONS = { NEED: '샘플 먼저 받고 싶음', SKIP: '샘플 없이 진행', UNSURE: '담당자와 상의' };

const clean = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// 화면에서 받은 값을 정리한다: 카드에 저장할 inquiry_details, 요구사항 글, 미리 넣을 수입 요건
export function cleanInquiry(body, today) {
  const categories = (Array.isArray(body?.categories) ? body.categories : []).filter((c) => INQUIRY_CATEGORIES.includes(c));
  const questions = [...new Set(categories.flatMap((c) => SPEC_QUESTIONS[c] || []))];
  const answersIn = body?.spec_answers && typeof body.spec_answers === 'object' ? body.spec_answers : {};
  const spec_answers = {};
  for (const q of questions) { const a = clean(answersIn[q], 300); if (a) spec_answers[q] = a; }
  const certKeys = CERT_OPTIONS.map(([k]) => k);
  const certifications = [...new Set((Array.isArray(body?.certifications) ? body.certifications : []).filter((k) => certKeys.includes(k)))];
  const desired = clean(body?.desired_date, 10);
  const details = {
    categories,
    quantity: clean(body?.quantity, 200),
    target_price: clean(body?.target_price, 200),
    desired_date: /^\d{4}-\d{2}-\d{2}$/.test(desired) && desired >= today ? desired : '',
    destination: clean(body?.destination, 200),
    certifications,
    sample: SAMPLE_OPTIONS[body?.sample] ? body.sample : '',
    spec_answers,
  };
  const label = (k) => CERT_OPTIONS.find(([key]) => key === k)?.[1] || k;
  const lines = [
    `카테고리: ${categories.join(', ') || '-'}`,
    `수량: ${details.quantity || '-'} / 희망 단가: ${details.target_price || '-'}`,
    `희망 입고일: ${details.desired_date || '-'} / 도착지: ${details.destination || '-'}`,
    `필요한 인증: ${certifications.map(label).join(', ') || '-'}`,
    `샘플: ${SAMPLE_OPTIONS[details.sample] || '-'}`,
    ...(questions.length ? ['', '[사양]', ...questions.map((q) => `- ${q}: ${spec_answers[q] || '(미입력)'}`)] : []),
  ];
  const importReqs = certifications.filter((k) => k !== 'UNKNOWN').map((k) => ({ key: k, label: label(k), status: 'REQUIRED', note: '고객 문의에서 선택' }));
  return { details, lines, importReqs, missing: questions.filter((q) => !spec_answers[q]) };
}
