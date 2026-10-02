// 상세 요금 비교 (/pricing) — 모든 문구 [ko, en, zh], VAT 별도
const T = (ko, en, zh) => [ko, en, zh];
const TEAM = T('한국 PM 1 + 중국 현지 QC·PM 2', 'Korea PM 1 + China QC·PM 2', '韩国 PM 1 + 中国现场 QC·PM 2');
const INC = T('포함', 'Included', '包含');
const QUOTE_COST = T('신규 견적마다 + 원가 구성 검토', 'Every new quote + cost breakdown review', '每份新报价 + 成本构成审核');
const QC = T('출고 건마다 + 검수 보고서', 'Every shipment + inspection report', '每批出货 + 检验报告');

export const page = {
  meta: T('AEGIS 제조팀 구독 플랜 · 상세 요금 비교', 'AEGIS manufacturing team plans · Pricing', 'AEGIS 制造团队订阅方案 · 价格对比'),
  desc: T('라이트·스탠다드·프로 구독 플랜 비교, 포함 범위와 실비, 단건 상품, 계약 조건 안내.', 'Compare Lite, Standard and Pro plans, what is included, pass-through costs, single services and contract terms.', '对比轻量版、标准版、专业版方案，了解包含范围、实费、单次服务与合同条件。'),
  h1: T('제조팀 구독 플랜 상세 비교', 'Manufacturing team plans in detail', '制造团队订阅方案详细对比'),
  lead: T('세 플랜 모두 같은 담당 팀(한국 PM 1명 + 중국 현지 QC·PM 2명)이 맡습니다. 플랜에 따라 관리 범위와 현장 방문 횟수가 달라집니다. VAT 별도.', 'All three plans are served by the same assigned team (1 PM in Korea + 2 QC·PMs in China). Plans differ in scope and number of site visits. VAT excluded.', '三个方案均由同一负责团队（韩国 PM 1 名 + 中国现场 QC·PM 2 名）承担，差异在于管理范围与现场走访次数。不含增值税。'),
  compareTitle: T('플랜 비교', 'Plan comparison', '方案对比'),
  includedTitle: T('포함 범위와 실비', 'Included vs. billed at cost', '包含范围与实费'),
  singlesTitle: T('단건 상품 (구독 전 체험)', 'Single services (try before subscribing)', '单次服务（订阅前体验）'),
  termsTitle: T('계약 조건', 'Contract terms', '合同条件'),
  item: T('항목', 'Item', '项目'),
  condition: T('조건', 'Terms', '条件'),
  incHead: [T('구독료에 포함', 'Included in subscription', '订阅费包含'), T('실비로 따로 청구', 'Billed separately at cost', '按实费另行收取')],
  singleHead: [T('상품', 'Service', '服务'), T('내용', 'Scope', '内容'), T('결과물', 'Deliverable', '交付物'), T('가격 (VAT 별도)', 'Price (excl. VAT)', '价格（不含增值税）')],
  ctaTitle: T('어떤 플랜이 맞을지 무료 상담으로 안내해 드립니다', 'We will recommend the right plan in a free consultation', '免费咨询，为您推荐合适方案'),
  ctaBtn: T('무료 상담 요청', 'Request a free consultation', '申请免费咨询'),
  detailBtn: T('상세 요금 비교하기 →', 'Compare plans in detail →', '查看详细价格对比 →'),
};

const ENT_NAME = T('엔터프라이즈', 'Enterprise', '企业版');
export const plans = [T('라이트', 'Lite', '轻量版'), T('스탠다드 (추천)', 'Standard (recommended)', '标准版（推荐）'), T('프로', 'Pro', '专业版'), ENT_NAME];

