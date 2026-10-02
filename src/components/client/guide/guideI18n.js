// 이용 가이드 문구 [ko, en, zh] — 고객 포털(ko 고정)과 공개 가이드(3개 언어)가 함께 사용
import { tx } from '@/lib/landingContent';
export const t = (v, lang = 'ko') => tx(v, lang);
const T = (ko, en, zh) => [ko, en, zh];

export const G = {
  title: T('이용 가이드', 'User guide', '使用指南'),
  sub: T('AEGIS Cloud에서 프로젝트 진행 상황을 확인하고 담당자와 소통하는 방법을 안내합니다', 'How to follow your projects and talk to your AEGIS team in AEGIS Cloud', '介绍如何在 AEGIS Cloud 查看项目进度并与负责人沟通'),
  s1: T('왼쪽 메뉴에서 시작합니다', 'Start from the left menu', '从左侧菜单开始'),
  s1d: T('왼쪽에 메뉴 세 개가 있습니다. 진행 상황을 한눈에 보려면 고객 대시보드, 프로젝트를 단계별로 보려면 소싱 보드, 사용법이 궁금하면 이 이용 가이드입니다.', 'There are three menus on the left: the client dashboard for an overview, the sourcing board to see projects by stage, and this user guide.', '左侧有三个菜单：客户仪表板一览进度，采购看板按阶段查看项目，使用指南了解操作方法。'),
  s2: T('고객 대시보드에서 전체를 확인합니다', 'See everything on the client dashboard', '在客户仪表板查看全局'),
  s2d: T('맨 위 숫자는 단계별 프로젝트 건수입니다. 그 아래에 진행 중인 프로젝트가 나열되고, 제목을 누르면 상세 화면이 열립니다. 담당자 연락처와 공유 파일도 이 화면에 있습니다.', 'The numbers at the top count projects by stage. Active projects are listed below; click a title to open its details. Your contact person and shared files are here too.', '顶部数字为各阶段项目数，下方列出进行中的项目，点击标题即可打开详情。负责人联系方式和共享文件也在此页面。'),
  s3: T('소싱 보드에서 단계를 확인합니다', 'Track stages on the sourcing board', '在采购看板查看阶段'),
  s3d: T('프로젝트가 대기 중, 소싱 중, 견적 검토, 발주·제작, 완료 다섯 단계를 지나갑니다. 단계는 AEGIS 담당자가 업데이트하므로 직접 옮기실 필요는 없습니다. 새 프로젝트를 맡기실 때는 오른쪽 위 신규 문의 작성을 누르세요.', 'Projects move through five stages: Waiting, Sourcing, Quote review, Order & production, Done. Your AEGIS team updates the stage, so you never need to move cards. To start a new project, click New inquiry at the top right.', '项目依次经过待处理、采购中、报价审核、下单·生产、完成五个阶段。阶段由 AEGIS 负责人更新，无需您手动移动。委托新项目时请点击右上角的新建询价。'),
  s4: T('프로젝트를 누르면 다섯 개 탭이 열립니다', 'Each project opens with five tabs', '点击项目会打开五个标签'),
  s4d: T('대시보드나 보드에서 프로젝트를 누르면 상세 화면이 열립니다. 아래 탭을 눌러 각 화면에서 무엇을 할 수 있는지 확인해 보세요.', 'Click a project on the dashboard or board to open its details. Tap the tabs below to see what each screen does.', '在仪表板或看板点击项目即可打开详情。点击下方标签了解各页面的功能。'),
  detail: T('프로젝트 상세', 'Project details', '项目详情'),
  sample: T('예시 화면', 'Sample screen', '示例画面'),
  faq: T('자주 묻는 질문', 'FAQ', '常见问题'),
  ctaT: T('문의를 남기면 AEGIS Cloud 계정을 발급해 드립니다', 'Send an inquiry and we will open your AEGIS Cloud account', '提交询价后，我们将为您开通 AEGIS Cloud 账号'),
  ctaD: T('영업일 기준 1일 이내에 담당자가 회신드립니다.', 'We reply within one business day.', '负责人将在一个工作日内回复。'),
  ctaB: T('견적 요청하기', 'Request a quote', '索取报价'),
};

