// 고객 이용 가이드 예시 화면 (HTML). 실제 고객 포털 화면과 같은 모양으로 그린 정적 화면이며 눌러도 동작하지 않는다.
// 각 화면의 번호(Mark n) 순서 = clientGuideContent.js 의 points 순서
import React from 'react';
import {
  LayoutDashboard, Kanban, BookOpen, Bell, Home, LogOut, Search, CalendarDays, CalendarOff, LifeBuoy, Plus, Upload, Paperclip, Send,
  FileText, FileImage, Download, Check, CheckCheck, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLIENT_COLUMNS } from '@/components/client/clientBoardMeta';
import { CG, STAGE, t } from './clientGuideContent';

const T = (ko, en, zh) => [ko, en, zh];
const PIN = { tl: '-left-2.5 -top-2.5', tr: '-right-2.5 -top-2.5', bl: '-left-2.5 -bottom-2.5', br: '-right-2.5 -bottom-2.5' };

export function Pin({ n, pos = 'tl', className }) {
  return <span className={cn('absolute z-10 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white', PIN[pos], className)}>{n}</span>;
}
// 설명 번호가 붙는 영역: 붉은 테두리 + 번호. 번호는 기본으로 오른쪽 위에 붙어 왼쪽 글자를 가리지 않는다.
// inline: 글자 길이만큼만 감싸고, 번호 자리만큼 오른쪽을 비운다.
function Mark({ n, pos = 'tr', inline, className, children }) {
  return <div className={cn('relative rounded-md ring-2 ring-rose-500/80 ring-offset-2 ring-offset-background', inline && 'inline-flex items-center pr-3', className)}>{children}<Pin n={n} pos={pos} /></div>;
}
export function Frame({ title, lang, children, className }) {
  return (
    <div className="pointer-events-none select-none overflow-hidden rounded-xl border bg-background text-foreground shadow-sm" aria-hidden="true">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><span className="flex gap-1"><i className="h-2 w-2 rounded-full bg-rose-300" /><i className="h-2 w-2 rounded-full bg-amber-300" /><i className="h-2 w-2 rounded-full bg-emerald-300" /></span>{title}</span>
        <span className="rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">{t(CG.sample, lang)}</span>
      </div>
      <div className={cn('p-4', className)}>{children}</div>
    </div>
  );
}

// 예시 데이터
const P = {
  led: T('LED 마스크 OEM', 'LED mask OEM', 'LED面罩 OEM'),
  airless: T('에어리스 용기 리뉴얼', 'Airless bottle renewal', '真空瓶改版'),
  plush: T('캐릭터 인형 1차', 'Character plush, lot 1', '卡通公仔首批'),
  inquiry: T('[고객문의] 실리콘 케이스 견적', '[고객문의] Silicone case quote', '[고객문의] 硅胶保护套询价'),
  sealer: T('튜브 실러', 'Tube sealer', '软管封口机'),
};
const W = {
  progress: T('진행 현황', 'Progress', '进度概况'),
  dashboard: T('고객 대시보드', 'Client dashboard', '客户仪表板'),
  board: T('소싱 보드', 'Sourcing board', '采购看板'),
  guide: T('이용 가이드', 'User guide', '使用指南'),
  portal: T('고객 포털', 'Client portal', '客户门户'),
  main: T('메인페이지', 'Main page', '主页'),
  logout: T('로그아웃', 'Sign out', '退出登录'),
  newInq: T('신규 문의 작성', 'New inquiry', '新建询价'),
  open: T('열기', 'Open', '打开'),
  contact: T('담당자 문의', 'Contact', '联系负责人'),
  contactBody: T('계정 접근이 어려우시거나 진행 상황에 문의가 있으시면 담당 PM 에게 연락해 주세요.', 'If you cannot sign in or have questions about progress, contact your PM.', '无法登录或对进度有疑问时，请联系负责的 PM。'),
  email: T('이메일', 'Email', '邮箱'),
  activeN: T('진행 중인 프로젝트 3건', '3 active projects', '进行中的项目 3 个'),
  toBoard: T('보드로 보기', 'View board', '看板查看'),
  client: T('고객사', 'Client', '客户'),
  buyer: T('글로우랩 구매팀', 'Glowlab buying team', 'Glowlab 采购部'),
};
const STATUS_COUNTS = { TODO: 1, IN_PROGRESS: 1, REVIEW: 1, PRODUCTION: 1, DONE: 1 };

