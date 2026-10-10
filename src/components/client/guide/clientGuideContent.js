// 각 문구는 [한국어, English, 中文]. 절의 points 개수 = 같은 id 예시 화면의 Mark 개수.
export const tr = (p, lang) => (Array.isArray(p) ? p[{ ko: 0, en: 1, zh: 2 }[lang] ?? 0] || p[0] : p);

export const UI = {
  title: ['이용 가이드', 'User Guide', '使用指南'],
  intro: ['AEGIS Cloud 고객 포털에서 할 수 있는 모든 일을 예시 화면과 번호별 설명으로 안내합니다.', 'Every task in the AEGIS Cloud client portal, explained with sample screens and numbered notes.', '通过示例画面和编号说明，介绍 AEGIS Cloud 客户门户的全部功能。'],
  note: ['예시 화면의 회사·제품·날짜는 가상입니다.', 'Companies, products and dates in sample screens are fictional.', '示例画面中的公司、产品和日期均为虚构。'],
  overview: ['한눈에 보기', 'At a glance', '一览'],
  flow: ['진행 흐름', 'How a project moves', '项目流程'],
  you: ['고객사가 할 일', 'You', '贵司'],
  us: ['AEGIS가 하는 일', 'AEGIS', 'AEGIS'],
  shortcuts: ['이럴 땐 여기로', 'Where to go', '快速入口'],
  tips: ['알아두세요', 'Good to know', '注意'],
  faq: ['자주 묻는 질문', 'FAQ', '常见问题'],
};

export const OVERVIEW = [
  ['왼쪽 메뉴: 고객 대시보드 · 소싱 보드 · 이용 가이드', 'Left menu: Dashboard · Sourcing board · Guide', '左侧菜单：仪表板 · 采购看板 · 使用指南'],
  ['알림: 새 소식이 오면 숫자가 표시됩니다.', 'Notifications: a count appears for new updates.', '通知：有新消息时显示数量。'],
  ['KR/中文: 화면 언어를 바꿉니다.', 'KR/中文: switch the screen language.', 'KR/中文：切换画面语言。'],
  ['단계별 건수', 'Projects per stage', '各阶段项目数'],
  ['진행 중인 프로젝트', 'Projects in progress', '进行中的项目'],
  ['담당자 문의', 'Contact your manager', '联系负责人'],
];

export const FLOW = [
  [['대기 중', 'Waiting', '等待中'], ['문의를 남깁니다', 'Send an inquiry', '提交咨询'], ['요구사항을 확인합니다', 'Review requirements', '确认需求']],
  [['소싱 중', 'Sourcing', '采购中'], ['추가 질문에 답합니다', 'Answer follow-ups', '回答补充问题'], ['공장을 찾고 비교합니다', 'Find and compare factories', '寻找并比较工厂']],
  [['견적 검토', 'Quote review', '报价审核'], ['견적서를 검토합니다', 'Review the quote', '审核报价单'], ['견적서를 발행합니다', 'Issue the quote', '发布报价单']],
  [['발주·제작', 'Production', '下单·生产'], ['선금을 보내고 진행을 확인합니다', 'Pay deposit and track', '支付预付款并跟进'], ['생산과 검수를 관리합니다', 'Manage production and QC', '管理生产和检验']],
  [['완료', 'Done', '完成'], ['물품을 받습니다', 'Receive goods', '收货'], ['잔금과 서류를 마무리합니다', 'Close balance and documents', '完成尾款和文件']],
];

export const SHORTCUTS = [
  [['새 프로젝트 맡기기', 'Start a project', '委托新项目'], 'inquiry'],
  [['납품일 확인', 'Check delivery date', '查看交货日'], 'steps'],
  [['견적서 보기', 'View quotes', '查看报价单'], 'quote'],
  [['담당자에게 문의', 'Ask your manager', '咨询负责人'], 'chat'],
  [['입금 확인', 'Payment status', '付款确认'], 'pay'],
  [['파일 보내기', 'Send files', '发送文件'], 'files'],
  [['지난 서류 찾기', 'Find past documents', '查找以往文件'], 'library'],
];

