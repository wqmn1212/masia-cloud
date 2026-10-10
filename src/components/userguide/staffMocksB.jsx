import React from 'react';
import { Frame, Mark, Btn, Field, Badge } from '@/components/guide/mockKit';

const L = (zh, ko, cn) => (zh ? cn : ko);

export function MemberMock({ zh }) {
  return (
    <Frame title={L(zh, '일정 탭 · 팀원', '日程页 · 团队成员')}>
      <div className="flex items-center gap-2 py-1.5">
        <span className="flex-1">{L(zh, '샘플 제작', '样品制作')} · 왕QC</span>
        <Mark n={2} inline><span className="text-muted-foreground">10-20</span></Mark>
        <Mark n={1} inline><Btn primary>{L(zh, '완료', '完成')}</Btn></Mark>
      </div>
      <Mark n={3}><Field label={L(zh, '지연 사유', '延误原因')} value={L(zh, '금형 수정', '模具修改')} /></Mark>
      <div className="mt-2"><Mark n={4}><div className="flex items-center gap-2 py-1.5 px-1 opacity-60"><span className="flex-1">{L(zh, '내부 원가 검토', '内部成本审核')} · 김PM</span><span>10-22</span></div></Mark></div>
    </Frame>
  );
}

export function MyWorkMock({ zh }) {
  return (
    <Frame title={L(zh, '내 업무', '我的工作')}>
      <Mark n={1}><div className="p-2 space-y-1">
        <div className="text-[10px] font-semibold text-destructive">{L(zh, '기한 지남 · 지연', '已逾期 · 延误')}</div>
        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">LED 마스크 OEM</span>
          <Mark n={2} inline><Badge tone="red">+4{L(zh, '일', '天')}</Badge></Mark>
          <Mark n={3} inline><span className="text-muted-foreground">{L(zh, '양산', '量产')}</span></Mark>
          <Mark n={4} inline><span>{L(zh, '기한', '期限')} 10-14</span></Mark>
        </div>
      </div></Mark>
      <div className="mt-2 p-2 text-muted-foreground">{L(zh, '그 밖의 진행 카드', '其他进行中卡片')} · 무선 충전 패드</div>
    </Frame>
  );
}

export function BoardMock({ zh }) {
  const cols = [['소싱 중', '采购中'], ['견적 검토', '报价审核'], ['발주·제작', '下单·生产']];
  return (
    <Frame title={L(zh, '소싱 칸반 보드', '采购看板')}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {cols.map(([k, c], i) => (
          <div key={k} className={`rounded bg-muted p-2 space-y-2 ${i !== 2 ? 'hidden sm:block' : ''}`}>
            <div className="font-semibold">{L(zh, k, c)}</div>
            {i === 2 ? (
              <div className="rounded border bg-card p-2 space-y-1.5"><div className="font-medium">LED 마스크 OEM</div>
                <div className="flex flex-wrap gap-2">
                  <Mark n={1} inline><span className="text-muted-foreground">{L(zh, '양산', '量产')}</span></Mark>
                  <Mark n={2} inline><Badge tone="red">+4{L(zh, '일', '天')}</Badge></Mark>
                  <Mark n={3} inline><Badge tone="amber">{L(zh, '지금 지연 중', '当前延误')}</Badge></Mark>
                </div></div>
            ) : <div className="h-12 rounded border bg-card" />}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function OpsMock() {
  const items = [['지연 카드', '3'], ['기한 지난 할 일', '5'], ['책임자 미지정', '2'], ['정시 납품률', '86%']];
  return (
    <Frame title="대시보드 · 운영 지표">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {items.map(([k, v], i) => <Mark key={k} n={i + 1}><div className="p-2"><div className="text-[10px] text-muted-foreground">{k}</div><div className="text-base font-bold">{v}</div></div></Mark>)}
      </div>
      <Mark n={5}><div className="p-2 space-y-1"><div className="font-semibold">지연 상위</div><div>LED 마스크 OEM <Badge tone="red">+4일</Badge></div><div>무선 충전 패드 <Badge tone="red">+2일</Badge></div></div></Mark>
    </Frame>
  );
}

export function AlertMock() {
  return (
    <Frame title="알림">
      <div className="flex justify-end mb-2"><Mark n={1} inline><span>🔔 <Badge tone="red">2</Badge></span></Mark></div>
      <Mark n={2}><div className="p-2"><div className="font-semibold">일정 지연: LED 마스크 OEM</div><div className="text-muted-foreground">양산 단계의 계획일(10-08)이 지났습니다.</div></div></Mark>
    </Frame>
  );
}

export function HolidayMock() {
  return (
    <Frame title="중국 휴무">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="휴일" value="춘절 · 2027-02-06 ~ 02-12" />
        <Mark n={1}><Field label="공장 앞뒤 휴무(일)" value="5" /></Mark>
        <Mark n={2}><Field label="발주 마감일" value="2027-01-15" /></Mark>
        <Mark n={3}><Field label="조휴 근무일" value="2027-01-30, 02-20" /></Mark>
        <Mark n={4}><div className="flex items-center gap-2 p-1"><input type="checkbox" checked readOnly tabIndex={-1} />고객 안내 (30·7일 전)</div></Mark>
        <Mark n={5}><Field label="공장별 휴무" value="선전 A공장 · 11-03 ~ 11-05" /></Mark>
      </div>
    </Frame>
  );
}

export function ScheduleMock() {
  return (
    <Frame title="오버뷰 · 견적·납품 일정 관리">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Mark n={1} inline><Badge tone="amber">국경절과 겹침</Badge></Mark>
        <Mark n={2} inline><Btn>고객에게 안내</Btn></Mark>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Mark n={3}><Field label="선금 기준일" value="2026-09-20" /></Mark>
        <Mark n={4}><Field label="소요 근무일" value="35" /></Mark>
        <Mark n={5}><Field label="예정 납품일" value="2026-11-13" /></Mark>
        <Mark n={6}><div className="flex items-center gap-2 p-1"><input type="checkbox" readOnly tabIndex={-1} />직접 조정</div></Mark>
        <Mark n={7}><Field label="변경 사유" value="공장 설비 점검" /></Mark>
        <Mark n={8}><div className="p-1 text-muted-foreground">변경 이력 · 11-10 → 11-13</div></Mark>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">일정 계획이 있는 카드는 납품일이 잠기고 일정 탭에서 바뀝니다.</div>
    </Frame>
  );
}

export function ClientMock() {
  return (
    <Frame title="고객 화면 · 진행 단계">
      <Mark n={1}><div className="flex justify-between p-1.5"><span>✔ 샘플 제작</span><span className="text-muted-foreground">완료 10-20</span></div></Mark>
      <div className="mt-2"><Mark n={2}><div className="flex justify-between p-1.5 font-medium"><span>● 양산</span><span>예정 11-10</span></div></Mark></div>
      <div className="mt-2"><Mark n={3}><div className="p-1.5 text-muted-foreground">사유: 원자재 입고 지연</div></Mark></div>
    </Frame>
  );
}