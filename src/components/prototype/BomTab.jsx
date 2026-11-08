import React from 'react';
import BomTable from '@/components/prototype/BomTable';
import ConnectionList from '@/components/prototype/ConnectionList';
import Pill from '@/components/prototype/Pill';
import { VERSION_STATUS } from '@/lib/prototype';

// 현재(승인) 설계의 부품표·연결 — 승인 전이면 최신 버전을 보여 준다
export default function BomTab({ project, versions }) {
  const v = versions.find((x) => x.id === project.current_version_id) || versions[0];
  if (!v) return <div className="rounded-xl border border-dashed bg-card p-10 text-center text-body text-muted-foreground">설계 초안을 만들면 부품표가 여기에 나옵니다.</div>;
  const bom = v.bom || [];
  const needs = bom.filter((b) => b.verify_status !== 'VERIFIED').length;
  const qty = bom.reduce((s, b) => s + (Number(b.qty) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[['부품 종류', bom.length], ['총 수량', qty], ['검증 대기', needs]].map(([l, n]) => (
          <div key={l} className="rounded-xl border bg-card p-4"><p className="text-caption text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-bold tabular-nums">{n}</p></div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2"><p className="text-title font-semibold">v{v.version_no} PCB 부품표</p><Pill meta={VERSION_STATUS[v.status]} /></div>
        {v.id !== project.current_version_id && <p className="text-caption text-warning-text">아직 승인된 설계가 없어 최신 초안을 보여 줍니다.</p>}
        <BomTable bom={bom} />
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <p className="text-title font-semibold">연결 관계 · 신호</p>
        <ConnectionList connections={v.connections} />
      </div>
    </div>
  );
}