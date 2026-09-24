// 월정액 PM·QC 전담팀 콘텐츠 — 모든 문구는 [ko, en, zh]
export const team = {
  eyebrow: '03 — DEDICATED PM · QC TEAM',
  h2: ['귀사의 중국 현지 팀이 되어 드립니다', 'Your own team on the ground in China', '成为贵司在中国的现场团队'],
  sub: [
    '한국 1명과 중국 2명이 공장 방문, 가격 협상, 출고 전 검수를 맡습니다. 공장 견적서 원본을 보여드리고, 월 계약을 맺으시면 공장 단가가 내려갑니다.',
    'One PM in Korea and two in China handle factory visits, price negotiation and pre-shipment inspection. We show you the original factory quote, and with a monthly contract your factory unit price goes down.',
    '韩国 1 人与中国 2 人负责工厂走访、价格谈判与出货前检验。我们向您展示工厂报价原件，签订月度合同后工厂单价随之下降。',
  ],
  roles: [
    { count: ['1명', '1 person', '1 人'], t: ['한국 PM', 'Korea PM', '韩国 PM'], d: ['고객 응대, 견적 검증, 기술 판단, 계약 조율', 'Client contact, quote review, technical judgement, contract coordination', '客户对接、报价核验、技术判断、合同协调'] },
    { count: ['2명', '2 people', '2 人'], t: ['중국 현지 QC · PM', 'China on-site QC · PM', '中国现场 QC · PM'], d: ['공장 방문, 공정 확인, 출고 전 검수, 공장 소통', 'Factory visits, process checks, pre-shipment inspection, factory communication', '工厂走访、工序确认、出货前检验、工厂沟通'] },
  ],
  scopeTitle: ['제공 범위', 'What is included', '服务范围'],
  scope: [
    ['공장 발굴 및 비교 견적', 'Factory sourcing & comparative quotes', '工厂开发与比价'],
    ['가격 협상', 'Price negotiation', '价格谈判'],
    ['견적서 · 도면 대조 검증 (중량, 사양, 누락 항목)', 'Quote vs. drawing check (weight, spec, missing items)', '报价与图纸比对（重量、规格、遗漏项）'],
    ['금형 · 시제품 · 양산 공정 관리', 'Tooling, prototype & mass-production control', '模具、样品与量产工序管理'],
    ['출고 전 현지 실물 검수 (사진 포함 보고서)', 'On-site pre-shipment inspection with photo report', '出货前现场实物检验（含照片报告）'],
    ['납기 관리', 'Delivery schedule management', '交期管理'],
    ['인증 · 수출 규제 확인', 'Certification & export regulation checks', '认证与出口法规确认'],
    ['주간 진행 보고', 'Weekly progress report', '每周进度报告'],
  ],
  deliverTitle: ['산출물 기준', 'Deliverables', '交付标准'],
  deliverables: [
    { v: ['주 1회', 'Weekly', '每周 1 次'], t: ['진행 보고', 'Progress report', '进度报告'] },
    { v: ['월 2회', '2× / month', '每月 2 次'], t: ['공장 방문', 'Factory visits', '工厂走访'] },
    { v: ['출고 건마다', 'Every shipment', '每批出货'], t: ['검수 보고서', 'Inspection report', '检验报告'] },
    { v: ['신규 견적마다', 'Every new quote', '每份新报价'], t: ['견적 검증', 'Quote verification', '报价核验'] },
  ],
  priceTitle: ['계약 구조 · 가격', 'Contract & pricing', '合同结构与价格'],
  terms: [
    { k: ['월 계약료', 'Monthly fee', '月度费用'], v: ['300만원 (표준)', 'KRW 3M (standard)', '300 万韩元（标准）'] },
    { k: ['계약 기간', 'Term', '合同期限'], v: ['3~12개월, 프로젝트 단위', '3–12 months, per project', '3~12 个月，按项目'] },
    { k: ['최소 보장', 'Minimum', '最低期限'], v: ['3개월', '3 months', '3 个月'] },
    { k: ['해지', 'Termination', '解约'], v: ['1개월 전 서면 통보', '1 month written notice', '提前 1 个月书面通知'] },
    { k: ['다수 계약', 'Multiple projects', '多项目'], v: ['프로젝트별 계약, 두 번째부터 할인', 'One contract per project, discount from the second', '按项目签约，第二个起享折扣'] },
  ],
  tiers: [
    { t: ['소형', 'Small', '小型'], ex: ['부품 소싱, 단일 사출품', 'Part sourcing, single moulded part', '零件采购、单一注塑件'], price: ['150~200만원', 'KRW 1.5–2M', '150~200 万韩元'] },
    { t: ['표준', 'Standard', '标准'], ex: ['사출 + 후가공 + 조립', 'Moulding + finishing + assembly', '注塑 + 后加工 + 组装'], price: ['300만원', 'KRW 3M', '300 万韩元'], highlight: true },
    { t: ['대형', 'Large', '大型'], ex: ['완제품 개발, 인증 포함', 'Full product development incl. certification', '整机开发，含认证'], price: ['500만원 이상', 'KRW 5M+', '500 万韩元以上'] },
  ],
  perMonth: ['/ 월', '/ month', '/ 月'],
  priceNote: ['등급별 금액은 확정 전 기준안이며, 프로젝트 범위에 따라 상담 후 결정됩니다. VAT 별도.', 'Tier prices are provisional and set after consultation based on project scope. VAT excluded.', '各等级价格为暂定方案，将根据项目范围协商确定。不含增值税。'],
  cta: ['월 계약 상담 신청', 'Book a monthly-contract consultation', '申请月度合同咨询'],
};

export const fit = {
  eyebrow: '04 — WHO IT IS FOR',
  h2: ['이런 회사에 맞습니다', 'Built for companies like these', '适合这样的企业'],
  targets: [
    { t: ['품질 · 납기가 불안한 회사', 'Unsure about quality or delivery', '质量与交期不稳定的企业'], d: ['이미 중국 공장과 거래 중이지만 불량과 일정 지연이 반복되는 경우', 'Already buying from a Chinese factory, but defects and delays keep coming back.', '已与中国工厂合作，但不良与延期反复出现。'] },
    { t: ['반복 생산 품목을 가진 브랜드', 'Brands with repeat production', '有重复生产品项的品牌'], d: ['같은 제품을 꾸준히 발주하는 중소 브랜드', 'Small and mid-sized brands that reorder the same products regularly.', '持续复购同一产品的中小品牌。'] },
    { t: ['여러 품목을 동시에 소싱하는 회사', 'Sourcing many items at once', '同时采购多个品项的企业'], d: ['여러 부품 · 품목을 여러 공장에서 함께 관리해야 하는 경우', 'Several parts and items across several factories that need one point of control.', '需要在多家工厂同时管理多个零件与品项。'] },
  ],
  modelTitle: ['나에게 맞는 모델', 'Which model fits', '适合您的模式'],
  models: [
    { k: ['단발 · 소액 거래', 'One-off or small orders', '单次或小额交易'], v: ['건별 소싱', 'Per-order sourcing', '按单采购'] },
    { k: ['3개월 이상 · 다수 품목', '3+ months or multiple items', '3 个月以上或多品项'], v: ['월정액 PM · QC 전담팀', 'Monthly dedicated PM · QC team', '月度专属 PM · QC 团队'], highlight: true },
  ],
};