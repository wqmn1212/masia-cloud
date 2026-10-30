import React from 'react';
import { Frame, Mark, Btn, Field, Badge } from '@/components/guide/mockKit';

// 고객 포털 1단계 직원 쪽 예시 화면 (결제 요청·받는 계좌 · 고객 포털 새 화면). Mark 개수 = userGuideContent 의 points 개수.
const L = (zh, ko, cn) => (zh ? cn : ko);

export function PayRequestMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 정산 → 결제 요청·입금 확인', '卡片 → 结算 → 付款请求·确认到账')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="flex flex-wrap items-center gap-2 rounded bg-muted/40 p-1.5">
        <span>{L(zh, '잔금 · 70% · USD 7,350', '尾款 · 70% · USD 7,350')}</span>
        <span className="ml-auto flex gap-1"><Mark n={1} inline><Btn>{L(zh, '결제 요청', '付款请求')}</Btn></Mark><Btn>{L(zh, '입금 확인', '确认到账')}</Btn></span>
      </div>
      <div className="mt-2 rounded border p-2 space-y-1.5">
        <b>{L(zh, '잔금 결제 요청', '尾款付款请求')}</b>
        <Mark n={2}><div className="grid grid-cols-2 gap-1 p-0.5"><Field label={L(zh, '청구 금액', '请求金额')} value="USD 7,350" /><Field label={L(zh, '결제 기한', '付款期限')} value="2026-11-04" /></div></Mark>
        <Mark n={3}><div className="p-1">{L(zh, '받는 곳: ◉ 이지스 계좌 (이지스 USD 계좌) ○ 확인된 공장 계좌', '收款方：◉ AEGIS 账户（AEGIS USD 账户）○ 已核实工厂账户')}</div></Mark>
        <div className="flex justify-end"><Mark n={4} inline><Btn primary>{L(zh, '결제 요청 보내기', '发送付款请求')}</Btn></Mark></div>
      </div>
      <Mark n={5} className="mt-2"><div className="p-1 text-primary">{L(zh, '고객 송금 알림 · 송금일 10/27 (김담당) — 통장 확인 뒤 입금 확인', '客户告知汇款 · 汇款日 10/27（金担当）— 核对银行后确认到账')}</div></Mark>
    </Frame>
  );
}