const NEG = T('협의', 'By agreement', '协商');
// 비교표 엔터프라이즈 열 (그룹 행 제외, 순서대로)
const ENT_COL = [
  T('별도 협의', 'Custom pricing', '单独洽谈'),
  T('대량 발주, 여러 제품 라인, 장기 반복 생산', 'Volume orders, multiple product lines, long-term repeat production', '大批量订单、多条产品线、长期重复生产'),
  T('이 고객만 맡는 전담 팀 1개 이상, 현지 인력 추가 배정', 'One or more teams dedicated to you, with extra local staff', '一支以上专属团队，可增派现场人员'),
  T('협의 (제품·공장 수 제한 없음)', 'By agreement (no limit on products or factories)', '协商（产品与工厂数量不限）'),
  T('협의 + 대체 공장 확보', 'By agreement + backup factory', '协商 + 确保备选工厂'),
  QUOTE_COST,
  NEG,
  T('주 단위 또는 공장 상주', 'Weekly or on-site at the factory', '按周走访或驻厂'),
  T('프로 + 불량 원인 분석과 재발 방지 보고서, 정기 공장 감사', 'Pro + defect root-cause & prevention report, regular audits', '专业版 + 不良原因分析与防再发报告、定期验厂'),
  T('생산·재고 계획 관리', 'Production & inventory planning', '生产与库存计划管理'),
  NEG,
  T('분할 납품 + 생산·재고 계획 조율', 'Split deliveries + production/inventory planning', '分批交付 + 生产库存计划协调'),
  T('주 1회 + 분기 경영 리뷰, 계약 지표(납기 준수율·불량률)', 'Weekly + quarterly business review, contract KPIs (on-time, defect rate)', '每周 + 季度经营复盘、合同指标（准时率、不良率）'),
  INC,
  INC,
  T('12개월', '12 months', '12 个月'),
];

const BASE_ROWS = [
  [T('월 구독료 (VAT 별도)', 'Monthly fee (excl. VAT)', '月订阅费（不含增值税）'), T('150만원', 'KRW 1.5M', '150 万韩元'), T('300만원', 'KRW 3M', '300 万韩元'), T('500만원 이상', 'KRW 5M+', '500 万韩元起')],
  [T('이런 프로젝트에', 'Best for', '适用项目'), T('부품 소싱, 단일 사출품, 같은 품목 반복 발주', 'Part sourcing, single moulded parts, repeat orders', '零件采购、单一注塑件、同品项复购'), T('사출 + 후가공 + 조립, 여러 부품을 모아 하나의 제품으로', 'Moulding + finishing + assembly, multiple parts into one product', '注塑 + 后加工 + 组装，多零件组成一个产品'), T('완제품 개발, 시제품부터 양산까지, 인증 필요', 'Full product development, prototype to mass production, certification', '整机开发，从样品到量产，需认证')],
  [T('담당 팀', 'Assigned team', '负责团队'), TEAM, TEAM, TEAM],
  [T('관리 범위', 'Scope', '管理范围'), T('품목 1개, 공장 1곳', '1 item, 1 factory', '1 个品项，1 家工厂'), T('품목 3개까지, 공장 3곳까지', 'Up to 3 items, 3 factories', '最多 3 个品项，3 家工厂'), T('제품 1개의 모든 부품, 공장 6곳까지', 'All parts of 1 product, up to 6 factories', '1 个产品的全部零件，最多 6 家工厂')],
  { group: T('찾는다', 'FIND', '寻找') },
  [T('공장 소싱', 'Factory sourcing', '工厂采购'), T('후보 공장 3곳 비교', 'Compare 3 candidate factories', '比较 3 家候选工厂'), T('후보 공장 4곳 비교', 'Compare 4 candidate factories', '比较 4 家候选工厂'), T('후보 공장 10곳 비교 + 공장 이원화', 'Compare 10 factories + dual sourcing', '比较 10 家候选工厂 + 双供应商')],
  [T('견적 검증', 'Quote verification', '报价核验'), T('신규 견적마다', 'Every new quote', '每份新报价'), QUOTE_COST, QUOTE_COST],
  [T('제조 컨설팅', 'Manufacturing consulting', '制造咨询'), T('사양·도면 검토', 'Spec & drawing review', '规格与图纸审核'), T('공정·소재·원가 개선 제안', 'Process, material & cost improvements', '工艺、材料与成本改进建议'), T('설계 단계부터 양산성 검토(DFM), 금형 사양 검토', 'DFM review from design stage, tooling spec review', '从设计阶段起做 DFM 审核，模具规格审核')],
  { group: T('지킨다', 'PROTECT', '守护') },
  [T('현장 방문', 'Site visits', '现场走访'), T('월 1회', '1× / month', '每月 1 次'), T('월 2회', '2× / month', '每月 2 次'), T('월 4회', '4× / month', '每月 4 次')],
  [T('출고 전 검수', 'Pre-shipment inspection', '出货前检验'), QC, QC, T('출고 건마다 + 검수 보고서 + 양산 중간 검수', 'Every shipment + report + in-line production inspection', '每批出货 + 检验报告 + 量产中期检验')],
  [T('일정관리', 'Schedule control', '进度管理'), T('주요 날짜(발주·출고)', 'Key dates (order, dispatch)', '关键日期（下单、出货）'), T('주간 일정표 + 지연 사전 경고', 'Weekly schedule + early delay alerts', '周进度表 + 延期预警'), T('주간 일정표 + 지연 사전 경고 + 단계별 승인 관리', 'Weekly schedule + delay alerts + stage approvals', '周进度表 + 延期预警 + 分阶段审批')],
  [T('인증·서류', 'Certification & documents', '认证与单证'), T('무역 서류 점검', 'Trade document check', '贸易单证检查'), T('무역 서류 + 인증 필요 여부 검토', 'Trade documents + certification needs review', '贸易单证 + 认证需求评估'), T('인증(KC 등) 진행 관리. 시험비는 실비', 'Certification (KC etc.) management. Test fees at cost', '认证（KC 等）进度管理，测试费按实费')],
  { group: T('전한다', 'DELIVER', '交付') },
  [T('납품·물류', 'Delivery & logistics', '交付与物流'), T('출고·선적 조율', 'Dispatch & shipping coordination', '出货与装运协调'), T('출고·선적·통관 서류 조율', 'Dispatch, shipping & customs documents', '出货、装运与清关单证协调'), T('출고·선적·통관·분할 납품 조율', 'Dispatch, shipping, customs & split deliveries', '出货、装运、清关与分批交付协调')],
  { group: T('공통', 'ALL PLANS', '通用') },
  [T('진행 보고', 'Progress reports', '进度报告'), T('격주 1회', 'Every 2 weeks', '每两周 1 次'), T('주 1회', 'Weekly', '每周 1 次'), T('주 1회 + 월 1회 화상 리뷰', 'Weekly + monthly video review', '每周 1 次 + 每月视频复盘')],
  [T('AEGIS Cloud', 'AEGIS Cloud', 'AEGIS Cloud'), INC, INC, INC],
  [T('월간 리포트', 'Monthly report', '月度报告'), T('—', '—', '—'), INC, INC],
  [T('최소 계약', 'Minimum term', '最短合同期'), T('3개월', '3 months', '3 个月'), T('3개월', '3 months', '3 个月'), T('6개월', '6 months', '6 个月')],
];
let entIdx = 0;
export const compareRows = BASE_ROWS.map((r) => (r.group ? r : [...r, ENT_COL[entIdx++]]));

