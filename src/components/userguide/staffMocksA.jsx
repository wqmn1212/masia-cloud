import React from 'react';
import { Frame, Mark, Btn, Field, Badge } from '@/components/guide/mockKit';

const L = (zh, ko, cn) => (zh ? cn : ko);

export function MenuMock({ zh }) {
  return (
    <Frame title="AEGIS Cloud">
      <div className="flex gap-3">
        <div className="w-36 shrink-0 rounded bg-sidebar text-sidebar-foreground p-2 space-y-2">
          <div className="opacity-60 text-[10px]">{L(zh, '본사 관리', '总部管理')}</div>
          <div>{L(zh, '내 업무', '我的工作')}</div>
          <Mark n={1}><div className="px-1">{L(zh, '이용 가이드', '使用指南')}</div></Mark>
          <Mark n={2}><div className="px-1">{L(zh, '내 업무', '我的工作')}</div></Mark>
          <Mark n={3}><div className="px-1">{L(zh, '중국 휴무', '中国假期')}</div></Mark>
          <Mark n={4}><div className="px-1">{L(zh, '소싱 칸반 보드', '采购看板')}</div></Mark>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex justify-end gap-3 border-b pb-2">
            <Mark n={5} inline>🔔</Mark>
            <Mark n={6} inline><span className="px-1">KR / 中文</span></Mark>
          </div>
          <div className="h-16 rounded bg-muted" /><div className="h-10 rounded bg-muted" />
        </div>
      </div>
    </Frame>
  );
}

export function OwnerMock({ zh }) {
  return (
    <Frame title={L(zh, '카드 상세', '卡片详情')}>
      <div className="font-semibold mb-2">LED 마스크 OEM</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <Mark n={1}><Field label={L(zh, '책임자', '负责人')} value="김PM" /></Mark>
        <Mark n={2}><Field label={L(zh, '다음 할 일', '下一步')} value={L(zh, '샘플 회신 확인', '确认样品反馈')} /></Mark>
        <Mark n={3}><Field label={L(zh, '기한', '期限')} value="2026-10-14" /></Mark>
      </div>
      <div className="flex gap-2 flex-wrap"><Btn>{L(zh, '개요', '概览')}</Btn><Mark n={4} inline><Btn primary>{L(zh, '일정', '日程')}</Btn></Mark><Btn>{L(zh, '업무', '任务')}</Btn></div>
    </Frame>
  );
}

export function CreateMock({ zh }) {
  return (
    <Frame title={L(zh, '일정 탭', '日程页')}>
      <div className="space-y-2">
        <Mark n={1}><Field label={L(zh, '템플릿', '模板')} value={L(zh, '전자 제품 OEM · 11단계', '电子产品 OEM · 11步')} /></Mark>
        <Mark n={2}><Field label={L(zh, '시작일', '开始日期')} value="2026-10-12" /></Mark>
        <div className="flex items-center gap-2"><input type="checkbox" readOnly tabIndex={-1} /> {L(zh, '선택 단계 포함', '包含可选步骤')}</div>
        <Mark n={3} inline><Btn primary>{L(zh, '계획 만들기', '创建计划')}</Btn></Mark>
      </div>
    </Frame>
  );
}

export function ConfirmMock({ zh }) {
  return (
    <Frame title={L(zh, '일정 탭', '日程页')}>
      <div className="flex justify-end gap-2 mb-2"><Mark n={5} inline><Btn>{L(zh, '다시 만들기', '重新创建')}</Btn></Mark><Mark n={1} inline><Btn primary>{L(zh, '계획 확정', '确认计划')}</Btn></Mark></div>
      {[['샘플 제작', '样品制作', '10-20', '왕QC'], ['내부 원가 검토', '内部成本审核', '10-22', '김PM']].map(([k, c, d, o], i) => (
        <div key={k} className="flex items-center gap-2 py-1.5 border-t">
          <span className="flex-1">{L(zh, k, c)} {i === 1 && <Mark n={4} inline>🙈</Mark>}</span>
          {i === 0 ? <Mark n={2} inline><span>{d}</span></Mark> : <span>{d}</span>}
          {i === 0 ? <Mark n={3} inline><span>{o}</span></Mark> : <span>{o}</span>}
        </div>
      ))}
    </Frame>
  );
}

export function CompleteMock({ zh }) {
  return (
    <Frame title={L(zh, '단계 완료', '完成步骤')}>
      <div className="space-y-2">
        <Mark n={1}><Field label={L(zh, '실제 완료일', '实际完成日')} value="2026-10-24" /></Mark>
        <Mark n={2}><div className="flex items-center gap-2 p-1"><input type="checkbox" checked readOnly tabIndex={-1} />{L(zh, '남은 단계를 2일 뒤로 밀기', '剩余步骤顺延2天')}</div></Mark>
        <div className="flex justify-end"><Mark n={3} inline><Btn primary>{L(zh, '완료 처리', '完成')}</Btn></Mark></div>
      </div>
    </Frame>
  );
}

export function QcMock({ zh }) {
  return (
    <Frame title={L(zh, '단계 완료 · 출고 전 검수', '完成步骤 · 出货前检验')}>
      <div className="space-y-2">
        <Mark n={1}><Field label={L(zh, 'QC 보고서 연결', '关联QC报告')} value="QC-1012 · 합격" /></Mark>
        <Mark n={2}><div className="px-2 py-1 rounded border opacity-50">QC-1008 · <Badge tone="red">불합격</Badge></div></Mark>
      </div>
    </Frame>
  );
}

export function DelayMock({ zh }) {
  return (
    <Frame title={L(zh, '일정 탭', '日程页')}>
      <div className="mb-2"><Mark n={1} inline><Badge tone="red">{L(zh, '납품 +4일', '交货 +4天')}</Badge></Mark></div>
      <div className="flex items-center gap-2 py-1.5 border-t">
        <span className="flex-1">{L(zh, '양산', '量产')}</span>
        <Mark n={2} inline><Badge tone="red">+4{L(zh, '일', '天')}</Badge></Mark>
        <Mark n={3} inline><Badge tone="amber">{L(zh, '기한 지남', '已逾期')}</Badge></Mark>
      </div>
      <div className="space-y-2 mt-2">
        <Mark n={4}><Field label={L(zh, '지연 사유', '延误原因')} value={L(zh, '원자재 입고 지연', '原材料到货延误')} /></Mark>
        <Mark n={5}><div className="flex items-center gap-2 p-1"><input type="checkbox" checked readOnly tabIndex={-1} />{L(zh, '고객 공개', '对客户公开')}</div></Mark>
      </div>
    </Frame>
  );
}