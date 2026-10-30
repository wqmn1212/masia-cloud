// 직원 일일 운영 요약 묶음 이름 (화면용 사본). 계산은 서버 base44/shared/opsDigest.ts (getOpsDigest) 가 한다.
// 검산: npm run check:ops-digest
export const SECTIONS = ['due_today', 'risk', 'client_wait', 'factory_wait', 'to_check', 'opportunity'];
export const SECTION_LABEL = {
  due_today: { ko: '오늘 마감', cn: '今日截止' },
  risk: { ko: '지연 위험', cn: '延误风险' },
  client_wait: { ko: '고객 대기 (3일 넘게 멈춤)', cn: '等待客户（超过3天）' },
  factory_wait: { ko: '공장 대기', cn: '等待工厂' },
  to_check: { ko: '확인할 것', cn: '待确认' },
  opportunity: { ko: '영업 기회 (고객 재주문 시점)', cn: '销售机会（客户返单时机）' },
};
