// 랜딩 콘텐츠 — 모든 문구는 [ko, en, zh] 3개 언어 배열
const LANG_INDEX = { ko: 0, en: 1, zh: 2 };
export const LANDING_LANGS = ['ko', 'en', 'zh'];
export const tx = (v, lang) => (Array.isArray(v) ? v[LANG_INDEX[lang] ?? 0] : v);

export const nav = [
  { href: '#about', label: ['우리가 하는 일', 'What we do', '业务介绍'] },
  { href: '#process', label: ['진행 프로세스', 'Process', '流程'] },
  { href: '#category', label: ['취급 품목', 'Categories', '产品品类'] },
  { href: '#trust', label: ['보안 · 계약', 'Security', '保密与合同'] },
];

export const header = {
  cta: ['견적 요청', 'Request a quote', '索取报价'],
  dashboard: ['대시보드로 이동', 'Go to dashboard', '前往控制台'],
};

export const hero = {
  badge: ['중국 선전 지사 운영 · 한국 본사 업무 진행', 'Shenzhen branch · Korean HQ operations', '深圳分公司 · 韩国总部运营'],
  h1a: ['중국 공장과 직거래,', 'Direct from the Chinese factory floor,', '直连中国工厂，'],
  h1b: ['한국 문 앞까지 한 번에.', 'delivered to your door in Korea.', '直送韩国客户手中。'],
  body: [
    'AEGIS는 한국에 본사를, 중국 선전에 지사와 직원을 두고 공장과 직접 만나 가격을 협상합니다. 온라인에서 공장처럼 활동하는 유통사보다 낮은 단가로 직거래가 가능하며, 공장 검증과 QC, 배송과 통관까지 한 번에 진행합니다.',
    'AEGIS has its own branch and staff on the ground in Shenzhen. We negotiate with factories face to face, so you buy below the price online trading companies posing as factories can offer. Verification, QC, shipping and customs are handled in one line.',
    'AEGIS 在深圳设有分公司和常驻员工，直接与工厂面对面谈判价格，因此价格低于线上冒充工厂的贸易商。验厂、QC、运输与清关一站式完成。',
  ],
  cta1: ['제조 문의하기', 'Request a quote', '索取报价'],
  cta2: ['진행 방식 보기', 'See how it works', '查看进行流程'],
  note: [
    '문의 접수 시 AEGIS Cloud 계정이 발급되어 견적 · QC · 물류 현황을 직접 확인할 수 있습니다.',
    'Submit a request and we issue a AEGIS Cloud account to track quotes, QC and shipping.',
    '提交询价后将开通 AEGIS Cloud 账号，可实时查看报价、QC 与物流。',
  ],
};

export const supply = {
  title: ['SUPPLY STRUCTURE', 'SUPPLY STRUCTURE', '供应结构'],
  koreaLabel: ['KOREA', 'KOREA', '韩国'],
  korea: ['고객사', 'Your company', '贵公司'],
  aegisLabel: ['KOREA HQ + SHENZHEN BRANCH', 'KOREA HQ + SHENZHEN BRANCH', '韩国总部 + 深圳分公司'],
  aegisDesc: ['현지 가격 협상 · 공장 검증 · QC · 배송 · 통관', 'On-site negotiation · factory audit · QC · shipping · customs', '现场议价 · 验厂 · QC · 运输 · 清关'],
  removed: ['공장을 표방하는 온라인 유통사', 'Trading companies posing as factories', '冒充工厂的贸易商'],
  removedTag: ['제거', 'REMOVED', '已去除'],
  chinaLabel: ['CHINA · SHENZHEN', 'CHINA · SHENZHEN', '中国 · 深圳'],
  china: ['검증 완료 공장', 'Verified factory', '已验证工厂'],
};

export const stats = [
  { value: '1,200', unit: '+', label: ['누적 프로젝트', 'Projects delivered', '累计项目数'] },
  { value: '380', unit: '+', label: ['검증 공장', 'Verified factories', '已验证工厂数'] },
  { value: '27', unit: '%', label: ['평균 단가 절감률', 'Avg. unit cost saved', '平均单价降幅'] },
  { value: '32', unit: ['일', 'd', '天'], label: ['평균 리드타임', 'Avg. lead time', '平均交期'] },
];

