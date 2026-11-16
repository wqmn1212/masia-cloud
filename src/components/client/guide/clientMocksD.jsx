import React from 'react';
import { Frame, Mark, Btn, Badge } from '@/components/guide/mockKit';

// 고객 포털 2단계 화면(디자인 확인·팀과 역할·사내 결재) 예시. Mark 개수 = clientGuideContent 의 points 개수.
const Pin = ({ n, className }) => <span className={`absolute flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ${className}`}>{n}</span>;
const Art = ({ children }) => <div className="relative flex h-20 items-center justify-center rounded bg-destructive/80 text-[11px] font-bold text-white">AEGIS FAN{children}</div>;

export function ReviewMock() {
  return (
    <Frame title="디자인·도면 확인 · 박스_인쇄_v2.png">
      <div className="mb-1.5 flex items-center gap-1.5"><Mark n={1} inline><Btn>이전 판과 나란히</Btn></Mark><span className="text-muted-foreground">기한 11/3</span></div>
      <div className="grid grid-cols-[1fr_1fr_0.9fr] gap-1.5">
        <div><div className="text-[9px] text-muted-foreground">이전 판</div><Art /></div>
        <div><div className="text-[9px] text-muted-foreground">이번 판</div><Mark n={2}><Art><Pin n={1} className="left-[45%] top-[30%]" /></Art></Mark></div>
        <Mark n={3}><div className="space-y-1 p-1"><div className="rounded border px-1 py-0.5">① 로고 2mm 위로</div><div className="rounded border px-1 py-0.5 text-muted-foreground">고칠 내용</div></div></Mark>
      </div>
      <div className="mt-2 flex gap-1.5"><Mark n={4} inline><Btn primary>이 판으로 승인</Btn></Mark><Mark n={5} inline><Btn>수정 요청 (의견 1개)</Btn></Mark></div>
    </Frame>
  );
}

export function TeamMock() {
  const R = ({ on, children }) => <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{children}</span>;
  return (
    <Frame title="팀·결재 → 계정과 역할">
      <div className="mb-1 flex items-center"><b>우리 회사 계정</b><span className="ml-auto"><Mark n={5} inline><span className="text-muted-foreground">자리 4 / 5명</span></Mark></span></div>
      <div className="divide-y rounded border">
        <div className="flex items-center gap-1 p-1"><span className="flex-1">박대표</span><Mark n={1} inline><span className="flex gap-0.5"><R on>고객 관리자</R><R on>결재권자</R></span></Mark></div>
        <div className="flex items-center gap-1 p-1"><span className="flex-1">김담당</span><Mark n={2} inline><span className="flex gap-0.5"><R>결재권자</R><R on>실무자</R><R>재무</R></span></Mark><Mark n={3} inline><span className="text-muted-foreground">사용 중지</span></Mark></div>
      </div>
      <Mark n={4} className="mt-1.5"><div className="flex items-center gap-1 rounded border border-dashed p-1"><span className="flex-1 text-muted-foreground">new@buyer.example</span><R on>실무자</R><Btn primary>초대 메일 보내기</Btn></div></Mark>
    </Frame>
  );
}

export function ApprovalMock() {
  return (
    <Frame title="팀·결재 → 결재 규칙 · 결재함">
      <div className="grid grid-cols-2 gap-1.5">
        <Mark n={1}><div className="space-y-0.5 p-1"><div>⬤━ 출고 승인</div><div>⬤━ 견적 수락</div><div className="text-muted-foreground">━○ 기준서 승인</div></div></Mark>
        <Mark n={2}><div className="p-1">견적 수락 · 금액 기준 <b>10,000,000원</b> 이상만</div></Mark>
      </div>
      <div className="mt-1.5 rounded border p-1">
        <Mark n={3}><div className="flex items-center gap-1 p-0.5"><Badge>출고 승인</Badge><Badge tone="amber">결재 중</Badge><b>휴대용 선풍기</b><span className="ml-auto text-muted-foreground">김담당 요청</span></div></Mark>
        <div className="mt-1 flex gap-1"><Mark n={4} inline><span className="flex gap-1"><Btn primary>승인</Btn><Btn>반려</Btn></span></Mark></div>
      </div>
      <Mark n={5} className="mt-1.5"><div className="rounded border border-primary/40 bg-primary/5 p-1 text-primary">사내 결재 중 · 김담당 요청 — 검수 탭의 출고 승인 자리</div></Mark>
    </Frame>
  );
}

export function DevMock() {
  return (
    <Frame title="프로젝트 상세 → 개발 탭">
      <Mark n={1}><div className="space-y-1 p-1"><div className="flex items-center gap-1.5"><b>ECO-001</b><span className="text-muted-foreground">구배 2° → 3°</span><Badge>승인 필요</Badge></div><div className="flex gap-1.5"><Btn primary>이 변경 승인</Btn><Btn>반려</Btn></div></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="space-y-1 p-1"><div>명판·라벨 문구 v1</div><div className="rounded bg-secondary px-1 py-0.5 font-mono text-[9px]">모델명: RENIGHT-L1 · DC 5 V</div><div className="flex gap-1.5"><Btn primary>이대로 승인</Btn><Btn>수정 요청</Btn></div></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex items-center gap-1.5 p-1"><Btn primary>3D·시뮬레이션 열기</Btn><span className="text-muted-foreground">버튼·조명 눌러 보기</span></div></Mark>
      <Mark n={4} className="mt-1.5"><div className="relative flex h-14 items-center justify-center rounded bg-secondary p-1"><span className="h-10 w-10 rounded-full border-2 border-muted-foreground/40" /><span className="absolute left-[52%] top-[40%] h-2.5 w-2.5 rounded-full bg-warning" /><span className="ml-2"><Btn>위치에 의견 남기기</Btn></span></div></Mark>
    </Frame>
  );
}

export function DesignRoomClientMock() {
  return (
    <Frame title="디자인 실시간 리뷰">
      <Mark n={1}><div className="flex items-center gap-1.5 p-1"><span>박스 인쇄 시안 · 열린 댓글 2</span><Btn primary>열기</Btn></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="relative h-14 rounded bg-destructive/80 p-1"><span className="absolute left-[60%] top-[45%] rounded bg-primary px-1 text-[9px] text-white">▲ 이호민</span></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="flex items-center gap-1.5 p-1"><Btn>댓글 (C)</Btn><span>① 로고 2mm 위로 · 답글 · 해결</span></div></Mark>
    </Frame>
  );
}

export function ClientRequestMock() {
  return (
    <Frame title="요청드린 자료 · 디자인 전달 자료">
      <Mark n={1}><div className="flex flex-wrap items-center gap-1.5 p-1"><span>각도별 이미지 *</span><Btn>파일 고르기</Btn><span className="text-muted-foreground">정면.png</span></div></Mark>
      <Mark n={2} className="mt-1.5"><div className="flex items-center gap-1.5 p-1"><Btn primary>보내기</Btn><Badge>담당자 확인 중</Badge></div></Mark>
      <Mark n={3} className="mt-1.5"><div className="p-1 text-destructive">담당자: 받침대 높이도 적어 주세요</div></Mark>
    </Frame>
  );
}
