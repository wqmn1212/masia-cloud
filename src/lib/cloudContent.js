// AEGIS Cloud 소개 페이지 문구 [ko, en, zh]
export const cloud = {
  docTitle: ['AEGIS Cloud · 진행 관리', 'AEGIS Cloud · Project tracking', 'AEGIS Cloud · 项目管理'],
  h1: ['맡긴 뒤에도, 다 보입니다.', 'Hand it over. Still see everything.', '交给我们，进度依然一目了然。'],
  sub: ['진행 단계, 견적서, 검수 보고서, 입금 확인까지. AEGIS에 맡긴 프로젝트는 고객 전용 화면에 모두 기록되어, 담당자에게 묻지 않아도 지금 상황을 알 수 있습니다.', 'Stages, quotes, inspection reports and payment status. Every project you hand to AEGIS is logged in your own workspace, so you know where things stand without having to ask.', '进度阶段、报价单、验货报告、付款确认，交给 AEGIS 的项目都记录在客户专属页面，无需询问负责人也能随时了解现状。'],
  cta1: ['견적 요청하고 계정 받기', 'Request a quote & get an account', '索取报价并开通账号'],
  cta2: ['비용 보기', 'See pricing', '查看费用'],
  sample: ['예시 화면 · 회사·제품·날짜는 가상입니다', 'Sample screen · names and dates are fictional', '示例画面 · 公司、产品和日期均为虚构'],
  beforeAfterTitle: ['이렇게 달라집니다', 'What changes', '有什么不同'],
  beforeLabel: ['전', 'Before', '之前'],
  afterLabel: ['후', 'After', '之后'],
  pairs: [
    { b: ['담당자에게 물어봐야 알 수 있습니다', 'You have to ask someone to find out', '要问负责人才知道'], a: ['지금 단계와 납품 예정일이 늘 보입니다', 'The current stage and delivery date are always on screen', '当前阶段和预计交货日随时可见'] },
    { b: ['메일·메신저·엑셀에 흩어집니다', 'Scattered across email, chat and spreadsheets', '分散在邮件、聊天和表格里'], a: ['프로젝트별로 한곳에 쌓입니다', 'Kept in one place, per project', '按项目集中保存'] },
    { b: ['번역기를 돌려 공장과 직접 주고받습니다', 'Back-and-forth with factories through a translator app', '靠翻译软件和工厂来回沟通'], a: ['한국어로 남기면 번역되어 중국 현지 담당자에게 전달되고, 대화가 기록으로 남습니다', 'Messages are translated between Korean and Chinese for our China team, and the thread stays on record', '韩中自动互译，直达中国现场负责人，沟通全程留档'] },
  ],
  eyebrow: ['AEGIS Cloud에서 보이는 것', 'What you see in AEGIS Cloud', '在 AEGIS Cloud 中可以看到'],
  scenes: [
    { mock: 'steps', t: ['지금 어디까지 왔는지, 묻지 않아도 보입니다', 'See where your project is, without asking', '项目进展到哪一步，不用问也能看到'], d: ['대기부터 완료까지 5단계 보드와 단계별 진행 상황, 납품 예정일을 언제든 확인합니다. 일정이 바뀌면 바로 메일로 알려 드립니다.', 'Track every project on a five-stage board, with step-by-step progress and the expected delivery date. If the schedule changes, we email you right away.', '通过五个阶段的看板查看每个项目的进度和预计交货日。日程一有变动，立即邮件通知。'], tags: ['5단계 보드 · 진행 단계 · 일정 변경 메일', '5-stage board · Progress steps · Schedule-change email', '五阶段看板 · 进度阶段 · 日程变更邮件'] },
    { mock: 'chat', t: ['카톡 대신, 프로젝트마다 한 창구', 'One channel per project, not scattered chats', '每个项目一个沟通窗口，告别零散聊天'], d: ['문의는 프로젝트별 문의 탭에 남기면 됩니다. 한국어와 중국어 사이는 자동으로 번역되고, 주고받은 말과 첨부 파일이 그대로 기록에 남습니다.', "Leave questions in each project's message tab. Korean and Chinese are translated automatically, and every message and attachment stays on record.", '在各项目的咨询页留言即可。韩语与中文自动互译，所有消息和附件完整留档。'], tags: ['문의 탭 · 자동 번역 · 답변 알림', 'Messages · Auto-translation · Reply alerts', '咨询页 · 自动翻译 · 回复提醒'] },
    { mock: 'files', t: ['견적서와 검수 보고서가 한곳에 쌓입니다', 'Quotes and inspection reports, all in one place', '报价单和验货报告集中在一处'], d: ['발행된 견적서는 PDF로, 검수 보고서와 인보이스·패킹리스트 같은 무역 서류는 파일 탭에 쌓입니다. 회사별 보관함에서 모든 프로젝트의 파일을 한 번에 찾습니다.', 'Issued quotes come as PDFs, and inspection reports and trade documents such as invoices and packing lists are kept in the files tab. Find files from every project in your company library.', '已发布的报价单可下载 PDF，验货报告和发票、装箱单等贸易单证保存在文件页。在公司文件库中一次查找所有项目的文件。'], tags: ['견적서 PDF · 파일 탭 · 회사별 보관함', 'Quote PDFs · Files tab · Company library', '报价单 PDF · 文件页 · 公司文件库'] },
    { mock: 'pay', t: ['입금이 확인됐는지 바로 압니다', 'Know at once whether your payment is confirmed', '付款是否到账，一看便知'], d: ['선금·중도금·잔금을 보내면 담당자가 확인한 뒤 상태가 바뀌고, 메일로도 알려 드립니다. 단계별로 얼마나 확인됐는지 한눈에 봅니다.', 'When you pay a deposit, interim or balance, the status changes once we confirm it, and we email you too. See at a glance how much of each stage is confirmed.', '支付定金、中期款或尾款后，负责人确认即更新状态，并同步邮件通知。各阶段确认比例一目了然。'], tags: ['단계별 입금 · 입금 확인 메일 · 확인 비율', 'Payment stages · Confirmation email · Confirmed share', '分阶段付款 · 到账邮件 · 确认比例'] },
    { mock: 'holiday', t: ['중국 휴무와 발주 마감, 미리 알려 드립니다', 'Chinese holidays and order deadlines, flagged early', '中国假期与下单截止日，提前提醒'], d: ['춘절·국경절처럼 공장이 멈추는 기간과 그 전 발주 마감일을 90일 전부터 대시보드에 보여 드립니다. 새 소식은 알림과 메일로 받습니다.', 'Factory shutdowns such as Chinese New Year and Golden Week, and the order deadline before them, show on your dashboard up to 90 days ahead. Updates arrive as notifications and email.', '春节、国庆等工厂停工期及之前的下单截止日，提前 90 天显示在控制台。新消息通过通知和邮件送达。'], tags: ['휴무 안내 · 발주 마감 · 알림 메일', 'Holiday notice · Order deadline · Email alerts', '假期提示 · 下单截止 · 邮件提醒'] },
  ],
  extras: [
    { t: ['우리 회사 프로젝트만 보입니다', "Only your company's projects", '只显示贵司项目'], d: ['계정은 회사 단위로 나뉘어, 다른 고객사의 정보는 보이지 않습니다.', "Accounts are separated by company; other clients' information is never visible.", '账号按公司隔离，看不到其他客户的信息。'] },
    { t: ['팀원도 함께 봅니다', 'Bring your team', '团队一起查看'], d: ['회사 내 추가 계정을 드립니다. 구매·품질·대표가 같은 화면을 봅니다.', 'Extra accounts for your colleagues, so purchasing, QA and management see the same screen.', '可为贵司同事开通更多账号，采购、品质和管理层看到同一画面。'] },
    { t: ['중요한 소식은 메일로도', 'Key updates by email', '重要消息同步邮件'], d: ['견적 발행, 입금 확인, 일정 변경은 항상 메일로도 보내 드립니다.', 'Quotes issued, payments confirmed and schedule changes always come by email too.', '报价发布、付款确认、日程变更都会同步发送邮件。'] },
  ],
  accountTitle: ['계정은 이렇게 받습니다', 'How to get an account', '如何开通账号'],
  steps: [
    { t: ['견적 요청', 'Request a quote', '提交询价'], d: ['도면, 사진, 문장 하나로도 시작할 수 있습니다.', 'A drawing, a photo or a single sentence is enough.', '一张图纸、一张照片或一句话即可。'] },
    { t: ['초대 메일', 'Invitation email', '邀请邮件'], d: ['영업일 기준 1일 이내에 회신하고, 계정 초대 메일을 보내 드립니다.', 'We reply within one business day and send your account invitation.', '一个工作日内回复，并发送账号邀请邮件。'] },
    { t: ['바로 사용', 'Start right away', '立即使用'], d: ['비밀번호를 정하고 메일로 온 인증 코드를 넣으면 시작합니다.', "Set a password, enter the code we email you, and you're in.", '设置密码并输入邮件中的验证码即可开始。'] },
  ],
  accountNote: ['모든 구독 플랜과 단건 상품에 포함되며, 따로 드는 비용은 없습니다.', 'Included with every plan and single service at no extra cost.', '所有订阅方案和单次服务均包含，无额外费用。'],
  finalTitle: ['프로젝트를 맡기고, 화면으로 확인하세요', 'Hand over your project and follow it on screen', '把项目交给我们，在画面上随时确认'],
  finalCta: ['견적 요청하고 AEGIS Cloud 계정 받기', 'Request a quote & get an AEGIS Cloud account', '索取报价并开通 AEGIS Cloud 账号'],
};