export const about = {
  eyebrow: '01 — WHAT WE DO',
  h2: ['중국의 공장과 한국의 기업을 연결하고, 도착할 때까지 사이에 남습니다.', 'We connect Korean companies with Chinese factories — and stay in the middle until it lands.', '我们连接韩国企业与中国工厂，并全程负责到货为止。'],
  cards: [
    { t: ['선전 현지 지사와 직원', 'A branch and staff in Shenzhen', '深圳设有分公司与常驻员工'], d: ['우리의 주 활동지는 중국 선전시입니다. 우리 직원이 공장을 직접 찾아가 만나기 때문에, 중간에 말을 옮기는 대신 가격을 직접 협상합니다.', 'Our main base of operations is Shenzhen, China. Because our own staff meet factories in person, we negotiate price directly instead of relaying messages through a middleman.', '我们的主要活动地是中国深圳。自有员工亲赴工厂洽谈，直接议价，而非经由中间人转达。'] },
    { t: ['유통사보다 낮은 단가', "Lower than a trading company's price", '低于贸易商的价格'], d: ['온라인에서 공장처럼 활동하는 판매자 상당수는 마진을 얹은 유통사입니다. 직접 협상은 그 층을 걷어냅니다.', 'Many sellers online present themselves as factories but are resellers with a margin layered on top. Direct negotiation removes that layer.', '线上许多卖家自称工厂，实为加价转售的中间商。直接谈判去除了这一层。'] },
    { t: ['모든 공장은 방문 가능', 'Every factory can be visited', '所有工厂均可实地走访'], d: ['고객사가 직접 방문해 검증할 수 있습니다. 방문이 어려울 경우 우리가 직접 가서 검증하고, 제품 QC를 함께 진행합니다.', 'You may visit and verify any factory yourself. If a visit is difficult, we go on your behalf, verify the site and run product QC together with you.', '您可亲自走访并验证任何一家工厂。若不便前往，我们代为实地验证，并与您一同进行产品 QC。'] },
    { t: ['배송 · 통관 원스톱', 'Shipping and customs in one line', '运输与清关一次搞定'], d: ['제품을 만드는 것 외에도 한국까지 배송, 통관 처리, 고객사 배송까지 모든 과정을 한 번에 처리합니다.', 'Beyond making the product, we ship it to Korea, clear customs and deliver to your door — the whole chain handled at once.', '除生产之外，运抵韩国、清关直至送达贵公司，全流程一次性完成。'] },
    { t: ['모든 업무는 한국 본사 진행', 'All business runs from the Korean HQ', '全部业务由韩国总部进行'], d: ['계약, 대금, 커뮤니케이션 모두 한국 본사를 통합니다. 한국어로, 국내 조건으로, 한 명의 담당자와 일합니다.', 'Contracts, payment and communication all go through the Korean head office. You work in Korean, under Korean terms, with one counterpart.', '合同、付款与沟通均通过韩国总部。以韩语、韩国条款与单一对接人协作。'] },
    { t: ['모든 공장과 NNN 계약', 'NNN agreements with every factory', '与所有工厂签署 NNN 协议'], d: ['협력하는 모든 공장과 NNN 계약을 맺어 도면 · 설계 · 사양 정보가 유출되지 않도록 철저히 진행합니다.', 'Every partner factory signs an NNN agreement so your design, drawings and specifications cannot leak or be copied.', '所有合作工厂均签署 NNN 协议，确保设计、图纸与规格不外泄、不被复制。'] },
  ],
};

