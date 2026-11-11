// 브랜드 문장 · 일하는 방식 · 지키는 네 가지 — 메인 BrandSection 과 /about 이 함께 쓴다. [ko, en, zh]
export const brand = {
  eyebrow: 'WHY AEGIS',
  h2: ['개발한 팀이 양산까지 책임집니다.', 'The team that develops it takes it to mass production.', '负责开发的团队，一直负责到量产。'],
  lead: [
    '설계하는 곳과 만드는 곳이 따로 움직이면, 금형 단계에서 설계를 다시 고치고 단가와 일정이 흔들립니다. AEGIS는 한국과 중국의 개발 인력이 같은 제품을 함께 설계하고, 중국 현지에서 협력 공장의 개발팀과 양산까지 직접 이끕니다.',
    'When the people who design and the people who build work apart, designs get reworked at the tooling stage and cost and schedule slip. At AEGIS, our developers in Korea and China design the same product together, then lead it through mass production on the ground in China with our partner factories’ engineering teams.',
    '设计方与生产方各自为战，就会在开模阶段返工设计，单价与交期随之波动。AEGIS 由韩国与中国的开发人员共同设计同一款产品，并在中国现场与合作工厂的开发团队一起，亲自推进到量产。',
  ],
  story: [
    [
      '이지스(Aegis)는 그리스 신화에서 대장장이 신 헤파이스토스가 만든 방패입니다. 우리는 그 이름처럼 직접 만들고, 만든 것을 끝까지 지킵니다.',
      'In Greek myth, the Aegis is the shield forged by Hephaestus, the smith god. True to the name, we build things ourselves and protect what we build to the end.',
      '在希腊神话中，埃吉斯（Aegis）是锻造之神赫菲斯托斯打造的盾牌。正如其名，我们亲手打造，并守护所造之物直到最后。',
    ],
    [
      '한국과 중국의 개발 인력이 같은 제품을 동시에 설계합니다. 중국 현장에서 공장의 금형과 공정을 보며 설계하기 때문에, 처음부터 양산에 맞는 설계가 나옵니다.',
      'Our developers in Korea and China design the same product at the same time. Because the design is made while looking at the factory’s tooling and processes on site, it is ready for mass production from the start.',
      '韩国与中国的开发人员同步设计同一款产品。由于在中国现场对照工厂的模具与工艺进行设计，从一开始就是适合量产的设计。',
    ],
    [
      '이미 완성된 제품이 있다면 그대로 양산만 맡기셔도 됩니다. 공장 선정부터 생산, 출고 전 검수까지 AEGIS가 공장을 직접 관리해 양산에 문제가 없게 합니다.',
      'Already have a finished product? Hand us just the mass production. From factory selection to production and pre-shipment inspection, AEGIS manages the factory directly so production runs without problems.',
      '已有成品？也可以只委托量产。从工厂选定、生产到出货前检验，AEGIS 直接管控工厂，确保量产顺利无误。',
    ],
  ],
  rolesTitle: ['한 팀으로 개발하고 생산합니다', 'One team, from development to production', '一个团队，从开发到生产'],
  roles: [
    { myth: ['KOREA', 'KOREA', '韩国'], real: ['한국 개발팀', 'Korea dev team', '韩国开发团队'], d: ['제품 기획 · 설계 · 고객 소통', 'Planning · design · client contact', '产品策划 · 设计 · 客户沟通'] },
    { myth: ['CHINA', 'CHINA', '中国'], real: ['중국 현지 개발·생산팀', 'China dev & production team', '中国本地开发生产团队'], d: ['시제품 · 금형 · 양산 관리 · QC', 'Prototypes · tooling · production · QC', '样机 · 模具 · 量产管理 · QC'], highlight: true },
    { myth: ['FACTORY', 'FACTORY', '工厂'], real: ['협력 공장 개발팀', 'Partner factory engineers', '合作工厂开发团队'], d: ['공정 · 금형 제작 · 생산 (AEGIS 관리)', 'Process · tooling · production, managed by AEGIS', '工艺 · 模具制作 · 生产（AEGIS 管控）'] },
  ],
  guardsTitle: ['AEGIS가 끝까지 지키는 네 가지', 'Four things AEGIS protects to the end', 'AEGIS 守护到底的四件事'],
  guards: [
    { t: ['품질', 'Quality', '质量'], d: ['설계 단계부터 양산 공정을 고려하고, 생산 중·출고 전 검수로 불량이 한국에 도착하기 전에 걸러냅니다.', 'Production is considered from the design stage, and in-line and pre-shipment inspection catch defects before they reach Korea.', '从设计阶段就考虑量产工艺，并通过生产中与出货前检验，在到达韩国前拦下不良。'] },
    { t: ['가격', 'Price', '价格'], d: ['만들기 쉬운 설계로 금형비와 단가를 낮추고, 공장 견적서를 도면과 대조해 검증합니다.', 'Design for manufacturing lowers tooling and unit cost, and factory quotes are checked against drawings.', '以易于制造的设计降低模具费与单价，并将工厂报价与图纸比对核验。'] },
    { t: ['일정', 'Schedule', '交期'], d: ['개발과 생산을 한 팀이 이어서 진행하고, 현장에서 진행 상황을 확인해 지연을 미리 알립니다.', 'One team carries development straight into production, checks progress on site and flags delays early.', '开发与生产由同一团队衔接推进，在现场确认进度，提前预警延误。'] },
    { t: ['서류와 정보', 'Documents & data', '文件与信息'], d: ['계약·인보이스·인증 서류와 도면을 AEGIS Cloud에서 안전하게 관리합니다.', 'Contracts, invoices, certificates and drawings are kept safely in AEGIS Cloud.', '合同、发票、认证文件与图纸在 AEGIS Cloud 中安全管理。'] },
  ],
  more: ['AEGIS 이야기 더 보기', 'Read the AEGIS story', '了解 AEGIS 的故事'],
};
