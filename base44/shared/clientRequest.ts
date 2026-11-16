// 고객 자료 요청 체크리스트: 템플릿, 항목 정리, 진행률, 고객에게 보낼 모양.
export const TEMPLATES: Record<string, { title: string; note: string; items: { key: string; label: string; hint: string; kind: 'file' | 'text'; required?: boolean }[] }> = {
  design_handoff: {
    title: '디자인 전달 자료',
    note: '아래 자료가 있으면 바로 3D 검토와 견적을 시작할 수 있습니다. 없는 항목은 비워 두셔도 됩니다.',
    items: [
      { key: 'renders', label: '각도별 이미지', hint: '정면·3/4·측면·뒷면·위 (실사 렌더 또는 3D 화면 캡처)', kind: 'file', required: true },
      { key: 'step', label: '부품별로 나뉜 3D 파일', hint: 'STEP(.stp) 권장 · 부품마다 따로 떨어지는 바디. 10MB 가 넘으면 공유 링크를 적어 주세요', kind: 'file', required: true },
      { key: 'dims', label: '전체 치수', hint: '지름·두께·높이 등 꼭 지켜야 할 치수', kind: 'text', required: true },
      { key: 'cmf', label: '색·재질·마감', hint: '부품별 색상 코드와 무광·유광·패브릭 등', kind: 'text' },
      { key: 'ui', label: '표시·조작부 위치', hint: '시계·로고·버튼·잭의 위치와 크기 (그림이면 파일로)', kind: 'file' },
      { key: 'priority', label: '꼭 지킬 것 / 바꿔도 되는 것', hint: '디자인 포인트와 원가를 위해 양보할 수 있는 부분', kind: 'text' },
    ],
  },
  product_brief: {
    title: '신제품 기획 자료',
    note: '처음 개발을 시작할 때 필요한 기본 정보입니다. 아는 만큼만 적어 주세요.',
    items: [
      { key: 'refs', label: '참고 사진·스케치', hint: '비슷한 제품 사진이나 손 스케치', kind: 'file', required: true },
      { key: 'target', label: '목표 판매가·첫 주문 수량', hint: '예: 소비자가 39,000원 · 첫 주문 1,000개', kind: 'text', required: true },
      { key: 'use', label: '사용 환경·주요 기능', hint: '어디서 누가 어떻게 쓰는지, 꼭 있어야 할 기능', kind: 'text' },
      { key: 'cert', label: '필요한 인증', hint: 'KC·전파·FCC·CE 등 판매 국가 기준', kind: 'text' },
      { key: 'schedule', label: '희망 입고 시기', hint: '예: 2027년 3월 말 한국 입고', kind: 'text' },
      { key: 'brand', label: '브랜드·패키지 자료', hint: '로고 파일, 브랜드 색, 패키지 참고', kind: 'file' },
    ],
  },
  artwork: {
    title: '패키지·인쇄 원고',
    note: '인쇄 전에 필요한 원고입니다. 받은 뒤 인쇄 사양과 함께 확인 요청을 드립니다.',
    items: [
      { key: 'art', label: '인쇄 원고', hint: 'AI 또는 PDF (글자는 윤곽선 처리)', kind: 'file', required: true },
      { key: 'barcode', label: '바코드 번호', hint: 'EAN-13 등', kind: 'text' },
      { key: 'color', label: '별색·색상 코드', hint: 'PANTONE 번호 등', kind: 'text' },
      { key: 'text', label: '표기 문구 확인', hint: '제조국·수입원·주의 문구 등', kind: 'text' },
    ],
  },
  custom: { title: '요청 자료', note: '', items: [] },
};

const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);

/** 직원이 고친 항목 목록 정리 (최대 20개, key 는 겹치지 않게) */
export function cleanItems(input: unknown) {
  const list = Array.isArray(input) ? input.slice(0, 20) : [];
  const seen = new Set<string>();
  return list.map((x: any, i: number) => {
    let key = clip(x?.key, 30).replace(/[^a-z0-9_]/gi, '') || `item${i + 1}`;
    while (seen.has(key)) key = `${key}_${i}`;
    seen.add(key);
    return { key, label: clip(x?.label, 80), hint: clip(x?.hint, 200), kind: x?.kind === 'text' ? 'text' : 'file', required: !!x?.required, status: 'WAITING', files: [], answer: '', history: [] };
  }).filter((x) => x.label);
}

export function progressOf(items: any[]) {
  const all = items || [];
  const done = all.filter((x) => x.status === 'ACCEPTED').length;
  const sent = all.filter((x) => x.status === 'SUBMITTED').length;
  const waiting = all.filter((x) => ['WAITING', 'REDO'].includes(x.status));
  return { total: all.length, done, submitted: sent, waiting: waiting.length, required_left: waiting.filter((x) => x.required).length };
}

/** 고객·직원 화면 모양 (파일 주소는 따로 연다) */
export function requestView(r: any) {
  return {
    id: r.id, card_id: r.card_id, title: r.title, note: r.note || '', due_date: r.due_date || '', status: r.status || 'OPEN', sent_at: r.sent_at || r.created_date,
    items: (r.items || []).map((x: any) => ({ key: x.key, label: x.label, hint: x.hint, kind: x.kind, required: !!x.required, status: x.status, answer: x.answer || '', staff_note: x.staff_note || '',
      files: (x.files || []).map((f: any, i: number) => ({ idx: i, name: f.name, size: f.size || 0, at: f.at, by: f.by })), submitted_at: x.submitted_at || null, submitted_by: x.submitted_by || '', reviewed_at: x.reviewed_at || null })),
    progress: progressOf(r.items),
  };
}