export const process = {
  eyebrow: '02 — PROCESS',
  h2: ['문의 한 번에서 납품까지, 끊기지 않는 한 줄', 'From first inquiry to the pallet at your gate', '从首次询价到货物送达贵司门口'],
  sub: ['각 단계는 AEGIS Cloud 계정에 기록되어, 지금 어디까지 왔는지 항상 확인할 수 있습니다.', 'Each step is logged in your AEGIS Cloud account, so you always know where the order stands.', '每个环节都记录在您的 AEGIS Cloud 账号中，随时掌握订单进度。'],
  steps: [
    { t: ['제조 문의 · 요구사항 정리', 'Inquiry & requirements', '询价与需求整理'], d: ['도면, 샘플, 또는 설명만으로도 가능합니다. 사양 · 수량 · 목표 단가를 함께 정리합니다.', 'Send drawings, samples or just a description. We define specs, quantity and target price with you.', '提交图纸、样品或简单描述均可。我们与您共同确定规格、数量与目标价格。'] },
    { t: ['공장 매칭 · NNN 체결', 'Factory matching & NNN', '工厂匹配与 NNN 签署'], d: ['현지 직원이 NNN 계약이 체결된 중국의 공장을 선별.', 'Our Shenzhen staff shortlist factories that actually make your item, and sign NNN before any file is shared.', '深圳团队筛选真正能生产该品项的工厂，并在共享任何文件前签署 NNN。'] },
    { t: ['현지 가격 협상', 'On-site price negotiation', '现场价格谈判'], d: ['공장에서 직접 협상하고, 원가 구성이 보이는 견적으로 회신합니다.', 'We negotiate at the factory in person and return a quote with the cost breakdown visible.', '我们亲赴工厂谈判，并提供含成本明细的报价。'] },
    { t: ['공장 검증 · 샘플', 'Factory audit & sampling', '验厂与打样'], d: ['함께 방문하거나 우리가 대신 갑니다. 설비 · 생산능력 · 인증을 확인하고 결정 전 샘플을 받습니다.', 'Visit with us, or we go for you: equipment, capacity, certifications and a sample before you commit.', '您可同行，或由我们代为前往：确认设备、产能、认证，并在决定前提供样品。'] },
    { t: ['계약서 작성 후 양산', 'Contract, then mass production', '签订合同后再量产'], d: ['모든 양산 제품은 계약서 작성 후 진행합니다. 사양 · 단가 · 납기 · 불량 처리 기준을 명시합니다.', 'No mass production starts without a signed contract covering spec, price, schedule and defect handling.', '所有量产均在签署合同后进行，合同涵盖规格、价格、交期与不良处理。'] },
    { t: ['생산 중 · 출하 전 QC', 'In-line & pre-shipment QC', '生产中与出货前 QC'], d: ['현지 직원이 공장에서 검사하고, 포장 전 사진 · 영상 리포트를 공유합니다.', 'Our staff inspect at the plant and share photo and video reports before anything is boxed.', '我方员工在厂内检验，装箱前提供照片与视频报告。'] },
    { t: ['배송 · 통관', 'Shipping & customs clearance', '运输与通关'], d: ['해상 · 항공 운송, 수출 서류, 한국 수입 통관과 관세까지 하나의 업무로 처리합니다.', 'Sea or air, export paperwork, Korean import clearance and duties — arranged by us as one job.', '海运或空运、出口单证、韩国进口清关与关税，均由我们统一处理。'] },
    { t: ['고객사 납품', 'Delivered to your site', '送达贵司现场'], d: ['국내 공장 · 창고까지 배송하고, A/S 요청도 같은 계정에서 처리합니다.', 'Domestic delivery to your factory or warehouse, with after-sales requests handled through the same account.', '国内配送至贵司工厂或仓库，售后同样通过该账号处理。'], highlight: true },
  ],
};

export const categories = {
  eyebrow: '03 — CATEGORIES',
  h2: ['우리가 다루는 품목', 'What we make', '我们承接的品类'],
  sub: ['기계설비부터 굿즈까지. 카테고리를 선택하면 대표 사례를 볼 수 있습니다.', 'Machinery to goods — pick a category to see representative work.', '从机械设备到周边商品，选择品类查看代表案例。'],
  footnote: ['목록에 없는 품목도 문의해 주세요. 대부분 선전에서 제작 가능합니다.', 'Not on the list? Send the drawing anyway — most items we have not listed are still made in Shenzhen.', '未列出的品类也可咨询。深圳大多可以生产。'],
  tabs: [
    { id: 'all', label: ['전체', 'All', '全部'] },
    { id: 'machine', label: ['기계설비', 'Machinery', '机械设备'] },
    { id: 'precision', label: ['정밀가공', 'Precision parts', '精密加工'] },
    { id: 'electronics', label: ['전자 · 전기', 'Electronics', '电子电器'] },
    { id: 'health', label: ['뷰티 · 의료', 'Beauty & medical', '美容医疗'] },
    { id: 'living', label: ['리빙 · 공구', 'Living & tools', '家居工具'] },
    { id: 'goods', label: ['굿즈 · 조형', 'Goods & figures', '周边与造型物'] },
    { id: 'chem', label: ['생활화학 · 원자재', 'Household chemicals', '日化用品'] },
  ],
};

const TAG = {
  machine: ['기계설비', 'MACHINERY', '机械设备'],
  precision: ['정밀가공', 'PRECISION', '精密加工'],
  electronics: ['전자 · 전기', 'ELECTRONICS', '电子电器'],
  health: ['뷰티 · 의료', 'BEAUTY · MEDICAL', '美容医疗'],
  living: ['리빙 · 공구', 'LIVING · TOOLS', '家居工具'],
  goods: ['굿즈 · 조형', 'GOODS · FIGURES', '周边与造型物'],
  chem: ['생활화학', 'HOUSEHOLD', '日化用品'],
  raw: ['원자재', 'RAW MATERIALS', '原材料'],
};

