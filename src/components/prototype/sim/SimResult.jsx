import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Sparkles, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SimPlayer from '@/components/prototype/sim/SimPlayer';
import SimCharts from '@/components/prototype/sim/SimCharts';
import SimStats from '@/components/prototype/sim/SimStats';
import SimStepList from '@/components/prototype/sim/SimStepList';
import SimNotes from '@/components/prototype/sim/SimNotes';
import { posesAt, stepAt } from '@/lib/protoSim';
import { fmtDate } from '@/lib/prototype';

export default function SimResult({ sim, parts, modelFile, onEdit }) {
  const result = sim.result;
  const dur = result.duration_s || 0;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [actId, setActId] = useState(null);
  const actuator = (sim.actuators || []).find((a) => a.id === actId) || null;
  const poses = useMemo(() => posesAt(result, parts, t), [result, parts, t]);
  const current = stepAt(result, t);

  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    let shown = last;
    let acc = 0;
    let id;
    const tick = (now) => {
      acc += (now - last) / 1000; last = now;
      if (now - shown > 50) { shown = now; const step = acc; acc = 0; setT((p) => Math.min(dur, p + step)); }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, dur]);
  useEffect(() => { if (playing && t >= dur) setPlaying(false); }, [t, dur, playing]);

  const wrongModel = parts?.length && sim.model_file_id && modelFile && modelFile.id !== sim.model_file_id;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-caption text-muted-foreground mr-auto">실행 {fmtDate(result.ran_at)} · {result.ran_by_name || '-'} {result.version_no ? `· 설계 v${result.version_no}` : ''}{sim.model_file_name ? ` · 모델 ${sim.model_file_name}` : ''}</p>
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="w-4 h-4" />입력 수정·다시 실행</Button>
      </div>
      {sim.result_stale && <p className="rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning-text">입력이 바뀐 뒤 아직 다시 실행하지 않았습니다. 아래 결과는 이전 입력 기준입니다.</p>}
      {wrongModel && <p className="rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning-text">지금 불러온 모델이 이 시나리오의 모델({sim.model_file_name})과 다릅니다. 부품 이름이 같은 것만 움직입니다.</p>}
      {result.ai?.summary && <p className="rounded-lg bg-secondary px-3 py-2 text-body"><Sparkles className="inline w-4 h-4 mr-1 text-chart-4" /><span className="text-micro text-chart-4 mr-1">AI 요약</span>{result.ai.summary}</p>}
      <SimStats result={result} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2 min-w-0">
          <SimPlayer parts={parts} poses={poses} highlightId={actId} />
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => { if (t >= dur) setT(0); setPlaying((p) => !p); }} aria-label={playing ? '일시정지' : '재생'}>{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Button>
            <Button size="icon" variant="ghost" onClick={() => { setPlaying(false); setT(0); }} aria-label="처음으로"><RotateCcw className="w-4 h-4" /></Button>
            <input type="range" min={0} max={dur} step={0.01} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} className="flex-1" />
            <span className="text-caption tabular-nums w-24 text-right">{t.toFixed(2)} / {dur}s</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-micro text-muted-foreground self-center">부품 선택:</span>
            {(sim.actuators || []).map((a) => <button key={a.id} type="button" onClick={() => setActId(actId === a.id ? null : a.id)} className={`rounded-full border px-2.5 py-0.5 text-caption ${actId === a.id ? 'border-warning bg-warning/10' : 'hover:bg-muted'}`}>{a.label || a.ref || '부품'}</button>)}
          </div>
        </div>
        <div className="min-w-0"><SimCharts result={result} t={t} actuator={actuator} /></div>
      </div>
      <SimStepList result={result} current={current} onSelect={(s) => { setPlaying(false); setT(s.t_start); }} />
      <SimNotes result={result} />
    </div>
  );
}