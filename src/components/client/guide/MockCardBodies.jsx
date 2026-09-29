import React from 'react';

const Row = ({ k, v }) => (
  <div className="flex justify-between text-[11px] py-1 border-b border-border"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
);
const FileBadge = ({ ext }) => <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ext}</span>;

export function MockOverviewBody() {
  return (
    <div className="space-y-2">
      <Row k="일정" v="선금 확인 2026-10-02" /><Row k="단계 · 우선순위" v="소싱 중 · 보통" /><Row k="목표일" v="2026-11-14" />
      <div className="rounded-lg border border-border p-2 bg-card">
        <p className="text-[11px] font-medium">요구사항 <span className="text-[10px] text-muted-foreground font-normal">이 항목만 수정할 수 있습니다</span></p>
        <p className="text-[11px] mt-1 p-2 rounded bg-muted/50">시간당 3,000포 이상, 질소 충전 옵션 포함. 한국 전압 220V 대응 필요.</p>
        <div className="flex justify-end mt-2"><span className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground">요구사항 저장</span></div>
      </div>
    </div>
  );
}

export function MockQuotationBody() {
  const rows = [['드립백 포장기 DBM-3000 견적', '2026.10.08 · USD · DBM-3000'], ['질소 충전 유닛 추가 견적', '2026.10.15 · USD']];
  return (
    <div className="space-y-2">
      {rows.map(([t, m]) => (
        <div key={t} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
          <FileBadge ext="PDF" />
          <div className="flex-1 min-w-0"><p className="text-[11px] font-medium truncate">{t}</p><p className="text-[10px] text-muted-foreground">{m}</p></div>
          <span className="text-[10px] px-2 py-0.5 rounded border border-border">↓ PDF</span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">금액은 PDF 견적서에 담겨 있습니다.</p>
    </div>
  );
}

export function MockChatBody() {
  return (
    <div className="space-y-2">
      <div className="max-w-[85%] rounded-lg bg-muted p-2 text-[11px]"><p className="text-[10px] text-muted-foreground">AEGIS 담당자</p>공장 3곳 견적을 받았습니다. 질소 충전 옵션 포함 기준으로 정리해 드릴까요?</div>
      <div className="max-w-[85%] ml-auto rounded-lg bg-primary text-primary-foreground p-2 text-[11px]">네, 포함 기준으로 부탁드립니다.</div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-muted-foreground">📎 <span className="flex-1">메시지를 입력하세요</span>➤</div>
    </div>
  );
}

export function MockSettlementBody() {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center rounded-lg border border-border bg-card p-2 text-[11px]"><b>선금 50%</b><span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent">승인 완료</span></div>
      <div className="flex justify-between items-center rounded-lg border border-border bg-card p-2 text-[11px]"><b>잔금 50%</b><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">대기 중</span></div>
      <p className="text-[10px] text-muted-foreground">입금 확인은 담당자가 처리하며, 승인되면 제작이 시작됩니다.</p>
    </div>
  );
}

export function MockFilesBody() {
  const files = [['PDF', '견적서_드립백포장기.pdf'], ['ZIP', '공장 실사 사진.zip'], ['PDF', 'QC 검수 리포트.pdf']];
  return (
    <div className="space-y-2">
      {files.map(([e, n]) => (
        <div key={n} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-[11px]">
          <FileBadge ext={e} /><span className="flex-1 truncate">{n}</span><span className="text-primary text-[10px]">열기</span>
        </div>
      ))}
    </div>
  );
}