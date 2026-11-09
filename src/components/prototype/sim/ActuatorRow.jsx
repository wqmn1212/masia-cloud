import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACTUATOR_KINDS, MOTIONS, AXES, numOrNull } from '@/lib/protoSim';

const box = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-base md:text-label';
const F = ({ label, children }) => <label className="space-y-1 min-w-0"><span className="block text-micro text-muted-foreground">{label}</span>{children}</label>;

export default function ActuatorRow({ a, parts, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...a, [k]: v });
  const num = (k) => ({ type: 'number', step: 'any', value: a[k] ?? '', onChange: (e) => set(k, numOrNull(e.target.value)), className: box });
  const moving = a.motion !== 'NONE';
  const unit = a.motion === 'ROTATE' ? '°' : 'mm';
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="grid gap-2 grid-cols-2 md:grid-cols-[1.4fr_0.8fr_1fr_0.7fr_0.7fr_0.7fr_auto] items-end">
        <F label="이름"><input className={box} value={a.label} onChange={(e) => set('label', e.target.value)} placeholder="예: 메인 모터" /></F>
        <F label="Ref"><input className={box} value={a.ref} onChange={(e) => set('ref', e.target.value)} placeholder="M1" /></F>
        <F label="종류"><select className={box} value={a.kind} onChange={(e) => set('kind', e.target.value)}>{ACTUATOR_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
        <F label="정격 V"><input {...num('rated_voltage_v')} /></F>
        <F label="정격 A"><input {...num('rated_current_a')} /></F>
        <F label="대기 A"><input {...num('idle_current_a')} /></F>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label="부품 삭제"><Trash2 className="w-4 h-4" /></Button>
      </div>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-[1fr_0.5fr_0.8fr_0.7fr_0.7fr_1.6fr] items-end">
        <F label="움직임"><select className={box} value={a.motion} onChange={(e) => set('motion', e.target.value)}>{MOTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
        {moving && <>
          <F label="축"><select className={box} value={a.axis} onChange={(e) => set('axis', e.target.value)}>{AXES.map((x) => <option key={x}>{x}</option>)}</select></F>
          <F label={`속도 (${unit}/s)`}><input {...num('speed')} /></F>
          <F label={`최소 (${unit})`}><input {...num('travel_min')} /></F>
          <F label={`최대 (${unit})`}><input {...num('travel_max')} /></F>
          <F label="3D 부품">
            <select className={box} value={a.part_name ? `${a.part_index}` : ''} onChange={(e) => { const i = e.target.value === '' ? null : Number(e.target.value); onChange({ ...a, part_index: i, part_name: i == null ? '' : parts[i]?.part_name || '' }); }}>
              <option value="">{parts?.length ? '연결 안 함' : a.part_name ? `${a.part_name} (모델 미로드)` : '모델을 먼저 불러오세요'}</option>
              {a.part_name && !parts?.[a.part_index] && <option value={`${a.part_index}`}>{a.part_name}</option>}
              {(parts || []).map((p, i) => <option key={i} value={`${i}`}>{p.part_name}</option>)}
            </select>
          </F>
        </>}
      </div>
    </div>
  );
}