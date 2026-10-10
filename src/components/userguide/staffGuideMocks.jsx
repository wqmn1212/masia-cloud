// 직원용 이용 가이드 예시 화면 (HTML). 실제 업무 화면과 같은 모양으로 그린 정적 화면이며 눌러도 동작하지 않는다.
// 각 화면의 번호(Mark n) 순서 = userGuideContent.js 의 shots[].points 순서
// 운영 지표·중국 휴무·납품 일정·고객 화면·알림은 실제 화면이 한국어뿐이라 중국어 가이드에서도 한국어로 그린다(본문의 shot.lang).
import React from 'react';
import {
  LayoutDashboard, ListChecks, BookOpen, BookMarked, CalendarOff, FileText, Kanban, Calculator, Bell, Home, LogOut, Search,
  UserRound, CalendarDays, Lock, RotateCcw, Check, EyeOff, ClipboardCheck, ChevronDown, Activity, TrendingDown, AlarmClock, UserX,
  CheckCircle2, CheckCheck, Plus, Pencil, Trash2, MessageSquare, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Frame as KitFrame, Mark } from '@/components/guide/mockKit';

const Z = (lang, ko, zh) => (lang === 'zh' ? zh : ko);
const Frame = ({ lang, ...props }) => <KitFrame badge={Z(lang, '예시 화면', '示例画面')} {...props} />;

// ── 공용 조각
const Input = ({ children, className, muted }) => <div className={cn('flex h-7 items-center justify-between gap-1 rounded-md border px-2 text-[11px]', muted && 'bg-muted/40 text-muted-foreground', className)}>{children}</div>;
const DateBox = ({ value, muted }) => <Input muted={muted}><span>{value}</span><CalendarDays className="h-3 w-3 opacity-60" /></Input>;
const SelectBox = ({ value, className }) => <Input className={className}><span className="truncate">{value}</span><ChevronDown className="h-3 w-3 opacity-60" /></Input>;
const Btn = ({ children, primary, className }) => <span className={cn('inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[11px] font-medium', primary ? 'bg-primary text-primary-foreground' : 'border bg-background', className)}>{children}</span>;
const Chip = ({ children, tone }) => <span className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold', tone === 'red' ? 'bg-destructive/15 text-destructive' : tone === 'amber' ? 'bg-chart-3/15 text-chart-3' : 'bg-muted text-foreground')}>{children}</span>;

// 예시 데이터
const LED = (lang) => Z(lang, 'LED 마스크 OEM', 'LED面罩 OEM');
const W = {
  done: (l) => Z(l, '완료', '完成'), base: (l) => Z(l, '기준일', '基准日'), plan: (l) => Z(l, '계획일', '计划日'), owner: (l) => Z(l, '담당', '负责人'),
  unset: (l) => Z(l, '미지정', '未指定'), unconfirmed: (l) => Z(l, '미확정', '未确认'), overdue: (l) => Z(l, '기한 지남', '已逾期'), day: (l) => Z(l, '일', '天'),
  reason: (l) => Z(l, '지연 사유', '延误原因'), public: (l) => Z(l, '고객 공개', '客户可见'),
};

// 일정 탭의 단계 한 줄 (MilestoneRow 모양)
function StepRow({ lang, seq, label, done, actual, base, plan, owner, ownerText, eye, qc, delay, overdue, button, reason, reasonPublic, marks = {}, planMuted }) {
  const m = (key, node, pos, inline) => (marks[key] ? <Mark n={marks[key]} pos={pos} inline={inline}>{node}</Mark> : node);
  return (
    <div className={cn('space-y-2 rounded-lg border p-2.5', done && 'bg-muted/30')}>
      <div className="flex items-center gap-2">
        <span className="w-4 text-[10px] text-muted-foreground">{seq}</span>
        <p className={cn('min-w-0 flex-1 truncate text-xs font-medium', done && 'text-muted-foreground line-through')}>{label}</p>
        {eye && m('eye', <EyeOff className="m-0.5 h-3.5 w-3.5 text-muted-foreground" />, 'tl')}
        {qc && <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />}
        {delay > 0 && m('delay', <Chip tone="red">+{delay}{W.day(lang)}</Chip>, 'tl')}
        {overdue && m('overdue', <Chip tone="amber">{W.overdue(lang)}</Chip>, 'tl')}
        {done ? <span className="text-[10px] text-primary">{W.done(lang)} {actual}</span>
          : button && m('button', <Btn><Check className="h-3 w-3" />{W.done(lang)}</Btn>)}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div><p className="text-muted-foreground">{W.base(lang)}</p><p className="mt-1">{base || W.unconfirmed(lang)}</p></div>
        <div><p className="text-muted-foreground">{W.plan(lang)}</p><div className="mt-1">{m('plan', <DateBox value={plan} muted={done || planMuted} />)}</div></div>
        <div><p className="text-muted-foreground">{W.owner(lang)}</p><div className="mt-1">{ownerText ? m('ownerText', <p className="flex h-7 items-center pr-1">{ownerText}</p>, 'tr', true) : m('owner', <SelectBox value={owner || W.unset(lang)} />)}</div></div>
      </div>
      {reason !== undefined && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{m('reason', <Input className={!reason ? 'text-muted-foreground' : ''}>{reason || W.reason(lang)}</Input>)}</div>
          {m('public', <span className="flex items-center gap-1 whitespace-nowrap text-[10px]"><input type="checkbox" readOnly checked={!!reasonPublic} className="h-3 w-3" tabIndex={-1} />{W.public(lang)}</span>, 'tr', true)}
        </div>
      )}
    </div>
  );
}

