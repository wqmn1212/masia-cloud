import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, FileDown, Bot, FileCode2, RotateCcw, Loader2, Info, Eye, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import ProtoFiles from '@/components/prototype/ProtoFiles';
import ConceptCanvas from '@/components/prototype/concept/ConceptCanvas';
import { Card, CopyButton, DownloadButton, CommandLine, CodeView, Field } from '@/components/prototype/develop/DevBits';
import { defaultCadParams, solidcraftScript, mcpBrief, scriptFileName, cliCommand, MCP_SETUP, shellParts, mainShellId, partParams, partCutouts } from '@/lib/devkit/solidcraft';
import { drawingSvg, drawingFileName, sizeText, posText } from '@/lib/devkit/drawing';
import { errorText, uploadProtoFile, addProtoFiles, protoAction } from '@/lib/prototypeApi';

const AUTO_DRAWING_NOTE = '개발 워크벤치 설계 도면 (PDF 내려받을 때 자동 보관)';

const OPTIONS = [
  { key: 'files', n: '방식 1', label: '파일 주고받기', icon: FileDown, hint: '설계자가 SolidCraft 에서 직접 모델링' },
  { key: 'ai', n: '방식 2', label: 'AI 가 SolidCraft 조작', icon: Bot, hint: 'Claude Code + SolidCraft MCP' },
  { key: 'script', n: '방식 3', label: '스크립트로 자동 생성', icon: FileCode2, hint: 'solidcraft-cli 로 STEP 만들기' },
];

const NUMS = [['width', '폭 (X)'], ['depth', '깊이 (Y)'], ['height', '높이 (Z)'], ['wall', '살두께'], ['corner', '모서리 R'], ['pocket', '윗면 자리 깊이']];

