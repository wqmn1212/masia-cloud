import React from 'react';
import { Frame, Mark, Btn, Field, Badge } from '@/components/guide/mockKit';

// 견적 자동화 직원 쪽 예시 화면 (문의 배정 · 공장 견적 요청 · 견적서 읽기 · 마진 규칙 · 승인과 발송 · 아침 요약).
// Mark 개수 = userGuideContent 의 points 개수.
const L = (zh, ko, cn) => (zh ? cn : ko);

export function IntakeMock({ zh }) {
  return (
    <Frame title={L(zh, '알림 · 문의 접수 → 새 문의 배정 규칙 · 관리자 할 일', '通知 · 咨询受理 → 新咨询分配规则 · 管理员待办')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="p-1.5"><div className="font-semibold">{L(zh, '[새 문의 배정] [고객문의] 보조배터리 OEM', '[新咨询分配] [客户咨询] 充电宝 OEM')}</div><div className="text-muted-foreground">{L(zh, '예시상사 고객사 규칙에 따라 책임자로 배정됐습니다.', '根据示例商社客户规则被指定为负责人。')}</div></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="p-1">{L(zh, '견적 기한 11/3 (희망 입고일까지 18일 · 급한 문의)', '报价截止 11/3（距期望到货 18 天 · 紧急咨询）')} <Badge tone="red">{L(zh, '높음', '高')}</Badge></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="grid grid-cols-3 gap-1 p-1"><Field label={L(zh, '팀 기본 담당자', '团队默认负责人')} value={L(zh, '왕리', '王丽')} /><Field label={L(zh, '견적 기한 (영업일)', '报价期限（工作日）')} value="3" /><Field label={L(zh, '급한 문의 (일)', '紧急咨询（天）')} value="30" /></div></Mark>
      <div className="mt-1.5 rounded border p-1.5"><b>{L(zh, '책임자 없는 진행 카드', '无负责人的进行中卡片')}</b>
        <Mark n={4}><div className="flex items-center gap-1 p-1"><span className="flex-1">{L(zh, '테이블 원형 상판 · 추천: 장위 (리빙·공구 카테고리 규칙)', '圆形桌面板 · 推荐：张伟（生活·工具品类规则）')}</span><Btn primary>{L(zh, '규칙대로 배정', '按规则分配')}</Btn></div></Mark>
      </div>
    </Frame>
  );
}

export function FactoryQuoteMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 업무 → 공장 업로드 링크', '卡片 → 任务 → 工厂上传链接')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="space-y-1 p-1"><Field label={L(zh, '공장 이름', '工厂名称')} value={L(zh, '운용(云涌)', '运涌')} /><div className="flex flex-wrap gap-1"><Badge tone="blue">{L(zh, '공장 견적서', '报价单')}</Badge><Badge>{L(zh, '생산 진행 사진', '生产进度照片')}</Badge><Btn>{L(zh, '견적 요청 문구 넣기', '填入询价说明')}</Btn></div></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="rounded bg-muted/40 p-1">{L(zh, '공장 휴대폰: 报价单 · 엑셀·워드·PDF·사진 · 메모', '工厂手机：报价单 · Excel·Word·PDF·照片 · 备注')}</div></Mark>
      <Mark n={3} className="mt-1.5"><div className="space-y-0.5 p-1">
        <div>ZP-5B报价单.xlsx <Badge tone="blue">{L(zh, '견적 초안 만듦 · 견적 탭에서 보기', '已生成报价草稿')}</Badge></div>
        <div>报价单.docx <span className="text-muted-foreground">{L(zh, '견적서 읽는 중', '正在读取报价单')}</span></div>
        <div>IMG_2231.jpg <Badge tone="amber">{L(zh, '읽지 못함', '读取失败')}</Badge> <Btn>{L(zh, '다시 읽기', '重新读取')}</Btn></div>
      </div></Mark>
      <Mark n={4} className="mt-1.5"><div className="p-1">{L(zh, '견적 탭: 회전식 타정기 ZP-5B', '报价页：旋转式压片机 ZP-5B')} <Badge tone="blue">{L(zh, '공장 업로드', '工厂上传')}</Badge> <span className="text-muted-foreground">{L(zh, '초안 · 공장 원가 그대로', '草稿 · 工厂成本原样')}</span></div></Mark>
    </Frame>
  );
}

export function QuoteImportMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 견적 → 견적 추가 → 견적서 파일 올리기', '卡片 → 报价 → 添加报价 → 上传报价文件')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="p-1"><Btn>{L(zh, '견적서 파일 (엑셀·워드·PDF·사진)', '报价文件（Excel·Word·PDF·照片）')}</Btn> <span className="text-muted-foreground">ZP-5B 최종견적서.xlsx</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="rounded bg-primary/5 p-1">{L(zh, '✓ 포함 항목 합 17,000 CNY · 견적서 합계 17,000 CNY · 선택 사양 2개 (합계 미포함 2,700)', '✓ 含入项目合计 17,000 CNY · 报价单合计 17,000 CNY · 选配 2 项（不含 2,700）')}</div></Mark>
      <Mark n={3} className="mt-1.5"><div className="grid grid-cols-2 gap-1 p-1"><span>{L(zh, '본체 1대 16,000 · 금형 5세트 200', '主机 1台 16,000 · 模具 5套 200')}</span><span>{L(zh, '플라즈마 도금', '等离子电镀')} <Badge>{L(zh, '선택 사양', '选配')}</Badge></span><span>{L(zh, '납기 선금 후 20영업일 · 유효 30일', '交期 预付后 20 工作日 · 有效 30 天')}</span><span>{L(zh, '결제 계약 시 확정 · 주요 사양 6개', '付款 签约时确定 · 主要规格 6 项')}</span></div></Mark>
      <div className="mt-1.5 flex justify-end"><Mark n={4} inline><Btn primary>{L(zh, '견적에 채우기', '填入报价')}</Btn></Mark></div>
    </Frame>
  );
}