function Summary({ lang, mark }) {
  const body = (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
      {CLIENT_COLUMNS.map((col) => (
        <div key={col.id} className={cn('rounded-lg border p-2', col.color)}>
          <div className="flex items-center gap-1"><i className={cn('h-1.5 w-1.5 shrink-0 rounded-full', col.dotColor)} /><span className="truncate text-[10px] font-medium">{t(STAGE[col.id], lang)}</span></div>
          <p className="mt-0.5 text-base font-bold">{STATUS_COUNTS[col.id]}</p>
        </div>
      ))}
    </div>
  );
  return mark ? <Mark n={mark}>{body}</Mark> : body;
}
function Tile({ lang, title, badge, due, holiday, priority, holidayMark }) {
  return (
    <div className="space-y-1.5 rounded-xl border bg-card p-2.5">
      {priority && <span className="inline-block rounded bg-destructive/15 px-1 text-[9px] font-semibold text-destructive">{t(priority, lang)}</span>}
      <p className="text-xs font-medium leading-snug">{t(title, lang)}</p>
      {holiday && (holidayMark
        ? <Mark n={holidayMark} pos="tr" inline><span className="block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">{t(holiday, lang)}</span></Mark>
        : <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">{t(holiday, lang)}</span>)}
      {due && <p className="flex items-center gap-1 text-[10px] font-medium text-primary"><CalendarDays className="h-3 w-3" />{due}</p>}
      {badge}
    </div>
  );
}
const HIGH = T('높음', 'High', '高');
const HOLIDAY_BADGE = T('춘절 휴무 겹침 · 2027-01-30~2027-02-19', 'Spring Festival overlap · 2027-01-30~02-19', '春节假期冲突 · 2027-01-30~02-19');

function ContactCard({ lang, mark }) {
  const body = (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold"><LifeBuoy className="h-3.5 w-3.5 text-primary" />{t(W.contact, lang)}</p>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{t(W.contactBody, lang)}</p>
      <p className="mt-1.5 text-[10px]"><span className="text-muted-foreground">{t(W.email, lang)} </span><span className="text-primary">lee@aegistrade.biz</span></p>
    </div>
  );
  return mark ? <Mark n={mark} pos="tr">{body}</Mark> : body;
}

// ── 한눈에 보기: 고객 포털 전체 모습
export function GlanceMock({ lang }) {
  const menu = [[LayoutDashboard, W.dashboard, true], [Kanban, W.board], [BookOpen, W.guide]];
  return (
    <Frame title="AEGIS Cloud" lang={lang} className="p-0">
      <div className="flex min-w-0">
        <div className="w-28 shrink-0 bg-sidebar p-2 sm:w-40">
          <p className="px-2 pb-2 pt-1 text-[11px] font-bold text-sidebar-foreground">AEGIS Cloud</p>
          <Mark n={1} pos="tr" className="ring-offset-sidebar">
            <div className="space-y-0.5 p-1">
              <p className="px-1.5 py-1 text-[9px] uppercase tracking-widest text-sidebar-foreground/40">{t(W.portal, lang)}</p>
              {menu.map(([Icon, label, active], i) => (
                <div key={i} className={cn('flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px]', active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/70')}><Icon className="h-3.5 w-3.5" />{t(label, lang)}</div>
              ))}
            </div>
          </Mark>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-end gap-3 border-b bg-card px-3 py-2">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Home className="h-3 w-3" /><span className="hidden sm:inline">{t(W.main, lang)}</span></span>
            <Mark n={2} pos="bl"><span className="relative block p-1"><Bell className="h-4 w-4" /><i className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold not-italic text-white">2</i></span></Mark>
            <Mark n={3} pos="br"><span className="flex whitespace-nowrap rounded-md border bg-muted/40 p-0.5 text-[9px] font-bold"><b className="rounded bg-card px-1.5 py-0.5 text-primary shadow-sm">KR</b><b className="px-1.5 py-0.5 text-muted-foreground">中文</b></span></Mark>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">G</span>
          </div>
          <div className="space-y-3 p-3">
            <p className="text-sm font-bold">{t(W.progress, lang)}</p>
            <Summary lang={lang} mark={4} />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-card p-2.5 md:col-span-2">
                <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold">{t(W.activeN, lang)}</span><span className="rounded border px-1.5 py-0.5 text-[9px]">{t(W.toBoard, lang)}</span></div>
                <Mark n={5}>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Tile lang={lang} title={P.led} due="2026-11-16" />
                    <Tile lang={lang} title={P.airless} />
                  </div>
                </Mark>
              </div>
              <ContactCard lang={lang} mark={6} />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ── 1. 처음 로그인
function LoginMock({ lang }) {
  const field = (label, value, extra) => (
    <div className="space-y-1"><p className="text-[11px] font-medium">{t(label, lang)}</p><div className={cn('h-8 rounded-md border px-2.5 text-[11px] leading-8', extra)}>{value}</div></div>
  );
  return (
    <Frame title={t(T('비밀번호 설정', 'Set password', '设置密码'), lang)} lang={lang} className="bg-muted/30">
      <div className="mx-auto max-w-xs space-y-4 rounded-xl border bg-card p-4">
        <div>
          <p className="text-base font-bold">{t(T('비밀번호 설정', 'Set password', '设置密码'), lang)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t(T('초대받은 이메일로 사용할 비밀번호를 정하면 바로 시작할 수 있습니다.', 'Choose a password for your invited email to get started.', '为受邀邮箱设置密码即可开始使用。'), lang)}</p>
        </div>
        <Mark n={1}>{field(T('이메일', 'Email', '邮箱'), 'buyer@glowlab.example', 'bg-muted')}</Mark>
        <Mark n={2}>
          <div className="space-y-2">
            {field(T('새 비밀번호', 'New password', '新密码'), '••••••••••')}
            {field(T('비밀번호 확인', 'Confirm password', '确认密码'), '••••••••••')}
          </div>
        </Mark>
        <Mark n={3}><div className="rounded-md bg-primary py-2 text-center text-[11px] font-medium text-primary-foreground">{t(T('비밀번호 설정하고 시작하기', 'Set password and start', '设置密码并开始'), lang)}</div></Mark>
        <Mark n={4} pos="bl"><div className="flex justify-between text-[10px] text-muted-foreground"><span>{t(T('이미 비밀번호가 있어요', 'I already have a password', '我已有密码'), lang)}</span><span>{t(T('비밀번호 재설정', 'Reset password', '重置密码'), lang)}</span></div></Mark>
      </div>
    </Frame>
  );
}

// ── 2. 고객 대시보드
function DashboardMock({ lang }) {
  return (
    <Frame title={t(W.dashboard, lang)} lang={lang}>
      <div className="space-y-3">
        <div><p className="text-sm font-bold">{t(W.progress, lang)}</p><p className="text-[10px] text-muted-foreground">{t(T('담당자가 공개한 프로젝트의 진행 단계와 견적서를 확인하실 수 있습니다', 'See the stage and quotes of projects your team has shared', '可查看负责人公开项目的进度阶段和报价单'), lang)}</p></div>
        <Summary lang={lang} mark={1} />
        <Mark n={2}>
          <div className="rounded-xl border bg-card p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold"><CalendarOff className="h-3.5 w-3.5 text-primary" />{t(T('중국 휴무 안내 (90일 이내)', 'China holidays (next 90 days)', '中国假期提示（90 天内）'), lang)}</p>
            <p className="mt-1.5 flex flex-wrap gap-x-3 text-[10px]"><b className="font-medium">{t(T('춘절', 'Spring Festival', '春节'), lang)}</b><span>2027-02-06 ~ 2027-02-12</span><span className="text-primary">{t(T('발주 마감 2026-12-31 (추정)', 'Order cut-off 2026-12-31 (est.)', '下单截止 2026-12-31（估计）'), lang)}</span></p>
          </div>
        </Mark>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-2.5 sm:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">{t(W.activeN, lang)}</span><Mark n={4} pos="tr"><span className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px]"><Kanban className="h-3 w-3" />{t(W.toBoard, lang)}</span></Mark></div>
            <div className="grid grid-cols-2 gap-1.5">
              <Mark n={3}><Tile lang={lang} title={P.led} due="2026-11-16" priority={HIGH} holiday={HOLIDAY_BADGE} /></Mark>
              <Tile lang={lang} title={P.airless} />
            </div>
          </div>
          <ContactCard lang={lang} mark={5} />
        </div>
      </div>
    </Frame>
  );
}

// ── 3. 소싱 보드
const BOARD = { TODO: [P.inquiry], IN_PROGRESS: [P.plush], REVIEW: [P.airless], PRODUCTION: [P.led], DONE: [P.sealer] };
function BoardMock({ lang }) {
  return (
    <Frame title={t(W.board, lang)} lang={lang}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div><p className="text-sm font-bold">{t(W.board, lang)}</p><p className="text-[10px] text-muted-foreground">{t(T('단계는 담당자가 업데이트합니다', 'Your team updates the stages', '阶段由负责人更新'), lang)}</p></div>
        <Mark n={1} pos="tr"><span className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground"><Plus className="h-3 w-3" />{t(W.newInq, lang)}</span></Mark>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[560px] grid-cols-5 gap-2 pt-2">
          {CLIENT_COLUMNS.map((col, i) => {
            const head = <div className={cn('flex items-center gap-1 rounded-t-lg border border-b-0 px-2 py-1.5', col.color)}><i className={cn('h-1.5 w-1.5 rounded-full', col.dotColor)} /><span className="truncate text-[10px] font-semibold">{t(STAGE[col.id], lang)}</span><span className="ml-auto rounded bg-secondary px-1 text-[9px]">{BOARD[col.id].length}</span></div>;
            return (
              <div key={col.id}>
                {i === 1 ? <Mark n={2} pos="bl">{head}</Mark> : head}
                <div className={cn('min-h-[120px] space-y-1.5 rounded-b-lg border border-t-0 p-1.5', col.color)}>
                  {BOARD[col.id].map((p, j) => (i === 3 ? <Mark key={j} n={3} pos="bl"><Tile lang={lang} title={p} due="2026-11-16" /></Mark> : <Tile key={j} lang={lang} title={p} />))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

// ── 4. 신규 문의 작성
const CATS = T(['기계설비', '정밀가공', '전자 · 전기', '뷰티 · 의료', '리빙 · 공구', '굿즈 · 조형', '기타'], ['Machinery', 'Precision parts', 'Electronics', 'Beauty · medical', 'Living · tools', 'Goods · figures', 'Other'], ['机械设备', '精密加工', '电子 · 电气', '美妆 · 医疗', '生活 · 工具', '周边 · 造型', '其他']);
function InquiryMock({ lang }) {
  const label = (v) => <p className="mb-1 text-[11px] font-medium">{t(v, lang)}</p>;
  const box = (v, cls) => <div className={cn('rounded-md border px-2.5 py-1.5 text-[11px]', cls)}>{v}</div>;
  return (
    <Frame title={t(W.newInq, lang)} lang={lang} className="bg-muted/30">
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="text-sm font-bold">{t(W.newInq, lang)}</p>
        <Mark n={1}>{label(T('제목 *', 'Title *', '标题 *'))}{box(t(T('실리콘 케이스 견적', 'Silicone case quote', '硅胶保护套询价'), lang))}</Mark>
        <Mark n={2}>{label(T('품목 카테고리', 'Category', '品类'))}<div className="flex flex-wrap gap-1">{t(CATS, lang).map((c, i) => <span key={c} className={cn('rounded-full border px-2 py-0.5 text-[10px]', i === 3 || i === 5 ? 'border-primary bg-primary text-primary-foreground' : 'bg-background')}>{c}</span>)}</div></Mark>
        <Mark n={3}><div className="grid grid-cols-2 gap-2"><div>{label(T('발주 예정 수량', 'Planned quantity', '预计下单数量'))}{box('3,000')}</div><div>{label(T('희망 단가', 'Target price', '期望单价'))}{box('$0.80')}</div></div></Mark>
        <Mark n={4}>{label(T('요구사항 상세 *', 'Requirements *', '详细需求 *'))}{box(t(T('식품 등급 실리콘, 팬톤 색상 2가지, 로고 양각. 12월 중순까지 납품 희망.', 'Food-grade silicone, 2 Pantone colours, embossed logo. Delivery by mid-December.', '食品级硅胶，潘通色 2 种，Logo 凸印，希望 12 月中旬交付。'), lang), 'min-h-[52px] leading-relaxed')}</Mark>
        <Mark n={5}>{label(T('첨부 파일 (최대 5건 · 10MB)', 'Attachments (max 5 · 10 MB)', '附件（最多 5 个 · 10MB）'))}<div className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-2.5 text-[10px] text-muted-foreground"><Upload className="h-3.5 w-3.5" />{t(T('파일 선택 / 드롭', 'Choose / drop files', '选择 / 拖放文件'), lang)}</div><div className="mt-1.5 flex gap-1"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">case_drawing.pdf ✕</span></div></Mark>
        <div className="flex justify-end gap-2"><span className="rounded-md border px-2.5 py-1 text-[10px]">{t(T('취소', 'Cancel', '取消'), lang)}</span><Mark n={6} pos="tr"><span className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground"><Plus className="h-3 w-3" />{t(T('문의 접수', 'Submit', '提交询价'), lang)}</span></Mark></div>
      </div>
    </Frame>
  );
}

// ── 프로젝트 상세 공용 머리 (탭 강조 위치를 바꿔 씀)
const TABS = [T('진행 정보', 'Progress', '进度信息'), T('견적서', 'Quotes', '报价单'), T('문의', 'Messages', '咨询'), T('결제', 'Payments', '付款'), T('파일', 'Files', '文件')];
function DetailHead({ lang, active, marks }) {
  const title = <p className="text-sm font-bold">{t(P.led, lang)}</p>;
  const refresh = <p className="text-[10px] text-primary">{t(T('최신 일정·입금 상태 새로고침', 'Refresh schedule & payment status', '刷新最新日程·到账状态'), lang)}</p>;
  const tabs = <div className="grid grid-cols-5 gap-0.5 rounded-md bg-muted p-0.5">{TABS.map((l, i) => <span key={i} className={cn('truncate rounded px-1 py-1 text-center text-[10px]', i === active ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground')}>{t(l, lang)}</span>)}</div>;
  return (
    <div className="mb-3 space-y-2">
      {marks ? <Mark n={1} inline>{title}</Mark> : title}
      {marks ? <Mark n={2} inline>{refresh}</Mark> : refresh}
      {marks ? <Mark n={3}>{tabs}</Mark> : tabs}
    </div>
  );
}
const DetailFrame = ({ lang, active, children, marks }) => (
  <Frame title={t(T('프로젝트 상세', 'Project details', '项目详情'), lang)} lang={lang} className="bg-muted/30">
    <div className="rounded-xl border bg-card p-4"><DetailHead lang={lang} active={active} marks={marks} />{children}</div>
  </Frame>
);

// ── 5. 프로젝트 상세
function DetailMock({ lang }) {
  return <DetailFrame lang={lang} active={0} marks><p className="py-6 text-center text-[11px] text-muted-foreground">{t(T('탭을 누르면 아래 내용이 바뀝니다', 'Content changes with the tab', '点击标签切换内容'), lang)}</p></DetailFrame>;
}

// ── 6. 진행 단계
const STEPS = [
  [T('사양 확정', 'Spec confirmed', '规格确认'), 'done', '2026-09-03'],
  [T('선금 입금', 'Deposit', '定金到账'), 'done', '2026-09-16', T('은행 휴무로 입금 확인 지연', 'Bank holiday delayed confirmation', '银行休假导致到账确认延迟')],
  [T('1차 샘플', 'First sample', '首样'), 'current', '2026-10-13'],
  [T('샘플 승인', 'Sample approval', '样品确认'), 'next', '2026-10-19'],
  [T('양산 시작', 'Mass production', '开始量产'), 'next', '2026-10-22'],
  [T('납품', 'Delivery', '交付'), 'next', '2026-11-16'],
];
function ProgressMock({ lang }) {
  const doneL = T('완료', 'Done', '完成'), planL = T('예정', 'Planned', '预计'), reasonL = T('사유', 'Reason', '原因');
  const row = ([label, state, date, reason], i) => {
    const done = state === 'done', current = state === 'current';
    return (
      <div key={i} className="flex gap-2.5">
        <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]', done ? 'bg-primary text-primary-foreground' : current ? 'border-2 border-primary text-primary' : 'border text-muted-foreground')}>{done ? <Check className="h-3 w-3" /> : i + 1}</span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs', current ? 'font-semibold' : done ? 'text-muted-foreground' : '')}>{t(label, lang)}</p>
          <p className="text-[10px] text-muted-foreground">{t(done ? doneL : planL, lang)} {date}</p>
          {reason && <Mark n={4} inline className="mt-1"><p className="text-[10px] text-muted-foreground">{t(reasonL, lang)}: {t(reason, lang)}</p></Mark>}
        </div>
      </div>
    );
  };
  return (
    <DetailFrame lang={lang} active={0}>
      <div className="rounded-lg border p-3">
        <p className="mb-3 text-xs font-semibold">{t(T('진행 단계', 'Milestones', '进行步骤'), lang)}</p>
        <div className="space-y-2.5">
          <Mark n={1} pos="tr"><div className="space-y-2.5 p-0.5">{STEPS.slice(0, 2).map(row)}</div></Mark>
          <Mark n={2} pos="tr"><div className="p-0.5">{row(STEPS[2], 2)}</div></Mark>
          {STEPS.slice(3, 5).map((s, i) => row(s, i + 3))}
          <Mark n={3} pos="tr"><div className="p-0.5">{row(STEPS[5], 5)}</div></Mark>
        </div>
      </div>
    </DetailFrame>
  );
}

// ── 7. 일정과 요구사항
function ScheduleMock({ lang }) {
  const item = (label, value) => <div><p className="text-[10px] text-muted-foreground">{t(label, lang)}</p><p className="mt-0.5 text-xs font-medium">{value}</p></div>;
  return (
    <DetailFrame lang={lang} active={0}>
      <div className="space-y-3">
        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-semibold">{t(T('견적·납품 일정', 'Quote & delivery schedule', '报价·交付日程'), lang)}</p>
          <div className="grid grid-cols-2 gap-3">
            <Mark n={1}>{item(T('견적 발송 기한', 'Quote due', '报价发送期限'), '2026-09-10')}</Mark>
            <Mark n={2}>{item(T('선금 입금 기준일', 'Deposit date', '定金到账基准日'), '2026-09-16')}</Mark>
            <Mark n={2}>{item(T('납품 소요일', 'Lead time', '交付所需天数'), t(T('50일', '50 days', '50 天'), lang))}</Mark>
            <Mark n={3}>{item(T('예정 납품일', 'Expected delivery', '预计交付日'), '2026-11-16')}</Mark>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{t(T('입금일 다음 날부터 계산 · 일요일·중국 공휴일 제외 · 토요일 포함', 'From the day after payment · excludes Sundays and Chinese holidays · Saturdays count', '从到账次日起计算 · 不含周日和中国公休日 · 含周六'), lang)}</p>
        </div>
        <Mark n={4} inline>
          <div className="flex flex-wrap items-center gap-1.5 p-0.5"><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">{t(STAGE.PRODUCTION, lang)}</span><span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">{t(HIGH, lang)}</span><span className="text-[10px] text-muted-foreground">{t(T('목표일', 'Target', '目标日期'), lang)} 2026-11-20</span></div>
        </Mark>
        <Mark n={5}>
          <div className="p-0.5">
            <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-semibold">{t(T('요구사항', 'Requirements', '需求'), lang)}</span><span className="text-[10px] text-muted-foreground">{t(T('이 항목만 수정할 수 있습니다', 'Only this field is editable', '仅此项可修改'), lang)}</span></div>
            <div className="mb-1 flex justify-end gap-1"><span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">KR</span><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">CN</span></div>
            <div className="rounded-md border px-2.5 py-2 text-[11px] leading-relaxed">{t(T('3단 밝기 조절, USB-C 충전, KC 인증 필요. 패키지 한글 표기.', '3-level brightness, USB-C charging, KC certification required. Korean on the package.', '3 档亮度调节，USB-C 充电，需 KC 认证，包装需韩文标注。'), lang)}</div>
          </div>
        </Mark>
        <div className="flex justify-end"><Mark n={6} pos="tr"><span className="rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">{t(T('요구사항 저장', 'Save requirements', '保存需求'), lang)}</span></Mark></div>
      </div>
    </DetailFrame>
  );
}

// ── 8. 견적서
function QuotesMock({ lang }) {
  const rows = [[T('LED 마스크 OEM 견적서 (3,000개)', 'LED mask OEM quote (3,000 pcs)', 'LED面罩 OEM 报价单（3,000 个）'), '2026.09.08 · USD · LM-200'], [T('포장 박스 추가 견적', 'Gift box add-on quote', '包装盒追加报价'), '2026.09.12 · USD']];
  return (
    <DetailFrame lang={lang} active={1}>
      <div className="space-y-2">
        {rows.map(([title, meta], i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 space-y-1">
              {i === 0 ? <Mark n={1} inline><p className="text-xs font-medium">{t(title, lang)}</p></Mark> : <p className="truncate text-xs font-medium">{t(title, lang)}</p>}
              {i === 0 ? <div><Mark n={2} inline><p className="text-[10px] text-muted-foreground">{meta}</p></Mark></div> : <p className="text-[10px] text-muted-foreground">{meta}</p>}
            </div>
            {i === 0 ? <Mark n={3} pos="tr"><span className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px]"><Download className="h-3 w-3" />PDF</span></Mark> : <span className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px]"><Download className="h-3 w-3" />PDF</span>}
          </div>
        ))}
      </div>
    </DetailFrame>
  );
}

// ── 9. 문의
function ChatMock({ lang }) {
  return (
    <DetailFrame lang={lang} active={2}>
      <div className="space-y-2">
        <Mark n={1} className="max-w-[80%]"><div className="rounded-xl bg-muted px-3 py-2"><p className="text-[9px] opacity-70">김PM · 10.07 14:20</p><p className="mt-0.5 text-[11px] leading-relaxed">{t(T('1차 샘플 사진 올려 드렸습니다. 색상 확인 부탁드립니다.', 'We uploaded first-sample photos. Please check the colour.', '已上传首样照片，请确认颜色。'), lang)}</p></div></Mark>
        <div className="flex justify-end"><Mark n={2} pos="tr" className="max-w-[80%]"><div className="rounded-xl bg-primary px-3 py-2 text-primary-foreground"><p className="text-[9px] opacity-70">{t(W.buyer, lang)} · 10.07 16:05</p><p className="mt-0.5 text-[11px] leading-relaxed">{t(T('색상은 좋습니다. 로고만 조금 더 진하게 해 주세요.', 'Colour is fine. Please make the logo a bit darker.', '颜色可以，Logo 请再加深一点。'), lang)}</p></div></Mark></div>
        <div className="flex items-end gap-2 border-t pt-3">
          <Mark n={3} pos="bl"><span className="flex h-8 w-8 items-center justify-center rounded-md border"><Paperclip className="h-3.5 w-3.5" /></span></Mark>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex justify-end"><Mark n={4} pos="tr" inline><span className="flex gap-1"><b className="rounded bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">KR</b><b className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">CN</b></span></Mark></div>
            <div className="rounded-md border px-2.5 py-2 text-[10px] text-muted-foreground">{t(T('메시지 / 消息 (파일을 끌어다 놓아 첨부)', 'Message (drag files to attach)', '消息（拖放文件即可附加）'), lang)}</div>
          </div>
          <Mark n={5} pos="tr"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Send className="h-3.5 w-3.5" /></span></Mark>
        </div>
      </div>
    </DetailFrame>
  );
}

// ── 10. 결제
function PaymentMock({ lang }) {
  const rows = [[T('선금', 'Deposit', '预付款'), '30%', T('입금일 2026-09-16', 'paid 2026-09-16', '到账日 2026-09-16'), T('입금 확인', 'Confirmed', '已到账'), 'bg-primary/15 text-primary'],
    [T('중도금', 'Interim', '中期款'), '40%', null, T('확인 대기', 'Pending', '待确认'), 'bg-muted text-muted-foreground'],
    [T('잔금', 'Balance', '尾款'), '30%', null, T('확인 대기', 'Pending', '待确认'), 'bg-muted text-muted-foreground']];
  return (
    <DetailFrame lang={lang} active={3}>
      <div className="space-y-3">
        <Mark n={1}><div className="rounded-xl border p-3"><p className="text-[10px] text-muted-foreground">{t(T('입금 확인 비율', 'Confirmed share', '到账确认比例'), lang)}</p><p className="mt-0.5 text-xl font-bold">30%</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-[30%] rounded-full bg-primary" /></div></div></Mark>
        <div className="space-y-2">
          {rows.map(([label, pct, paid, status, cls], i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              {i === 0 ? <Mark n={2} inline><span className="flex gap-2 p-0.5"><b className="text-xs font-medium">{t(label, lang)}</b><span className="text-xs text-muted-foreground">{pct}{paid ? ` · ${t(paid, lang)}` : ''}</span></span></Mark>
                : <><b className="text-xs font-medium">{t(label, lang)}</b><span className="text-xs text-muted-foreground">{pct}</span></>}
              {i === 0 ? <Mark n={3} pos="tr" className="ml-auto"><span className={cn('block rounded-full px-2 py-0.5 text-[10px] font-medium', cls)}>{t(status, lang)}</span></Mark> : <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium', cls)}>{t(status, lang)}</span>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">{t(T('* 금액 상세는 발행된 견적서 PDF 를 확인해 주세요.', '* See the issued PDF quote for amounts.', '* 金额明细请查看已发布的报价单 PDF。'), lang)}</p>
      </div>
    </DetailFrame>
  );
}

// ── 파일 목록 한 줄 (파일 탭·보관함 공용)
function FileRow({ lang, icon: Icon = FileText, name, type, ext, card, who, date, marks = {} }) {
  const wrap = (n, node, pos, inline) => (marks[n] ? <Mark n={marks[n]} pos={pos} inline={inline}>{node}</Mark> : node);
  return (
    <div className="flex items-center gap-2.5 p-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 space-y-1">
        {wrap('info', <div className="flex flex-wrap items-center gap-1.5 p-0.5"><span className="text-[11px] font-medium">{name}</span><span className="rounded bg-secondary px-1.5 text-[9px]">{t(type, lang)}</span><span className="rounded border px-1 text-[9px] uppercase">{ext}</span></div>, 'tr', true)}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {card && wrap('card', <span className="p-0.5 text-primary">📋 {t(card, lang)}</span>, 'tr', true)}
          {wrap('who', <span className="p-0.5">· {t(who, lang)} · {date}</span>, 'tr', true)}
        </div>
      </div>
      {wrap('open', <span className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px]"><ExternalLink className="h-3 w-3" />{t(W.open, lang)}</span>, 'tr', false)}
    </div>
  );
}
const DT = { GENERAL: T('일반 파일', 'General', '一般文件'), QUOTATION: T('견적서', 'Quote', '报价单'), PL: T('패킹리스트 (PL)', 'Packing list (PL)', '装箱单（PL）'), CI: T('인보이스 (CI)', 'Invoice (CI)', '发票（CI）') };
const AEGIS = T('김PM', 'Kim (PM)', '金PM');

// ── 11. 파일
function FilesMock({ lang }) {
  return (
    <DetailFrame lang={lang} active={4}>
      <div className="space-y-2">
        <Mark n={1}><div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-[10px] text-muted-foreground"><Upload className="h-3.5 w-3.5" />{t(T('파일을 끌어다 놓거나 클릭해서 업로드 (최대 5건 · 10MB)', 'Drag files here or click to upload (max 5 · 10 MB)', '拖放文件或点击上传（最多 5 个 · 10MB）'), lang)}</div></Mark>
        <p className="text-[10px] text-muted-foreground">{t(T('업로드한 파일과 담당자가 공개한 파일이 함께 표시됩니다.', 'Your uploads and files shared by your team appear together.', '同时显示您上传的文件和负责人公开的文件。'), lang)}</p>
        <div className="divide-y rounded-xl border bg-card">
          <FileRow lang={lang} icon={FileImage} name="sample1_photos.zip" type={DT.GENERAL} ext="zip" who={AEGIS} date="2026-10-07" marks={{ info: 2, who: 3, open: 4 }} />
          <FileRow lang={lang} name="logo_v2.ai" type={DT.GENERAL} ext="ai" who={W.buyer} date="2026-10-07" />
        </div>
      </div>
    </DetailFrame>
  );
}

// ── 12. 회사별 파일 보관함
function LibraryMock({ lang }) {
  const f = (label, value) => <div><p className="text-[10px]">{t(label, lang)}</p><div className="mt-0.5 h-7 rounded-md border px-2 text-[10px] leading-7 text-muted-foreground">{value}</div></div>;
  return (
    <Frame title={t(W.dashboard, lang)} lang={lang}>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between"><p className="text-xs font-semibold">{t(T('회사별 파일 보관함', 'Company file library', '公司文件库'), lang)}</p><span className="rounded border px-1.5 py-0.5 text-[9px]">{t(T('새로고침', 'Refresh', '刷新'), lang)}</span></div>
        <Mark n={1}><div className="grid grid-cols-2 gap-2 p-0.5 sm:grid-cols-4">{f(T('카드명', 'Project', '卡片名称'), t(T('카드명 검색', 'Search', '搜索'), lang))}{f(T('문서 유형', 'Document type', '文件类型'), t(T('전체', 'All', '全部'), lang))}{f(T('업로드 시작일', 'From', '开始日期'), '2026-09-01')}{f(T('업로드 종료일', 'To', '结束日期'), '2026-10-31')}</div></Mark>
        <div className="divide-y rounded-xl border bg-card">
          <FileRow lang={lang} name="CI_LM-200.pdf" type={DT.CI} ext="pdf" card={P.led} who={AEGIS} date="2026-10-02" marks={{ info: 2, card: 3, open: 4 }} />
          <FileRow lang={lang} name="PL_LM-200.xlsx" type={DT.PL} ext="xlsx" card={P.led} who={AEGIS} date="2026-10-02" />
          <FileRow lang={lang} name="quote_airless.pdf" type={DT.QUOTATION} ext="pdf" card={P.airless} who={AEGIS} date="2026-09-28" />
        </div>
        <div className="flex justify-end"><Mark n={5} pos="tr" inline><span className="flex items-center gap-2 p-0.5 text-[10px]"><b className="rounded-md border px-2 py-0.5 font-normal">{t(T('이전', 'Prev', '上一页'), lang)}</b>{t(T('1 페이지', 'Page 1', '第 1 页'), lang)}<b className="rounded-md border px-2 py-0.5 font-normal">{t(T('다음', 'Next', '下一页'), lang)}</b></span></Mark></div>
      </div>
    </Frame>
  );
}

// ── 13. 알림
function AlertsMock({ lang }) {
  const items = [
    ['⏩', T('[진행 상황] LED 마스크 OEM → 발주 · 제작', '[진행 상황] LED mask OEM → Order & production', '[진행 상황] LED面罩 OEM → 下单 · 生产'), T('프로젝트 단계가 "발주 · 제작" 로 변경되었습니다.', 'The project moved to "Order & production".', '项目阶段已变更为"下单 · 生产"。'), T('10분 전', '10 min ago', '10 分钟前'), false],
    ['📄', T('[견적서 발행] 에어리스 용기 리뉴얼', '[견적서 발행] Airless bottle renewal', '[견적서 발행] 真空瓶改版'), T('견적서가 발행되었습니다. 고객 포털에서 PDF 로 다운로드하실 수 있습니다.', 'A quote has been issued. Download the PDF in the portal.', '报价单已发布，可在客户门户下载 PDF。'), T('2시간 전', '2 hours ago', '2 小时前'), false],
    ['💬', T('[답변] 캐릭터 인형 1차', '[답변] Character plush, lot 1', '[답변] 卡通公仔首批'), T('봉제선 사진 다시 올려 드렸습니다.', 'We re-uploaded the seam photos.', '已重新上传缝线照片。'), T('어제', 'yesterday', '昨天'), true],
  ];
  return (
    <Frame title={t(T('알림', 'Notifications', '通知'), lang)} lang={lang} className="bg-muted/30">
      <div className="flex justify-end pb-2 pr-8"><Mark n={1} pos="tl"><span className="relative block p-1"><Bell className="h-4 w-4" /><i className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold not-italic text-white">2</i></span></Mark></div>
      <div className="ml-auto max-w-sm overflow-hidden rounded-lg border bg-card shadow-md">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-xs font-semibold">{t(T('알림', 'Notifications', '通知'), lang)}</span><Mark n={2} pos="tr" inline><span className="flex items-center gap-1 text-[10px] text-primary"><CheckCheck className="h-3 w-3" />{t(T('모두 읽음', 'Mark all read', '全部已读'), lang)}</span></Mark></div>
        <div className="divide-y">
          {items.map(([icon, title, body, when, read], i) => {
            const row = (
              <div className={cn('flex gap-2.5 px-3 py-2.5', !read && 'bg-primary/5')}>
                <span className="text-sm leading-none">{icon}</span>
                <div className="min-w-0 flex-1"><p className={cn('truncate text-[11px]', !read && 'font-semibold')}>{t(title, lang)}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{t(body, lang)}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{t(when, lang)}</p></div>
                {!read && <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
            );
            return i === 0 ? <Mark key={i} n={3} pos="bl" className="rounded-none">{row}</Mark> : <div key={i}>{row}</div>;
          })}
        </div>
      </div>
    </Frame>
  );
}

// ── 14. 중국 휴무 안내
function HolidaysMock({ lang }) {
  return (
    <Frame title={t(W.dashboard, lang)} lang={lang}>
      <div className="space-y-3">
        <div className="rounded-xl border bg-card p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold"><CalendarOff className="h-3.5 w-3.5 text-primary" />{t(T('중국 휴무 안내 (90일 이내)', 'China holidays (next 90 days)', '中国假期提示（90 天内）'), lang)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px]">
            <Mark n={1} inline><span className="flex gap-2 p-0.5"><b className="font-medium">{t(T('춘절', 'Spring Festival', '春节'), lang)}</b>2027-02-06 ~ 2027-02-12</span></Mark>
            <Mark n={2} inline><span className="p-0.5 text-muted-foreground">{t(T('공장 휴무 예상 2027-01-30 ~ 2027-02-19', 'Factory closure (est.) 2027-01-30 ~ 02-19', '预计工厂停工 2027-01-30 ~ 2027-02-19'), lang)}</span></Mark>
            <Mark n={3} pos="tr" inline><span className="p-0.5 font-medium text-primary">{t(T('휴무 전 출고 발주 마감 2026-12-31 (추정)', 'Order by 2026-12-31 to ship before (est.)', '假期前出货下单截止 2026-12-31（估计）'), lang)}</span></Mark>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{t(T('공장 휴무와 발주 마감일은 추정치이며 공장 사정에 따라 달라질 수 있습니다.', 'Factory closures and cut-offs are estimates.', '工厂停工和下单截止日为估计值，可能因工厂情况而变化。'), lang)}</p>
        </div>
        <div className="max-w-[240px]"><Tile lang={lang} title={P.plush} due="2027-02-26" holiday={HOLIDAY_BADGE} holidayMark={4} /></div>
      </div>
    </Frame>
  );
}

// ── 15. 계정·언어·도움
function AccountMock({ lang }) {
  return (
    <Frame title="AEGIS Cloud" lang={lang} className="space-y-3 bg-muted/30">
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border bg-card px-3 py-2">
        <span className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] text-muted-foreground"><Search className="h-3 w-3" />…</span>
        <Mark n={1} pos="bl" inline><span className="flex items-center gap-1 p-0.5 text-[10px] text-muted-foreground"><Home className="h-3 w-3" />{t(W.main, lang)}</span></Mark>
        <Bell className="h-4 w-4" />
        <Mark n={2} pos="bl" inline><span className="flex whitespace-nowrap rounded-md border bg-muted/40 p-0.5 text-[9px] font-bold"><b className="rounded bg-card px-1.5 py-0.5 text-primary shadow-sm">KR</b><b className="px-1.5 py-0.5 text-muted-foreground">中文</b></span></Mark>
        <span className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">G</span><span className="text-[10px] leading-tight"><b className="block">{t(W.buyer, lang)}</b><span className="text-muted-foreground">{t(W.client, lang)}</span></span></span>
        <Mark n={3} pos="br" inline><span className="flex items-center gap-1 p-0.5 text-[10px] text-muted-foreground"><LogOut className="h-3 w-3" />{t(W.logout, lang)}</span></Mark>
      </div>
      <div className="max-w-xs"><ContactCard lang={lang} mark={4} /></div>
    </Frame>
  );
}

export const MOCKS = {
  login: LoginMock, dashboard: DashboardMock, board: BoardMock, inquiry: InquiryMock, detail: DetailMock, progress: ProgressMock,
  schedule: ScheduleMock, quotes: QuotesMock, chat: ChatMock, payment: PaymentMock, files: FilesMock, library: LibraryMock,
  alerts: AlertsMock, holidays: HolidaysMock, account: AccountMock,
};