// 카드 상세 머리 (제목 · 상태 · 고객사/공장)
function CardHead({ lang }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">{LED(lang)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">🏢 글로우랩 · 🏭 선전 A공장</p></div>
      <span className="rounded-full bg-chart-4/15 px-2 py-0.5 text-[10px] font-semibold text-chart-4">발주·제작</span>
    </div>
  );
}
const TAB_LABELS = (l) => (l === 'zh' ? ['概览', '进度', '任务', '会议·分析', '报价', 'BOM', '文件', '贸易文件', '聊天', '结算', '决策'] : ['오버뷰', '일정', '업무', '미팅·분석', '견적', 'BOM', '파일', '무역서류', '채팅', '정산', '결정']);
const CardFrame = ({ lang, children }) => <Frame lang={lang} title={Z(lang, '카드 상세', '卡片详情')} className="bg-muted/30"><div className="rounded-xl border bg-card p-4">{children}</div></Frame>;

// ── 01 메뉴와 화면 구성
function AppMock({ lang }) {
  const menu = [
    ['/dashboard', LayoutDashboard, Z(lang, '대시보드', '仪表盘')], ['/my-work', ListChecks, Z(lang, '내 업무', '我的工作'), true],
    ['/user-guide', BookOpen, Z(lang, '이용 가이드', '使用指南')], ['/service-guide', BookMarked, Z(lang, '서비스 사용 가이드', '服务使用指南')],
    ['/china-holidays', CalendarOff, Z(lang, '중국 휴무', '中国假期')], ['/quotations', FileText, Z(lang, '견적 관리', '报价管理')],
    ['/task-board', Kanban, Z(lang, '소싱 칸반 보드', '采购看板')], ['/settlement', Calculator, Z(lang, '정산 대시보드', '结算概览')],
  ];
  const marks = { '/user-guide': 1, '/my-work': 2, '/china-holidays': 3, '/task-board': 4 };
  return (
    <Frame lang={lang} title="AEGIS Cloud" className="p-0">
      <div className="flex min-w-0">
        <div className="w-32 shrink-0 space-y-0.5 bg-sidebar p-2 sm:w-44">
          <p className="px-2 pb-2 pt-1 text-[11px] font-bold text-sidebar-foreground">{Z(lang, '이지스 클라우드', 'AEGIS 云平台')}</p>
          <p className="px-2 pb-1 text-[9px] uppercase tracking-widest text-sidebar-foreground/40">{Z(lang, '본사 관리', '总部管理')}</p>
          {menu.map(([path, Icon, label, active]) => {
            const row = <div className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]', active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/70')}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{label}</span></div>;
            return marks[path] ? <Mark key={path} n={marks[path]} className="ring-offset-sidebar">{row}</Mark> : <div key={path}>{row}</div>;
          })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
            <span className="hidden min-w-0 flex-1 items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-1 text-[10px] text-muted-foreground sm:flex"><Search className="h-3 w-3" /><span className="truncate">{Z(lang, '견적, 공장, 고객사 검색...', '搜索报价、工厂、客户...')}</span></span>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground"><Home className="h-3 w-3" /><span className="hidden sm:inline">{Z(lang, '메인페이지', '主页')}</span></span>
            <Mark n={5} pos="bl"><span className="relative block p-1"><Bell className="h-4 w-4" /><i className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold not-italic text-white">1</i></span></Mark>
            <Mark n={6} pos="br"><span className="flex whitespace-nowrap rounded-md border bg-muted/40 p-0.5 text-[9px] font-bold"><b className={cn('rounded px-1.5 py-0.5', lang !== 'zh' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground')}>KR</b><b className={cn('rounded px-1.5 py-0.5', lang === 'zh' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground')}>中文</b></span></Mark>
            <span className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">김</span><span className="hidden text-[10px] leading-tight md:block"><b className="block">김PM</b><span className="text-muted-foreground">{Z(lang, '팀 관리자', '团队管理员')}</span></span></span>
            <LogOut className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
          </div>
          <div className="p-3"><MyWorkBody lang={lang} /></div>
        </div>
      </div>
    </Frame>
  );
}

