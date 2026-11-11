// 제조팀 구독 콘텐츠 (담당 팀 배정 방식) — 모든 문구는 [ko, en, zh]
export const team = {
  eyebrow: '03 — MANUFACTURING TEAM SUBSCRIPTION',
  h2: ['귀사의 중국 현지 팀이 되어 드립니다', 'Your own team on the ground in China', '成为贵司在中国的现场团队'],
  sub: [
    '중국 생산을 계속 맡기려면 제조팀 구독을 더하세요. 한국 1명과 중국 2명이 귀사의 제조팀으로 공장 방문, 가격 협상, 출고 전 검수, 물류를 맡습니다. 제품 대금은 공장에 직접 결제하고, 이지스에는 월 관리 비용만 냅니다.',
    'To keep your China production running, add a manufacturing team plan. One PM in Korea and two in China act as your manufacturing team: factory visits, price negotiation, pre-shipment inspection and logistics. You pay the factory directly for products and pay AEGIS a monthly management fee.',
    '如需持续托管在华生产，可追加制造团队订阅。韩国 1 人与中国 2 人作为贵司的制造团队，负责工厂走访、价格谈判、出货前检验与物流。货款直接支付给工厂，AEGIS 只收取月度管理费。',
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
  deliverTitle: ['산출물 기준 (스탠다드)', 'Deliverables (Standard)', '交付标准（标准版）'],
  deliverables: [
    { v: ['주 1회', 'Weekly', '每周 1 次'], t: ['진행 보고', 'Progress report', '进度报告'] },
    { v: ['월 2회', '2× / month', '每月 2 次'], t: ['공장 방문', 'Factory visits', '工厂走访'] },
    { v: ['출고 건마다', 'Every shipment', '每批出货'], t: ['검수 보고서', 'Inspection report', '检验报告'] },
    { v: ['신규 견적마다', 'Every new quote', '每份新报价'], t: ['견적 검증', 'Quote verification', '报价核验'] },
  ],
  priceTitle: ['계약 구조 · 가격', 'Contract & pricing', '合同结构与价格'],
  perMonth: ['/ 월', '/ month', '/ 月'],
  cta: ['구독 상담 신청', 'Book a subscription consultation', '申请订阅咨询'],
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
    { k: ['한 번만 확인하면 될 때', 'When you need a one-time check', '只需确认一次时'], v: ['단건 상품 (공장 실사 · 출고 검품 · 견적 검증)', 'Single services (factory audit, pre-shipment inspection, quote review)', '单项服务（验厂、出货检验、报价核验）'] },
    { k: ['제품 하나를 개발부터 양산까지 맡길 때', 'One product, from development to mass production', '将 1 个产品从开发到量产全部委托时'], v: ['턴키 납품 (기본) · 이지스가 만들어 납품', 'Turnkey delivery (default) · we build and deliver it', '交钥匙交付（基本）· 由 AEGIS 生产并交付'], highlight: true },
    { k: ['중국 생산 전체를 계속 맡길 때 (12개월)', 'Ongoing China production (12 months)', '持续托管在华全部生产时（12 个月）'], v: ['제조팀 구독 (라이트 · 스탠다드 · 프로)', 'Manufacturing team subscription (Lite, Standard, Pro)', '制造团队订阅（轻量版、标准版、专业版）'] },
  ],
};