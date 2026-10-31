import React from 'react';
import { Check, Paperclip, ShieldCheck } from 'lucide-react';
import { Frame, Mark, Btn, Field, Badge } from '@/components/guide/mockKit';

// 새 기능 사용법 예시 화면 (견적 비교표 · 전자서명 · 도착 원가 · AI 비서 · 관리자 할 일 · 공장 확인 · 품질 준비 · 수입·클레임)
const L = (zh, ko, cn) => (zh ? cn : ko);
const Line = ({ children, className = '' }) => <div className={`flex items-center gap-2 py-1.5 border-t ${className}`}>{children}</div>;

export function CompareMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 견적 → 견적 비교표', '卡片 → 报价 → 比价表')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Mark n={1} inline><span className="inline-flex rounded border p-0.5"><span className="px-1.5 py-0.5">{L(zh, '공장 원가', '工厂成本')}</span><span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground">{L(zh, '고객 제안가', '客户报价')}</span><span className="px-1.5 py-0.5">{L(zh, '고객이 보는 화면', '客户看到的页面')}</span></span></Mark>
        <span className="ml-auto" /><Mark n={4} inline><Btn>{L(zh, '공장 질문 복사 (3)', '复制工厂问题 (3)')}</Btn></Mark>
      </div>
      <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-x-2 text-[11px]">
        <span className="text-muted-foreground">{L(zh, '항목', '项目')}</span><b>A안</b><b>B안</b><b>C안</b>
      </div>
      <Mark n={2}><div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-x-2 py-1.5 px-1 bg-primary/5"><span className="text-muted-foreground">{L(zh, '한국 도착 원가', '韩国到岸成本')}</span><span>₩54.2M</span><span>₩56.5M <Badge tone="blue">{L(zh, '가장 낮음', '最低')}</Badge></span><span>₩97.0M</span></div></Mark>
      <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-x-2 py-1.5 border-t"><span className="text-muted-foreground">{L(zh, '라벨링기', '贴标机')}</span><span>₩10.3M</span><span>₩11.3M</span><span className="flex items-center justify-between">₩18.4M <Mark n={3} inline><span>···</span></Mark></span></div>
      <Mark n={5} className="mt-2"><div className="p-1.5 space-y-1"><Field label={L(zh, '추천 의견 (고객에게 보임)', '推荐意见（客户可见）')} value={L(zh, '투입 장치가 포함된 B안을 추천합니다', '推荐包含上料装置的 B 方案')} /><div className="flex justify-end"><Btn primary>{L(zh, '고객에게 공개', '向客户公开')}</Btn></div></div></Mark>
      <Mark n={6} className="mt-2"><div className="flex items-center gap-2 p-1.5"><Badge tone="blue">{L(zh, '고객이 B안을 골랐습니다', '客户选择了 B 方案')}</Badge><span className="ml-auto"><Btn primary>{L(zh, '확정', '确认')}</Btn></span></div></Mark>
    </Frame>
  );
}

