import React, { useEffect, useMemo, useState } from 'react';
import { Box, Loader2, CheckCircle2, Wrench, Ruler, Triangle, Rotate3D, Maximize, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import MeasureCanvas from '@/components/prototype/measure/MeasureCanvas';
import PartVisibilityList from '@/components/prototype/measure/PartVisibilityList';
import MeasureDraft from '@/components/prototype/measure/MeasureDraft';
import MeasureList from '@/components/prototype/measure/MeasureList';
import ConnectionList from '@/components/prototype/ConnectionList';
import SimulationPanel from '@/components/prototype/sim/SimulationPanel';
import { OUTPUT_SCOPE } from '@/lib/prototype';
import { signProtoFile, errorText, actorName } from '@/lib/prototypeApi';
import { isModelFile, loadModelParts } from '@/lib/protoModel';
import { partsBounds, distanceMm, angleDeg, fmtMm } from '@/lib/measure3d';

const MODES = [
  ['ORBIT', '회전', Rotate3D],
  ['DIST', '거리', Ruler],
  ['ANGLE', '각도', Triangle],
];

const HINTS = {
  ORBIT: '드래그로 회전, 휠로 확대합니다. 부품 목록의 눈 아이콘으로 보이기·숨기기를 바꿉니다.',
  DIST: '거리 측정: 모델 위에서 두 점을 차례로 찍습니다.',
  ANGLE: '각도 측정: 세 점을 찍습니다. 두 번째 점이 꼭짓점입니다.',
};

const autoStatus = (row) => {
  if (row.design_value == null) return 'MEASURED';
  const ok = Math.abs(Number(row.value) - Number(row.design_value)) <= (Number(row.tolerance) || 0);
  return ok ? 'MATCH' : 'DIFF';
};

export default function ViewerTab({ project, versions, user }) {
  const [modelFile, setModelFile] = useState(null);
  // 분류와 상관없이 STEP·STL 확장자면 3D 로 연다 (도면 분류로 올린 STEP 포함)
  const models = (project.files || []).filter((f) => f.category === 'MODEL3D' || isModelFile(f.name));
  const [parts, setParts] = useState(null);
  const [visible, setVisible] = useState([]);
  const [selected, setSelected] = useState(-1);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState({ rotX: 0.5, rotY: 0.8, zoom: 1 });
  const [mode, setMode] = useState('ORBIT');
  const [picks, setPicks] = useState([]);
  const [draft, setDraft] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const v = versions.find((x) => x.id === project.current_version_id) || versions[0];
  const bounds = useMemo(() => (parts?.length ? partsBounds(parts) : null), [parts]);

  useEffect(() => {
    let alive = true;
    base44.entities.ProtoMeasurement.filter({ project_id: project.id }, '-created_date', 200)
      .then((res) => { if (alive) setRows(Array.isArray(res) ? res : res?.items || []); })
      .catch(() => {});
    // 같은 시제품을 보고 있는 팀원이 저장·완료 표시하면 바로 반영한다
    const unsubscribe = base44.entities.ProtoMeasurement.subscribe((event) => {
      const rec = event?.data;
      if (!rec || rec.project_id !== project.id) return;
      setRows((prev) => {
        if (event.type === 'delete') return prev.filter((r) => r.id !== rec.id);
        return prev.some((r) => r.id === rec.id) ? prev.map((r) => (r.id === rec.id ? rec : r)) : [rec, ...prev];
      });
    });
    return () => { alive = false; if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [project.id]);

  const load = async (f) => {
    setLoading(f.id); setError(''); setParts(null); setSelected(-1); setPicks([]); setDraft(null); setSelectedId('');
    try {
      const loaded = await loadModelParts(await signProtoFile(project.id, f.id), f.name);
      if (!loaded.length) throw new Error('이 파일에서 3D 형상을 찾지 못했습니다. 솔리드가 들어 있는 STEP·STL 인지 확인해 주세요.');
      setParts(loaded);
      setVisible(loaded.map(() => true));
      setModelFile({ id: f.id, name: f.name });
    } catch (e) { setError(errorText(e)); }
    setLoading('');
  };

  const need = mode === 'ANGLE' ? 3 : 2;

  const changeMode = (next) => {
    setMode(next);
    setPicks([]);
    setDraft(null);
  };

  const resetPicks = () => { setPicks([]); setDraft(null); };

  const handlePick = (hit) => {
    if (mode === 'ORBIT' || draft) return;
    const next = [...picks, hit].slice(0, need);
    setPicks(next);
    if (next.length === need) {
      const value = mode === 'ANGLE' ? angleDeg(next[0], next[1], next[2]) : distanceMm(next[0], next[1]);
      setDraft({ kind: mode === 'ANGLE' ? 'ANGLE' : 'DISTANCE', points: next, value, unit: mode === 'ANGLE' ? 'deg' : 'mm' });
    }
  };

  const saveMeasurement = async ({ label, designValue, tolerance, note }) => {
    if (!draft) return;
    setSaving(true); setError('');
    try {
      const difference = designValue == null ? null : Number((draft.value - designValue).toFixed(2));
      const status = designValue == null ? 'MEASURED' : Math.abs(difference) <= tolerance ? 'MATCH' : 'DIFF';
      const points = draft.points.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      const partNames = [...new Set(draft.points.map((p) => parts?.[p.part]?.part_name).filter(Boolean))];
      const created = await base44.entities.ProtoMeasurement.create({
        tenant_id: project.tenant_id,
        project_id: project.id,
        model_file_id: modelFile?.id || '',
        model_file_name: modelFile?.name || '',
        label: label?.trim() || (draft.kind === 'ANGLE' ? '각도 측정' : '거리 측정'),
        kind: draft.kind,
        points,
        value: Number(draft.value.toFixed(2)),
        unit: draft.unit,
        design_value: designValue,
        tolerance,
        difference,
        status,
        part_names: partNames,
        note: note?.trim() || '',
        created_by_name: actorName(user),
      });
      setRows((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setSelectedId(created.id);
      setDraft(null);
      setPicks([]);
    } catch (e) { setError(errorText(e)); }
    setSaving(false);
  };

  const setStatus = async (row, status) => {
    const patch = status === 'DONE'
      ? { status, done_at: new Date().toISOString(), done_by_name: actorName(user) }
      : { status: status === 'AUTO' ? autoStatus(row) : status, done_at: '', done_by_name: '' };
    try {
      const updated = await base44.entities.ProtoMeasurement.update(row.id, patch);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch, ...updated } : r)));
    } catch (e) { setError(errorText(e)); }
  };

  const removeMeasurement = async (row) => {
    try {
      await base44.entities.ProtoMeasurement.delete(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      if (selectedId === row.id) setSelectedId('');
    } catch (e) { setError(errorText(e)); }
  };

  const active = rows.find((r) => r.id === selectedId);
  const overlay = active && active.model_file_id && active.model_file_id === modelFile?.id ? [active.points || []] : [];
  const picking = !!parts && mode !== 'ORBIT' && !draft;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border bg-card p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-title font-semibold mr-auto">3D 검토</p>
            {models.map((f) => <Button key={f.id} size="sm" variant="outline" onClick={() => load(f)} disabled={!!loading}>{loading === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}{f.name}</Button>)}
          </div>
          {models.length === 0 && <p className="text-caption text-muted-foreground">제작 탭에서 ‘3D 모델 (STEP·STL)’ 파일을 올리면 여기서 돌려 보며 부품을 확인할 수 있습니다.</p>}
          {error && <p className="text-caption text-destructive">{error}</p>}
          {parts ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {MODES.map(([key, text, Icon]) => (
                  <Button key={key} size="sm" variant={mode === key ? 'default' : 'outline'} onClick={() => changeMode(key)}>
                    <Icon className="w-4 h-4" />{text}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setView({ rotX: 0.5, rotY: 0.8, zoom: 1 })}><Maximize className="w-4 h-4" />화면 맞춤</Button>
                {(picks.length > 0 || draft) && <Button size="sm" variant="ghost" onClick={resetPicks}><RotateCcw className="w-4 h-4" />지우기</Button>}
              </div>
              <MeasureCanvas
                parts={parts}
                bounds={bounds}
                visible={visible}
                selectedPart={selected}
                view={view}
                setView={setView}
                picks={picks}
                overlays={overlay}
                picking={picking}
                onPick={handlePick}
              />
              <p className="text-micro text-muted-foreground">{HINTS[mode]} 이 보기는 형상·치수 확인용이며 전기·기구 동작 시뮬레이션은 아닙니다.</p>
            </>
          ) : (
            <div className="aspect-square rounded-xl bg-secondary flex items-center justify-center text-caption text-muted-foreground">{loading ? '모델을 읽는 중… (큰 STEP 은 시간이 걸립니다)' : '모델을 선택하세요'}</div>
          )}
        </div>

        <div className="space-y-4">
          {bounds && (
            <div className="rounded-xl border bg-card p-4 space-y-1">
              <p className="text-caption font-semibold text-muted-foreground">전체 치수 (모델 기준)</p>
              <p className="text-title font-semibold">{bounds.size.map(fmtMm).join(' × ')}</p>
              <p className="text-micro text-muted-foreground">가로 × 세로 × 높이. 부품을 숨겨도 치수는 전체 기준입니다.</p>
            </div>
          )}
          <div className="rounded-xl border bg-card p-3 max-h-[320px] overflow-y-auto">
            <PartVisibilityList
              parts={parts}
              visible={visible}
              boxes={bounds?.boxes}
              selected={selected}
              onToggle={(i) => setVisible((prev) => prev.map((on, k) => (k === i ? !on : on)))}
              onShowAll={() => setVisible((parts || []).map(() => true))}
              onSelect={setSelected}
            />
          </div>
          <div className="rounded-xl border bg-card p-3 space-y-3 max-h-[520px] overflow-y-auto">
            <div className="flex items-center justify-between px-1">
              <p className="text-caption font-semibold text-muted-foreground">측정·검증 {rows.length ? `(${rows.length})` : ''}</p>
              {mode !== 'ORBIT' && !draft && <span className="text-micro text-primary">{picks.length}/{need}점 찍음</span>}
            </div>
            {draft && (
              <MeasureDraft
                key={`${draft.kind}-${draft.points.length}-${draft.value}`}
                draft={draft}
                partNames={[...new Set(draft.points.map((p) => parts?.[p.part]?.part_name).filter(Boolean))]}
                saving={saving}
                onSave={saveMeasurement}
                onCancel={resetPicks}
              />
            )}
            {!draft && mode !== 'ORBIT' && (
              <p className="rounded-lg border border-dashed p-2 text-caption text-muted-foreground">{HINTS[mode]}</p>
            )}
            <MeasureList
              rows={rows}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onStatus={setStatus}
              onDelete={removeMeasurement}
            />
          </div>
        </div>
      </div>

      <SimulationPanel project={project} versions={versions} user={user} parts={parts} modelFile={modelFile} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <p className="text-title font-semibold">연결·작동 흐름 {v ? `(v${v.version_no})` : ''}</p>
          {v?.operating_principle && <p className="text-caption text-muted-foreground line-clamp-4">{v.operating_principle}</p>}
          <ConnectionList connections={v?.connections} />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-2">
          <p className="text-title font-semibold">산출물 범위</p>
          {OUTPUT_SCOPE.map((o) => (
            <div key={o.label} className="flex items-start gap-2 text-label">
              {o.auto ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-success" /> : <Wrench className="w-4 h-4 mt-0.5 text-muted-foreground" />}
              <span>{o.label}<span className="text-caption text-muted-foreground"> — {o.auto ? '이 앱에서 초안 생성·확인' : `외부 도구 필요 (${o.tool})`}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}