export const enterprise = {
  name: ENT_NAME,
  price: T('별도 협의', 'Custom pricing', '单独洽谈'),
  priceSub: T('전담 팀 1개부터', 'From one dedicated team', '一支专属团队起'),
  ex: T('대량 발주, 여러 제품 라인, 장기 반복 생산', 'Volume orders, multiple product lines, long-term repeat production', '大批量订单、多条产品线、长期重复生产'),
  lines: [
    [T('팀', 'Team', '团队'), T('이 고객만 맡는 전담 팀, 인력 추가 배정', 'A team dedicated to you, with extra staff as needed', '只服务贵司的专属团队，可增派人员')],
    [T('현장 방문', 'Site visits', '现场走访'), T('주 단위 또는 공장 상주', 'Weekly or on-site at the factory', '按周走访或驻厂')],
    [T('품질', 'Quality', '质量'), T('불량 원인 분석, 정기 공장 감사', 'Defect root-cause analysis, regular factory audits', '不良原因分析、定期验厂')],
    [T('최소 계약', 'Minimum term', '最短合同期'), T('12개월', '12 months', '12 个月')],
  ],
  cta: T('엔터프라이즈 상담 신청', 'Talk to us about Enterprise', '咨询企业版'),
  blockTitle: T('대규모 생산이라면, 엔터프라이즈', 'For large-scale production: Enterprise', '大规模生产，选择企业版'),
  blockLead: T('대량 발주와 지속적인 관리에는 더 많은 사람이 필요합니다. 엔터프라이즈는 귀사만 맡는 전담 팀을 두고, 필요한 만큼 현지 인력을 늘려 운영합니다. 범위와 금액은 상담 후 협의합니다.', 'Volume orders and ongoing management need more people. Enterprise gives you a team dedicated only to your company, scaled up with local staff as needed. Scope and price are agreed after consultation.', '大批量订单与持续管理需要更多人力。企业版为贵司配备专属团队，并按需增派现场人员。范围与价格在咨询后协商确定。'),
  blockNote: T('전담 인력을 배정한 뒤 시작하며, 보통 2~4주가 걸립니다.', 'Work starts once dedicated staff are assigned, usually within 2–4 weeks.', '专属人员到位后开始，一般需要 2~4 周。'),
  rows: [
    [T('팀', 'Team', '团队'), T('이 고객만 맡는 전담 팀 1개 이상. 현지 인력 추가 배정 가능', 'One or more teams dedicated only to you. Extra local staff available', '一支以上只服务贵司的专属团队，可增派现场人员')],
    [T('관리 범위', 'Scope', '管理范围'), T('협의 (제품·공장 수 제한 없음)', 'By agreement (no limit on products or factories)', '协商（产品与工厂数量不限）')],
    [T('현장 방문', 'Site visits', '现场走访'), T('주 단위 또는 공장 상주, 협의', 'Weekly or on-site at the factory, by agreement', '按周走访或驻厂，协商确定')],
    [T('품질', 'Quality', '质量'), T('출고 검수 + 양산 중간 검수 + 불량 원인 분석과 재발 방지 보고서, 정기 공장 감사, 품질 지표 관리', 'Shipment + in-line inspection + defect root-cause & prevention reports, regular audits, quality KPIs', '出货与量产中期检验 + 不良原因分析与防再发报告、定期验厂、质量指标管理')],
    [T('공급망', 'Supply chain', '供应链'), T('분할 납품 조율 + 생산·재고 계획, 대체 공장 확보', 'Split deliveries + production/inventory planning, backup factories', '分批交付协调 + 生产库存计划、确保备选工厂')],
    [T('보고', 'Reporting', '报告'), T('주 1회 + 월 1회 화상 리뷰 + 분기 경영 리뷰, 계약 지표(납기 준수율, 불량률)', 'Weekly + monthly video + quarterly business review, contract KPIs (on-time rate, defect rate)', '每周 + 每月视频 + 季度经营复盘，合同指标（准时率、不良率）')],
    [T('최소 계약', 'Minimum term', '最短合同期'), T('12개월', '12 months', '12 个月')],
  ],
};