export const CHAPTERS = [
  { id: 'login', title: ['처음 로그인', 'First sign-in', '首次登录'], intro: ['초대 메일의 버튼을 누르면 비밀번호 설정 화면이 열립니다.', 'The button in your invitation email opens the password setup screen.', '点击邀请邮件中的按钮即可打开密码设置画面。'],
    points: [['이메일: 초대받은 주소를 입력합니다.', 'Email: enter the invited address.', '邮箱：输入受邀邮箱。'], ['새 비밀번호와 확인: 8자 이상입니다.', 'New password and confirm: 8+ characters.', '新密码及确认：至少8位。'], ['시작하기: 메일로 온 인증 코드를 넣으면 로그인됩니다.', 'Start: enter the code sent by email to sign in.', '开始：输入邮件中的验证码即可登录。'], ['이미 계정이 있으면 로그인, 잊었으면 비밀번호 재설정을 누릅니다.', 'Have an account? Sign in, or reset your password.', '已有账号请登录，忘记密码请重置。']] },
  { id: 'dash', title: ['고객 대시보드', 'Client dashboard', '客户仪表板'], intro: ['로그인하면 가장 먼저 보이는 화면입니다. 30초마다 자동으로 새로고침됩니다.', 'The first screen after sign-in. It refreshes every 30 seconds.', '登录后首先看到的画面，每30秒自动刷新。'],
    points: [['단계별 건수', 'Projects per stage', '各阶段项目数'], ['중국 휴무 안내: 90일 안의 휴무를 보여 줍니다.', 'China holiday notice: holidays within 90 days.', '中国假期提示：显示90天内的假期。'], ['프로젝트 카드: 누르면 상세가 열립니다.', 'Project card: click to open details.', '项目卡片：点击打开详情。'], ['보드로 보기', 'View on board', '在看板中查看'], ['담당자 문의: 연락처를 확인합니다.', 'Contact: see your manager’s details.', '联系负责人：查看联系方式。']] },
  { id: 'board', wide: true, title: ['소싱 보드', 'Sourcing board', '采购看板'], intro: ['프로젝트를 다섯 단계 칸으로 나눠 보여 줍니다. 단계는 AEGIS 담당자가 옮깁니다.', 'Projects are shown in five stage columns. AEGIS moves them between stages.', '项目按五个阶段分列显示，阶段由 AEGIS 负责人移动。'],
    points: [['신규 문의 작성', 'New inquiry', '新建咨询'], ['단계 칸과 건수', 'Stage column and count', '阶段栏和数量'], ['프로젝트 카드', 'Project card', '项目卡片']] },
  { id: 'inquiry', title: ['신규 문의 작성', 'New inquiry', '新建咨询'], intro: ['새 프로젝트를 맡길 때 씁니다. 접수하면 "대기 중" 카드가 생기고 확인 메일이 갑니다.', 'Use this to start a project. A "Waiting" card is created and a confirmation email is sent.', '委托新项目时使用。提交后生成"等待中"卡片并发送确认邮件。'],
    points: [['제목', 'Title', '标题'], ['카테고리', 'Category', '类别'], ['수량·희망 단가', 'Quantity · target price', '数量·目标单价'], ['요구사항', 'Requirements', '需求'], ['첨부: 최대 5개, 개당 10MB', 'Attachments: up to 5, 10MB each', '附件：最多5个，每个10MB'], ['문의 접수', 'Submit', '提交咨询']],
    tips: [['연속 접수는 5분 간격으로 제한됩니다.', 'You can submit again after 5 minutes.', '连续提交需间隔5分钟。']] },
  { id: 'detail', title: ['프로젝트 상세', 'Project details', '项目详情'], intro: ['대시보드 카드, 보드 카드, 알림, 메일 링크에서 열 수 있습니다.', 'Open it from a dashboard card, board card, notification or email link.', '可从仪表板卡片、看板卡片、通知或邮件链接打开。'],
    points: [['프로젝트 이름', 'Project name', '项目名称'], ['새로고침', 'Refresh', '刷新'], ['탭: 개요 · 견적서 · 문의 · 결제 · 파일', 'Tabs: Overview · Quotes · Chat · Payments · Files', '标签：概览 · 报价单 · 咨询 · 付款 · 文件']] },
  { id: 'steps', title: ['진행 단계', 'Progress steps', '进度步骤'], intro: ['담당자가 계획을 확정하면 단계가 보입니다. 확정 전에는 보이지 않습니다.', 'Steps appear once your manager confirms the plan.', '负责人确认计划后显示步骤，确认前不显示。'],
    points: [['끝난 단계: 완료일', 'Finished step: completion date', '已完成步骤：完成日'], ['지금 단계: 예정일', 'Current step: planned date', '当前步骤：预计日'], ['납품 예정일', 'Expected delivery', '预计交货日'], ['사유: 담당자가 공개한 경우만 보입니다.', 'Reason: shown only if shared by your manager.', '原因：仅在负责人公开时显示。']] },
  { id: 'sched', title: ['일정과 요구사항', 'Schedule and requirements', '日程与需求'], intro: ['개요 탭에서 일정을 보고 요구사항을 고칩니다.', 'See the schedule and edit requirements in the Overview tab.', '在概览标签查看日程并修改需求。'],
    points: [['견적 발송 기한', 'Quote deadline', '报价发送期限'], ['선금 기준일·소요일', 'Deposit date · lead days', '预付款基准日·所需天数'], ['예정 납품일: 선금일부터 근무일로 계산합니다.', 'Expected delivery: counted in workdays from the deposit date.', '预计交货日：从预付款日按工作日计算。'], ['단계·우선순위·목표일', 'Stage · priority · target date', '阶段·优先级·目标日'], ['요구사항: KR/CN 칸에 쓰면 자동 번역됩니다.', 'Requirements: write in KR/CN, auto-translated.', '需求：在KR/CN栏填写会自动翻译。'], ['저장: 담당자에게 알림이 갑니다.', 'Save: your manager is notified.', '保存：会通知负责人。']] },
  { id: 'quote', title: ['견적서', 'Quotes', '报价单'], intro: ['발행된 견적서만 보입니다. 금액은 PDF에만 있습니다.', 'Only issued quotes appear. Amounts are in the PDF only.', '只显示已发布的报价单，金额仅在PDF中。'],
    points: [['견적서 이름', 'Quote name', '报价单名称'], ['발행일·통화·모델', 'Issued · currency · model', '发布日·币种·型号'], ['PDF 열기', 'Open PDF', '打开PDF']] },
  { id: 'chat', title: ['문의', 'Chat', '咨询'], intro: ['프로젝트별로 담당자와 대화합니다. 답변이 오면 알림이 갑니다.', 'Talk with your manager per project. You are notified of replies.', '按项目与负责人沟通，有回复时会通知。'],
    points: [['담당자 메시지', 'Manager’s message', '负责人消息'], ['내 메시지', 'Your message', '我的消息'], ['첨부', 'Attach', '附件'], ['KR/CN: 입력 언어', 'KR/CN: input language', 'KR/CN：输入语言'], ['보내기: 상대 언어로 자동 번역됩니다.', 'Send: auto-translated for the other side.', '发送：自动翻译成对方语言。']] },
  { id: 'pay', title: ['결제', 'Payments', '付款'], intro: ['입금하면 담당자가 확인한 뒤 상태가 바뀝니다.', 'After you pay, status changes once your manager confirms.', '付款后由负责人确认并更新状态。'],
    points: [['입금 확인 비율', 'Confirmed share', '已确认比例'], ['단계(선금·중도금·잔금)와 입금일', 'Stage (deposit/interim/balance) and date', '阶段（预付·中期·尾款）和付款日'], ['상태: 확인 대기 · 확인됨', 'Status: pending · confirmed', '状态：待确认 · 已确认']] },
  { id: 'files', title: ['파일', 'Files', '文件'], intro: ['도면·사진·서류를 주고받습니다.', 'Exchange drawings, photos and documents.', '收发图纸、照片和文件。'],
    points: [['업로드: 최대 5개, 개당 10MB', 'Upload: up to 5, 10MB each', '上传：最多5个，每个10MB'], ['이름·문서 종류', 'Name · document type', '名称·文件类型'], ['올린 사람·날짜', 'Uploader · date', '上传人·日期'], ['열기', 'Open', '打开']] },
  { id: 'library', title: ['회사별 파일 보관함', 'Company file library', '公司文件库'], intro: ['모든 프로젝트의 공유 파일을 한곳에서 찾습니다. 50개씩 보여 줍니다.', 'Find shared files from all projects in one place, 50 per page.', '在一处查找所有项目的共享文件，每页50个。'],
    points: [['검색: 이름·종류·기간', 'Search: name · type · period', '搜索：名称·类型·期间'], ['파일 정보', 'File info', '文件信息'], ['프로젝트 이름: 누르면 프로젝트로 이동', 'Project name: click to open the project', '项目名称：点击进入项目'], ['열기', 'Open', '打开'], ['이전·다음', 'Previous · next', '上一页·下一页']] },
  { id: 'notif', title: ['알림과 메일', 'Notifications and email', '通知与邮件'], intro: ['단계 이동, 견적 발행, 답변, 입금 확인, 일정 변경, 파일 공유, 휴무 안내 등을 알려 드립니다. 메일은 5분 단위로 묶어 보냅니다.', 'You are notified of stage moves, quotes, replies, payments, schedule changes, shared files and holidays. Emails are bundled every 5 minutes.', '会通知阶段移动、报价发布、回复、付款确认、日程变更、文件共享、假期提示等。邮件每5分钟合并发送。'],
    points: [['알림 종', 'Bell', '通知铃'], ['모두 읽음', 'Mark all read', '全部已读'], ['알림 항목: 누르면 해당 화면으로 이동', 'Item: click to go there', '通知项：点击跳转']] },
  { id: 'holiday', title: ['중국 휴무 안내', 'China holiday notice', '中国假期提示'], intro: ['중국 공휴일과 공장 휴무 예상 기간을 미리 알려 드립니다.', 'We tell you in advance about Chinese holidays and expected factory closures.', '提前告知中国公休日和工厂预计停工期间。'],
    points: [['휴일·공식 기간', 'Holiday · official dates', '假日·官方期间'], ['공장 휴무 예상', 'Expected factory closure', '工厂预计停工'], ['발주 마감일', 'Order cutoff', '下单截止日'], ['프로젝트의 휴무 겹침 표시', 'Holiday overlap on a project', '项目的假期重叠提示']] },
  { id: 'account', title: ['계정·언어·도움말', 'Account, language, help', '账号·语言·帮助'], intro: ['위쪽 막대와 메뉴 아래에서 계정을 다룹니다.', 'Manage your account from the top bar and menu.', '在顶部栏和菜单中管理账号。'],
    points: [['메인페이지', 'Home page', '主页'], ['KR/中文', 'KR/中文', 'KR/中文'], ['로그아웃', 'Sign out', '退出'], ['담당자 문의', 'Contact your manager', '联系负责人']] },
];

