import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ActuatorRow from '@/components/prototype/sim/ActuatorRow';
import { newActuator, parseRated } from '@/lib/protoSim';

// 구동 부품: 직접 추가하거나 설계 부품표 줄에서 가져온다 (정격값은 문자열에서 읽을 수 있을 때만 채움)
export default function ActuatorEditor({ actuators, onChange, parts, version }) {
  const bom = version?.bom || [];
  const update = (i, a) => onChange(actuators.map((x, j) => (j === i ? a : x)));
  const fromBom = (idx) => {
    const r = bom[idx];
    if (!r) return;
    onChange([...actuators, newActuator({ label: r.name || r.part_no || '', ref: r.ref || '', rated_voltage_v: parseRated(r.voltage, 'V'), rated_current_a: parseRated(r.current, 'A') })]);
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-body font-semibold mr-auto">구동·전기 부품 {actuators.length}</p>
        {bom.length > 0 && (
          <select className="h-8 rounded-md border border-input bg-transparent px-2 text-label" value="" onChange={(e) => fromBom(Number(e.target.value))}>
            <option value="">설계 부품표 v{version.version_no}에서 추가…</option>
            {bom.map((r, i) => <option key={i} value={i}>{[r.ref, r.name, r.voltage, r.current].filter(Boolean).join(' · ')}</option>)}
          </select>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...actuators, newActuator()])}><Plus className="w-4 h-4" />직접 추가</Button>
      </div>
      {actuators.length === 0 && <p className="text-caption text-muted-foreground">모터·솔레노이드·히터·LED 같이 전원을 쓰거나 움직이는 부품을 등록하세요.</p>}
      {actuators.map((a, i) => <ActuatorRow key={a.id} a={a} parts={parts} onChange={(v) => update(i, v)} onRemove={() => onChange(actuators.filter((_, j) => j !== i))} />)}
    </div>
  );
}