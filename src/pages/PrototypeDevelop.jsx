import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, Workflow, Sparkles, Box, ListChecks, CircuitBoard, Bluetooth, FlaskConical, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { protoKeys, useProtoProject, actorName, errorText } from '@/lib/prototypeApi';
import { useProtoConcepts } from '@/lib/conceptApi';
import { randomBase, pinUuids } from '@/lib/devkit/ble';
import { assignPins, pinProblems } from '@/lib/devkit/features';
import ConceptStep from '@/components/prototype/develop/ConceptStep';
import CadStep from '@/components/prototype/develop/CadStep';
import FeaturesStep from '@/components/prototype/develop/FeaturesStep';
import CircuitStep from '@/components/prototype/develop/CircuitStep';
import BleStep from '@/components/prototype/develop/BleStep';
import TestStep from '@/components/prototype/develop/TestStep';

const STEPS = [
  { key: 'concept', label: '스케치·컨셉', icon: Sparkles },
  { key: 'cad', label: '3D 도면', icon: Box },
  { key: 'features', label: '기능 정의', icon: ListChecks },
  { key: 'circuit', label: '회로 설계', icon: CircuitBoard },
  { key: 'ble', label: '블루투스·앱', icon: Bluetooth },
  { key: 'test', label: '시험·양산', icon: FlaskConical },
];

const asciiName = (t) => `AEGIS-${String(t || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase() || 'PROTO'}`;
const initialDev = (project) => ({
  device_name: asciiName(project.title), mcu: 'esp32c3', supply_v: 5, features: [], cad: null,
  ...(project.dev || {}),
});

// 개발 워크벤치: 현장 스케치 → 컨셉 → 3D 도면(SolidCraft) → 기능 → 회로 → 블루투스·앱 → 시험을 한 화면에서 잇는다
export default function PrototypeDevelop() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: project, isLoading, error } = useProtoProject(projectId);
  const { data: concepts = [] } = useProtoConcepts(projectId);
  const { data: circuits = [] } = useQuery({ queryKey: ['circuitDesigns', 'project', projectId], queryFn: () => base44.entities.CircuitDesign.filter({ project_id: projectId }, '-updated_date', 20), enabled: !!projectId });
  const [dev, setDev] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const step = STEPS.some((s) => s.key === params.get('step')) ? params.get('step') : 'concept';
  const go = (key) => setParams((p) => { const n = new URLSearchParams(p); n.set('step', key); return n; }, { replace: true });

  useEffect(() => { if (project && !dev) setDev(initialDev(project)); }, [project]);  
  const change = (patch) => { setDev((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) })); setDirty(true); };

  const concept = useMemo(() => concepts.find((c) => c.preview?.parts?.length) || null, [concepts]);
  const features = useMemo(() => (dev ? assignPins(dev.features || [], dev.mcu) : []), [dev]);
  const view = dev ? { ...dev, features } : null;

  const save = async () => {
    setSaving(true);
    try {
      const next = pinUuids({ ...view, uuid_base: view.uuid_base || randomBase(), updated_at: new Date().toISOString(), updated_by_name: actorName(user) });
      await base44.entities.ProtoProject.update(project.id, { dev: next });
      setDev(next); setDirty(false);
      qc.invalidateQueries({ queryKey: protoKeys.project(projectId) });
      toast({ title: '개발 설정을 저장했습니다' });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setSaving(false);
  };

  if (isLoading || (project && !dev)) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (error || !project) return <div className="py-24 text-center text-body text-muted-foreground">시제품을 찾을 수 없습니다. <Link to="/prototypes" className="text-primary">목록으로</Link></div>;

  const done = {
    concept: !!concept,
    cad: (project.files || []).some((f) => /\.(step|stp)$/i.test(f.name || '')),
    features: (project.dev?.features || []).length > 0,
    circuit: circuits.length > 0,
    ble: !!project.dev?.uuid_base && (project.dev?.features || []).length > 0,
    test: ['TEST', 'IMPROVE'].includes(project.stage),
  };
  const problems = pinProblems(features, view.mcu);
  const props = { project, concept, concepts, circuits, dev: view, change, user, dirty, onSaved: () => qc.invalidateQueries({ queryKey: protoKeys.project(projectId) }) };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to={`/prototypes/${project.id}`} className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />{project.title}</Link>
          <div className="mt-2 flex items-center gap-2 text-primary"><Workflow className="w-5 h-5" /><span className="text-label font-semibold">개발 워크벤치</span></div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">스케치에서 동작하는 시제품까지</h1>
          <p className="mt-1 text-caption text-muted-foreground">현장 스케치 → 컨셉 → 3D 도면 → 기능 → 회로 → 블루투스·앱 → 시험을 단계마다 이어서 진행합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-caption text-warning-text">저장하지 않은 변경</span>}
          <Button onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}설정 저장</Button>
        </div>
      </div>

      <nav className="grid grid-cols-3 gap-2 md:grid-cols-6" aria-label="개발 단계">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = s.key === step;
          return (
            <button key={s.key} type="button" onClick={() => go(s.key)} aria-current={active ? 'step' : undefined}
              className={`relative rounded-xl border px-3 py-2.5 text-left transition-colors ${active ? 'border-primary bg-primary/5' : 'bg-card hover:border-primary/40'}`}>
              <span className="flex items-center gap-1.5 text-micro text-muted-foreground">{i + 1}단계{done[s.key] && <Check className="w-3.5 h-3.5 text-success-text" />}</span>
              <span className={`mt-0.5 flex items-center gap-1.5 text-label font-semibold ${active ? 'text-primary' : ''}`}><Icon className="w-4 h-4 shrink-0" />{s.label}</span>
            </button>
          );
        })}
      </nav>

      {problems.length > 0 && ['features', 'circuit', 'ble'].includes(step) && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-caption text-warning-text space-y-0.5">{problems.map((p) => <p key={p}>{p}</p>)}</div>
      )}

      {step === 'concept' && <ConceptStep {...props} onNext={() => go('cad')} />}
      {step === 'cad' && <CadStep {...props} />}
      {step === 'features' && <FeaturesStep {...props} />}
      {step === 'circuit' && <CircuitStep {...props} />}
      {step === 'ble' && <BleStep {...props} />}
      {step === 'test' && <TestStep {...props} />}
    </div>
  );
}