export const FAQ = [
  [['프로젝트가 안 보여요.', 'I can’t see my project.', '看不到我的项目。'], ['담당자가 고객 공개로 바꾼 프로젝트만 보입니다. 담당자에게 문의해 주세요.', 'Only projects shared with you appear. Please ask your manager.', '只显示对您公开的项目，请联系负责人。']],
  [['단계를 직접 옮길 수 있나요?', 'Can I move stages?', '可以自己移动阶段吗？'], ['아니요. AEGIS 담당자가 옮깁니다.', 'No, AEGIS moves them.', '不可以，由 AEGIS 负责人移动。']],
  [['납품일은 어디서 보나요?', 'Where is the delivery date?', '在哪里看交货日？'], ['프로젝트 상세의 진행 단계와 개요 탭의 일정에서 봅니다.', 'In the progress steps and the Overview tab schedule.', '在项目详情的进度步骤和概览标签的日程中。']],
  [['견적 금액이 안 보여요.', 'I can’t see quote amounts.', '看不到报价金额。'], ['금액은 PDF에만 있습니다. PDF 열기를 눌러 주세요.', 'Amounts are in the PDF. Click Open PDF.', '金额仅在PDF中，请点击打开PDF。']],
  [['견적서 탭이 비어 있어요.', 'The Quotes tab is empty.', '报价单标签是空的。'], ['아직 발행된 견적서가 없습니다. 발행되면 알림이 갑니다.', 'No quote has been issued yet. You’ll be notified.', '尚未发布报价单，发布后会通知您。']],
  [['입금했는데 확인 대기예요.', 'I paid but it says pending.', '已付款但显示待确认。'], ['담당자가 입금을 확인하면 바뀝니다. 급하면 문의 탭에 남겨 주세요.', 'It changes when confirmed. Leave a chat message if urgent.', '负责人确认后会更新，急需请在咨询中留言。']],
  [['중국어로 써야 하나요?', 'Do I need to write in Chinese?', '需要用中文写吗？'], ['아니요. 한국어로 쓰면 자동 번역됩니다.', 'No, Korean is auto-translated.', '不需要，韩语会自动翻译。']],
  [['파일 크기 제한이 있나요?', 'Is there a file size limit?', '文件大小有限制吗？'], ['한 번에 5개, 개당 10MB까지입니다.', 'Up to 5 files, 10MB each.', '一次最多5个，每个10MB。']],
  [['메일에 답장해도 되나요?', 'Can I reply to emails?', '可以回复邮件吗？'], ['알림 메일은 발신 전용입니다. 문의 탭을 써 주세요.', 'Notification emails are no-reply. Use the Chat tab.', '通知邮件为仅发送，请使用咨询标签。']],
  [['비밀번호를 잊었어요.', 'I forgot my password.', '忘记密码了。'], ['로그인 화면에서 비밀번호 재설정을 눌러 주세요.', 'Click password reset on the sign-in screen.', '请在登录画面点击重置密码。']],
  [['계정을 더 만들 수 있나요?', 'Can I add accounts?', '可以增加账号吗？'], ['담당자에게 추가할 이메일을 알려 주세요.', 'Send the email to add to your manager.', '请将要添加的邮箱告知负责人。']],
];