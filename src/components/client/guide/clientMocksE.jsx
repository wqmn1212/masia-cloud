import React from 'react';
import { Frame, Mark, Btn, Badge } from '@/components/guide/mockKit';

// 고객 포털 3단계 화면(상품 원가·재주문 예상·불량 신고와 보상) 예시. Mark 개수 = clientGuideContent 의 points 개수.
export function CostsMock() {
  return (
    <Frame title="상품 원가 · 휴대용 선풍기">
      <Mark n={1}><div className="flex items-end justify-between p-1"><div><div className="text-[10px] text-muted-foreground">개당 한국 도착 원가</div><div className="text-base font-bold">1,230원</div></div><span className="text-[10px]">▲ +50원 · 환율 1,304원 → 1,370원</span></div></Mark>
      <Mark n={2} className="mt-1"><div className="flex flex-wrap items-center gap-1 p-1 text-[10px]">검수 2회 · 불량 신고 2건 (불량률 2.5%) <Badge>처리 중 1</Badge><Badge tone="amber">보상 미반영 1</Badge></div></Mark>
      <Mark n={3} className="mt-1"><div className="rounded bg-muted/40 p-1">예상 소진 <b>12/26</b> · 주문 권장 <b className="text-primary">11/12</b> <span className="text-muted-foreground">(재고 6,000 · 월 3,000)</span></div></Mark>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] items-start gap-1.5">
        <Mark n={4} inline><Btn>재주문 · 예상 보기</Btn></Mark>
        <div className="rounded border border-primary/30 bg-primary/5 p-1 text-[10px]">6,000개 · 개당 <b>1,065원 ~ 1,441원</b> · 도착 예상 1/2~1/8 <span className="text-muted-foreground">(견적이 아니라 예상)</span></div>
      </div>
      <Mark n={5} className="mt-1.5"><div className="p-1 text-[10px]">7/21 주문 · 출고 전 검수 조건부 합격 · 불량 신고 포장 찢김 · 공장 회신 대기 5일</div></Mark>
    </Frame>
  );
}

export function ClaimMock() {
  return (
    <Frame title="프로젝트 → 검수 → 불량 신고">
      <Mark n={1}><div className="flex items-center gap-1 p-1"><b className="flex-1">버튼이 눌린 채 돌아오지 않음</b><span className="text-muted-foreground">불량 120 / 3,000개 · 사진 2장</span></div></Mark>
      <Mark n={2} className="mt-1"><div className="flex items-center gap-1 p-1 text-[10px]">{['접수', '확인 중', '공장 확인', '처리 완료'].map((k, i) => <span key={k} className={`rounded-full px-1.5 py-0.5 ${i <= 1 ? 'bg-primary text-primary-foreground' : 'border text-muted-foreground'}`}>{k}</span>)}</div></Mark>
      <Mark n={3} className="mt-1"><div className="p-1 text-[10px] text-amber-700">공장 회신 대기 4일 · 이지스가 공장에 원인과 처리 방안을 요청했습니다 (기한 3영업일)</div></Mark>
      <Mark n={4} className="mt-1"><div className="rounded border border-dashed p-1 text-[10px]"><b>보상 약속</b>: 다음 발주 할인 · KRW 150,000 — <span className="text-amber-700">다음 주문에 반영 예정</span></div></Mark>
    </Frame>
  );
}