export const startEnterpriseInquiry = () =>
  window.dispatchEvent(new CustomEvent('aegis:inquiry-type', { detail: { type: 'monthly', interest: 'ENTERPRISE' } }));

export const compareNotes = [
  T('담당 팀은 여러 고객사를 함께 맡는 "담당 팀 배정" 방식입니다.', 'The assigned team serves several clients; it is an assigned, not dedicated, team.', '负责团队同时服务多家客户，采用"分配负责团队"方式。'),
  T('현장 방문은 중국 현지 직원이 공장에서 공정·재고·품질을 확인하고 사진과 함께 AEGIS Cloud에 올리는 것을 말합니다. 출고 전 검수는 방문 횟수에 포함되지 않습니다.', 'A site visit means our China staff check process, stock and quality at the factory and post photos to AEGIS Cloud. Pre-shipment inspections are not counted as visits.', '现场走访指中国员工到厂确认工序、库存与质量，并附照片上传至 AEGIS Cloud。出货前检验不计入走访次数。'),
  T('관리 범위를 넘으면 플랜을 올리거나 계약을 하나 더 맺습니다.', 'If scope is exceeded, upgrade the plan or add another contract.', '超出管理范围时，可升级方案或追加一份合同。'),
  T('프로는 제품 범위와 인증 여부에 따라 상담 후 금액을 정합니다.', 'Pro is priced after consultation, based on product scope and certification needs.', '专业版根据产品范围与认证需求，咨询后确定价格。'),
  T('더 큰 규모는 엔터프라이즈로 상담합니다.', 'Larger scope? See Enterprise below.', '更大规模请咨询企业版。'),
];

