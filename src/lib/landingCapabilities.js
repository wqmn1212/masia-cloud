// 메인페이지 기술력 · 합리적인 가격 · 고객 편의 기능(AEGIS Cloud) 섹션 — 모든 문구는 [ko, en, zh]
// 화면에 소개하는 기능은 실제로 앱에 있는 것만 적는다. 수치로 된 약속(절감률 등)은 근거 없이 넣지 않는다.

export const capabilities = {
  eyebrow: '01 — CAPABILITIES',
  h2: ['도면이 없어도, 아이디어부터 양산까지 만듭니다', 'No drawings? We take your idea all the way to mass production', '没有图纸也没关系，从创意一路做到量产'],
  sub: [
    '좋은 제품은 공장을 찾는 것만으로 나오지 않습니다. 이지스는 설계 검토, 회로, 금형, 시험, 품질 관리를 직접 다루는 기술과 도구로 개발 기간과 시행착오를 줄입니다.',
    'Good products take more than finding a factory. AEGIS handles design review, circuits, tooling, testing and quality control in-house, with our own tools, to cut development time and trial and error.',
    '好产品不只是找到工厂。AEGIS 以自有技术和工具亲自处理设计评审、电路、模具、测试与品质管理，缩短开发周期、减少反复试错。',
  ],
  demoTitle: ['컨셉 스튜디오', 'Concept Studio', '概念工作室'],
  demoCaption: [
    '예시: “책상 위에 두는 원통형 미니 공기청정기” 한 문장으로 만든 미팅용 3D 프리뷰입니다. 끌어서 돌려 보세요.',
    'Example: a meeting-ready 3D preview built from one sentence — “a small cylindrical air purifier for the desk”. Drag to rotate.',
    '示例：仅凭一句“放在桌上的圆柱形迷你空气净化器”生成的会议用 3D 预览。拖动即可旋转。',
  ],
  demoNote: ['개념 시각화이며 실제 설계 도면이 아닙니다.', 'Concept visualisation, not a production drawing.', '此为概念可视化，并非实际设计图纸。'],
  demoLoading: ['3D 미리보기를 불러오는 중', 'Loading 3D preview', '正在加载 3D 预览'],
  demoFallback: ['이 브라우저에서는 3D 미리보기를 표시할 수 없습니다.', '3D preview is not available in this browser.', '当前浏览器无法显示 3D 预览。'],
  demoTags: [['3D 프리뷰', '3D preview', '3D 预览'], ['회로 검토', 'Circuit review', '电路评审'], ['사출·금형 검토', 'Moulding review', '注塑·模具评审'], ['미팅용 PDF', 'Meeting PDF', '会议用 PDF']],
  items: [
    { icon: 'concept', t: ['아이디어 → 3D 컨셉', 'Idea → 3D concept', '创意 → 3D 概念'], d: ['아이디어를 듣고 확인할 조건을 정리한 뒤, 미팅 자리에서 돌려 볼 수 있는 3D 프리뷰와 렌더 이미지를 만듭니다.', 'We clarify the open questions, then build a 3D preview and render you can turn around right in the meeting.', '先梳理需要确认的条件，再生成可在会议现场旋转查看的 3D 预览与渲染图。'] },
    { icon: 'circuit', t: ['회로 · PCB', 'Circuits & PCB', '电路 · PCB'], d: ['회로 구성과 부품표를 정리하고 전류·전력을 계산해 위험을 미리 찾습니다. 구매 가능한 부품번호로 확정해 기판 조립까지 연결합니다.', 'We lay out the circuit and BOM, calculate current and power to catch risks early, and lock in purchasable part numbers through to board assembly.', '整理电路结构与物料清单，计算电流与功率提前发现风险，并确定可采购的料号，一直衔接到电路板组装。'] },
    { icon: 'mold', t: ['사출 · 금형 사전 검토', 'Moulding & tooling review', '注塑 · 模具预审'], d: ['STEP 도면으로 구배·언더컷·살 두께를 미리 보고, 공장에 보낼 금형 설계 지시서를 한국어·중국어로 만듭니다.', 'From a STEP file we check draft, undercuts and wall thickness up front, and write the tooling brief for the factory in Korean and Chinese.', '通过 STEP 图纸预先检查拔模斜度、倒扣与壁厚，并以韩中双语出具发给工厂的模具设计说明书。'] },
    { icon: 'test', t: ['시제품 시험 · 개선', 'Prototype testing', '样机测试 · 改进'], d: ['시험 결과를 버전마다 기록하고 원인을 분석해, 다음 시제품에서 고칠 것을 정리합니다.', 'Test results are logged per version and analysed, so the next prototype fixes the right things.', '按版本记录测试结果并分析原因，梳理下一版样机需要改进的地方。'] },
    { icon: 'quality', t: ['양산 품질 관리', 'Production quality', '量产品质管理'], d: ['제품마다 시리얼 단위로 검사 결과를 남기고, 불량은 공정·원인별로 기록해 출고 전에 걸러냅니다.', 'Every unit gets a serial-level inspection record; defects are logged by process and cause and caught before shipment.', '每件产品按序列号留存检验记录，不良按工序与原因记录，在出货前拦截。'] },
    { icon: 'docs', t: ['인증 · 수출입 서류', 'Certification & trade documents', '认证 · 进出口单证'], d: ['KC 등 수입 요건을 미리 확인하고, 배터리 제품의 운송 서류(UN38.3·MSDS)까지 챙깁니다.', 'We check import requirements such as KC early, down to transport documents for battery products (UN38.3, MSDS).', '提前确认 KC 等进口要求，连电池产品的运输文件（UN38.3、MSDS）也一并准备。'] },
  ],
  note: ['AI가 만든 초안은 담당 엔지니어가 검토한 뒤 전달합니다.', 'AI-generated drafts are reviewed by our engineers before they reach you.', 'AI 生成的初稿均由负责工程师审核后再交付。'],
};

