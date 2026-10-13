import React from 'react';
import { Frame, Mark, Btn, Field, Badge } from '@/components/guide/mockKit';

export function QuoteMock() {
  return (
    <Frame title="견적서">
      <div className="flex items-center gap-2 p-1">
        <div className="flex-1 min-w-0 space-y-1">
          <Mark n={1} inline><span className="font-medium">LED 마스크 견적서</span></Mark>
          <div><Mark n={2} inline><span className="text-muted-foreground">2026-09-08 · USD · LM-200</span></Mark></div>
        </div>
        <Mark n={3} inline><Btn primary>PDF</Btn></Mark>
      </div>
    </Frame>
  );
}

export function ChatMock() {
  return (
    <Frame title="문의">
      <div className="space-y-2">
        <Mark n={1}><div className="p-1.5 rounded bg-muted w-fit max-w-[85%]">리PM: 샘플 사진 올려 드렸습니다.</div></Mark>
        <div className="flex justify-end"><Mark n={2}><div className="p-1.5 rounded bg-primary text-primary-foreground">확인했습니다. 색상 OK입니다.</div></Mark></div>
        <div className="flex items-center gap-2 border-t pt-2">
          <Mark n={3} inline>📎</Mark><Mark n={4} inline><span>KR / CN</span></Mark>
          <div className="flex-1 px-2 py-1 rounded border bg-background text-muted-foreground">메시지 입력</div>
          <Mark n={5} inline><Btn primary>보내기</Btn></Mark>
        </div>
      </div>
    </Frame>
  );
}

export function PayMock() {
  return (
    <Frame title="결제">
      <Mark n={1}><div className="p-1.5"><div className="flex justify-between"><span>입금 확인</span><span className="font-semibold">30%</span></div><div className="h-1.5 rounded bg-muted mt-1"><div className="h-1.5 rounded bg-primary w-[30%]" /></div></div></Mark>
      <div className="mt-2 space-y-1">
        {[['선금 30%', '09-20', '입금 확인', 'green'], ['잔금 70%', '-', '확인 대기', 'amber']].map(([k, d, s, tone], i) => (
          <div key={k} className="flex items-center gap-2 py-1 border-t">
            {i === 0 ? <Mark n={2} inline><span>{k} · {d}</span></Mark> : <span>{k} · {d}</span>}
            <span className="ml-auto">{i === 0 ? <Mark n={3} inline><Badge tone={tone}>{s}</Badge></Mark> : <Badge tone={tone}>{s}</Badge>}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function FilesMock() {
  return (
    <Frame title="파일">
      <Mark n={1}><div className="p-2 border border-dashed rounded text-center text-muted-foreground">파일을 끌어 놓거나 눌러서 올리기</div></Mark>
      <div className="flex items-center gap-2 mt-2 py-1">
        <Mark n={2} inline><span>QC_검수보고서_1002.pdf <Badge>검수 보고서</Badge></span></Mark>
        <Mark n={3} inline><span className="text-muted-foreground">김대리 · 10-02</span></Mark>
        <span className="ml-auto"><Mark n={4} inline><Btn>열기</Btn></Mark></span>
      </div>
    </Frame>
  );
}

export function LibraryMock() {
  return (
    <Frame title="회사별 파일 보관함">
      <Mark n={1}><div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-0.5"><Field label="이름" value="인보이스" /><Field label="프로젝트" value="전체" /><Field label="종류" value="전체" /><Field label="기간" value="최근 3개월" /></div></Mark>
      <div className="flex flex-wrap items-center gap-2 mt-2 py-1">
        <Mark n={2} inline><span>인보이스_0920.pdf · 09-20</span></Mark>
        <Mark n={3} inline><span className="text-primary">LED 마스크 OEM</span></Mark>
        <span className="ml-auto"><Mark n={4} inline><Btn>열기</Btn></Mark></span>
      </div>
      <div className="flex justify-center mt-2"><Mark n={5} inline><span className="flex gap-2"><Btn>이전</Btn><Btn>다음</Btn></span></Mark></div>
    </Frame>
  );
}

export function NotifMock() {
  return (
    <Frame title="알림">
      <div className="flex items-center justify-between mb-2"><Mark n={1} inline><span>🔔 <Badge tone="red">2</Badge></span></Mark><Mark n={2} inline><span className="text-primary">모두 읽음</span></Mark></div>
      <Mark n={3}><div className="p-1.5"><div className="font-medium">견적서가 발행되었습니다</div><div className="text-muted-foreground">LED 마스크 OEM · 방금</div></div></Mark>
    </Frame>
  );
}

export function HolidayMock() {
  return (
    <Frame title="중국 휴무 안내">
      <div className="space-y-2">
        <Mark n={1}><div className="p-1.5 font-medium">춘절 · 2027-02-06 ~ 02-12</div></Mark>
        <Mark n={2}><div className="p-1.5">공장 휴무 예상 02-01 ~ 02-17</div></Mark>
        <Mark n={3}><div className="p-1.5">발주 마감 2027-01-15</div></Mark>
        <Mark n={4}><div className="p-1.5"><Badge tone="amber">LED 마스크 OEM · 휴무 겹침</Badge></div></Mark>
      </div>
    </Frame>
  );
}

export function AccountMock() {
  return (
    <Frame title="AEGIS Cloud">
      <div className="flex flex-wrap items-center gap-3 border-b pb-2">
        <Mark n={1} inline><span>메인페이지</span></Mark>
        <span className="ml-auto"><Mark n={2} inline><span>KR / 中文</span></Mark></span>
        <Mark n={3} inline><span>로그아웃</span></Mark>
      </div>
      <div className="mt-2"><Mark n={4}><div className="p-1.5">담당자 리PM · lee@aegis.example</div></Mark></div>
    </Frame>
  );
}