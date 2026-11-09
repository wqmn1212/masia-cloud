import React from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stateOf, numOrNull } from '@/lib/protoSim';

const box = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-base md:text-label';

export default function SimStepRow({ step, index, actuators, onChange, onMove, onRemove }) {
  const set = (k, v) => onChange({ ...step, [k]: v });
  const setState = (id, patch) => {
    const others = (step.states || []).filter((s) => s.actuator_id !== id);
    onChange({ ...step, states: [...others, { ...stateOf(step, id), ...patch }] });
  };
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="grid gap-2 grid-cols-[auto_1fr_90px_auto] md:grid-cols-[auto_1fr_100px_1.4fr_auto] items-center">
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-micro font-semibold flex items-center justify-center">{index + 1}</span>
        <input className={box} value={step.name} onChange={(e) => set('name', e.target.value)} placeholder="단계 이름" />
        <div className="relative"><input type="number" step="any" min="0" className={`${box} pr-6`} value={step.duration_s ?? ''} onChange={(e) => set('duration_s', numOrNull(e.target.value))} /><span className="absolute right-2 top-2 text-micro text-muted-foreground">초</span></div>
        <input className={`${box} hidden md:block`} value={step.trigger} onChange={(e) => set('trigger', e.target.value)} placeholder="시작 조건·센서 신호 (예: 리밋 SW1 ON)" />
        <div className="flex">
          <Button type="button" size="icon" variant="ghost" onClick={() => onMove(-1)} aria-label="위로"><ChevronUp className="w-4 h-4" /></Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => onMove(1)} aria-label="아래로"><ChevronDown className="w-4 h-4" /></Button>
          <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label="단계 삭제"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>
      <input className={`${box} md:hidden`} value={step.trigger} onChange={(e) => set('trigger', e.target.value)} placeholder="시작 조건·센서 신호" />
      <div className="flex flex-wrap gap-2">
        {actuators.map((a) => {
          const s = stateOf(step, a.id);
          return (
            <div key={a.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-label ${s.on ? 'border-primary bg-primary/5' : ''}`}>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={!!s.on} onChange={(e) => setState(a.id, { on: e.target.checked })} />{a.label || a.ref || '부품'}</label>
              {s.on && <>
                {a.motion !== 'NONE' && <select className="h-7 rounded border bg-transparent px-1 text-caption" value={s.direction} onChange={(e) => setState(a.id, { direction: Number(e.target.value) })}><option value={1}>정방향</option><option value={-1}>역방향</option></select>}
                <input type="number" min="0" max="100" className="h-7 w-14 rounded border bg-transparent px-1 text-caption" value={s.duty_pct ?? 100} onChange={(e) => setState(a.id, { duty_pct: numOrNull(e.target.value) })} /><span className="text-micro text-muted-foreground">%</span>
              </>}
            </div>
          );
        })}
        {actuators.length === 0 && <span className="text-caption text-muted-foreground">부품을 먼저 등록하세요</span>}
      </div>
    </div>
  );
}