export const TAB_TEXT = [
  [T('진행 정보', 'Overview', '进度信息'), T('일정과 현재 단계, 목표일, 그리고 요청하신 요구사항이 정리되어 있습니다. 이 탭에서 고객사가 직접 수정하실 수 있는 항목은 요구사항 하나뿐이며, 저장하면 중국 현지 담당자에게 번역되어 전달됩니다.', 'Schedule, current stage, target date and your requirements. The only thing you can edit here is the requirements; when saved, they are translated and sent to our China staff.', '整理了日程、当前阶段、目标日期及您的需求。此标签中您只能修改需求，保存后会翻译并转达给中国现场负责人。')],
  [T('견적서', 'Quotes', '报价单'), T('담당자가 공개한 견적서 목록이 발행일과 함께 표시되고, 오른쪽 PDF 버튼으로 내려받습니다. 금액은 화면에 표시되지 않고 PDF 안에 담겨 있습니다. 아직 공개된 견적서가 없으면 비어 있다고 안내됩니다.', 'Quotes published by your team are listed with their issue date; download them with the PDF button. Amounts appear only inside the PDF. If nothing is published yet, the tab says so.', '显示负责人公开的报价单及发布日期，可通过右侧 PDF 按钮下载。金额不在页面显示，仅在 PDF 中。尚无公开报价时会提示为空。')],
  [T('문의', 'Messages', '咨询'), T('담당자와 주고받는 대화 창입니다. 파일도 첨부할 수 있습니다. 한국어로 쓰시면 중국 현지 직원에게 중국어로 전달되므로 번역 없이 그대로 쓰시면 됩니다.', 'Your conversation with the team, with file attachments. Messages are translated for our China staff automatically.', '与负责人沟通的对话窗口，可附加文件。您的消息会自动翻译转达给中国现场员工。')],
  [T('결제', 'Payments', '付款'), T('선금과 잔금의 승인 상태를 보여줍니다. 입금 확인은 담당자가 처리하며, 승인되면 제작 공정이 시작됩니다.', 'Shows approval status of the deposit and balance. Your team confirms payments, and production starts once approved.', '显示预付款与尾款的审批状态。入账由负责人确认，批准后开始生产。')],
  [T('파일', 'Files', '文件'), T('견적서, 공장 실사 사진, QC 검수 리포트처럼 공유된 자료를 내려받는 곳입니다. 담당자가 공개한 파일만 표시됩니다.', 'Download shared materials such as quotes, factory audit photos and QC reports. Only files your team has published appear here.', '下载报价单、验厂照片、QC 检验报告等共享资料。仅显示负责人公开的文件。')],
];

export const FAQ = [
  [T('프로젝트가 하나도 안 보입니다.', 'I cannot see any projects.', '看不到任何项目。'), T('담당자가 검토를 마치고 공개해야 화면에 나타납니다. 문의를 접수하신 직후에는 비어 있는 것이 정상이며, 보통 영업일 기준 하루 안에 표시됩니다.', 'Projects appear once your team has reviewed and published them. It is normal to be empty right after an inquiry; they usually appear within one business day.', '负责人审核并公开后才会显示。刚提交询价时为空属正常，通常一个工作日内显示。')],
  [T('단계를 제가 옮길 수 있나요?', 'Can I move the stage myself?', '我可以自己移动阶段吗？'), T('아니요. 단계는 AEGIS 담당자가 진행 상황에 맞춰 업데이트합니다. 고객사에서 직접 바꾸실 수 있는 것은 요구사항과 문의 메시지입니다.', 'No. Your AEGIS team updates stages as work progresses. You can edit requirements and send messages.', '不可以。阶段由 AEGIS 负责人根据进度更新。您可直接修改的是需求和咨询消息。')],
  [T('견적서 탭이 비어 있습니다.', 'The Quotes tab is empty.', '报价单标签为空。'), T('견적서는 담당자가 공개 처리한 뒤에 보입니다. 취합·검토 중에는 “아직 발행된 견적서가 없습니다”로 표시됩니다.', 'Quotes appear after your team publishes them. While they are being compiled, the tab shows "No quotes issued yet".', '报价单在负责人公开后才显示。汇总审核期间会显示"尚未发布报价单"。')],
  [T('견적 금액이 화면에 안 보입니다.', 'I cannot see quote amounts.', '页面上看不到报价金额。'), T('금액은 화면에 표시하지 않고 PDF 견적서 안에만 담습니다. 목록 오른쪽 PDF 버튼으로 금액이 포함된 견적서를 내려받으실 수 있습니다.', 'Amounts are only in the PDF quote. Download it with the PDF button on the right.', '金额不在页面显示，仅包含在 PDF 报价单中。可通过右侧 PDF 按钮下载。')],
  [T('중국어로 써야 하나요?', 'Do I need to write in Chinese?', '需要用中文写吗？'), T('한국어로 쓰시면 됩니다. 문의와 요구사항은 중국어로 번역되어 현지 담당자에게 전달됩니다.', 'No. Messages and requirements are translated into Chinese for our local staff.', '不需要。咨询和需求会翻译成中文转达给现场负责人。')],
  [T('계정을 추가하고 싶습니다.', 'I want to add accounts.', '想要增加账号。'), T('담당자에게 요청하시면 같은 회사 계정을 추가로 발급해 드립니다. 추가된 계정도 같은 프로젝트를 보게 됩니다.', 'Ask your team and we will issue extra accounts for your company. They see the same projects.', '向负责人申请即可为贵司追加账号，追加账号可查看相同项目。')],
];

