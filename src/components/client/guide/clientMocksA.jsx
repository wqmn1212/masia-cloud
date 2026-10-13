import React from 'react';
import { Frame, Mark, Btn, Field, Badge } from '@/components/guide/mockKit';

const Card = ({ title, sub, badge }) => <div className="rounded border bg-card p-2"><div className="font-medium">{title}</div>{sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}{badge}</div>;

export function OverviewMock() {
  return (
    <Frame title="AEGIS Cloud">
      <div className="flex flex-col sm:flex-row gap-3">
        <Mark n={1} className="sm:w-36 shrink-0"><div className="rounded bg-sidebar text-sidebar-foreground p-2 space-y-1.5"><div>고객 대시보드</div><div>소싱 보드</div><div>이용 가이드</div></div></Mark>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex justify-end gap-4 border-b pb-2"><Mark n={2} inline>🔔</Mark><Mark n={3} inline><span>KR / 中文</span></Mark></div>
          <Mark n={4}><div className="grid grid-cols-5 gap-1 p-1 text-center">{['1', '2', '1', '3', '4'].map((v, i) => <div key={i} className="rounded bg-muted py-1 font-bold">{v}</div>)}</div></Mark>
          <Mark n={5}><div className="p-1"><Card title="LED 마스크 OEM" sub="발주·제작" /></div></Mark>
          <div className="flex justify-end"><Mark n={6} inline><Btn>담당자 문의</Btn></Mark></div>
        </div>
      </div>
    </Frame>
  );
}

export function LoginMock() {
  return (
    <Frame title="비밀번호 설정">
      <div className="space-y-2 max-w-xs mx-auto">
        <Mark n={1}><Field label="이메일" value="kim@glowlab.kr" /></Mark>
        <Mark n={2}><div className="space-y-1 p-0.5"><Field label="새 비밀번호" value="••••••••" /><Field label="비밀번호 확인" value="••••••••" /></div></Mark>
        <Mark n={3}><div className="text-center p-1"><Btn primary>시작하기</Btn></div></Mark>
        <Mark n={4}><div className="flex justify-between p-1 text-primary"><span>로그인</span><span>비밀번호 재설정</span></div></Mark>
      </div>
    </Frame>
  );
}

export function DashMock() {
  return (
    <Frame title="고객 대시보드">
      <div className="space-y-2">
        <Mark n={1}><div className="grid grid-cols-5 gap-1 p-1 text-center">{['대기', '소싱', '견적', '제작', '완료'].map((k, i) => <div key={k} className="rounded bg-muted py-1"><div className="text-[9px] text-muted-foreground">{k}</div><div className="font-bold">{i + 1}</div></div>)}</div></Mark>
        <Mark n={2}><div className="p-1.5 rounded bg-chart-3/10">국경절 10-01 ~ 10-07 · 발주 마감 09-20</div></Mark>
        <Mark n={3}><div className="p-1"><Card title="LED 마스크 OEM" sub="발주·제작 · 납품 예정 11-10" /></div></Mark>
        <div className="flex justify-start"><Mark n={4} inline><Btn>보드로 보기</Btn></Mark></div>
        <Mark n={5}><div className="p-1.5 rounded border bg-background"><div className="text-[10px] text-muted-foreground">담당자 문의</div><div>리PM · lee@aegis.example</div></div></Mark>
      </div>
    </Frame>
  );
}

export function BoardMock() {
  const cols = ['대기 중', '소싱 중', '견적 검토', '발주·제작', '완료'];
  return (
    <Frame title="소싱 보드">
      <div className="flex justify-end mb-2"><Mark n={1} inline><Btn primary>신규 문의 작성</Btn></Mark></div>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {cols.map((c, i) => (
          <div key={c} className={`rounded bg-muted p-2 space-y-2 ${i !== 3 ? 'hidden sm:block' : ''}`}>
            {i === 3 ? <Mark n={2}><div className="font-semibold p-0.5">{c} <Badge>1</Badge></div></Mark> : <div className="font-semibold">{c}</div>}
            {i === 3 ? <Mark n={3}><Card title="LED 마스크 OEM" sub="글로우랩" /></Mark> : <div className="h-10 rounded border bg-card" />}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function InquiryMock() {
  return (
    <Frame title="신규 문의 작성">
      <div className="grid sm:grid-cols-2 gap-2">
        <Mark n={1}><Field label="제목" value="무선 충전 패드" /></Mark>
        <Mark n={2}><Field label="카테고리" value="전자 · 전기" /></Mark>
        <Mark n={3} className="sm:col-span-2"><div className="grid grid-cols-2 gap-2 p-0.5"><Field label="수량" value="3,000" /><Field label="희망 단가" value="USD 4.5" /></div></Mark>
        <Mark n={4} className="sm:col-span-2"><Field label="요구사항" value="15W, 화이트, 로고 인쇄" /></Mark>
        <Mark n={5}><div className="p-1.5 border border-dashed rounded">📎 도면.pdf</div></Mark>
        <div className="flex items-end justify-end"><Mark n={6} inline><Btn primary>문의 접수</Btn></Mark></div>
      </div>
    </Frame>
  );
}

export function DetailMock() {
  return (
    <Frame title="프로젝트 상세">
      <div className="flex items-center justify-between mb-2"><Mark n={1} inline><span className="font-semibold">LED 마스크 OEM</span></Mark><Mark n={2} inline><Btn>새로고침</Btn></Mark></div>
      <Mark n={3}><div className="flex flex-wrap gap-1 p-1">{['개요', '견적서', '문의', '결제', '파일'].map((k, i) => <Btn key={k} primary={i === 0}>{k}</Btn>)}</div></Mark>
    </Frame>
  );
}

export function StepsMock() {
  return (
    <Frame title="진행 단계">
      <div className="space-y-2">
        <Mark n={1}><div className="flex justify-between p-1.5"><span>✔ 1차 샘플</span><span className="text-muted-foreground">완료 10-20</span></div></Mark>
        <Mark n={2}><div className="flex justify-between p-1.5 font-medium"><span>● 양산 시작</span><span>예정 10-28</span></div></Mark>
        <Mark n={3}><div className="flex justify-between p-1.5"><span>납품 예정일</span><span className="font-semibold">11-10</span></div></Mark>
        <Mark n={4}><div className="p-1.5 text-muted-foreground">사유: 원자재 입고 지연</div></Mark>
      </div>
    </Frame>
  );
}

export function SchedMock() {
  return (
    <Frame title="개요 · 일정과 요구사항">
      <div className="grid sm:grid-cols-2 gap-2">
        <Mark n={1}><Field label="견적 발송 기한" value="2026-09-10" /></Mark>
        <Mark n={2}><div className="grid grid-cols-2 gap-1 p-0.5"><Field label="선금 기준일" value="09-20" /><Field label="소요 근무일" value="40" /></div></Mark>
        <Mark n={3}><Field label="예정 납품일" value="2026-11-10" /></Mark>
        <Mark n={4}><div className="flex flex-wrap gap-1 p-1"><Badge tone="blue">발주·제작</Badge><Badge tone="amber">높음</Badge><Badge>목표 11-15</Badge></div></Mark>
        <Mark n={5} className="sm:col-span-2"><div className="grid grid-cols-2 gap-1 p-0.5"><Field label="KR" value="화이트, 로고 인쇄" /><Field label="CN" value="白色，印刷标志" /></div></Mark>
        <div className="sm:col-span-2 flex justify-end"><Mark n={6} inline><Btn primary>저장</Btn></Mark></div>
      </div>
    </Frame>
  );
}