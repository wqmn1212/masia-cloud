// 공개 AEGIS Cloud 사용 가이드 — [ko, en, zh]
// 목업 데이터는 테스트 팀 "[TEST] 가이드 데모 고객사"의 샘플 레코드를 반영한다.
export const guideMeta = {
  title: ['AEGIS Cloud 사용 가이드', 'AEGIS Cloud user guide', 'AEGIS Cloud 使用指南'],
  desc: ['문의 후 발급되는 AEGIS Cloud 계정으로 프로젝트 진행·견적·파일·QC를 확인하는 방법을 화면 예시로 안내합니다.', 'See how clients track projects, quotes, files and QC in their AEGIS Cloud account.', '通过示例画面了解如何在 AEGIS Cloud 账号中查看项目、报价、文件与 QC。'],
  eyebrow: ['AEGIS CLOUD GUIDE', 'AEGIS CLOUD GUIDE', 'AEGIS CLOUD 指南'],
  lead: ['견적 요청을 보내면 AEGIS Cloud 계정이 발급됩니다. 아래는 테스트 고객사 계정으로 재현한 실제 화면 예시입니다.', 'Once you request a quote, we issue an AEGIS Cloud account. Below are screens reproduced from a test client account.', '提交询价后即开通 AEGIS Cloud 账号。以下为测试客户账号重现的画面示例。'],
  sample: ['예시 화면', 'Sample screen', '示例画面'],
  ctaTitle: ['직접 사용해 보세요', 'Try it with your own project', '用您的项目亲自体验'],
  ctaBtn: ['견적 요청하고 계정 받기', 'Request a quote & get an account', '索取报价并开通账号'],
};

export const STAGES = [
  { status: 'TODO', label: ['대기 중', 'Waiting', '待处理'] },
  { status: 'IN_PROGRESS', label: ['소싱 중', 'Sourcing', '采购中'] },
  { status: 'REVIEW', label: ['견적 검토', 'Quote review', '报价审核'] },
  { status: 'PRODUCTION', label: ['발주 · 제작', 'Production', '生产中'] },
  { status: 'DONE', label: ['완료', 'Done', '已完成'] },
];

export const sampleCards = [
  { title: '탁상형 라벨기 소싱', status: 'TODO' },
  { title: 'LED 뷰티디바이스 금형', status: 'IN_PROGRESS', factory: '선전 A공장' },
  { title: '드립백 포장기 견적', status: 'REVIEW', factory: '동관 B공장' },
  { title: '알루미늄 케이스 CNC 3,000개', status: 'PRODUCTION', factory: '광저우 C공장' },
  { title: '캐릭터 인형 1,000개', status: 'DONE', factory: '중산 D공장' },
];

export const steps = [
  { id: 'menu', mock: 'menu', t: ['왼쪽 메뉴에서 시작합니다', 'Start from the left menu', '从左侧菜单开始'], d: ['로그인하면 고객 대시보드, 소싱 보드, 이용 가이드 세 개 메뉴가 보입니다. 고객사 계정은 자기 회사 프로젝트만 볼 수 있습니다.', 'After login you see three menus: dashboard, sourcing board and guide. Client accounts only see their own company’s projects.', '登录后可见客户控制台、采购看板与使用指南三个菜单。客户账号仅能查看本公司项目。'] },
  { id: 'dashboard', mock: 'dashboard', t: ['대시보드에서 전체 현황을 봅니다', 'See everything on the dashboard', '在控制台查看整体进度'], d: ['단계별 프로젝트 건수와 진행 중인 프로젝트 목록, 담당자 연락처가 한 화면에 있습니다.', 'Project counts by stage, the active project list and your AEGIS contact sit on one screen.', '各阶段项目数、进行中的项目列表与对接人信息集中在一个画面。'] },
  { id: 'board', mock: 'board', t: ['소싱 보드에서 단계를 확인합니다', 'Follow stages on the sourcing board', '在采购看板查看阶段'], d: ['프로젝트는 대기 → 소싱 → 견적 검토 → 발주·제작 → 완료로 이동합니다. 단계는 AEGIS 담당자가 업데이트합니다.', 'Projects move from waiting to sourcing, quote review, production and done. AEGIS staff update the stage.', '项目依次经过待处理、采购、报价审核、生产、完成。阶段由 AEGIS 负责人更新。'] },
  { id: 'detail', mock: 'detail', t: ['프로젝트를 열어 탭별로 확인합니다', 'Open a project and browse its tabs', '打开项目按标签查看'], d: ['개요·견적·파일·채팅·QC 탭으로 나뉩니다. 공개된 견적서와 공유 파일, QC 사진 리포트를 여기서 확인합니다.', 'Tabs cover overview, quote, files, chat and QC. Published quotes, shared files and QC photo reports live here.', '分为概要、报价、文件、沟通、QC 标签。已发布报价、共享文件与 QC 照片报告均在此查看。'] },
  { id: 'chat', mock: 'chat', t: ['궁금한 점은 채팅으로 남깁니다', 'Ask questions in chat', '通过沟通标签提问'], d: ['프로젝트별 채팅에 메시지를 남기면 담당자가 답변합니다. 새 프로젝트는 소싱 보드의 신규 문의로 맡길 수 있습니다.', 'Leave a message in the project chat and your contact replies. Start a new project from “New inquiry” on the board.', '在项目沟通中留言，负责人会回复。新项目可通过看板的"新询价"提交。'] },
];