export const M = {
  menu: T('왼쪽 메뉴', 'Left menu', '左侧菜单'),
  portal: T('고객 포털', 'Client portal', '客户门户'),
  dash: T('고객 대시보드', 'Client dashboard', '客户仪表板'),
  board: T('소싱 보드', 'Sourcing board', '采购看板'),
  guide: T('이용 가이드', 'User guide', '使用指南'),
  kpis: [T('전체', 'Total', '全部'), T('소싱 중', 'Sourcing', '采购中'), T('견적 검토', 'Quote review', '报价审核'), T('제작', 'Production', '生产')],
  active: T('진행 중인 프로젝트 3건', '3 active projects', '进行中的项目 3 个'),
  toBoard: T('보드로 보기', 'View board', '看板查看'),
  p1: T('드립백 포장기 도입', 'Drip-bag packer', '挂耳包装机导入'),
  p2: T('라벨러 2호기 증설', 'Second labeller', '贴标机 2 号机扩充'),
  p3: T('튜브 실링기 교체', 'Tube sealer replacement', '软管封口机更换'),
  p4: T('신규 문의 검토', 'New inquiry review', '新询价审核'),
  p5: T('충전기 금형', 'Filler tooling', '灌装机模具'),
  newInq: T('＋ 신규 문의 작성', '+ New inquiry', '＋ 新建询价'),
  cols: { TODO: T('대기 중', 'Waiting', '待处理'), IN_PROGRESS: T('소싱 중', 'Sourcing', '采购中'), REVIEW: T('견적 검토', 'Quote review', '报价审核'), PRODUCTION: T('발주 · 제작', 'Order & production', '下单 · 生产'), DONE: T('완료', 'Done', '完成') },
  st: { IN_PROGRESS: T('소싱 중', 'Sourcing', '采购中'), REVIEW: T('견적 검토', 'Quote review', '报价审核'), PRODUCTION: T('발주 · 제작', 'Order & production', '下单 · 生产') },
  // card bodies
  sched: T('일정', 'Schedule', '日程'), schedV: T('선금 확인 2026-10-02', 'Deposit confirmed 2026-10-02', '预付款确认 2026-10-02'),
  stage: T('단계 · 우선순위', 'Stage · priority', '阶段 · 优先级'), stageV: T('소싱 중 · 보통', 'Sourcing · Medium', '采购中 · 普通'),
  target: T('목표일', 'Target date', '目标日期'),
  req: T('요구사항', 'Requirements', '需求'), reqOnly: T('이 항목만 수정할 수 있습니다', 'Only this field is editable', '仅此项可修改'),
  reqV: T('시간당 3,000포 이상, 질소 충전 옵션 포함. 한국 전압 220V 대응 필요.', '3,000+ packs per hour, nitrogen flush option, 220V for Korea.', '每小时 3,000 包以上，含充氮选项，需适配韩国 220V 电压。'),
  reqSave: T('요구사항 저장', 'Save requirements', '保存需求'),
  q1: T('드립백 포장기 DBM-3000 견적', 'Drip-bag packer DBM-3000 quote', '挂耳包装机 DBM-3000 报价'),
  q2: T('질소 충전 유닛 추가 견적', 'Nitrogen unit add-on quote', '充氮单元追加报价'),
  qNote: T('금액은 PDF 견적서에 담겨 있습니다.', 'Amounts are inside the PDF quote.', '金额包含在 PDF 报价单中。'),
  agent: T('AEGIS 담당자', 'AEGIS team', 'AEGIS 负责人'),
  c1: T('공장 3곳 견적을 받았습니다. 질소 충전 옵션 포함 기준으로 정리해 드릴까요?', 'We have quotes from 3 factories. Shall we compare them with the nitrogen option included?', '已收到 3 家工厂报价。按含充氮选项为您整理吗？'),
  c2: T('네, 포함 기준으로 부탁드립니다.', 'Yes, please include it.', '好的，请按包含选项整理。'),
  msgPh: T('메시지를 입력하세요', 'Type a message', '请输入消息'),
  dep: T('선금 50%', 'Deposit 50%', '预付款 50%'), bal: T('잔금 50%', 'Balance 50%', '尾款 50%'),
  approved: T('승인 완료', 'Approved', '已批准'), waiting: T('대기 중', 'Pending', '待处理'),
  payNote: T('입금 확인은 담당자가 처리하며, 승인되면 제작이 시작됩니다.', 'Your team confirms payment; production starts once approved.', '入账由负责人确认，批准后开始生产。'),
  f1: T('견적서_드립백포장기.pdf', 'Quote_DripBagPacker.pdf', '报价单_挂耳包装机.pdf'),
  f2: T('공장 실사 사진.zip', 'Factory audit photos.zip', '验厂照片.zip'),
  f3: T('QC 검수 리포트.pdf', 'QC inspection report.pdf', 'QC 检验报告.pdf'),
  open: T('열기', 'Open', '打开'),
};