export const included = [
  [T('공장 탐색·비교·가격 협상', 'Factory search, comparison & negotiation', '工厂寻找、比较与议价'), T('제품 대금(공장에 직접 또는 대행 정산)', 'Product cost (paid to factory or via us)', '货款（直付工厂或代为结算）')],
  [T('견적 검증과 도면·사양 검토', 'Quote verification and drawing/spec review', '报价核验与图纸规格审核'), T('샘플·시제품 제작비', 'Samples & prototypes', '样品与原型制作费')],
  [T('플랜별 횟수만큼의 현장 방문', 'Site visits per plan', '按方案次数的现场走访'), T('금형비', 'Tooling', '模具费')],
  [T('출고 전 검수와 검수 보고서', 'Pre-shipment inspection & report', '出货前检验与报告'), T('물류비(중국 내륙 운송, 해운·항공, 국내 배송)', 'Logistics (China inland, sea/air, Korea delivery)', '物流费（中国内陆、海运/空运、韩国配送）')],
  [T('일정표 관리와 지연 경고', 'Schedule tracking & delay alerts', '进度管理与延期预警'), T('관세·부가세·통관 수수료', 'Duties, VAT & customs fees', '关税、增值税与清关费')],
  [T('무역 서류 점검과 선적·통관 조율', 'Trade documents, shipping & customs coordination', '贸易单证检查与装运清关协调'), T('인증 시험·인증 기관 수수료', 'Certification tests & agency fees', '认证测试与机构费用')],
  [T('AEGIS Cloud 계정과 회사 내 추가 계정', 'AEGIS Cloud account plus extra company seats', 'AEGIS Cloud 账号及公司追加账号'), T('광둥성 밖 공장 방문 시 교통·숙박비', 'Travel & lodging for factories outside Guangdong', '广东省外工厂走访的交通住宿费')],
  [T('한국어↔중국어 소통(문의·요구사항 번역)', 'Korean↔Chinese communication & translation', '韩中沟通（咨询与需求翻译）'), T('플랜 횟수를 넘는 추가 방문·검수(단건 가격 적용)', 'Extra visits/inspections beyond plan (single-service price)', '超出方案次数的追加走访/检验（按单次价格）')],
];

export const includedNotes = [
  T('실비는 진행 전에 견적을 보여드리고 승인을 받은 뒤 집행합니다. AEGIS Cloud 결제 탭에서 승인 상태를 확인할 수 있습니다.', 'Pass-through costs are quoted and approved by you before we spend them. Track approvals in the AEGIS Cloud payment tab.', '实费在执行前先报价并经您批准，可在 AEGIS Cloud 付款标签查看审批状态。'),
  T('광둥성 안(선전·동관·광저우·포산·중산 등) 방문은 교통비를 따로 받지 않습니다.', 'No travel charges for visits within Guangdong (Shenzhen, Dongguan, Guangzhou, Foshan, Zhongshan, etc.).', '广东省内（深圳、东莞、广州、佛山、中山等）走访不另收交通费。'),
  T('구독료와 실비 외에 따로 청구하는 비용이 없습니다.', 'We bill nothing beyond the subscription fee and pass-through costs.', '除订阅费与实费外，不另行收取其他费用。'),
];

export const singles = [
  [T('공장 실사 1회', 'Factory audit (1×)', '验厂 1 次'), T('광둥성 내 공장 1곳 방문. 설비, 생산 능력, 품질 관리 체계, 사업자 정보 확인', 'Visit 1 factory in Guangdong: equipment, capacity, QC system, business registration', '走访广东省内 1 家工厂，确认设备、产能、品控体系与营业信息'), T('사진·영상 포함 실사 보고서(한국어)', 'Audit report with photos & video (Korean)', '含照片视频的验厂报告（韩语）'), T('50만원', 'KRW 500K', '50 万韩元')],
  [T('출고 전 검품 1회', 'Pre-shipment inspection (1×)', '出货前验货 1 次'), T('출고 직전 현장 검품 1인·1일. 수량, 외관, 치수, 포장 확인', '1 inspector, 1 day before dispatch: quantity, appearance, dimensions, packing', '出货前现场验货 1 人 1 天，确认数量、外观、尺寸与包装'), T('검품 보고서(합격·불합격 판정, 사진)', 'Inspection report (pass/fail, photos)', '验货报告（合格判定与照片）'), T('40만원', 'KRW 400K', '40 万韩元')],
  [T('견적 검증 1건', 'Quote review (1 quote)', '报价核验 1 份'), T('받으신 중국 공장 견적서 1건의 원가 구성, 사양 누락, 납기 현실성 검토', 'Review cost structure, missing specs and lead-time realism of 1 factory quote', '审核 1 份中国工厂报价的成本构成、规格遗漏与交期合理性'), T('검토 의견서 + 협상 포인트', 'Review memo + negotiation points', '审核意见书 + 谈判要点'), T('30만원', 'KRW 300K', '30 万韩元')],
];

