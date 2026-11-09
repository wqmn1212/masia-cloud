import React, { useMemo, useState } from 'react';
import { Loader2, Save, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import ActuatorEditor from '@/components/prototype/sim/ActuatorEditor';
import SimStepsEditor from '@/components/prototype/sim/SimStepsEditor';
import SimInputCheck from '@/components/prototype/sim/SimInputCheck';
import { checkInputs, numOrNull } from '@/lib/protoSim';
import { actorName, errorText, runSimulation } from '@/lib/prototypeApi';

const box = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-base md:text-body';

export default function SimEditor({ sim, project, version, user, parts, modelFile, onSaved, onRan, onCancel }) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => ({
    title: sim?.title || '새 동작 시나리오', supply_voltage_v: sim?.supply_voltage_v ?? null, supply_limit_a: sim?.supply_limit_a ?? null,
    notes: sim?.notes || '', actuators: sim?.actuators || [], steps: sim?.steps || [],
  }));
  const [busy, setBusy] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const check = useMemo(() => checkInputs(form, { parts, project, version }), [form, parts, project, version]);

  const save = async () => {
    const ids = new Set(form.actuators.map((a) => a.id));
    const payload = {
      ...form, steps: form.steps.map((s) => ({ ...s, states: (s.states || []).filter((x) => ids.has(x.actuator_id)) })),
      version_id: version?.id || null, version_no: version?.version_no || null,
      ...(modelFile ? { model_file_id: modelFile.id, model_file_name: modelFile.name } : {}),
    };
    if (sim) return base44.entities.ProtoSimulation.update(sim.id, { ...payload, result_stale: !!sim.result });
    return base44.entities.ProtoSimulation.create({ ...payload, tenant_id: project.tenant_id, project_id: project.id, status: 'DRAFT', created_by_name: actorName(user) });
  };

  const handle = async (run) => {
    setBusy(run ? '저장하고 계산하는 중…' : '저장 중…');
    try {
      const saved = await save();
      onSaved(saved);
      if (run) {
        const res = await runSimulation(saved.id, () => setBusy('AI 설명을 기다리는 중… (최대 3분)'));
        toast({ title: '시뮬레이션을 마쳤습니다' });
        onRan(res.sim);
      } else toast({ title: '저장했습니다' });
    } catch (e) { toast({ title: '처리하지 못했습니다', description: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <label className="space-y-1"><span className="text-caption text-muted-foreground">시나리오 이름</span><input className={box} value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="space-y-1"><span className="text-caption text-muted-foreground">공급 전압 (V)</span><input type="number" step="any" className={box} value={form.supply_voltage_v ?? ''} onChange={(e) => set('supply_voltage_v', numOrNull(e.target.value))} placeholder={project.power_requirements ? '요구사항 참고' : ''} /></label>
        <label className="space-y-1"><span className="text-caption text-muted-foreground">전원 허용 전류 (A, 선택)</span><input type="number" step="any" className={box} value={form.supply_limit_a ?? ''} onChange={(e) => set('supply_limit_a', numOrNull(e.target.value))} /></label>
      </div>
      {project.power_requirements && <p className="text-caption text-muted-foreground">요구사항의 전원 조건: {project.power_requirements}</p>}
      <ActuatorEditor actuators={form.actuators} onChange={(v) => set('actuators', v)} parts={parts} version={version} />
      <SimStepsEditor steps={form.steps} actuators={form.actuators} onChange={(v) => set('steps', v)} />
      <label className="block space-y-1"><span className="text-caption text-muted-foreground">조건·가정 메모 (AI 설명에 전달)</span><textarea className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-body" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="예: 부하 0.5kg, 상온 25℃, 리밋 스위치로 정지" /></label>
      <SimInputCheck items={check.items} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {busy && <span className="text-caption text-muted-foreground mr-auto flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" />{busy}</span>}
        {onCancel && <Button variant="ghost" onClick={onCancel} disabled={!!busy}>취소</Button>}
        <Button variant="outline" onClick={() => handle(false)} disabled={!!busy}><Save className="w-4 h-4" />저장</Button>
        <Button onClick={() => handle(true)} disabled={!!busy || !check.canRun}><Play className="w-4 h-4" />저장 후 실행</Button>
      </div>
    </div>
  );
}