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
