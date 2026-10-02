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
  deliverTitle: ['산출물 기준 (스탠다드)', 'Deliverables (Standard)', '交付标准（标准版）'],
  deliverables: [
    { v: ['주 1회', 'Weekly', '每周 1 次'], t: ['진행 보고', 'Progress report', '进度报告'] },
    { v: ['월 2회', '2× / month', '每月 2 次'], t: ['공장 방문', 'Factory visits', '工厂走访'] },
    { v: ['출고 건마다', 'Every shipment', '每批出货'], t: ['검수 보고서', 'Inspection report', '检验报告'] },
    { v: ['신규 견적마다', 'Every new quote', '每份新报价'], t: ['견적 검증', 'Quote verification', '报价核验'] },
  ],
  priceTitle: ['구독 플랜 · 계약 조건', 'Plans & contract terms', '订阅方案与合同条件'],
  terms: [
    { k: ['계약 단위', 'Contract unit', '合同单位'], v: ['프로젝트 1개 = 계약 1건, 최대 12개월 후 갱신', 'One contract per project, up to 12 months, then renewal', '一个项目一份合同，最长 12 个月后续约'] },
    { k: ['최소 기간', 'Minimum term', '最短期限'], v: ['라이트 · 스탠다드 3개월, 프로 6개월', 'Lite & Standard 3 months, Pro 6 months', '轻量版与标准版 3 个月，专业版 6 个月'] },
    { k: ['해지', 'Termination', '解约'], v: ['최소 기간 이후 1개월 전 서면 통보', '1 month written notice after the minimum term', '最短期限后提前 1 个月书面通知'] },
    { k: ['다수 계약', 'Multiple projects', '多项目'], v: ['같은 회사의 두 번째 계약부터 10% 할인', '10% off from your second contract', '同一公司第二份合同起优惠 10%'] },
    { k: ['장기 계약', 'Long-term', '长期合同'], v: ['6개월: 공장 실사 1회 무료 · 12개월: 월 구독료 10% 할인 + 일시 정지 1회', '6 months: one free factory audit · 12 months: 10% off + one pause', '6 个月：免费验厂 1 次 · 12 个月：月费优惠 10% + 暂停 1 次'] },
  ],
  tiers: [
    {
      t: ['라이트', 'Lite', '轻量版'],
      ex: ['부품 소싱, 단일 사출품, 같은 품목 반복 발주', 'Part sourcing, a single moulded part, repeat orders', '零件采购、单一注塑件、同品项复购'],
      price: ['150만원', 'KRW 1.5M', '150 万韩元'],
      points: [
        ['품목 1개, 공장 1곳', '1 item, 1 factory', '1 个品项，1 家工厂'],
        ['현장 방문 월 1회', 'Factory visit 1× / month', '每月工厂走访 1 次'],
        ['출고 건마다 검수 보고서', 'Inspection report every shipment', '每批出货检验报告'],
        ['진행 보고 격주 1회', 'Progress report every 2 weeks', '每两周进度报告 1 次'],
      ],
    },
    {
      t: ['스탠다드 · 추천', 'Standard · Recommended', '标准版 · 推荐'],
      ex: ['사출 + 후가공 + 조립, 여러 부품을 하나의 제품으로', 'Moulding + finishing + assembly into one product', '注塑 + 后加工 + 组装，多个零件组成一个产品'],
      price: ['300만원', 'KRW 3M', '300 万韩元'],
      highlight: true,
      points: [
        ['품목 3개까지, 공장 3곳까지', 'Up to 3 items and 3 factories', '最多 3 个品项、3 家工厂'],
        ['현장 방문 월 2회', 'Factory visits 2× / month', '每月工厂走访 2 次'],
        ['주간 일정표 + 지연 사전 경고', 'Weekly schedule with early delay warnings', '每周进度表 + 延期预警'],
        ['진행 보고 주 1회 + 월간 리포트', 'Weekly report + monthly report', '每周报告 + 月度报告'],
      ],
    },
    {
      t: ['프로', 'Pro', '专业版'],
      ex: ['완제품 개발, 시제품부터 양산까지, 인증 필요', 'Full product development from prototype to mass production, with certification', '整机开发，从样品到量产，需认证'],
      price: ['500만원 이상', 'KRW 5M+', '500 万韩元起'],
      points: [
        ['제품 1개의 모든 부품, 공장 6곳까지', 'Every part of one product, up to 6 factories', '一个产品的全部零件，最多 6 家工厂'],
        ['현장 방문 월 4회 + 양산 중간 검수', 'Factory visits 4× / month + mid-production checks', '每月工厂走访 4 次 + 量产中检'],
        ['인증(KC 등) 진행 관리', 'Certification (KC etc.) management', '认证（KC 等）进度管理'],
        ['주 1회 보고 + 월 1회 화상 리뷰', 'Weekly report + monthly video review', '每周报告 + 每月视频复盘'],
      ],
    },
  ],
  perMonth: ['/ 월', '/ month', '/ 月'],
  priceNote: ['VAT 별도. 제품 대금 · 샘플 · 금형비 · 물류비 · 관세 · 인증 시험비는 실비로 따로 청구합니다. 프로는 범위에 따라 상담 후 정합니다.', 'VAT excluded. Product cost, samples, tooling, freight, duties and certification testing are billed at cost. Pro is priced after consultation based on scope.', '不含增值税。货款、样品、模具、物流、关税及认证测试费按实际费用另行收取。专业版根据范围协商定价。'],
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
    { k: ['한 번만 확인하면 될 때', 'When you need a one-time check', '只需确认一次时'], v: ['단건 상품 (공장 실사 · 출고 검품 · 견적 검증)', 'Single service (factory audit · pre-shipment check · quote review)', '单项服务（验厂 · 出货验货 · 报价核验）'] },
    { k: ['3개월 이상 · 꾸준한 생산', '3+ months of ongoing production', '3 个月以上持续生产'], v: ['제조팀 구독 (라이트 · 스탠다드 · 프로)', 'Manufacturing team subscription (Lite · Standard · Pro)', '制造团队订阅（轻量版 · 标准版 · 专业版）'], highlight: true },
  ],
};