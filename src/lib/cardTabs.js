// 업무 카드 탭: 일하는 순서대로 7개. 예전 탭 이름(알림 링크·북마크에 남아 있음)은 새 탭 + 그 안의 구역으로 바꿔 연다.
export const CARD_TABS = [
  { key: 'now', ko: '지금', cn: '当前' },
  { key: 'quote', ko: '견적', cn: '报价' },
  { key: 'make', ko: '생산', cn: '生产' },
  { key: 'quality', ko: '품질', cn: '质量' },
  { key: 'ship', ko: '선적·정산', cn: '发货·结算' },
  { key: 'talk', ko: '소통', cn: '沟通' },
  { key: 'files', ko: '파일', cn: '文件' },
];
const KEYS = new Set(CARD_TABS.map((t) => t.key));

// 예전 탭 → [새 탭, 구역 id]
export const LEGACY_TAB = {
  overview: ['now', ''], tasks: ['now', 'card-tasks'], milestones: ['make', 'card-milestones'], meetings: ['talk', 'card-meetings'],
  quotation: ['quote', ''], bom: ['quote', 'card-bom'], trade: ['ship', ''], chat: ['talk', ''], settlement: ['ship', 'card-settlement'],
  decisions: ['talk', 'card-decisions'], production: ['quality', 'card-production'],
};

/** 'quote', 'settlement', 'quality#card-claims' 같은 값을 { tab, section } 으로 */
export function resolveCardTab(value) {
  const [raw, hash = ''] = String(value || '').split('#');
  if (KEYS.has(raw)) return { tab: raw, section: hash };
  const old = LEGACY_TAB[raw];
  return old ? { tab: old[0], section: hash || old[1] } : { tab: 'now', section: '' };
}

/** '지금' 탭 신호 문장 → 그 일을 하는 탭 (구역) */
export function signalTarget(section, text) {
  const t = String(text || '');
  if (/고객 새 메시지/.test(t)) return 'talk';
  if (/클레임|불량|보상/.test(t)) return 'quality#card-claims';
  if (/검수|QC|성적서|기준 샘플/.test(t)) return 'quality';
  if (/선적|출하 서류|통관|입고|송금|입금|결제|정산/.test(t)) return /정산/.test(t) ? 'ship#card-settlement' : 'ship';
  if (/공장|업로드 링크|미제출|제출/.test(t) && !/견적 초안/.test(t)) return 'talk#card-factory-request';
  if (/견적|비교표/.test(t)) return 'quote';
  if (/계약서|서명/.test(t)) return 'files';
  if (/\(업무\)|업무 \d+일/.test(t)) return 'now#card-tasks';
  if (/주문 권장|재주문/.test(t)) return 'ship#card-settlement';
  if (/휴무|일정|지남|남음/.test(t) || section === 'risk') return 'make#card-milestones';
  return 'now#card-tasks';
}

/** 카드 상태별 지금 단계와 할 일 */
export const STAGE_GUIDE = {
  TODO: { ko: '문의를 정리하고 공장에 견적을 요청합니다', cn: '整理需求并向工厂询价', tab: 'talk#card-factory-request' },
  IN_PROGRESS: { ko: '공장 견적을 받아 우리 견적서를 만듭니다', cn: '获取工厂报价并制作报价单', tab: 'quote' },
  REVIEW: { ko: '견적 승인·고객 발송, 고객 선택과 계약을 기다립니다', cn: '报价审批·发送客户，等待客户选择与签约', tab: 'quote' },
  PRODUCTION: { ko: '생산 일정·품질 검수·선적을 챙깁니다', cn: '跟进生产进度·质检·发货', tab: 'make' },
  DONE: { ko: '정산을 마치고 재주문 시점을 봅니다', cn: '完成结算并关注返单时机', tab: 'ship#card-settlement' },
};
