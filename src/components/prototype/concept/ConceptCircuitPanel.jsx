import React, { useState } from 'react';
import { CircuitBoard, Loader2, Play, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ConceptCircuitResult from '@/components/prototype/concept/ConceptCircuitResult';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';
import { CONCEPT_DISCLAIMER } from '@/lib/concept';

// 회로 검토: 전원·부품·입출력·동작 시나리오 → 회로 구성 제안 + 정격값 기반 계산
export default function ConceptCircuitPanel({ concept, project, onChanged }) {
  const c = concept.circuit;
  const [form, setForm] = useState(() => c?.inputs || { supply_voltage_v: '', supply_limit_a: '', power_source: project.power_requirements || '', components: '', io: project.io_requirements || '', scenario: '' });
  const [editing, setEditing] = useState(!c);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = async () => {
    if (!(Number(form.supply_voltage_v) > 0)) { setError('공급 전압을 입력해 주세요'); return; }
    setBusy('회로 구성을 제안하고 계산하는 중… (1~2분)'); setError('');
    try {
      const res = await runConcept('circuit', { concept_id: concept.id, inputs: form }, () => setBusy('시간이 걸리고 있습니다. 결과를 확인하는 중…'));
      setEditing(false);
      onChanged(res.concept);
    } catch (e) { setError(errorText(e)); }
    setBusy('');
  };

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4 min-w-0">
      <div className="flex items-center gap-2">
        <CircuitBoard className="w-5 h-5 text-primary" />
        <p className="text-title font-semibold mr-auto">회로 검토</p>
        {c && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>조건 바꿔 다시 실행</Button>}
      </div>
      <p className="flex items-start gap-1.5 text-caption text-muted-foreground"><Info className="w-4 h-4 shrink-0 mt-0.5" />{CONCEPT_DISCLAIMER.circuit}</p>

      {editing && (
        <div className="space-y-3 rounded-xl bg-secondary p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>공급 전압 (V)</Label><Input type="number" value={form.supply_voltage_v ?? ''} onChange={set('supply_voltage_v')} placeholder="예: 5" /></div>
            <div className="space-y-1.5"><Label>전원 허용 전류 (A, 선택)</Label><Input type="number" value={form.supply_limit_a ?? ''} onChange={set('supply_limit_a')} placeholder="예: 2" /></div>
          </div>
          <div className="space-y-1.5"><Label>전원 종류</Label><Input value={form.power_source || ''} onChange={set('power_source')} placeholder="예: USB-C 5V 어댑터, 18650 2셀 배터리" /></div>
          <div className="space-y-1.5"><Label>정해진 부품·정격 (선택)</Label><Textarea rows={2} value={form.components || ''} onChange={set('components')} placeholder="예: DC 팬 5V 0.3A, LED 20mA 3개. 적지 않은 값은 AI가 가정으로 채우고 표시합니다." /></div>
          <div className="space-y-1.5"><Label>입출력</Label><Textarea rows={2} value={form.io || ''} onChange={set('io')} placeholder="예: 터치 버튼 1개, 상태 LED, 먼지 센서" /></div>
          <div className="space-y-1.5"><Label>동작 시나리오</Label><Textarea rows={3} value={form.scenario || ''} onChange={set('scenario')} placeholder="예: 버튼을 누르면 약풍 10분 → 강풍 5분 → 자동 꺼짐. 비우면 AI가 대표 순서를 제안합니다." /></div>
          {error && <p className="text-caption text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {busy && <p className="text-caption text-muted-foreground">{busy}</p>}
            {c && <Button variant="ghost" onClick={() => setEditing(false)} disabled={!!busy}>취소</Button>}
            <Button onClick={run} disabled={!!busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}회로 검토 실행</Button>
          </div>
        </div>
      )}
      {c && !editing && <ConceptCircuitResult circuit={c} />}
    </div>
  );
}