export const value = {
  eyebrow: '02 — WHY IT COSTS LESS',
  h2: ['좋은 제품을, 합리적인 가격에', 'Better products, at a fair price', '好产品，合理的价格'],
  sub: [
    '싸게 만드는 방법은 단가를 깎는 것만이 아닙니다. 설계부터 공장 선정, 물류, 품질까지 비용이 새는 곳을 막습니다.',
    'Lower cost is not just haggling over unit price. We plug the leaks from design and factory selection through logistics and quality.',
    '降低成本不只是压单价。我们从设计、工厂选择到物流与品质，堵住每一个漏钱的环节。',
  ],
  items: [
    { t: ['공장과 직접 협상', 'Direct negotiation', '直接与工厂议价'], d: ['중간 유통사 없이 광둥성 현지 직원이 공장을 직접 만나 가격을 협상합니다.', 'No middlemen: our Guangdong staff meet factories in person and negotiate the price.', '没有中间商，广东本地员工亲自与工厂面谈议价。'] },
    { t: ['여러 공장 비교', 'Compare factories', '多家工厂比价'], d: ['같은 사양으로 여러 공장의 견적을 받아 단가·납기·조건을 나란히 비교한 뒤 고릅니다.', 'Quotes from several factories on the same spec, compared side by side on price, lead time and terms.', '按同一规格向多家工厂询价，并排比较单价、交期与条件后再选择。'] },
    { t: ['설계에서 원가 절감', 'Cost down by design', '从设计降低成本'], d: ['금형 수 줄이기, 알맞은 살 두께, 표준 부품처럼 만들기 쉬운 설계로 금형비와 단가를 낮춥니다.', 'Fewer moulds, the right wall thickness, standard parts — design for manufacturing lowers tooling and unit cost.', '减少模具数量、合理壁厚、采用标准件——以易于制造的设计降低模具费与单价。'] },
    { t: ['도착 원가까지 미리', 'Landed cost up front', '提前算到落地成本'], d: ['물류비·관세·부가세까지 더한 개당 한국 도착 원가로 비교해, 받고 나서 늘어나는 비용을 줄입니다.', 'We compare on landed cost per unit in Korea — freight, duty and VAT included — so costs do not grow after delivery.', '按含物流费、关税与增值税的单件韩国落地成本比较，减少到货后才增加的费用。'] },
    { t: ['불량은 출고 전에', 'Defects stop before shipping', '不良在出货前拦截'], d: ['출고 전 현지 검수로 불량을 걸러내, 한국에 도착한 뒤의 재작업·반품 비용을 막습니다.', 'On-site inspection before dispatch keeps rework and returns in Korea from eating your margin.', '出货前现场检验拦截不良，避免到韩国后的返工与退货成本。'] },
  ],
};