export function PayeeMock({ zh }) {
  return (
    <Frame title={L(zh, '관리자 할 일 → 이지스 받는 계좌', '管理员待办 → AEGIS 收款账户')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="flex items-center"><b>{L(zh, '이지스 받는 계좌', 'AEGIS 收款账户')}</b><span className="ml-auto"><Mark n={1} inline><Btn>{L(zh, '+ 계좌 등록', '+ 登记账户')}</Btn></Mark></span></div>
      <Mark n={2} className="mt-1"><div className="p-1">{L(zh, '이지스 USD 계좌', 'AEGIS USD 账户')} <Badge>USD</Badge> · {L(zh, '예시은행 · 1005-123-456789', '示例银行 · 1005-123-456789')}</div></Mark>
      <Mark n={3} className="mt-1"><div className="p-1">{L(zh, '이지스 원화 계좌', 'AEGIS 韩元账户')} <Badge>KRW</Badge> <Badge>{L(zh, '쓰지 않음', '停用')}</Badge></div></Mark>
      <div className="mt-2 rounded border p-1.5"><b>{L(zh, '결제 기한 지남', '付款逾期')}</b><Mark n={4}><div className="p-1">{L(zh, '테이블 상판 · 중도금 40%', '桌面板 · 中期款 40%')} <Badge tone="amber">{L(zh, '3일 지남', '逾期 3 天')}</Badge></div></Mark></div>
    </Frame>
  );
}

export function PortalMock({ zh }) {
  return (
    <Frame title={L(zh, '고객이 보는 화면', '客户看到的画面')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="grid grid-cols-4 gap-1 rounded border p-1"><span className="font-medium">{L(zh, '휴대용 선풍기', '便携风扇')}</span><span>{L(zh, '출고 전 검수', '出货前检验')}</span><span><Badge tone="blue">{L(zh, '고객님', '贵司')}</Badge></span><span>11/18 · 30%</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="rounded border p-1">{L(zh, '서류함: CI · PL · 계약서 · ZIP으로 내려받기', '文件柜：CI · PL · 合同 · ZIP 下载')}</div></Mark>
      <Mark n={3} className="mt-1.5"><div className="rounded border p-1">{L(zh, '담당 PM 이호민 · 답변 평일 10:00~18:00', '负责 PM 李浩民 · 回复 工作日 10:00~18:00')}</div></Mark>
      <div className="mt-1.5 rounded border p-1.5"><b>{L(zh, '고객사 관리 → 고객 포털에 담당 PM 보여 주기', '客户管理 → 在客户门户显示负责 PM')}</b><Mark n={4}><div className="p-1">{L(zh, '담당 PM 이름 표시  ⬤━', '显示负责 PM 姓名  ⬤━')}</div></Mark></div>
    </Frame>
  );
}

// 고객 포털 2단계 직원 쪽 예시 화면 (고객 계정·역할·결재, 디자인 고객 확인, 견적 수락)
export function ClientTeamMock({ zh }) {
  const R = ({ on, children }) => <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{children}</span>;
  return (
    <Frame title={L(zh, '고객사 관리 → 고객 계정·역할·결재 규칙', '客户管理 → 客户账号·角色·审批规则')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="divide-y rounded border">
        <div className="flex items-center gap-1 p-1"><span className="flex-1">{L(zh, '박대표', '朴代表')}</span><Mark n={1} inline><span className="flex gap-0.5"><R on>{L(zh, '고객 관리자', '客户管理员')}</R><R on>{L(zh, '결재권자', '审批人')}</R></span></Mark></div>
        <div className="flex items-center gap-1 p-1"><span className="flex-1">{L(zh, '김담당', '金担当')}</span><Mark n={2} inline><span className="flex gap-0.5"><R on>{L(zh, '실무자', '经办人')}</R><R>{L(zh, '재무', '财务')}</R></span></Mark></div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Mark n={3}><div className="p-1">{L(zh, '동료 초대 · 자리 3 / 5명', '邀请同事 · 名额 3 / 5')}</div></Mark>
        <Mark n={4}><div className="p-1">{L(zh, '⬤━ 출고 승인 · ⬤━ 견적 수락 (1,000만원 이상)', '⬤━ 出货批准 · ⬤━ 报价接受（1000万韩元以上）')}</div></Mark>
      </div>
      <Mark n={5} className="mt-1.5"><div className="rounded bg-primary/5 p-1 text-primary">{L(zh, '카드 머리: 고객사 결재 중 · 출고 승인 · 김담당 요청', '卡片顶部：客户审批中 · 出货批准 · 金担当申请')}</div></Mark>
    </Frame>
  );
}

export function FileReviewStaffMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 파일 → 고객 확인 요청', '卡片 → 文件 → 客户确认请求')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="flex items-center gap-1.5 rounded bg-muted/40 p-1"><span className="flex-1">박스_인쇄_v2.png</span><Mark n={1} inline><Btn>{L(zh, '고객 확인 요청', '客户确认请求')}</Btn></Mark></div>
      <Mark n={2} className="mt-1.5"><div className="grid grid-cols-3 gap-1 p-0.5"><Field label={L(zh, '확인받을 내용', '确认内容')} value={L(zh, '로고 위치·색상', '标志位置·颜色')} /><Field label={L(zh, '기한', '期限')} value="11/03" /><Field label={L(zh, '이전 판', '上一版')} value="v1" /></div></Mark>
      <div className="mt-1.5 flex flex-wrap items-center gap-1"><Mark n={3} inline><span className="flex gap-1"><Badge tone="amber">{L(zh, '고객 확인 중', '客户确认中')}</Badge><Badge tone="red">{L(zh, '수정 요청', '要求修改')}</Badge><Badge tone="blue">{L(zh, '고객 승인 10/27', '客户已批准 10/27')}</Badge></span></Mark></div>
      <Mark n={4} className="mt-1.5"><div className="p-1">{L(zh, '[디자인 수정 요청] 1. 로고 2mm 위로 · 2. 하단 문구 크게', '[设计修改要求] 1. 标志上移2mm · 2. 底部文字放大')}</div></Mark>
      <Mark n={5} className="mt-1.5"><div className="p-1 text-destructive">{L(zh, '승인본 지정: 고객이 아직 확인 중인 파일입니다', '指定定稿：客户仍在确认该文件')}</div></Mark>
    </Frame>
  );
}

export function QuoteAcceptMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 견적', '卡片 → 报价')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="rounded border p-1.5">
        <Mark n={1}><div className="rounded bg-primary/10 p-1"><b className="text-primary">{L(zh, '고객이 이 견적으로 진행 요청', '客户请求按此报价推进')}</b> · {L(zh, '김담당 · 10/28 · 11월 첫 주 발주 예정', '金担当 · 10/28 · 预计11月第一周下单')}</div></Mark>
        <div className="mt-1.5 flex justify-end gap-1"><Mark n={2} inline><Btn>{L(zh, '수주 완료로 바꾸기', '改为已成交')}</Btn></Mark><Mark n={3} inline><Btn primary>{L(zh, '계약서 만들기', '生成合同')}</Btn></Mark></div>
      </div>
    </Frame>
  );
}