export const portfolio = [
  { cat: 'machine', tag: TAG.machine, t: ['산업기계', 'Industrial machinery', '工业机械'], d: ['도면 기반 생산라인 및 공정 설비 제작', 'Production lines and process equipment built to drawing.', '按图纸定制的生产线与工艺设备。'], image: '' },
  { cat: 'machine', tag: TAG.machine, t: ['식품기계 · 포장기계', 'Food & packaging machinery', '食品与包装机械'], d: ['충전 · 실링 · 라벨링 및 소량 식품 라인', 'Filling, sealing, labelling and small-batch food lines.', '灌装、封口、贴标及小批量食品线。'], image: '' },
  { cat: 'machine', tag: TAG.machine, t: ['소형 기계장비', 'Compact machines', '小型机械设备'], d: ['소규모 현장용 탁상형 · 전용 장비', 'Benchtop and single-purpose equipment for small floors.', '适用于小型车间的台式与专用设备。'], image: '' },
  { cat: 'precision', tag: TAG.precision, t: ['사출', 'Injection moulding', '注塑成型'], d: ['금형 제작, T0 샘플, 양산 사출', 'Mould fabrication, T0 sampling and mass moulding.', '模具制作、T0 试模与批量注塑。'], image: '' },
  { cat: 'precision', tag: TAG.precision, t: ['CNC', 'CNC machining', 'CNC 加工'], d: ['STEP 도면 기반 금속 · 플라스틱 절삭', 'Metal and plastic machining from STEP files.', '依据 STEP 文件进行金属与塑料加工。'], image: '' },
  { cat: 'precision', tag: TAG.precision, t: ['판금 · 용접 · 프레스', 'Sheet metal · welding · press', '钣金 · 焊接 · 冲压'], d: ['외함 · 프레임 · 프레스 부품, 지그 제작 포함', 'Enclosures, frames and stamped parts with jig setup.', '外壳、框架与冲压件，含治具制作。'], image: '' },
  { cat: 'electronics', tag: TAG.electronics, t: ['소형전자기기 · 전자제품', 'Small electronics', '小型电子产品'], d: ['PCBA, 펌웨어 인계, 선전 현지 조립', 'PCBA, firmware handover and assembly in Shenzhen.', 'PCBA、固件交接与深圳本地组装。'], image: '' },
  { cat: 'electronics', tag: TAG.electronics, t: ['소형가전 · 가전', 'Small home appliances', '小家电'], d: ['KC 인증 지원 및 220V 사양 전환', 'KC certification support and 220V spec conversion.', '支持 KC 认证及 220V 规格转换。'], image: '' },
  { cat: 'electronics', tag: TAG.electronics, t: ['전자부품 · 배터리 · 자석', 'Components · batteries · magnets', '电子元件 · 电池 · 磁铁'], d: ['대량 소싱, MSDS 및 운송 서류 처리', 'Bulk sourcing with MSDS and transport documentation.', '批量采购，含 MSDS 与运输单证。'], image: '' },
  { cat: 'health', tag: TAG.health, t: ['뷰티디바이스', 'Beauty devices', '美容仪器'], d: ['LED · EMS · RF 기기, 금형 및 브랜딩 포함', 'LED, EMS and RF devices with tooling and branding.', 'LED、EMS、RF 设备，含模具与品牌定制。'], image: '' },
  { cat: 'health', tag: TAG.health, t: ['의료기기', 'Medical devices', '医疗器械'], d: ['필요 등급 인증 보유 공장 선별', 'Factories screened for the certifications your class requires.', '按照贵司等级所需认证筛选工厂。'], image: '' },
  { cat: 'health', tag: TAG.health, t: ['화장품용기', 'Cosmetic containers', '化妆品容器'], d: ['펌프 · 튜브 · 에어리스 용기, 후가공 포함', 'Pumps, tubes and airless bottles with custom decoration.', '泵头、软管、真空瓶及定制装饰。'], image: '' },
  { cat: 'living', tag: TAG.living, t: ['가구', 'Furniture', '家具'], d: ['금속 · 목재 가구, 컨테이너 적재용 KD 포장', 'Metal and wood furniture, knock-down packing for container fit.', '金属与木制家具，拆装包装以适配集装箱。'], image: '' },
  { cat: 'living', tag: TAG.living, t: ['공구 · 부속품', 'Tools & accessories', '工具与配件'], d: ['수공구 · 지그 · 교체 부품 소량 생산', 'Hand tools, jigs and replacement parts in small runs.', '手动工具、治具与备件小批量生产。'], image: '' },
  { cat: 'goods', tag: TAG.goods, t: ['굿즈 · 캐릭터 · 인형', 'Character goods & plush', '角色周边与毛绒玩具'], d: ['NNN 하에 IP 보호 생산, 색상 교정 진행', 'IP-safe production under NNN, with colour-proof rounds.', 'NNN 保护下的 IP 安全生产，含打色样。'], image: '' },
  { cat: 'goods', tag: TAG.goods, t: ['조형물 · 디스플레이', 'Sculptures & displays', '造型物与展示道具'], d: ['대형 FRP · 레진 제작, 해상운송용 목상자 포장', 'Large-format FRP and resin pieces, crated for sea freight.', '大型 FRP 与树脂制品，木箱海运包装。'], image: '' },
  { cat: 'chem', tag: TAG.chem, t: ['세제 · 청소용품', 'Detergents & cleaning', '洗涤剂与清洁用品'], d: ['OEM 충전 및 국내 자가검사 서류 지원', 'OEM filling with self-declaration paperwork for Korea.', 'OEM 灌装，配套韩国自我标识申报文件。'], image: '' },
  { cat: 'chem', tag: TAG.raw, t: ['원자재', 'Raw materials', '原材料'], d: ['수지 · 금속 소재 · 필름, 등급 및 로트 단위 소싱', 'Resin, metal stock and film sourced by grade and lot.', '按等级与批次采购树脂、金属材料与薄膜。'], image: '' },
];