export function MarginRuleMock({ zh }) {
  return (
    <Frame title={L(zh, '견적 관리 → 견적 마진 규칙 · 견적 작성', '报价管理 → 报价利润规则 · 编写报价')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="grid grid-cols-2 gap-1 p-1"><Field label={L(zh, '팀 기준 마진 (%)', '团队基准利润 (%)')} value="15" /><Field label={L(zh, '팀 최소 마진 (%)', '团队最低利润 (%)')} value="10" /></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="space-y-0.5 p-1"><div>{L(zh, '고객사 · 예시상사 · 기준 20% · 최소 15% · 연간 계약 고객', '客户 · 示例商社 · 基准 20% · 最低 15% · 年度合同客户')}</div><div>{L(zh, '카테고리 · 굿즈·조형 · 기준 30% · 최소 25%', '品类 · 周边·造型 · 基准 30% · 最低 25%')}</div></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex items-center gap-1 p-1"><span className="flex-1">{L(zh, '기준 마진 20% (예시상사 고객사 규칙) · 최소 15%', '基准利润 20%（示例商社客户规则）· 最低 15%')}</span><Btn>{L(zh, '빈 마진에 기준 채우기', '空白利润填入基准')}</Btn></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="p-1 text-warning-text">{L(zh, '⚠ 마진이 13%로 기준(예시상사 고객사 규칙 15%)보다 낮습니다', '⚠ 利润 13%，低于基准（示例商社客户规则 15%）')}</div></Mark>
    </Frame>
  );
}

export function ApprovalMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 견적 · 관리자 할 일 → 견적 승인 · 고객 발송', '卡片 → 报价 · 管理员待办 → 报价审批 · 客户发送')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="flex items-center gap-1 p-1"><span className="flex-1">{L(zh, 'ZP-5B 타정기 · 초안', 'ZP-5B 压片机 · 草稿')}</span><Btn>{L(zh, '검토 요청', '申请审核')}</Btn></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="p-1"><div className="font-medium">{L(zh, '타정기 5구 · ZP-5B', '5冲压片机 · ZP-5B')} <Badge tone="amber">{L(zh, '승인 요청 1일 전', '1天前申请审批')}</Badge></div><div className="text-muted-foreground">{L(zh, '고객 금액 $3,050 · 원가 $2,394 · 마진 21.5% · 납기 20영업일 · 유효 30일', '客户金额 $3,050 · 成本 $2,394 · 利润 21.5% · 交期 20 工作日 · 有效 30 天')}</div></div></Mark>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Mark n={3}><div className="p-1"><div className="text-destructive">{L(zh, '⊘ 카드가 고객에게 공개되지 않았습니다', '⊘ 卡片尚未对客户公开')}</div><div className="flex justify-end pt-0.5"><Btn primary>{L(zh, '승인하고 보내기', '批准并发送')}</Btn></div></div></Mark>
        <Mark n={4}><div className="p-1"><div>{L(zh, '반려 사유: 금형 단가 공장에 다시 확인', '退回原因：请向工厂重新确认模具单价')}</div><div className="flex justify-end pt-0.5"><Btn>{L(zh, '반려', '退回')}</Btn></div></div></Mark>
      </div>
      <Mark n={5} className="mt-1.5"><div className="p-1">{L(zh, 'ZP-3 소형 타정기 · 고객에게 보냄 10/21 · 승인 이호민', 'ZP-3 小型压片机 · 已发给客户 10/21 · 审批 李浩民')} <Btn>{L(zh, '공개 해제', '取消公开')}</Btn></div></Mark>
    </Frame>
  );
}

export function QuoteDigestMock({ zh }) {
  return (
    <Frame title={L(zh, '내 업무 → 오늘 요약 (아침 메일 08:30)', '我的工作 → 今日摘要（早间邮件 08:30）')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="p-1"><b className="text-primary">{L(zh, '오늘 마감', '今日截止')}</b> · {L(zh, '타정기 5구 · 견적 기한 (고객에게 보낸 견적 없음)', '5冲压片机 · 报价截止（尚未发给客户）')}</div></Mark>
      <Mark n={2} className="mt-1"><div className="p-1"><b className="text-warning-text">{L(zh, '공장 대기', '等待工厂')}</b> · {L(zh, '운용 견적서 4일째 미회신', '运涌 报价单 4 天未回复')}</div></Mark>
      <Mark n={3} className="mt-1"><div className="p-1"><b>{L(zh, '확인할 것', '待确认')}</b> · {L(zh, '공장 견적 초안 (마진 확인 후 검토 요청) · 견적 반려됨: 마진 15% 이상', '工厂报价草稿（确认利润后申请审核）· 报价被退回：利润 15% 以上')}</div></Mark>
      <Mark n={4} className="mt-1"><div className="p-1"><b>{L(zh, '확인할 것 (팀 관리자)', '待确认（团队管理员）')}</b> · {L(zh, '견적 승인 대기 2일째 · 포장기 견적 (요청 왕리)', '报价待审批第 2 天 · 包装机报价（申请 王丽）')}</div></Mark>
      <Mark n={5} className="mt-1"><div className="p-1"><b className="text-warning-text">{L(zh, '고객 대기 · 지연 위험', '等待客户 · 延误风险')}</b> · {L(zh, '견적 회신 6일째 · 견적 유효기간 11/3 만료 (1일 남음)', '报价回复第 6 天 · 报价有效期 11/3 到期（剩 1 天）')}</div></Mark>
    </Frame>
  );
}