// ── 02 책임자와 다음 할 일
function OwnerMock({ lang }) {
  return (
    <CardFrame lang={lang}>
      <CardHead lang={lang} />
      <div className="mt-3 space-y-2 rounded-lg border bg-muted/20 p-2.5">
        <div className="flex items-center gap-2 text-[11px]"><UserRound className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">{Z(lang, '책임자', '负责人')}</span><Mark n={1}><SelectBox value="김PM" className="w-24" /></Mark></div>
        <div className="flex gap-2">
          <Mark n={2} className="min-w-0 flex-1"><Input>{Z(lang, '1차 샘플 사진 받기', '索取首样照片')}</Input></Mark>
          <Mark n={3}><div className="w-28"><DateBox value="2026-10-10" /></div></Mark>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-0.5 rounded-md bg-muted p-0.5 sm:grid-cols-5">
        {TAB_LABELS(lang).map((l, i) => {
          const tab = <span className={cn('block truncate rounded px-1 py-1 text-center text-[10px]', i === 1 ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground')}>{l}</span>;
          return i === 1 ? <Mark key={l} n={4}>{tab}</Mark> : <div key={l}>{tab}</div>;
        })}
      </div>
    </CardFrame>
  );
}

// ── 03 계획 만들기
function CreateMock({ lang }) {
  return (
    <CardFrame lang={lang}>
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-xs font-semibold">{Z(lang, '계획 만들기', '制定计划')}</p>
        {lang !== 'zh' && <p className="text-[10px] text-muted-foreground">템플릿과 시작일을 고르면 중국 휴무를 피한 근무일 기준으로 단계별 계획일이 채워집니다.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className="mb-1 text-[10px]">{Z(lang, '템플릿', '模板')}</p><Mark n={1}><SelectBox value={Z(lang, '일반 OEM · 11단계', '通用OEM · 11个步骤')} /></Mark></div>
          <div><p className="mb-1 text-[10px]">{Z(lang, '시작일', '开始日')}</p><Mark n={2}><DateBox value="2026-10-09" /></Mark></div>
        </div>
        <Mark n={3} inline><Btn primary>{Z(lang, '계획 만들기', '制定计划')}</Btn></Mark>
      </div>
    </CardFrame>
  );
}

// ── 04 계획 다듬고 확정하기
function DraftMock({ lang }) {
  const steps = [
    [Z(lang, '사양 확정', '规格确认'), '2026-10-13', {}, { plan: 2 }],
    [Z(lang, '공장 확정', '工厂确认'), '2026-10-19', { eye: true }, { eye: 4 }],
    [Z(lang, '선금 입금', '定金到账'), '2026-10-22', {}, {}],
    [Z(lang, '1차 샘플', '首样'), '2026-11-03', { owner: '왕QC' }, { owner: 3 }],
  ];
  return (
    <CardFrame lang={lang}>
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold">{Z(lang, '일반 OEM', '通用OEM')}</p><span className="text-[10px] text-muted-foreground">0/11 {W.done(lang)}</span>
          <div className="flex-1" />
          <Mark n={1} pos="tl" inline><Btn primary><Lock className="h-3 w-3" />{Z(lang, '계획 확정', '确认计划')}</Btn></Mark>
          <Mark n={5} inline><span className="inline-flex items-center gap-1 px-1.5 text-[11px] font-medium"><RotateCcw className="h-3 w-3" />{Z(lang, '다시 만들기', '重新制定')}</span></Mark>
        </div>
        <p className="rounded bg-muted/40 p-2 text-[10px] text-muted-foreground">{Z(lang, '계획 확정 전입니다. 날짜·담당자를 조정한 뒤 확정하면 기준일이 잠기고 지연이 계산됩니다.', '计划尚未确认。调整日期和负责人后确认，基准日将锁定并开始计算延误。')}</p>
        {steps.map(([label, plan, extra, marks], i) => <StepRow key={i} lang={lang} seq={i + 1} label={label} plan={plan} button {...extra} marks={marks} />)}
      </div>
    </CardFrame>
  );
}

// ── 완료 창 (단계 완료 · QC)
function DialogFrame({ lang, title, children }) {
  return (
    <Frame lang={lang} title={Z(lang, '카드 상세 · 일정', '卡片详情 · 进度')} className="bg-muted/40">
      <div className="mx-auto max-w-xs space-y-3 rounded-xl border bg-card p-4 shadow-lg">
        <p className="text-sm font-semibold">{title}</p>
        {children}
      </div>
    </Frame>
  );
}
const ActualDate = ({ lang, mark }) => {
  const body = <><p className="mb-1 text-[10px]">{Z(lang, '실제 완료일', '实际完成日')}</p><DateBox value="2026-10-09" /></>;
  return mark ? <Mark n={mark}><div className="p-0.5">{body}</div></Mark> : <div>{body}</div>;
};

// ── 05 단계 완료 처리
function CompleteMock({ lang }) {
  return (
    <DialogFrame lang={lang} title={`${Z(lang, '1차 샘플', '首样')} ${W.done(lang)}`}>
      <ActualDate lang={lang} mark={1} />
      <Mark n={2}><span className="flex items-center gap-1.5 p-0.5 text-[11px]"><input type="checkbox" readOnly checked className="h-3 w-3" tabIndex={-1} />{Z(lang, '뒤 단계 계획일도 늦어진 만큼 밀기', '后续步骤按延误天数顺延')}</span></Mark>
      <Mark n={3}><span className="flex h-8 items-center justify-center rounded-md bg-primary text-[11px] font-medium text-primary-foreground">{Z(lang, '완료 처리', '标记完成')}</span></Mark>
    </DialogFrame>
  );
}

// ── 06 출고 전 검수 (QC 보고서)
function QcMock({ lang }) {
  return (
    <DialogFrame lang={lang} title={`${Z(lang, '출고 전 검수', '出货前检验')} ${W.done(lang)}`}>
      <ActualDate lang={lang} />
      <div>
        <p className="mb-1 text-[10px]">{Z(lang, 'QC 보고서 연결 (필수)', '关联QC报告（必填）')}</p>
        <Mark n={1}><SelectBox value={<span className="text-muted-foreground">{Z(lang, '보고서 선택', '选择报告')}</span>} /></Mark>
        <div className="mt-1.5 space-y-0.5 rounded-md border bg-popover p-1 shadow-md">
          <p className="rounded px-2 py-1 text-[11px]">2026-10-06 · {Z(lang, '합격', '合格')}</p>
          <Mark n={2}><p className="px-2 py-1 text-[11px] text-muted-foreground/60">2026-10-02 · {Z(lang, '불합격', '不合格')}</p></Mark>
        </div>
      </div>
      <span className="flex h-8 items-center justify-center rounded-md bg-primary/50 text-[11px] font-medium text-primary-foreground">{Z(lang, '완료 처리', '标记完成')}</span>
    </DialogFrame>
  );
}

// ── 07 지연 표시와 지연 사유
function DelayMock({ lang }) {
  return (
    <CardFrame lang={lang}>
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold">{Z(lang, '일반 OEM', '通用OEM')}</p><span className="text-[10px] text-muted-foreground">3/11 {W.done(lang)}</span>
          <Mark n={1} inline><span className="text-[11px] font-semibold text-destructive">{Z(lang, '납품', '交付')} +4{W.day(lang)}</span></Mark>
          <div className="flex-1" /><span className="inline-flex items-center gap-1 text-[11px] font-medium"><RotateCcw className="h-3 w-3" />{Z(lang, '다시 만들기', '重新制定')}</span>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">⋯ 1 · 2 ⋯</p>
        <StepRow lang={lang} seq={3} label={Z(lang, '선금 입금', '定金到账')} done actual="2026-09-16" base="2026-09-12" plan="2026-09-12" owner={W.unset(lang)} delay={4}
          reason={Z(lang, '은행 휴무로 입금 확인 지연', '银行休假导致到账确认延迟')} reasonPublic marks={{ delay: 2, public: 5 }} />
        <StepRow lang={lang} seq={4} label={Z(lang, '1차 샘플', '首样')} base="2026-09-23" plan="2026-09-29" owner="왕QC" delay={16} overdue button
          reason={Z(lang, '금형 수정으로 샘플 재작업', '模具修改，样品返工')} marks={{ overdue: 3, reason: 4 }} />
      </div>
    </CardFrame>
  );
}

// ── 08 팀원이 보는 일정 탭
function SubMock({ lang }) {
  return (
    <CardFrame lang={lang}>
      <div className="space-y-2.5">
        <StepRow lang={lang} seq={4} label={Z(lang, '1차 샘플', '首样')} base="2026-09-23" plan="2026-09-29" planMuted ownerText="왕QC" delay={16} overdue button reason="" marks={{ button: 1, plan: 2, reason: 3 }} />
        <StepRow lang={lang} seq={5} label={Z(lang, '샘플 승인', '样品确认')} base="2026-10-08" plan="2026-10-12" planMuted ownerText="왕QC" delay={4} button reason="" />
        <StepRow lang={lang} seq={7} label={Z(lang, '출고 전 검수', '出货前检验')} qc base="2026-10-29" plan="2026-11-02" planMuted ownerText="리PM" delay={4} marks={{ ownerText: 4 }} />
      </div>
    </CardFrame>
  );
}

// ── 09 내 업무 (본문은 01 화면에도 쓴다)
function MyWorkCard({ title, badges, stage, next, due, dueRed, marks = {} }) {
  const m = (key, node, pos) => (marks[key] ? <Mark n={marks[key]} pos={pos} inline>{node}</Mark> : node);
  return (
    <div className="space-y-1 rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs font-medium">{title}</p>{badges && m('badges', <span className="flex gap-1">{badges}</span>, 'tl')}</div>
      <div>{m('stage', <p className="truncate text-[10px] text-muted-foreground">🏢 글로우랩{stage && ` · ▸ ${stage}`}</p>)}</div>
      <div className="flex items-center gap-2 text-[11px]"><span className="min-w-0 flex-1 truncate">{next}</span>{m('due', <span className={cn('flex items-center gap-1', dueRed ? 'font-semibold text-destructive' : 'text-muted-foreground')}><CalendarDays className="h-3 w-3" />{due}</span>)}</div>
    </div>
  );
}
function MyWorkBody({ lang, marked }) {
  const zh = lang === 'zh';
  const overdueCard = zh
    ? <MyWorkCard title="真空瓶改版" badges={<Chip tone="amber">当前延误</Chip>} stage="样品确认" next="重新索取颜色标准样" due="2026-10-06" dueRed marks={marked ? { badges: 2, stage: 3, due: 4 } : {}} />
    : <MyWorkCard title="LED 마스크 OEM" badges={<><Chip tone="amber">지금 지연 중</Chip><Chip tone="red">+4일</Chip></>} stage="1차 샘플" next="1차 샘플 사진 받기" due="2026-10-10" marks={marked ? { badges: 2, stage: 3, due: 4 } : {}} />;
  const rest = zh
    ? [<MyWorkCard key="a" title="卡通公仔首批" stage="首样" next="索取缝制不良照片" due="2026-10-12" />]
    : [<MyWorkCard key="a" title="라벨러 2대" stage="제작" next="시운전 영상 요청" due="2026-10-14" />, <MyWorkCard key="b" title="실리콘 케이스" next="금형비 견적 확인" due="2026-10-15" />];
  const heading = <p className="text-[11px] font-semibold text-destructive">{Z(lang, '기한 지남 · 지연', '已逾期 · 延误')} 1</p>;
  return (
    <div className="space-y-3">
      <div><p className="text-sm font-bold">{Z(lang, '내 업무', '我的工作')}</p><p className="text-[10px] text-muted-foreground">{Z(lang, '내가 책임자인 진행 중 카드', '我负责的进行中卡片')} {zh ? '2个' : '3건'}</p></div>
      <div className="space-y-1.5">{marked ? <Mark n={1} inline>{heading}</Mark> : heading}{overdueCard}</div>
      <div className="space-y-1.5"><p className="text-[11px] font-semibold">{Z(lang, '진행 중', '进行中')} {rest.length}</p>{rest}</div>
    </div>
  );
}
function MyWorkMock({ lang }) {
  return <Frame lang={lang} title={Z(lang, '내 업무', '我的工作')}><MyWorkBody lang={lang} marked /></Frame>;
}

// ── 10 소싱 칸반 보드 배지
function BoardCard({ title, sub, chips }) {
  return (
    <div className="space-y-1.5 rounded-lg border bg-card p-2.5">
      <p className="text-xs font-medium">{title}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
      {chips && <div className="flex flex-wrap gap-1">{chips}</div>}
      <p className="flex gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />채팅</span><span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />파일</span></p>
    </div>
  );
}
function BoardMock({ lang }) {
  const zh = lang === 'zh';
  const cols = [
    [zh ? '进行中' : '진행 중', 'bg-chart-3/10', 'bg-chart-3', [<BoardCard key="a" title={zh ? '卡通公仔首批' : '캐릭터 인형 1차'} sub="🏢 글로우랩" chips={<Chip>▸ {zh ? '首样' : '1차 샘플'}</Chip>} />]],
    [zh ? '审核中' : '검토', 'bg-accent/10', 'bg-accent', [<BoardCard key="b" title={zh ? '香水空瓶' : '향수 공병'} sub="🏢 글로우랩" />]],
    [zh ? '生产中' : '생산', 'bg-chart-4/10', 'bg-chart-4', [
      <BoardCard key="c" title={LED(lang)} sub="🏢 글로우랩 · 🏭 선전 A공장" chips={<>
        <Mark n={1} pos="bl" inline><Chip>▸ {zh ? '首样' : '1차 샘플'}</Chip></Mark>
        <Mark n={2} pos="bl" inline><Chip tone="red">+4{W.day(lang)}</Chip></Mark>
        <Mark n={3} inline><Chip tone="amber">{zh ? '当前延误' : '지금 지연 중'}</Chip></Mark></>} />,
      <BoardCard key="d" title={zh ? '真空瓶改版' : '에어리스 용기 리뉴얼'} sub="🏢 글로우랩" chips={<><Chip>▸ {zh ? '样品确认' : '샘플 승인'}</Chip><Chip tone="amber">{zh ? '当前延误' : '지금 지연 중'}</Chip></>} />]],
  ];
  return (
    <Frame lang={lang} title={Z(lang, '소싱 칸반 보드', '采购看板')}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cols.map(([label, bg, dot, cards], i) => (
          <div key={label} className={cn('space-y-2 rounded-xl p-2', bg, i < 2 && 'hidden sm:block')}>
            <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold"><i className={cn('h-2 w-2 rounded-full', dot)} />{label}<span className="ml-auto rounded-full bg-background px-1.5 text-[9px]">{cards.length}</span></p>
            {cards}
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ── 11 운영 지표 (한국어 화면)
function OpsMock({ lang }) {
  const metric = (Icon, label, value, sub, warn) => (
    <div className="h-full rounded-lg border p-2.5">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="h-3 w-3" />{label}</p>
      <p className={cn('mt-1 text-xl font-bold', warn && 'text-destructive')}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
  return (
    <Frame lang={lang} title="대시보드">
      <div className="space-y-3 rounded-xl border bg-card p-3">
        <p className="text-sm font-semibold">운영 지표</p>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          {metric(Activity, '진행 중 카드', 7)}
          <Mark n={1}>{metric(TrendingDown, '지연 카드', 2, '납품 지연 1건 평균 +4.0일', true)}</Mark>
          <Mark n={2}>{metric(AlarmClock, '다음 할 일 기한 지남', 1, null, true)}</Mark>
          <Mark n={3}>{metric(UserX, '책임자 미지정', 1, null, true)}</Mark>
          <Mark n={4}>{metric(CheckCircle2, '정시 납품률', '50%', '2건 중 1건 · 계획 미확정 1건')}</Mark>
        </div>
        <Mark n={5}>
          <div className="space-y-0.5 p-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground">지연 상위 카드</p>
            <p className="flex items-center gap-2 px-1.5 py-1 text-[11px]"><span className="flex-1 truncate">LED 마스크 OEM</span><span className="truncate text-[10px] text-muted-foreground">1차 샘플 · 김PM</span><b className="text-[10px] text-destructive">+4일</b></p>
            <p className="flex items-center gap-2 px-1.5 py-1 text-[11px]"><span className="flex-1 truncate">에어리스 용기 리뉴얼</span><span className="truncate text-[10px] text-muted-foreground">샘플 승인 · 왕QC</span><b className="text-[10px] text-chart-3">지금 지연 중 · 지난 단계 1개</b></p>
          </div>
        </Mark>
      </div>
    </Frame>
  );
}

// ── 12 매일 아침 지연 알림 (한국어 화면)
function BellMock({ lang }) {
  const items = [
    ['⏰', 'LED 마스크 OEM · 기한 지난 단계 1개', '1차 샘플: 계획일 2026-09-29 (담당 왕QC)', '약 2시간 전', false],
    ['⏰', '에어리스 용기 리뉴얼 · 기한 지난 단계 1개', '샘플 승인: 계획일 2026-10-06 (담당 왕QC)', '약 2시간 전', false],
    ['🗨️', '캐릭터 인형 1차 · 샘플 의견 도착', '고객 의견: 봉제선이 잘 보이도록 사진을 다시 부탁드립니다.', '2일 전', true],
  ];
  return (
    <Frame lang={lang} title="알림" className="bg-muted/30">
      <div className="flex justify-end pb-2 pr-8"><Mark n={1} pos="tl"><span className="relative block p-1"><Bell className="h-4 w-4" /><i className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold not-italic text-white">2</i></span></Mark></div>
      <div className="ml-auto max-w-sm overflow-hidden rounded-lg border bg-card shadow-md">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-xs font-semibold">알림</span><span className="flex items-center gap-1 text-[10px] text-primary"><CheckCheck className="h-3 w-3" />모두 읽음</span></div>
        <div className="divide-y">
          {items.map(([icon, title, body, when, read], i) => {
            const row = (
              <div className={cn('flex gap-2.5 px-3 py-2.5', !read && 'bg-primary/5')}>
                <span className="text-sm leading-none">{icon}</span>
                <div className="min-w-0 flex-1"><p className={cn('truncate text-[11px]', !read && 'font-semibold')}>{title}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{body}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{when}</p></div>
                {!read && <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
            );
            return i === 0 ? <Mark key={i} n={2} pos="bl" className="rounded-none">{row}</Mark> : <div key={i}>{row}</div>;
          })}
        </div>
      </div>
    </Frame>
  );
}

// ── 13 중국 휴무 등록 (한국어 화면)
function HolidaysMock({ lang }) {
  // 실제 휴일 추가 양식처럼 비어 있는 칸은 안내 문구(placeholder)를 흐리게 보여 준다
  const field = (label, value, placeholder, cls) => <div className={cls}><p className="mb-1 text-[10px] font-medium">{label}</p><Input className={!value ? 'text-muted-foreground' : ''}>{value || placeholder}</Input></div>;
  const rows = [
    ['2027 춘절', '2027-02-06 ~ 2027-02-12', '공장 휴무 2027-01-30 ~ 2027-02-19', '발주 마감 2026-12-31', true],
    ['2026 국경절', '2026-10-01 ~ 2026-10-07', null, '발주 마감 2026-09-15', true],
  ];
  return (
    <Frame lang={lang} title="중국 휴무">
      <div className="space-y-3">
        <div><p className="text-sm font-bold">중국 휴무</p><p className="text-[10px] text-muted-foreground">공휴일·공장 휴무를 등록하면 매일 08:00 진행 카드와의 겹침을 점검하고, 납품일 자동 계산에서 제외합니다.</p></div>
        <div className="space-y-3 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold">중국 공휴일</p><Btn primary><Plus className="h-3 w-3" />휴일 추가</Btn></div>
          <div className="grid gap-2.5 rounded-lg border bg-muted/20 p-3 sm:grid-cols-4">
            {field('연도', '2027')}
            {field('휴일명', '', '춘절', 'sm:col-span-3')}
            {field('공식 시작일', '', '연도-월-일')}
            {field('공식 종료일', '', '연도-월-일')}
            <Mark n={1}>{field('공장 앞뒤 추가 휴무(일)', '0')}</Mark>
            <Mark n={2}>{field('발주 마감일', '', '연도-월-일')}</Mark>
            <Mark n={3} className="sm:col-span-3">{field('조휴 근무일 (쉼표로 구분)', '', '2027-01-31, 2027-02-20')}</Mark>
            <Mark n={4}><span className="flex h-full items-end gap-1.5 pb-1.5 text-[10px]"><input type="checkbox" readOnly className="h-3 w-3" tabIndex={-1} />고객 발주 마감 안내</span></Mark>
            <div className="flex justify-end gap-2 sm:col-span-4"><Btn>취소</Btn><Btn primary>저장</Btn></div>
          </div>
          <div className="divide-y">
            {rows.map(([name, dates, factory, cutoff, announce]) => (
              <div key={name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[11px]">
                <b className="w-20 font-medium">{name}</b><span>{dates}</span>{factory && <span className="text-muted-foreground">{factory}</span>}<span className="text-muted-foreground">{cutoff}</span>
                {announce && <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-semibold">고객 안내</span>}
                <span className="ml-auto flex gap-2 text-muted-foreground"><Pencil className="h-3 w-3" /><Trash2 className="h-3 w-3" /></span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <Mark n={5} inline><span className="p-0.5"><b className="block text-xs font-semibold">공장별 휴무</b><span className="text-[10px] text-muted-foreground">정전·설비 점검 등 개별 일정. 고객에게는 보이지 않습니다.</span></span></Mark>
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1.5fr_auto]"><SelectBox value="공장 선택" /><DateBox value="연도-월-일" muted /><DateBox value="연도-월-일" muted /><Input className="text-muted-foreground">사유</Input><Btn primary>추가</Btn></div>
          <div className="flex items-center gap-3 py-1.5 text-[11px]"><b className="w-24 font-medium">선전 A공장</b><span>2026-10-20 ~ 2026-10-21</span><span className="truncate text-muted-foreground">전력 제한으로 라인 정지</span><Trash2 className="ml-auto h-3 w-3 text-muted-foreground" /></div>
        </div>
      </div>
    </Frame>
  );
}

// ── 14 견적·납품 일정 (한국어 화면)
function ScheduleFieldsBox({ locked, marks = {} }) {
  const m = (key, node, cls) => (marks[key] ? <Mark n={marks[key]} className={cls}>{node}</Mark> : node);
  const f = (label, node) => <div><p className="mb-1 text-[10px] font-medium">{label}</p>{node}</div>;
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {f('견적 발송 기한', <DateBox value="연도-월-일" muted />)}
      {m('paid', f('선금 입금 기준일', <DateBox value={locked ? '2026-09-16' : '2026-10-12'} />))}
      {locked ? <>
        {m('lockedDate', f('예정 납품일', <Input muted>2026-11-16</Input>))}
        {m('notice', <p className="rounded bg-primary/5 p-2 text-[10px] text-primary sm:col-span-2">마일스톤 계획이 있는 카드입니다. 예정 납품일은 '일정' 탭의 납품 단계에서 바꿉니다.</p>, 'sm:col-span-2')}
      </> : <>
        {m('days', f('납품 소요일 (일요일·중국 휴무 제외)', <Input>21</Input>))}
        {m('date', f('예정 납품일', <Input muted>2026-11-05</Input>))}
        <div className="sm:col-span-2">{m('manual', <span className="flex items-center gap-1.5 p-0.5 text-[11px]"><input type="checkbox" readOnly className="h-3 w-3" tabIndex={-1} />납품일 직접 조정 (공휴일·협의 일정 반영)</span>)}</div>
      </>}
      <p className="text-[10px] text-muted-foreground sm:col-span-2">입금일 다음 날부터 계산하며 토요일은 포함합니다. 등록된 중국 공휴일(공장 앞뒤 휴무 포함)은 빼고 조휴 근무일은 셉니다.</p>
    </div>
  );
}
function ScheduleMock({ lang }) {
  return (
    <Frame lang={lang} title="카드 상세 · 오버뷰">
      <div className="space-y-3">
        <p className="text-xs font-semibold">견적·납품 일정 관리</p>
        <Mark n={1}>
          <div className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-[11px] font-semibold text-amber-800">생산 기간 휴무 겹침</p>
            <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-amber-900"><span className="rounded-full border px-1.5 py-0.5 text-[9px]">공장 휴무(고객 비공개)</span>선전 A공장 전력 제한 2026-10-20 ~ 2026-10-21</p>
            <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-amber-900"><span className="rounded-full border px-1.5 py-0.5 text-[9px]">중국 공휴일</span>춘절 2027-01-30 ~ 2027-02-19</p>
            <div className="flex justify-end"><Mark n={2} inline><Btn primary>고객에게 안내</Btn></Mark></div>
          </div>
        </Mark>
        <ScheduleFieldsBox marks={{ paid: 3, days: 4, date: 5, manual: 6 }} />
        <Mark n={7}><div className="p-0.5"><p className="mb-1 text-[10px] font-medium">변경 사유</p><Input className="text-muted-foreground">예: 고객 요청 납기 변경</Input></div></Mark>
        <div className="flex justify-end gap-2"><Btn>최신 내용 다시 불러오기</Btn><Btn primary>일정 저장</Btn></div>
        <div className="space-y-2 border-t pt-3">
          <p className="text-[11px] font-semibold">일정·입금 변경 이력 (최근 20건)</p>
          <Mark n={8}>
            <div className="space-y-0.5 rounded-lg border p-2.5 text-[10px]">
              <p className="text-muted-foreground">2026. 10. 5. 오전 10:30:00 · 김PM</p>
              <p className="text-[11px]">예정 납품일: 2026-10-30 → 2026-11-05</p>
              <p>사유: 공장 금형 수정으로 납기 6일 연장</p>
              <p className="text-muted-foreground">메일 발송 완료</p>
            </div>
          </Mark>
        </div>
      </div>
    </Frame>
  );
}
function LockedMock({ lang }) {
  return <Frame lang={lang} title="카드 상세 · 오버뷰"><ScheduleFieldsBox locked marks={{ lockedDate: 1, notice: 2 }} /></Frame>;
}

// ── 15 고객에게 보이는 일정 (한국어 화면)
function ClientMock({ lang }) {
  const steps = [['사양 확정', 'done', '2026-09-03'], ['선금 입금', 'done', '2026-09-16', '은행 휴무로 입금 확인 지연'], ['1차 샘플', 'current', '2026-09-29'], ['샘플 승인', 'next', '2026-10-12'], ['양산 시작', 'next', '2026-10-15'], ['납품', 'next', '2026-11-16']];
  const row = ([label, state, date, reason], i) => {
    const done = state === 'done', current = state === 'current';
    return (
      <div key={i} className="flex gap-2.5">
        <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]', done ? 'bg-primary text-primary-foreground' : current ? 'border-2 border-primary text-primary' : 'border text-muted-foreground')}>{done ? <Check className="h-3 w-3" /> : i + 1}</span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs', current ? 'font-semibold' : done ? 'text-muted-foreground' : '')}>{label}</p>
          <p className="text-[10px] text-muted-foreground">{done ? '완료' : '예정'} {date}</p>
          {reason && <Mark n={3} inline className="mt-1"><p className="text-[10px] text-muted-foreground">사유: {reason}</p></Mark>}
        </div>
      </div>
    );
  };
  return (
    <Frame lang={lang} title="고객 포털 · 프로젝트 상세">
      <div className="rounded-lg border p-3">
        <p className="mb-3 text-xs font-semibold">진행 단계</p>
        <div className="space-y-2.5">
          <Mark n={1}><div className="p-0.5">{row(steps[0], 0)}</div></Mark>
          {row(steps[1], 1)}
          <Mark n={2}><div className="p-0.5">{row(steps[2], 2)}</div></Mark>
          {steps.slice(3).map((s, i) => row(s, i + 3))}
        </div>
      </div>
    </Frame>
  );
}

// 넓게 보여 줄 화면 (설명을 화면 아래에 둔다)
export const WIDE = ['app', 'ops', 'holidays', 'board'];
export const STAFF_MOCKS = {
  app: AppMock, owner: OwnerMock, create: CreateMock, draft: DraftMock, complete: CompleteMock, qc: QcMock, delay: DelayMock, sub: SubMock,
  mywork: MyWorkMock, board: BoardMock, ops: OpsMock, bell: BellMock, holidays: HolidaysMock, schedule: ScheduleMock, locked: LockedMock, client: ClientMock,
};