export const trust = {
  eyebrow: '04 — SECURITY & CONTRACT',
  h2: ['도면은 유출되지 않습니다', 'Your drawings do not leave the room', '您的图纸不会外流'],
  cards: [
    { t: ['NNN 계약 선행', 'NNN agreement, always first', 'NNN 协议，始终优先'], d: ['비공개 · 비사용 · 우회금지. 도면이나 샘플을 공유하기 전, 협력하는 모든 공장과 체결합니다.', 'Non-disclosure, non-use, non-circumvention — signed with every partner factory before drawings or samples are shared.', '不披露、不使用、不规避 —— 在共享图纸或样品之前，与每一家合作工厂签署。'] },
    { t: ['계약서 작성 후 양산', 'Contract before mass production', '量产前签订合同'], d: ['사양 · 단가 · 납기 · 검사 기준 · 불량 처리를 문서로 확정한 뒤 라인을 돌립니다.', 'Spec, unit price, schedule, inspection standard and defect handling are fixed in writing before the line starts.', '规格、单价、交期、检验标准与不良处理，在开线前以书面固定。'] },
    { t: ['한국 본사 단일 창구', 'One counterpart in Korea', '韩国单一对接窗口'], d: ['모든 업무는 한국 본사에서 진행합니다. 계약 · 정산 · 기록이 국내 조건 아래 남습니다.', 'All business runs through the Korean head office — contract, settlement and records under Korean terms.', '所有业务通过韩国总部进行 —— 合同、结算与记录均依韩国条款。'] },
  ],
};

export const contact = {
  eyebrow: '05 — GET STARTED',
  h2: ['만들고 싶은 것을 알려주세요', 'Send us what you want made', '告诉我们您想生产什么'],
  body: ['도면, 사진, 혹은 문장 하나로도 시작할 수 있습니다. 영업일 기준 1일 이내 회신드리며, 견적 · QC 리포트 · 물류 현황을 한곳에서 보는 AEGIS Cloud 계정을 발급해 드립니다.', 'A drawing, a photo or a sentence is enough to start. We reply within one business day, and open a AEGIS Cloud account where your quote, QC reports and shipping status live in one place.', '一张图纸、一张照片或一句话即可开始。我们将在一个工作日内回复，并开通 AEGIS Cloud 账号，报价、QC 报告与物流状态集中可见。'],
  hqLabel: ['한국 본사', 'KOREA HQ', '韩国总部'],
  hq: ['계약 · 정산 · 지원 업무', 'All contracts, settlement and support', '合同、结算与支持'],
  szLabel: ['중국 선전 지사', 'SHENZHEN BRANCH', '深圳分公司'],
  sz: ['가격 협상 · 공장 검증 · QC · 출하', 'Negotiation, factory audit, QC, shipping', '议价、验厂、QC、运输'],
};

