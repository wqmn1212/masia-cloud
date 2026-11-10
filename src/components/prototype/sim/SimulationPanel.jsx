import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SimEditor from '@/components/prototype/sim/SimEditor';
import SimResult from '@/components/prototype/sim/SimResult';
import { protoKeys, useProtoSims } from '@/lib/prototypeApi';
import { SIM_DISCLAIMER } from '@/lib/protoSim';

// 3D 검토 안의 동작 시뮬레이션: 시나리오 목록 → 입력(부품·단계) → 결과(단계 설명·파형·3D 재생)
export default function SimulationPanel({ project, versions, user, parts, modelFile }) {
  const qc = useQueryClient();
  const { data: sims = [], isLoading } = useProtoSims(project.id);
  const [openId, setOpenId] = useState(null);
  const [mode, setMode] = useState('result');
  const sim = sims.find((s) => s.id === openId) || null;
  const version = versions.find((v) => v.id === project.current_version_id) || versions[0];
  const refresh = () => qc.invalidateQueries({ queryKey: protoKeys.sims(project.id) });
  const open = (s) => { setOpenId(s.id); setMode(s.result ? 'result' : 'edit'); };
  const editing = openId === 'new' || (sim && mode === 'edit');

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="mr-auto">
          <p className="text-title font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />전기·기구 동작 시뮬레이션</p>
          <p className="text-caption text-warning-text mt-0.5">{SIM_DISCLAIMER}</p>
        </div>
        <Button size="sm" onClick={() => { setOpenId('new'); setMode('edit'); }}><Plus className="w-4 h-4" />새 시나리오</Button>
      </div>
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
        <div className="flex flex-wrap gap-2">
          {sims.map((s) => (
            <button key={s.id} type="button" onClick={() => open(s)} className={`rounded-lg border px-3 py-1.5 text-left text-label ${openId === s.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
              {s.title}<span className="block text-micro text-muted-foreground">{s.result ? (s.result_stale ? '입력 변경됨 · 재실행 필요' : `실행됨 · ${s.result.duration_s}s`) : '초안'}</span>
            </button>
          ))}
          {sims.length === 0 && openId !== 'new' && <p className="text-caption text-muted-foreground">아직 시나리오가 없습니다. ‘새 시나리오’로 구동 부품과 단계를 등록해 보세요.</p>}
        </div>
      )}
      {editing && (
        <SimEditor key={openId} sim={sim} project={project} version={version} user={user} parts={parts} modelFile={modelFile}
          onSaved={(s) => { refresh(); setOpenId(s.id); }}
          onRan={(s) => { qc.setQueryData(protoKeys.sims(project.id), (old = []) => old.map((x) => (x.id === s.id ? s : x))); refresh(); setOpenId(s.id); setMode('result'); }}
          onCancel={() => { if (sim?.result) setMode('result'); else setOpenId(null); }} />
      )}
      {sim && mode === 'result' && sim.result && <SimResult sim={sim} parts={parts} modelFile={modelFile} onEdit={() => setMode('edit')} />}
    </div>
  );
}