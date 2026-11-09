import React, { useMemo, useState } from 'react';
import { Box, Loader2, CheckCircle2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ModelCanvas from '@/components/prototype/ModelCanvas';
import ConnectionList from '@/components/prototype/ConnectionList';
import { OUTPUT_SCOPE } from '@/lib/prototype';
import { signProtoFile, errorText } from '@/lib/prototypeApi';
import { isModelFile, loadModelParts, mergeMeshes } from '@/lib/protoModel';

export default function ViewerTab({ project, versions }) {
  // 분류와 상관없이 STEP·STL 확장자면 3D 로 연다 (도면 분류로 올린 STEP 포함)
  const models = (project.files || []).filter((f) => f.category === 'MODEL3D' || isModelFile(f.name));
  const [parts, setParts] = useState(null);
  const [selected, setSelected] = useState(-1);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const v = versions.find((x) => x.id === project.current_version_id) || versions[0];
  const merged = useMemo(() => (parts?.length ? mergeMeshes(parts) : null), [parts]);
  const mesh = selected >= 0 ? parts?.[selected]?.mesh : merged;

  const load = async (f) => {
    setLoading(f.id); setError(''); setParts(null); setSelected(-1);
    try {
      const loaded = await loadModelParts(await signProtoFile(project.id, f.id), f.name);
      if (!loaded.length) throw new Error('이 파일에서 3D 형상을 찾지 못했습니다. 솔리드가 들어 있는 STEP·STL 인지 확인해 주세요.');
      setParts(loaded);
    }
    catch (e) { setError(errorText(e)); }
    setLoading('');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border bg-card p-5 space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-title font-semibold mr-auto">3D 검토</p>
            {models.map((f) => <Button key={f.id} size="sm" variant="outline" onClick={() => load(f)} disabled={!!loading}>{loading === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}{f.name}</Button>)}
          </div>
          {models.length === 0 && <p className="text-caption text-muted-foreground">제작 탭에서 ‘3D 모델 (STEP·STL)’ 파일을 올리면 여기서 돌려 보며 부품을 확인할 수 있습니다.</p>}
          {error && <p className="text-caption text-destructive">{error}</p>}
          {mesh ? <ModelCanvas mesh={mesh} color={selected >= 0 ? 0x5b8def : 0xa8bad6} /> : (
            <div className="aspect-[16/9] rounded-xl bg-secondary flex items-center justify-center text-caption text-muted-foreground">{loading ? '모델을 읽는 중… (큰 STEP 은 시간이 걸립니다)' : '모델을 선택하세요'}</div>
          )}
          <p className="text-micro text-muted-foreground">드래그로 회전, 휠로 확대합니다. 이 보기는 형상 확인용이며 전기·기구 동작 시뮬레이션은 아닙니다.</p>
        </div>
        <div className="rounded-xl border bg-card p-3 max-h-[640px] overflow-y-auto">
          <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">구성 부품 {parts ? parts.length : ''}</p>
          {parts && <button type="button" onClick={() => setSelected(-1)} className={`w-full rounded-lg px-3 py-1.5 text-left text-label ${selected === -1 ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>전체 조립</button>}
          {(parts || []).map((p, i) => (
            <button key={i} type="button" onClick={() => setSelected(i)} className={`w-full rounded-lg px-3 py-1.5 text-left text-label truncate ${selected === i ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>{p.part_name}</button>
          ))}
        </div>
      </div>
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