export const cloudFeatures = {
  eyebrow: '03 — AEGIS CLOUD',
  h2: ['맡긴 뒤에도, 고객 화면에서 다 보입니다', 'After you hand it over, you still see everything', '交给我们之后，一切仍尽在眼前'],
  sub: [
    '문의하면 AEGIS Cloud 계정을 드립니다. 진행 상황, 견적, 승인, 결제, 서류를 담당자에게 묻지 않고 화면에서 바로 확인하고 처리합니다.',
    'Every inquiry comes with an AEGIS Cloud account. Check and act on progress, quotes, approvals, payments and documents yourself — no need to chase anyone.',
    '咨询即开通 AEGIS Cloud 账号。进度、报价、审批、付款与文件，无需询问负责人，在页面上直接查看并处理。',
  ],
  tabs: [
    { key: 'dash', t: ['진행 현황', 'Progress', '进度'], d: ['확인하실 일과 프로젝트별 단계, 납품 예정일을 한 화면에서 봅니다. 일정이 바뀌면 메일로 알려 드립니다.', 'Your to-dos, each project’s stage and delivery dates on one screen. Schedule changes arrive by email.', '在一个页面查看待办事项、各项目阶段与交付日期。日程变更会邮件通知。'] },
    { key: 'quote', t: ['견적 비교 · 수락', 'Quotes', '报价比较 · 确认'], d: ['견적을 같은 기준으로 비교하고, 마음에 드는 견적을 화면에서 바로 수락합니다.', 'Compare quotes on the same basis and accept the one you want right on screen.', '按同一标准比较报价，满意的报价可直接在页面上确认。'] },
    { key: 'review', t: ['디자인 · 도면 승인', 'Design approval', '设计 · 图纸确认'], d: ['이전 판과 나란히 보고, 고칠 곳에 핀을 찍어 의견을 남기거나 바로 승인합니다.', 'See it next to the previous version, pin comments where changes are needed, or approve in one click.', '与上一版并排查看，在需要修改的位置打点留言，或直接批准。'] },
    { key: 'approval', t: ['사내 결재', 'Internal approvals', '内部审批'], d: ['금액 기준을 정해 두면 견적 수락과 출고 승인이 회사 결재권자를 거쳐 진행됩니다.', 'Set an amount threshold and quote acceptance or shipment release goes through your own approvers.', '设定金额标准后，报价确认与出货批准会经过贵司审批人。'] },
    { key: 'costs', t: ['원가 · 재주문 알림', 'Cost & reorder', '成本 · 补货提醒'], d: ['상품별 한국 도착 원가와 품질 이력을 보고, 재고가 떨어지기 전에 주문 시점을 알려 드립니다.', 'Landed cost and quality history per product, with a reminder to reorder before stock runs out.', '按产品查看韩国落地成本与品质记录，并在库存用完前提醒下单时机。'] },
    { key: 'pay', t: ['결제 · 서류', 'Payments & documents', '付款 · 文件'], d: ['결제 요청과 입금 확인, 인보이스·검수 보고서 같은 서류를 프로젝트별로 모아 둡니다.', 'Payment requests and confirmations, invoices and inspection reports, kept together per project.', '付款请求与到账确认、发票与检验报告等文件按项目集中保存。'] },
  ],
  extrasTitle: ['이 밖에도', 'Also included', '此外还有'],
  extras: [
    ['한국어 ↔ 중국어 자동 번역 문의', 'Korean ↔ Chinese auto-translated messages', '韩中自动翻译沟通'],
    ['주간 요약 메일', 'Weekly summary email', '每周摘要邮件'],
    ['중국 휴무 · 발주 마감 알림', 'China holiday & order cut-off alerts', '中国假期 · 下单截止提醒'],
    ['팀원 초대와 역할', 'Team seats & roles', '团队成员与角色'],
    ['불량 신고와 보상 추적', 'Defect claims & compensation tracking', '不良申报与补偿追踪'],
    ['금형 대장', 'Tooling register', '模具台账'],
  ],
  sample: ['예시 화면 · 회사·제품·날짜는 가상입니다', 'Sample screens · companies, products and dates are fictional', '示例页面 · 公司、产品与日期均为虚构'],
  more: ['AEGIS Cloud 자세히 보기 →', 'Explore AEGIS Cloud →', '了解 AEGIS Cloud →'],
};