export const singleNotes = [
  T('단건 상품 구매 후 30일 안에 구독을 시작하면 단건 금액을 첫 달 구독료에서 차감합니다.', 'Subscribe within 30 days and the single-service fee is deducted from your first month.', '购买单次服务后 30 天内订阅，可从首月订阅费中抵扣。'),
  T('단건 상품도 AEGIS Cloud 계정을 발급하고, 보고서는 파일 탭으로 전달합니다.', 'Single services include an AEGIS Cloud account; reports arrive in the files tab.', '单次服务同样开通 AEGIS Cloud 账号，报告通过文件标签交付。'),
  T('광둥성 밖 공장은 교통·숙박비를 실비로 더합니다.', 'Factories outside Guangdong add travel and lodging at cost.', '广东省外工厂另加交通住宿实费。'),
];

export const terms = [
  [T('계약 단위', 'Contract unit', '合同单位'), T('프로젝트 1개 = 계약 1건', '1 project = 1 contract', '1 个项目 = 1 份合同')],
  [T('최소 기간', 'Minimum term', '最短期限'), T('라이트·스탠다드 3개월, 프로 6개월', 'Lite/Standard 3 months, Pro 6 months', '轻量版/标准版 3 个月，专业版 6 个月')],
  [T('최대 기간', 'Maximum term', '最长期限'), T('12개월, 이후 갱신', '12 months, then renewal', '12 个月，之后续约')],
  [T('해지', 'Termination', '解约'), T('최소 기간 이후 1개월 전 서면 통보', '1 month written notice after minimum term', '最短期限后提前 1 个月书面通知')],
  [T('다수 계약 할인', 'Multi-contract discount', '多合同折扣'), T('같은 회사의 두 번째 계약부터 10%', '10% from the second contract of the same company', '同一公司第二份合同起 9 折')],
  [T('6개월 계약 혜택', '6-month benefit', '6 个月合同优惠'), T('공장 실사 1회 무료', '1 free factory audit', '免费验厂 1 次')],
  [T('12개월 계약 혜택', '12-month benefit', '12 个月合同优惠'), T('월 구독료 10% 할인 + 생산 공백기 일시 정지 1회(최대 1개월)', '10% off monthly fee + one pause during production gaps (up to 1 month)', '月费 9 折 + 生产空档期暂停 1 次（最长 1 个月）')],
  [T('플랜 올리기', 'Upgrade', '升级方案'), T('언제든, 다음 달부터 적용', 'Anytime, from next month', '随时，次月生效')],
  [T('플랜 내리기', 'Downgrade', '降级方案'), T('최소 기간 이후, 다음 달부터 적용', 'After minimum term, from next month', '最短期限后，次月生效')],
  [T('결제', 'Billing', '付款'), T('매월 초 선불, 세금계산서 발행', 'Prepaid at the start of each month, tax invoice issued', '每月初预付，开具税务发票')],
  [ENT_NAME, T('최소 12개월, 범위와 금액은 협의', 'Minimum 12 months, scope and price agreed', '最短 12 个月，范围与价格协商确定')],
];
export const termsNote = T('할인은 중복 적용되지 않습니다. 모든 금액은 VAT 별도입니다. 프로는 상담 후 결정합니다.', 'Discounts do not stack. All prices exclude VAT. Pro is priced after consultation.', '折扣不可叠加。所有价格均不含增值税。专业版咨询后确定价格。');

// 메인 플랜 카드: 가격 + 핵심 4줄(관리 범위, 현장 방문, 보고 주기, 최소 계약)
const KEY_ROWS = [3, 9, 16, 19];
export const planCards = plans.slice(0, 3).map((name, i) => ({
  name,
  price: compareRows[0][i + 1],
  ex: compareRows[1][i + 1],
  lines: KEY_ROWS.map((r) => [compareRows[r][0], compareRows[r][i + 1]]),
  highlight: i === 1,
}));