// 2단계: 컨셉 → 파라메트릭 3D 도면. SolidCraft 를 세 가지 방식으로 쓴다
export default function CadStep({ project, concept, dev, change, user, onSaved }) {
  const parts = concept?.preview?.parts || [];
  // 외장 부품마다 따로 설계한다 (본체·물탱크처럼 따로 사출되는 부품). 기본은 조작부가 가장 많이 붙은 부품
  const shells = useMemo(() => shellParts(parts), [parts]);
  const partId = shells.some((p) => p.id === dev.cad?.part_id) ? dev.cad.part_id : mainShellId(parts);
  const base = useMemo(() => (partId ? partParams(parts, partId) : defaultCadParams(concept?.preview)), [concept?.id, partId]);  
  const own = dev.cad && (dev.cad.part_id || null) === (partId || null) ? dev.cad : {};
  const params = { ...base, ...own };
  const setParam = (k, v) => change((d) => ({ cad: { ...(d.cad && (d.cad.part_id || null) === (partId || null) ? d.cad : {}), part_id: partId || null, [k]: v, concept_id: concept?.id || null } }));
  const choosePart = (id) => change({ cad: { part_id: id, concept_id: concept?.id || null } });
  const [option, setOption] = useState('files');
  const [busy, setBusy] = useState('');
  const allCuts = useMemo(() => (partId ? partCutouts(parts, partId) : []), [concept?.id, partId]);  
  const skip = new Set(params.skip_cutouts || []);
  const cuts = allCuts.filter((c) => !skip.has(c.id));
  const outBase = scriptFileName(`${project.title}${params.part_name ? `-${params.part_name}` : ''}`);
  const script = JSON.stringify(solidcraftScript(params, cuts), null, 2);
  const brief = mcpBrief({ project, concept, params, cutouts: cuts, features: dev.features, outBase, otherParts: shells.filter((p) => p.id !== partId).map((p) => p.name) });
  const today = new Date().toISOString().slice(0, 10);
  const drawing = useMemo(() => drawingSvg({ title: project.title, partName: params.part_name, material: params.material, params, cutouts: cuts, date: today, docNo: `${(dev.device_name || 'AEGIS').slice(0, 12)}-${today.replace(/-/g, '')}-${String(Math.max(1, shells.findIndex((p) => p.id === partId) + 1)).padStart(2, '0')}` }), [project.title, JSON.stringify(params), JSON.stringify(cuts), dev.device_name, partId, shells.length]);  
  const [drawingUrl, setDrawingUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(new Blob([drawing.svg], { type: 'image/svg+xml' })); setDrawingUrl(u); return () => URL.revokeObjectURL(u); }, [drawing.svg]);
  const drawName = drawingFileName(project.title, params.part_name);
  const exportDrawing = async (kind) => {
    setBusy(kind);
    try {
      const { downloadBlob } = await import('@/lib/devkit/conceptExport');
      if (kind === 'svg') downloadBlob(new Blob([drawing.svg], { type: 'image/svg+xml' }), `${drawName}.svg`);
      else {
        const { drawingPdfBlob } = await import('@/lib/devkit/drawingPdf');
        const blob = await drawingPdfBlob(drawing.svg);
        downloadBlob(blob, `${drawName}.pdf`);
        // 내려받은 도면은 시제품 파일(도면)에도 보관 — 같은 이름의 이전 자동 보관본은 바꾼다
        const f = await uploadProtoFile(new File([blob], `${drawName}.pdf`, { type: 'application/pdf' }), user, { category: 'DRAWING', note: AUTO_DRAWING_NOTE });
        await addProtoFiles(project.id, [f]);
        const old = (project.files || []).filter((x) => x.name === f.name && x.note === AUTO_DRAWING_NOTE && x.id !== f.id);
        for (const o of old) await protoAction('remove_file', { project_id: project.id, file_id: o.id }).catch(() => {});
        onSaved?.();
        toast({ title: '도면 PDF 를 내려받고 시제품 파일에도 보관했습니다' });
      }
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  const exportModel = async (kind) => {
    setBusy(kind);
    try {
      const { conceptStl, conceptGlb, downloadBlob } = await import('@/lib/devkit/conceptExport');
      if (kind === 'stl') downloadBlob(conceptStl(parts), `${outBase}-concept.stl`);
      else downloadBlob(await conceptGlb(parts), `${outBase}-concept.glb`);
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card title="외장 기본 치수" icon={Box} tag="파라메트릭"
          actions={concept && <Button size="sm" variant="ghost" onClick={() => change({ cad: null })}><RotateCcw className="w-4 h-4" />컨셉 치수로</Button>}>
          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <div className="relative h-[280px] overflow-hidden rounded-xl border bg-gradient-to-b from-secondary to-card">
              {parts.length
                ? <ConceptCanvas parts={parts} autoRotate overall={concept.preview.overall_mm} />
                : <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-caption text-muted-foreground">컨셉이 없으면 오른쪽에 치수를 직접 넣어 시작하세요.</p>}
            </div>
            <div className="space-y-3">
              {shells.length > 1 && (
                <Field label="설계할 외장 부품" hint={`외장 부품 ${shells.length}개 — 부품마다 스크립트·도면을 따로 만듭니다`}>
                  <select value={partId || ''} onChange={(e) => choosePart(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-label" aria-label="설계할 외장 부품">
                    {shells.map((p) => <option key={p.id} value={p.id}>{p.name} ({Math.round(p.size.x)}×{Math.round(p.size.z ?? p.size.x)}×{Math.round(p.size.y)})</option>)}
                  </select>
                </Field>
              )}
              <Field label="몸통 모양">
                <select value={params.shape} onChange={(e) => setParam('shape', e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-label">
                  <option value="box">사각 (모서리 둥글게)</option>
                  <option value="round">원통</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                {NUMS.filter(([k]) => !(params.shape === 'round' && (k === 'depth' || k === 'corner'))).map(([k, l]) => (
                  <Field key={k} label={`${k === 'width' && params.shape === 'round' ? '지름' : l} mm`}>
                    <Input type="number" min={0} step="0.5" value={params[k]} onChange={(e) => setParam(k, Math.max(0, Number(e.target.value) || 0))} className="h-9 tabular-nums" />
                  </Field>
                ))}
              </div>
            </div>
          </div>
          {allCuts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-label font-semibold">구멍·개구부 <span className="font-normal text-caption text-muted-foreground">이 부품 표면에 붙은 버튼·표시등·커넥터·뚜껑 자리</span></p>
              <div className="flex flex-wrap gap-2">
                {allCuts.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-caption">
                    <Checkbox checked={!skip.has(c.id)} onCheckedChange={(v) => setParam('skip_cutouts', v ? [...skip].filter((x) => x !== c.id) : [...skip, c.id])} />
                    {c.name} <span className="tabular-nums text-muted-foreground">{({ top: '윗면', front: '앞면', back: '뒷면' })[c.face]} · {sizeText(c)} · {posText(c)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="flex items-start gap-1.5 text-micro text-muted-foreground"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />좌표는 mm, Z 가 위, 앞쪽이 −Y, 윗면 중심이 원점입니다. 바꾼 치수는 ‘설정 저장’을 눌러야 남습니다.</p>
        </Card>

        <div className="space-y-2">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <button key={o.key} type="button" onClick={() => setOption(o.key)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${option === o.key ? 'border-primary bg-primary/5' : 'bg-card hover:border-primary/40'}`}>
                <span className={`flex items-center gap-2 text-label font-semibold ${option === o.key ? 'text-primary' : ''}`}><Icon className="w-4 h-4" /><span className="rounded bg-muted px-1.5 py-0.5 text-micro font-medium text-muted-foreground">{o.n}</span>{o.label}</span>
                <span className="mt-0.5 block text-caption text-muted-foreground">{o.hint}</span>
              </button>
            );
          })}
          <div className="rounded-xl bg-secondary px-4 py-3 text-caption text-muted-foreground space-y-1">
            <p>SolidCraft 는 오픈소스 파라메트릭 CAD 입니다 (데스크톱·웹·CLI). 아직 0.x 버전이라 복잡한 형상은 상용 CAD 와 함께 쓰세요.</p>
            <p>어느 방식이든 결과 STEP 을 아래에 올리면 3D 검토·부품표·금형 검토로 이어집니다.</p>
          </div>
        </div>
      </div>

      <Card title="설계 도면" icon={Ruler} tag={`A3 · ${drawing.scale} · 3각법`}
        actions={<>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => exportDrawing('svg')}>{busy === 'svg' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}SVG</Button>
          <Button size="sm" disabled={!!busy} onClick={() => exportDrawing('pdf')}>{busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}PDF 내려받기</Button>
        </>}>
        <p className="text-caption text-muted-foreground">위 치수와 구멍·개구부로 만든 {params.part_name || '외장'} 외형 도면입니다 (평면도·정면도·우측면도·등각도, 치수, 구멍 표, 주기, 표제란). 치수를 바꾸면 바로 다시 그려지고, 금형 업체 견적·협의용 초안으로 쓸 수 있습니다. 살두께·리브·보스 같은 내부 형상은 CAD(STEP)가 기준입니다.</p>
        {drawingUrl && <img src={drawingUrl} alt={`${params.part_name || '외장'} 설계 도면`} className="w-full rounded-lg border bg-white" />}
      </Card>

      {option === 'files' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="컨셉 3D 를 SolidCraft 로 보내기" icon={FileDown}>
            <p className="text-caption text-muted-foreground">컨셉의 기본 도형 조립을 메시로 내보냅니다. SolidCraft 에서 열어 비율 참고용으로 두고 그 위에 솔리드를 그리세요. (메시는 편집 가능한 솔리드가 아닙니다)</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!parts.length || !!busy} onClick={() => exportModel('stl')}>{busy === 'stl' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}STL (Z 위, 통짜)</Button>
              <Button size="sm" variant="outline" disabled={!parts.length || !!busy} onClick={() => exportModel('glb')}>{busy === 'glb' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}GLB (부품별 이름)</Button>
              <DownloadButton text={script} name={`${outBase}.json`} type="application/json" label="외장 출발 스크립트" />
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-caption">
              <li>SolidCraft 에서 STL·GLB 를 열어 크기·비율을 확인합니다.</li>
              <li>외장을 솔리드로 그리고 매개변수(폭·깊이·높이·살두께)로 치수를 묶습니다.</li>
              <li>파일 → STEP 내보내기 후 오른쪽에 올립니다.</li>
            </ol>
          </Card>
          <div className="space-y-2 min-w-0">
            <ProtoFiles project={project} user={user} categories={['MODEL3D', 'CAD']} onChanged={onSaved} title="STEP 되받기 (3D 모델·CAD 파일)" />
            <Button size="sm" variant="outline" asChild><Link to={`/prototypes/${project.id}?tab=viewer`}><Eye className="w-4 h-4" />올린 STEP 을 3D 검토에서 열기</Link></Button>
          </div>
        </div>
      )}

      {option === 'ai' && (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card title="준비 (PC 에서 한 번)" icon={Bot}>
            <ol className="list-decimal space-y-2 pl-5 text-caption">
              <li>PC 에 SolidCraft 와 Claude Code 를 설치합니다.</li>
              <li>
                {MCP_SETUP.map(([l, c]) => <div key={c} className="mt-1"><CommandLine label={l} cmd={c} /></div>)}
              </li>
              <li>오른쪽 작업 지시서와 외장 스크립트를 같은 폴더에 받습니다.</li>
              <li>그 폴더에서 Claude Code 를 열고 지시서를 붙여 넣습니다. AI 가 명령 인자를 확인하며 모델링하고 STEP 을 내보냅니다.</li>
              <li>만들어진 STEP 을 방식 1 의 ‘STEP 되받기’에 올립니다.</li>
            </ol>
            <p className="text-micro text-muted-foreground">MCP 서버는 사용자 PC 에서 돕니다. 이 웹 앱 서버에서는 SolidCraft 를 실행하지 않습니다.</p>
          </Card>
          <Card title="AI 작업 지시서" actions={<><CopyButton text={brief} label="지시서 복사" /><DownloadButton text={brief} name={`${outBase}-brief.md`} type="text/markdown" label="지시서" /><DownloadButton text={script} name={`${outBase}.json`} type="application/json" label="스크립트" /></>}>
            <CodeView text={brief} maxH="max-h-[520px]" />
          </Card>
        </div>
      )}

      {option === 'script' && (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card title="스크립트 실행" icon={FileCode2}>
            <p className="text-caption text-muted-foreground">위 치수로 외장 몸통 → 세로 모서리 R → 윗면 조작부 자리까지 만드는 명령 목록입니다. 치수를 바꾸면 스크립트도 바로 바뀝니다.</p>
            <CommandLine label="스크립트를 받은 폴더에서" cmd={cliCommand(outBase)} />
            <ul className="list-disc space-y-1 pl-5 text-caption text-muted-foreground">
              <li>SolidCraft 공개 예제에서 확인한 명령만 씁니다: 매개변수, 스케치(선·원), 돌출(추가·자르기), 필렛.</li>
              <li>속 비우기(shell)·보스·리브·파팅은 방식 2 (AI 작업)나 설계자가 이어서 넣습니다.</li>
              <li>처음 쓰는 SolidCraft 버전이면 한 번 실행해 모양을 확인하세요.</li>
            </ul>
          </Card>
          <Card title={`${outBase}.json`} actions={<><CopyButton text={script} /><DownloadButton text={script} name={`${outBase}.json`} type="application/json" variant="default" /></>}>
            <CodeView text={script} maxH="max-h-[520px]" />
          </Card>
        </div>
      )}
    </div>
  );
}
