import React, { useState } from 'react';
import { Plus, Pencil, RotateCw, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import Pill from '@/components/prototype/Pill';
import TestDialog from '@/components/prototype/TestDialog';
import TestAnalysis from '@/components/prototype/TestAnalysis';
import { TEST_STATUS, fmtDate } from '@/lib/prototype';
import { openProtoFile, syncProtoRisk } from '@/lib/prototypeApi';

export default function TestsTab({ project, versions, tests, user, onChanged }) {
  const [dialog, setDialog] = useState(null); // { test?, retestOf? }
  const current = versions.find((v) => v.id === project.current_version_id) || versions[0];
  const versionOf = (t) => versions.find((v) => v.id === t.version_id);

  const saved = async (status) => {
    setDialog(null);
    const next = status === 'FAIL' || status === 'PARTIAL' ? 'IMPROVE' : project.stage === 'BUILD' ? 'TEST' : null;
    if (next && next !== project.stage) await base44.entities.ProtoProject.update(project.id, { stage: next });
    await syncProtoRisk(project.id); // 불합격 시험 수가 바뀌면 목록의 위험 수도 맞춘다
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-title font-semibold">시험 · 개선</p>
          <p className="text-caption text-muted-foreground">새 시험은 {current ? `v${current.version_no}` : '설계 버전 없이'} 기준으로 만듭니다.</p>
        </div>
        <Button onClick={() => setDialog({})}><Plus className="w-4 h-4" />새 시험 계획</Button>
      </div>
      {tests.length === 0 && <div className="rounded-xl border border-dashed bg-card p-10 text-center text-body text-muted-foreground">시험 계획을 만들고 조건·합격 기준을 정해 보세요.</div>}
      {tests.map((t) => (
        <div key={t.id} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><p className="text-body font-semibold">{t.title}</p><Pill meta={TEST_STATUS[t.status]} />{t.version_no && <span className="text-micro text-muted-foreground">v{t.version_no}</span>}{t.retest_of && <span className="text-micro text-primary">재시험</span>}</div>
              <p className="text-caption text-muted-foreground">{t.tester_name ? `${t.tester_name} · ${fmtDate(t.tested_at)}` : `계획 · ${fmtDate(t.created_date)}`}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDialog({ test: t })}><Pencil className="w-4 h-4" />결과 기록</Button>
              {t.status !== 'PLANNED' && <Button size="sm" variant="ghost" onClick={() => setDialog({ retestOf: t })}><RotateCw className="w-4 h-4" />재시험</Button>}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3 text-caption">
            {[['조건', t.conditions], ['합격 기준', t.expected], ['불량', t.defects]].map(([l, val]) => <div key={l}><span className="text-muted-foreground">{l}</span><p className="whitespace-pre-wrap">{val || '-'}</p></div>)}
          </div>
          {t.measurements?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{t.measurements.map((m, i) => <span key={i} className="rounded-md bg-muted px-2 py-1 text-caption">{m.name}: <b>{m.value || '-'}</b>{m.unit}{m.spec ? ` (기준 ${m.spec})` : ''}</span>)}</div>
          )}
          {t.evidence?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{t.evidence.map((f) => <button key={f.id} type="button" onClick={() => openProtoFile(project.id, f.id, t.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-caption hover:bg-muted"><Paperclip className="w-3 h-3" />{f.name}</button>)}</div>
          )}
          <TestAnalysis project={project} test={t} onChanged={onChanged} onVersionCreated={onChanged} />
        </div>
      ))}
      <TestDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        project={project}
        version={dialog?.test ? versionOf(dialog.test) : current}
        test={dialog?.test}
        retestOf={dialog?.retestOf}
        user={user}
        onSaved={saved}
      />
    </div>
  );
}