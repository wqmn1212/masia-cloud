import React, { useEffect, useState } from 'react';
import Pill from '@/components/prototype/Pill';
import AiDraftPanel from '@/components/prototype/AiDraftPanel';
import VersionView from '@/components/prototype/VersionView';
import VersionActions from '@/components/prototype/VersionActions';
import VersionEditDialog from '@/components/prototype/VersionEditDialog';
import { VERSION_STATUS, fmtDate } from '@/lib/prototype';

export default function DesignTab({ project, versions, user, onChanged }) {
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const current = versions.find((v) => v.id === project.current_version_id);
  const selected = versions.find((v) => v.id === selectedId) || versions[0];
  useEffect(() => { if (selectedId && !versions.some((v) => v.id === selectedId)) setSelectedId(null); }, [versions, selectedId]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <AiDraftPanel project={project} baseVersion={selected || current} onCreated={(v) => { setSelectedId(v.id); onChanged(); }} />
        <div className="rounded-xl border bg-card p-2">
          <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">설계 버전</p>
          {versions.length === 0 && <p className="px-2 pb-2 text-caption text-muted-foreground">아직 버전이 없습니다.</p>}
          {versions.map((v) => (
            <button key={v.id} type="button" onClick={() => setSelectedId(v.id)} className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${selected?.id === v.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-body font-semibold">v{v.version_no}{v.id === project.current_version_id ? ' · 현재' : ''}</span>
                <Pill meta={VERSION_STATUS[v.status]} />
              </div>
              <p className="text-micro text-muted-foreground line-clamp-1">{v.change_note || (v.source === 'AI' ? 'AI 초안' : '수동')} · {fmtDate(v.created_date)}</p>
            </button>
          ))}
        </div>
      </aside>

      {selected ? (
        <div className="rounded-xl border bg-card p-5 space-y-5 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><p className="text-title font-semibold">v{selected.version_no} 설계</p><Pill meta={VERSION_STATUS[selected.status]} /></div>
              <p className="text-caption text-muted-foreground">{selected.source === 'AI' ? 'AI 초안' : '수동'} · {selected.created_by_name || '-'} · {fmtDate(selected.updated_date)}{selected.change_note ? ` · ${selected.change_note}` : ''}</p>
              {selected.review_note && <p className="mt-1 text-caption">검토 메모 ({selected.reviewed_by_name}): {selected.review_note}</p>}
            </div>
            <VersionActions project={project} version={selected} versions={versions} user={user} onEdit={() => setEditing(true)} onChanged={onChanged} />
          </div>
          {selected.source === 'AI' && selected.status === 'DRAFT' && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning-text">AI가 만든 검토 전 초안입니다. ‘검증 필요’ 부품은 데이터시트로 확인한 뒤 승인하세요. 실제 작동은 시제품 시험으로만 확인됩니다.</p>
          )}
          <VersionView version={selected} />
          {selected.history?.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-label font-semibold text-muted-foreground">변경 이력</p>
              <ul className="mt-2 space-y-1 text-caption">
                {[...selected.history].reverse().map((h, i) => <li key={i}><span className="text-muted-foreground">{fmtDate(h.at)} · {h.by}</span> — {h.action}{h.note ? `: ${h.note}` : ''}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center text-body text-muted-foreground">요구사항을 채운 뒤 AI 초안을 만들어 보세요.</div>
      )}
      {selected && <VersionEditDialog version={selected} open={editing} onOpenChange={setEditing} user={user} onSaved={() => { setEditing(false); onChanged(); }} />}
    </div>
  );
}