export function EsignMock({ zh }) {
  return (
    <Frame title={L(zh, '계약서 관리', '合同管理')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="flex items-center justify-between mb-1"><span className="text-muted-foreground">{L(zh, '계약서 본문 / 특약 사항', '合同正文 / 特别条款')}</span><Mark n={1} inline><span className="text-[11px] text-warning-text font-medium">{L(zh, '전자서명 조항 넣기', '插入电子签名条款')}</span></Mark></div>
      <div className="h-10 rounded border bg-muted/40 mb-2" />
      <div className="flex justify-end gap-2 mb-3"><Btn>{L(zh, '계약서 저장', '保存合同')}</Btn><Mark n={2} inline><Btn primary>{L(zh, '서명 요청', '签名请求')}</Btn></Mark></div>
      <Mark n={3}><div className="grid grid-cols-2 gap-2 p-1.5"><Field label={L(zh, '서명자', '签署人')} value={L(zh, '김담당 · 구매팀장', '金负责人 · 采购经理')} /><Field label={L(zh, '서명 기한', '签名期限')} value={L(zh, '14일', '14 天')} /></div></Mark>
      <div className="mt-3 rounded border p-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2"><b>{L(zh, '전자서명', '电子签名')}</b><Mark n={4} inline><Badge tone="blue">{L(zh, '서명 대기 · 열람함', '待签名 · 已阅读')}</Badge></Mark><span className="text-muted-foreground">SG-2026-0001 · v1</span></div>
        <Mark n={5}><div className="flex gap-2 p-1"><Btn>{L(zh, '다시 알림', '再次提醒')}</Btn><Btn>{L(zh, '기한 +7일', '期限 +7 天')}</Btn><Btn>{L(zh, '회수', '撤回')}</Btn></div></Mark>
        <Mark n={6}><div className="flex items-center gap-1 p-1 text-muted-foreground"><ShieldCheck className="w-3.5 h-3.5 text-primary" />{L(zh, '감사 기록 5건 · 사슬 검사 정상', '审计记录 5 条 · 链校验正常')}</div></Mark>
      </div>
    </Frame>
  );
}

export function LandedMock({ zh }) {
  const rows = [['상품 대금 · 선금 30%', '货款 · 首款 30%', 'USD 3,150', '1,420', '4,473,000'], ['한국 도착 비용 · 1차 선적', '韩国到岸费用 · 第1批', 'KRW 1,800,000', '—', '1,800,000']];
  return (
    <Frame title={L(zh, '카드 → 정산 → 도착 원가 확정', '卡片 → 结算 → 确认到岸成本')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="p-1">
        <div className="grid grid-cols-[1.6fr_1fr_.6fr_1fr] gap-2 text-[10px] text-muted-foreground"><span>{L(zh, '항목 (고객에게 보임)', '项目（客户可见）')}</span><span>{L(zh, '금액', '金额')}</span><span>{L(zh, '환율', '汇率')}</span><span className="text-right">{L(zh, '원화', '韩元')}</span></div>
        {rows.map(([k, c, a, f, w]) => <div key={k} className="grid grid-cols-[1.6fr_1fr_.6fr_1fr] gap-2 py-1 border-t"><span>{L(zh, k, c)}</span><span>{a}</span><span>{f}</span><span className="text-right">{w}</span></div>)}
      </div></Mark>
      <div className="grid grid-cols-[1.6fr_1fr_.6fr_1fr] gap-2 py-1 border-t items-center px-1"><span>{L(zh, '금형비', '模具费')}</span><span>CNY 8,000</span><span>198.3</span><span className="flex justify-end items-center gap-1"><Mark n={3} inline><span className="inline-block w-6 h-3 rounded-full bg-primary" /></Mark></span></div>
      <div className="flex mt-2"><Mark n={2} inline><Btn>+ {L(zh, '줄 추가', '添加行')}</Btn></Mark></div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 rounded bg-muted/50 p-2">
        <div><div className="text-[10px] text-muted-foreground">{L(zh, '도착 원가 합계', '到岸成本合计')}</div><b>16,946,580</b></div>
        <Mark n={4} inline><div className="px-1"><div className="text-[10px] text-muted-foreground">{L(zh, '개당 도착 원가', '单件到岸成本')}</div><b className="text-primary text-sm">33,893원</b></div></Mark>
      </div>
      <div className="flex justify-end mt-2"><Mark n={5} inline><Btn primary>{L(zh, '확정하고 고객에게 공개', '确认并向客户公开')}</Btn></Mark></div>
    </Frame>
  );
}

export function AssistantMock({ zh }) {
  return (
    <Frame title={L(zh, 'AI 업무 비서', 'AI工作助手')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="space-y-2">
        <div className="flex justify-end"><Mark n={1} inline><div className="rounded-xl bg-primary text-primary-foreground px-2.5 py-1.5 max-w-[240px]"><div className="flex items-center gap-1 underline"><Paperclip className="w-3 h-3" />정산서_HBL-2610.pdf</div>{L(zh, '테이블 상판 재주문 도착 비용으로 기록해 줘', '记为桌面板返单的到岸费用')}</div></Mark></div>
        <div className="rounded-xl border bg-card px-2.5 py-2 max-w-[300px] space-y-1.5">
          <Mark n={2}><div className="p-1 text-muted-foreground space-y-0.5"><div className="flex items-center gap-1"><Check className="w-3 h-3 text-primary" />{L(zh, '선적 찾기', '查找发货')}</div><div className="flex items-center gap-1"><Check className="w-3 h-3 text-primary" />{L(zh, '정산서 읽기', '读取结算单')}</div></div></Mark>
          <Mark n={3}><div className="p-1"><b>{L(zh, '정산서 미리보기', '结算单预览')}</b>
            {[['해상 운임', '海运费', '588,000'], ['관세 (8%)', '关税 (8%)', '698,000'], ['수입 부가세', '进口增值税', '1,062,000']].map(([k, c, v]) => <div key={k} className="flex justify-between border-t py-0.5"><span>{L(zh, k, c)}</span><span>{v}</span></div>)}
            <div className="pt-0.5">{L(zh, '부가세 제외 합계', '不含增值税合计')} <b>1,742,000원</b></div>
          </div></Mark>
        </div>
        <div className="flex justify-end"><Mark n={4} inline><div className="rounded-xl bg-primary text-primary-foreground px-2.5 py-1.5">{L(zh, '응, 기록해 줘', '好，记录吧')}</div></Mark></div>
        <Mark n={5}><div className="rounded-xl border bg-card px-2.5 py-1.5 max-w-[300px]"><div className="flex items-center gap-1 text-muted-foreground"><Check className="w-3 h-3 text-primary" />{L(zh, '도착 비용 기록', '记录到岸费用')}</div>{L(zh, '기록했습니다. 다음: ', '已记录。下一步：')}<span className="text-primary underline">{L(zh, '도착 원가 확정', '确认到岸成本')}</span></div></Mark>
      </div>
    </Frame>
  );
}

export function InboxMock({ zh }) {
  return (
    <Frame title={L(zh, '관리자 할 일', '管理员待办')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="grid grid-cols-4 gap-1.5 p-1">
        {[['견적 승인', '报价审批', 2], ['책임자 없음', '无负责人', 1], ['공장 계좌', '工厂账户', 1], ['입금 확인', '确认到账', 2], ['고객 선택', '客户选择', 1], ['전자서명', '电子签名', 2], ['도착 원가', '到岸成本', 2], ['불량 신고', '不良投诉', 1]].map(([k, c, n]) => <div key={k} className="rounded border p-1.5"><div className="text-[10px] text-muted-foreground">{L(zh, k, c)}</div><b>{n}</b></div>)}
      </div></Mark>
      <div className="mt-2 rounded border p-2">
        <b>{L(zh, '공장 지급 계좌 확인', '核实工厂收款账户')}</b>
        <Mark n={2} className="mt-1"><div className="p-1"><div className="flex items-center gap-1">{L(zh, '예시 전자 유한공사', '示例电子有限公司')} <Badge tone="amber">{L(zh, '변경 요청', '变更申请')}</Badge></div><div className="text-warning-text">{L(zh, '변경 사유: 위챗으로 은행 변경을 알림', '变更原因：通过微信通知更换银行')}</div></div></Mark>
      </div>
      <div className="mt-2 rounded border p-2">
        <b>{L(zh, '입금 확인 대기', '待确认到账')}</b>
        <div className="flex items-center gap-2 pt-1"><Mark n={3} className="flex-1"><div className="p-1">{L(zh, '자동 포장기 · 선금 50% · 송금확인증 있음', '自动包装机 · 首款 50% · 有汇款凭证')}</div></Mark><Mark n={4} inline><Btn>{L(zh, '입금 확인 ↗', '确认到账 ↗')}</Btn></Mark></div>
      </div>
    </Frame>
  );
}

export function FactoryMock({ zh }) {
  const items = [['사업자등록증 원본 확인', '营业执照原件核实', true], ['경영 범위에 생산 포함', '经营范围含生产', true], ['실제 제조사 (무역회사 아님)', '实际制造商（非贸易公司）', true], ['공장 현장 방문', '现场考察', false], ['생산 설비·라인 확인', '生产设备·产线核实', false]];
  return (
    <Frame title={L(zh, '공장 관리 → 공장 상세', '工厂管理 → 工厂详情')} badge={L(zh, '예시 화면', '示例画面')}>
      <div className="flex items-center gap-2 mb-1"><b>{L(zh, '공장 확인 카드', '工厂核实卡')}</b><Badge tone="amber">{L(zh, '공장 확인 중', '核实中')}</Badge></div>
      <Mark n={1}><div className="p-1">{items.map(([k, c, ok]) => <div key={k} className="flex items-center gap-1.5 py-0.5"><span className={`inline-flex w-3.5 h-3.5 items-center justify-center rounded-sm border ${ok ? 'bg-primary border-primary text-primary-foreground' : ''}`}>{ok && <Check className="w-2.5 h-2.5" />}</span>{L(zh, k, c)}</div>)}</div></Mark>
      <Mark n={2} className="mt-1"><div className="p-1"><Field label={L(zh, '확인 내용', '核实内容')} value={L(zh, '통일사회신용코드 9144… · 사출기 280톤 6대', '统一社会信用代码 9144… · 280吨注塑机 6台')} /></div></Mark>
      <div className="mt-3 rounded border p-2">
        <b>{L(zh, '지급 계좌', '收款账户')}</b>
        <Mark n={3} className="mt-1"><div className="flex flex-wrap items-center gap-1.5 p-1">LI MING · {L(zh, '공상은행 선전 지점', '工商银行深圳支行')} <Badge tone="red">{L(zh, '확인 전 송금 중지', '核实前暂停付款')}</Badge></div></Mark>
        <div className="flex justify-end gap-2 mt-2"><Btn>{L(zh, '거절', '拒绝')}</Btn><Mark n={4} inline><Btn primary>{L(zh, '확인된 계좌로 지정', '指定为已核实账户')}</Btn></Mark></div>
      </div>
    </Frame>
  );
}

export function QualityMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 업무 · 파일 · BOM', '卡片 → 任务 · 文件 · BOM')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="p-1.5"><b>{L(zh, '사전 QC 점검', 'QC 事前检查')}</b><div className="flex flex-wrap gap-1 my-1"><Badge tone="blue">{L(zh, '종이 박스', '纸盒')}</Badge><Badge tone="blue">{L(zh, '설명서', '说明书')}</Badge><Badge tone="blue">{L(zh, '사출 외관 부품', '注塑外观件')}</Badge></div><div className="rounded bg-warning/10 px-1.5 py-1 text-warning-text">{L(zh, '지금 정할 사양 3 · 사양 입력', '待定规格 3 · 填写规格')}</div></div></Mark>
      <Mark n={2} className="mt-2"><div className="flex items-center gap-2 p-1.5"><b>{L(zh, '품질 기준서 v2', '质量标准书 v2')}</b><span className="text-muted-foreground">AQL 0 / 1.0 / 2.5</span><span className="ml-auto"><Btn primary>{L(zh, '고객에게 승인 요청', '请客户批准')}</Btn></span></div></Mark>
      <Mark n={3} className="mt-2"><div className="flex items-center gap-2 p-1.5"><b>{L(zh, '기준 샘플', '标准样品')}</b><span>GS-2610-01 · {L(zh, '3개', '3 个')}</span><Badge tone="green">{L(zh, '등록됨', '已登记')}</Badge></div></Mark>
      <Line className="mt-2"><Paperclip className="w-3 h-3" /><span className="flex-1">{L(zh, '패키지 인쇄_v3.ai', '包装印刷_v3.ai')}</span><Mark n={4} inline><Badge tone="blue">{L(zh, '공장 전달 승인본', '工厂生产批准版')}</Badge></Mark></Line>
      <Line><span className="flex-1">{L(zh, '금형 대장 · 본체 상판 금형', '模具台账 · 主体上盖模具')}</span><Mark n={5} inline><Badge tone="green">{L(zh, '소유 확인서 있음', '有所有权确认书')}</Badge></Mark></Line>
    </Frame>
  );
}

export function ArriveMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 → 무역서류 · 업무', '卡片 → 贸易文件 · 任务')} badge={L(zh, '예시 화면', '示例画面')}>
      <Mark n={1}><div className="p-1.5"><b>{L(zh, '수입 요건 (인증·신고)', '进口要求（认证·申报）')}</b><div className="flex flex-wrap gap-1 mt-1"><Badge tone="blue">{L(zh, '전기용품 KC 인증', '电器 KC 认证')}</Badge><Badge tone="blue">{L(zh, '원산지 표시', '原产地标识')}</Badge></div></div></Mark>
      <div className="mt-2 rounded border p-2">
        <div className="flex flex-wrap items-center gap-2"><b>{L(zh, '1차 선적', '第1批发货')}</b><span className="text-muted-foreground">B/L HBL-2610 · {L(zh, '도착', '到港')}</span><Mark n={2} inline><Badge tone="blue">{L(zh, '고객 포털에 보이기', '在客户门户显示')}</Badge></Mark></div>
        <Mark n={3} className="mt-1"><div className="flex justify-between p-1"><span>{L(zh, '도착지 비용 (실제)', '目的港费用（实际）')}</span><b>1,742,000원</b></div></Mark>
      </div>
      <div className="mt-2 rounded border p-2">
        <b>{L(zh, '고객 불량 신고', '客户不良投诉')}</b>
        <div className="py-1">{L(zh, '버튼이 눌린 채로 돌아오지 않음 · 120/2000', '按钮按下后无法回弹 · 120/2000')}</div>
        <Mark n={4}><div className="flex gap-1 p-1">{[['접수', '受理'], ['확인 중', '确认中'], ['공장 확인', '工厂确认'], ['처리 완료', '处理完成']].map(([k, c], i) => <span key={k} className={`px-1.5 py-0.5 rounded ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{L(zh, k, c)}</span>)}</div></Mark>
        <div className="flex justify-end mt-1"><Mark n={5} inline><Btn>{L(zh, '중국어 클레임 문서 복사', '复制中文投诉文件')}</Btn></Mark></div>
      </div>
    </Frame>
  );
}
