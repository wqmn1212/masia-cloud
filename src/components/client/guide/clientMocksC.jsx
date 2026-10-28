import React from 'react';
import { Frame, Mark, Btn, Badge } from '@/components/guide/mockKit';

// 고객 포털 1단계 화면(주문 현황판·입고 달력·결제 요청·서류함·메일 설정) 예시. Mark 개수 = clientGuideContent 의 points 개수.
export function DashMock() {
  return (
    <Frame title="고객 대시보드">
      <div className="space-y-2">
        <Mark n={1}><div className="p-1.5 rounded border bg-background"><div className="font-medium">고객님이 확인하실 일 <Badge tone="red">2</Badge></div><div className="text-muted-foreground">중도금 결제 · 블리스터 포장기 · 기한 10/30 · 출고 승인 대기</div></div></Mark>
        <Mark n={2}><div className="grid grid-cols-5 gap-1 p-1 text-center">{['대기', '소싱', '견적', '제작', '완료'].map((k, i) => <div key={k} className="rounded bg-muted py-1"><div className="text-[9px] text-muted-foreground">{k}</div><div className="font-bold">{[0, 1, 1, 5, 1][i]}</div></div>)}</div></Mark>
        <div className="rounded border bg-background p-1.5">
          <div className="flex items-center justify-between"><span className="font-medium">진행 중인 프로젝트 7건</span><Mark n={3} inline><span className="flex gap-1"><Btn primary>목록</Btn><Btn>입고 달력</Btn></span></Mark></div>
          <Mark n={4}><div className="mt-1 grid grid-cols-4 gap-1 border-t pt-1"><span className="font-medium">휴대용 선풍기 OEM</span><span>출고 전 검수 · 10/30 예정</span><span><Badge tone="blue">고객님</Badge> 출고 승인</span><span>11/18 도착 · 30%</span></div></Mark>
          <Mark n={5}><div className="grid grid-cols-4 gap-1 border-t pt-1"><span className="font-medium">드립백 포장재</span><span>1차 샘플</span><span><Badge tone="amber">일정 변경</Badge></span><span className="text-muted-foreground">인쇄 동판 재제작</span></div></Mark>
        </div>
        <Mark n={6}><div className="p-1.5 rounded border bg-background"><div className="text-[10px] text-muted-foreground">담당자 문의</div><div>lee@aegis.example</div></div></Mark>
      </div>
    </Frame>
  );
}

export function CalendarMock() {
  const days = Array.from({ length: 14 }, (_, i) => i + 15);
  return (
    <Frame title="입고 달력">
      <div className="flex items-center gap-2 mb-1"><Mark n={1} inline><span className="flex gap-1"><Btn>‹</Btn><span className="font-semibold px-1">2026년 11월</span><Btn>›</Btn></span></Mark></div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px]">
        {days.map((d) => (
          <div key={d} className={`min-h-[34px] rounded border p-0.5 ${d === 21 ? 'bg-chart-3/10' : 'bg-background'}`}>
            <div className="text-muted-foreground">{d}</div>
            {d === 18 && <Mark n={2}><div className="rounded border border-primary/40 px-0.5 text-primary truncate">🚢 선풍기</div></Mark>}
            {d === 24 && <Mark n={3}><div className="rounded bg-muted px-0.5 truncate">양산</div></Mark>}
            {d === 21 && <Mark n={4}><div className="text-[9px] text-amber-700">휴무</div></Mark>}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function PayMock() {
  return (
    <Frame title="결제">
      <Mark n={1}><div className="p-1.5"><div className="flex justify-between"><span>입금 확인 비율</span><span className="font-semibold">30%</span></div><div className="h-1.5 rounded bg-muted mt-1"><div className="h-1.5 rounded bg-primary w-[30%]" /></div></div></Mark>
      <div className="mt-2 rounded border border-primary/40 p-1.5 space-y-1.5">
        <div className="flex items-center"><span className="font-medium">중도금 40% · USD 4,200</span><span className="ml-auto"><Mark n={2} inline><Badge tone="amber">결제 요청 · D-2</Badge></Mark></span></div>
        <Mark n={3}><div className="rounded bg-primary/5 p-1.5"><div className="font-medium">이지스 USD 계좌</div><div>예금주 AEGIS TRADE · 계좌 1005-123-456789 📋</div></div></Mark>
        <Mark n={4} inline><Btn primary>송금했어요</Btn></Mark>
      </div>
      <div className="mt-1.5"><Mark n={5}><div className="p-1 text-amber-700">계좌가 바뀌었다는 연락은 이 화면에서만 확인하세요.</div></Mark></div>
    </Frame>
  );
}

export function DocsMock() {
  return (
    <Frame title="서류함">
      <div className="flex items-center gap-2 mb-1"><Mark n={1} inline><span className="flex gap-1"><Btn primary>진행 중</Btn><Btn>전체</Btn></span></Mark></div>
      <div className="rounded border bg-background p-1.5 space-y-1">
        <div className="font-medium">테이블 상판 재주문</div>
        <Mark n={2}><div className="flex items-center gap-1"><span>☑</span><span>CI_SZX-ICN.pdf</span><Badge>인보이스 (CI)</Badge></div></Mark>
        <Mark n={3}><div className="flex items-center gap-1"><span>☐</span><span>제품 공급 계약서</span><Badge tone="blue">체결 완료본</Badge></div></Mark>
        <Mark n={4}><div className="rounded border border-dashed p-1 text-muted-foreground">아직 공유되지 않은 선적 서류: B/L · 1차 선적</div></Mark>
      </div>
      <div className="mt-1.5 flex justify-end"><Mark n={5} inline><Btn primary>ZIP으로 내려받기</Btn></Mark></div>
    </Frame>
  );
}

export function NotifMock() {
  return (
    <Frame title="알림">
      <div className="flex items-center justify-between mb-2"><Mark n={1} inline><span>🔔 <Badge tone="red">2</Badge></span></Mark><span className="flex gap-2"><Mark n={2} inline><span className="text-primary">모두 읽음</span></Mark><Mark n={4} inline><span className="text-muted-foreground">⚙ 메일 설정</span></Mark></span></div>
      <Mark n={3}><div className="p-1.5"><div className="font-medium">[결제 요청] 블리스터 포장기 중도금</div><div className="text-muted-foreground">기한 10/30 · 방금</div></div></Mark>
    </Frame>
  );
}
