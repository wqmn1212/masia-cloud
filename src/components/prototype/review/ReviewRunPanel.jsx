import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { REVIEW_SECTIONS, VERSION_STATUS } from '@/lib/prototype';
import { runReview, errorText } from '@/lib/prototypeApi';

const AREA_OPTIONS = REVIEW_SECTIONS.map((s) => ({ key: s.area, label: s.title, category: s.category }));

// 검토 범위·파일·대조 설계 버전을 골라 AI 검토를 실행한다
export default function ReviewRunPanel({ project, versions, onDone }) {
  const files = (project.files || []).filter((f) => REVIEW_SECTIONS.some((s) => s.category === f.category));
  const [areas, setAreas] = useState(['CIRCUIT', 'MOLD', 'BOM']);
  const [picked, setPicked] = useState([]);
  const [versionId, setVersionId] = useState(project.current_version_id || '');
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState('');
  const fileKey = files.map((f) => f.id).join(',');
  useEffect(() => { setPicked(files.map((f) => f.id)); }, [fileKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const run = async () => {
    setBusy('run');
    try {
      const res = await runReview({ project_id: project.id, areas, file_ids: picked, version_id: versionId || null, instruction }, () => setBusy('wait'));
      setInstruction('');
      toast({ title: 'AI 설계 검토를 마쳤습니다', description: `지적 사항 ${res.review.findings?.length || 0}건` });
      onDone(res.review);
    } catch (e) { toast({ title: '검토하지 못했습니다', description: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  return (
    <div className="rounded-xl border border-chart-4/30 bg-chart-4/5 p-5 space-y-4">
      <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-chart-4" /><p className="text-title font-semibold">AI 설계 검토</p></div>
      <div className="space-y-1.5">
        <Label>검토 범위</Label>
        <div className="flex flex-wrap gap-3">{AREA_OPTIONS.map((a) => <label key={a.key} className="flex items-center gap-1.5 text-label"><Checkbox checked={areas.includes(a.key)} onCheckedChange={() => toggle(areas, setAreas, a.key)} />{a.label}</label>)}</div>
      </div>
      <div className="space-y-1.5">
        <Label>검토할 파일 {picked.length}/{files.length}</Label>
        {files.length === 0 ? <p className="text-caption text-muted-foreground">왼쪽에서 회로도·사출 도면·부품표를 먼저 등록하세요.</p> : (
          <div className="max-h-40 overflow-y-auto space-y-1">{files.map((f) => <label key={f.id} className="flex items-center gap-1.5 text-label"><Checkbox checked={picked.includes(f.id)} onCheckedChange={() => toggle(picked, setPicked, f.id)} /><span className="truncate">{f.name}</span></label>)}</div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>함께 대조할 설계 버전</Label>
        <select className="h-9 w-full rounded-md border bg-card px-2 text-body" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          <option value="">대조하지 않음</option>
          {versions.map((v) => <option key={v.id} value={v.id}>v{v.version_no} · {VERSION_STATUS[v.status]?.label || v.status}{v.id === project.current_version_id ? ' (현재)' : ''}</option>)}
        </select>
      </div>
      <Textarea rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="특히 볼 부분 (선택) — 예: 12V→3.3V 레귤레이터 발열, 하우징 스냅핏 강도" disabled={!!busy} />
      <Button className="w-full" onClick={run} disabled={!!busy || !areas.length || (!picked.length && !versionId)}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy === 'wait' ? '마무리 확인 중… (최대 3분)' : busy ? '검토 중… (1~3분)' : 'AI 검토 시작'}
      </Button>
      <p className="text-micro text-muted-foreground">이미지·PDF·텍스트·엑셀만 읽습니다. 고급 모델을 써서 크레딧이 더 들며, 결과는 사람의 최종 확인이 필요한 검토 의견입니다.</p>
    </div>
  );
}