export const form = {
  company: ['회사명', 'Company', '公司名称'],
  companyPh: ['예) 주식회사 아이지스', 'e.g. AEGIS Co., Ltd.', '例：AEGIS 有限公司'],
  name: ['담당자명', 'Contact name', '联系人'],
  namePh: ['이름', 'Full name', '姓名'],
  phone: ['연락처', 'Phone', '联系电话'],
  phonePh: ['010-0000-0000', '010-0000-0000', '010-0000-0000'],
  email: ['이메일', 'Email', '邮箱'],
  emailPh: ['you@company.com', 'you@company.com', 'you@company.com'],
  category: ['품목 카테고리', 'Category', '品类'],
  quantity: ['발주 예정 수량', 'Order quantity', '订购数量'],
  quantityPh: ['예) 500개 / 2대', 'e.g. 500 pcs / 2 units', '例：500 个 / 2 台'],
  price: ['희망 단가', 'Target unit price', '目标单价'],
  pricePh: ['선택 입력', 'Optional', '可不填'],
  detail: ['어떤 제품을 만들고 싶으신가요?', 'What do you want made?', '想要生产什么？'],
  detailPh: ['사양, 재질, 참고 링크, 희망 납기 등 알고 계신 내용을 적어주세요.', 'Specs, materials, reference links, deadline — anything you already know.', '规格、材质、参考链接、交期 —— 已知信息均可填写。'],
  attach: ['도면 · 사진 첨부', 'Attach drawings or photos', '上传图纸或照片'],
  attachSub: ['STEP, DWG, PDF, JPG · 업로드 시점부터 NNN 적용', 'STEP, DWG, PDF, JPG · NNN applies from the moment you upload', 'STEP、DWG、PDF、JPG · 上传即适用 NNN'],
  submit: ['견적 요청하고 AEGIS Cloud 계정 받기', 'Request a quote & get a AEGIS Cloud account', '索取报价并开通 AEGIS Cloud 账号'],
  sending: ['전송 중...', 'Sending...', '发送中...'],
  consent: ['제출 시 위 정보가 견적 목적에 한해 처리되는 것에 동의하게 됩니다.', 'By submitting you agree to our handling of the information above for quotation purposes only.', '提交即表示同意上述信息仅用于报价用途。'],
  doneTitle: ['문의가 접수되었습니다', 'Your request has been received', '询价已提交'],
  doneBody: ['영업일 기준 1일 이내에 담당자가 회신드립니다. AEGIS Cloud 계정 발급 안내는 입력하신 이메일로 보내드립니다.', 'We will reply within one business day. Account instructions will be sent to the email you provided.', '我们将在一个工作日内回复。账号开通指引将发送至您填写的邮箱。'],
  again: ['다시 문의하기', 'Send another request', '再次咨询'],
  error: ['전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'Something went wrong. Please try again shortly.', '发送失败，请稍后重试。'],
  tooMany: ['같은 이메일로 최근에 접수된 문의가 있습니다. 잠시 후 다시 시도해 주세요.', 'A request from this email was received recently. Please try again later.', '该邮箱近期已提交过询价，请稍后重试。'],
};

// 폼 카테고리 태그 — value 는 ManufacturingLead.categories enum (한국어 고정)
export const formTags = [
  { value: '기계설비', label: ['기계설비', 'Machinery', '机械设备'] },
  { value: '정밀가공', label: ['정밀가공', 'Precision parts', '精密加工'] },
  { value: '전자 · 전기', label: ['전자 · 전기', 'Electronics', '电子电器'] },
  { value: '뷰티 · 의료', label: ['뷰티 · 의료', 'Beauty · Medical', '美容医疗'] },
  { value: '리빙 · 공구', label: ['리빙 · 공구', 'Living · Tools', '家居工具'] },
  { value: '굿즈 · 조형', label: ['굿즈 · 조형', 'Goods · Figures', '周边造型'] },
  { value: '기타', label: ['기타', 'Other', '其他'] },
];

export const footer = {
  tagline: ['한국 본사 · 중국 선전 지사 · 공장 소싱, QC, 배송 및 통관', 'Korean HQ · Shenzhen branch · Factory sourcing, QC, shipping and customs', '韩国总部 · 深圳分公司 · 工厂采购、QC、运输与清关'],
  copyright: '© 2026 AEGIS',
};