// 고객 포털 3단계 직원 쪽 예시 화면 (문의 양식·소싱 진행률, 재주문 예상·주문 시점, 불량 보상·공장 회신 기한)
export function InquiryFormStaffMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 오버뷰 (고객 문의로 만든 카드)', '卡片 → 概览（由客户咨询生成）')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="whitespace-pre-line p-1 text-[10px]">{L(zh, '카테고리: 전자 · 전기 / 수량: 3,000\n[사양] 충전 단자: USB-C · 정격 전압·전력: (미입력)', '카테고리: 전자 · 전기 / 수량: 3,000\n[사양] 충전 단자: USB-C · 정격 전압·전력: (미입력)')}</div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1">{L(zh, '납기 2027-01-10 · 수입 요건', '交期 2027-01-10 · 进口要求')} <Badge tone="amber">{L(zh, '전기용품 KC 인증 · 필요', '电器 KC 认证 · 需要')}</Badge></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1 text-[10px]">{[L(zh, '요구사항 확인', '确认需求'), L(zh, '공장 후보 3곳', '候选工厂3家'), L(zh, '견적 2건 받음', '已收报价2份'), L(zh, '비교표 준비', '准备比价表')].map((k, i) => <span key={k} className={`rounded-full px-1.5 py-0.5 ${i <= 2 ? 'bg-primary text-primary-foreground' : 'border text-muted-foreground'}`}>{k}</span>)}</div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex items-center justify-between gap-2 p-1"><span>{L(zh, '견적 발송 기한을 고객 소싱 진행률에 보여 주기', '在客户寻源进度中显示报价截止日')}</span><span className="h-3.5 w-7 rounded-full bg-primary" /></div></Mark>
    </Frame>
  );
}

export function ReorderStaffMock({ zh }) {
  return (
    <Frame title={L(zh, '고객 포털 → 상품 원가 (고객 화면)', '客户门户 → 产品成本（客户画面）')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="p-1">{L(zh, '6,000개 · 개당 1,065원 ~ 1,441원 · 합계 639만 ~ 865만원', '6,000个 · 单价 1,065 ~ 1,441 韩元 · 合计 639万 ~ 865万韩元')} <span className="text-muted-foreground">{L(zh, '(환율 1,304원 → 1,370원)', '（汇率 1,304 → 1,370 韩元）')}</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="p-1">{L(zh, '도착 예상 1/2 ~ 1/8 · 춘절 공장 휴무 7일 반영', '预计到货 1/2 ~ 1/8 · 已计入春节工厂停工7天')}</div></Mark>
      <Mark n={3} className="mt-1.5"><div className="rounded bg-muted/40 p-1">{L(zh, '재고 6,000 · 월 3,000 → 예상 소진 12/26 · 주문 권장 11/12 · 알림 10/29', '库存 6,000 · 月用量 3,000 → 预计用完 12/26 · 建议下单 11/12 · 提醒 10/29')}</div></Mark>
      <div className="mt-1.5 flex justify-end"><Mark n={4} inline><Btn primary>{L(zh, '재주문 요청', '返单请求')}</Btn></Mark></div>
    </Frame>
  );
}

export function ClaimTrackStaffMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 업무 → 불량 신고', '卡片 → 任务 → 不良投诉')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="p-1 text-[10px] text-muted-foreground">{L(zh, '공장에 보냄 10/24 · 회신 대기 2영업일', '已发工厂 10/24 · 等待回复 2 个工作日')}</div></Mark>
      <Mark n={2} className="mt-1.5"><div className="grid grid-cols-[1fr_auto] items-end gap-1 p-0.5"><Field label={L(zh, '공장 회신 (내부용)', '工厂回复（内部）')} value={L(zh, '스프링 불량 · 재생산 동의', '弹簧不良 · 同意重新生产')} /><Btn>{L(zh, '저장', '保存')}</Btn></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="p-1 text-[10px] text-amber-700">{L(zh, '관리자 할 일: 공장 회신 기한(3영업일)이 지났습니다. 공장에 독촉하고 회신을 기록하세요.', '管理员待办：已超过工厂回复期限（3 个工作日），请催促工厂并记录回复。')}</div></Mark>
      <Mark n={4} className="mt-1.5"><div className="flex flex-wrap items-center gap-1 p-1"><b>{L(zh, '보상 약속', '补偿承诺')}</b> KRW 150,000 · {L(zh, '반영할 다음 주문', '兑现的下一订单')}: <span className="rounded border px-1">{L(zh, '휴대용 선풍기 2차', '便携风扇 第2批')}</span> <Badge tone="blue">{L(zh, '반영됨', '已兑现')}</Badge></div></Mark>
    </Frame>
  );
}