// 컨셉 스튜디오 예시 형상 (미니 공기청정기) — 메인페이지 3D 데모용 고정 데이터
export const DEMO_PARTS = [
  { id: 'd1', name: '외장 케이스', layer: 'SHELL', shape: 'cylinder', size: { x: 120, y: 190, z: 120 }, position: { x: 0, y: 105, z: 0 }, color: '#e8eaee', finish: 'matte' },
  { id: 'd2', name: '바닥 받침', layer: 'SHELL', shape: 'cylinder', size: { x: 126, y: 10, z: 126 }, position: { x: 0, y: 5, z: 0 }, color: '#4b5563', finish: 'rubber' },
  { id: 'd3', name: '흡입 그릴', layer: 'SHELL', shape: 'cylinder', size: { x: 122, y: 46, z: 122 }, position: { x: 0, y: 36, z: 0 }, color: '#9ca3af', finish: 'metal' },
  { id: 'd4', name: '상단 토출구', layer: 'SHELL', shape: 'torus', size: { x: 112, y: 10, z: 112 }, position: { x: 0, y: 202, z: 0 }, color: '#d1d5db', finish: 'gloss' },
  { id: 'd5', name: '토출 그릴', layer: 'SHELL', shape: 'cylinder', size: { x: 92, y: 4, z: 92 }, position: { x: 0, y: 200, z: 0 }, color: '#374151', finish: 'matte' },
  { id: 'd6', name: 'LED 링', layer: 'UI', shape: 'torus', size: { x: 70, y: 4, z: 70 }, position: { x: 0, y: 203, z: 0 }, color: '#3b82f6', finish: 'glass' },
  { id: 'd7', name: '터치 버튼', layer: 'UI', shape: 'cylinder', size: { x: 16, y: 6, z: 16 }, position: { x: 0, y: 140, z: 60 }, rotation_deg: { x: 90, y: 0, z: 0 }, color: '#0066ff', finish: 'gloss' },
  { id: 'd8', name: '팬', layer: 'INTERNAL', shape: 'cylinder', size: { x: 90, y: 28, z: 90 }, position: { x: 0, y: 160, z: 0 }, color: '#64748b', finish: 'matte' },
  { id: 'd9', name: '필터', layer: 'INTERNAL', shape: 'cylinder', size: { x: 100, y: 80, z: 100 }, position: { x: 0, y: 90, z: 0 }, color: '#f5f5f4', finish: 'matte' },
  { id: 'd10', name: '제어 기판', layer: 'PCB', shape: 'box', size: { x: 60, y: 3, z: 40 }, position: { x: 0, y: 128, z: 0 }, color: '#15803d', finish: 'matte' },
];
