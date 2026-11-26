import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLeaveGuard } from '@/lib/useLeaveGuard';
import { parseOpj, encodeNativeText, downloadNativeFile } from '@/lib/pcbArt/opj';
import OpjTreeNode from '@/components/pcb/OpjTreeNode';
import OpjProperties from '@/components/pcb/OpjProperties';
import SourceViewer from '@/components/pcb/SourceViewer';

export default function OpjViewer({ file, files, onSave, onDirtyChange }) {
  const [text, setText] = useState(file.text), [clean, setClean] = useState(file.text);
  const [selected, setSelected] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const parsed = useMemo(() => parseOpj(text), [text]);
  const node = parsed.nodes.find(n => n.id === selected) || parsed.root;
  const dirty = text !== clean;
  useLeaveGuard(dirty, { message: '수정한 OPJ 프로젝트를 아직 저장하거나 내려받지 않았습니다. 떠날까요?' });
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const download = () => { downloadNativeFile(encodeNativeText(file, text), file.name); setClean(text); };
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave(encodeNativeText(file, text), file.name); setClean(text); }
    catch (e) { setError(e?.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-title font-semibold">OrCAD 프로젝트 뷰어{dirty ? ' · 수정됨' : ''}</h2><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadNativeFile(file.bytes, file.name)}>업로드 원본 받기</Button><Button onClick={download} disabled={busy}><Download />수정본 .opj 다운로드</Button>{onSave && <Button variant="outline" disabled={busy || !dirty} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <Save />}시제품에 수정본 저장</Button>}</div></div>
        <p className="mt-2 text-caption text-muted-foreground">.opj에는 프로젝트 구조와 참조 경로가 들어 있습니다. 회로도·부품·배선 그림은 별도 .dsn 또는 PCB 설계 파일에 있으며 이 화면에서 회로 편집은 지원하지 않습니다.</p>
        <p className="mt-1 text-micro text-muted-foreground">왼쪽 항목을 선택해 값을 수정하세요. 내려받을 때 원래 .opj 형식·인코딩을 유지하며, 업로드 원본은 덮어쓰지 않습니다.</p>
        {error && <p role="alert" className="mt-2 text-caption text-destructive">{error}</p>}
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-xl border bg-card p-4"><h2 className="mb-2 text-label font-semibold">프로젝트 구조</h2><ul className="max-h-[60vh] overflow-auto text-caption"><OpjTreeNode node={parsed.root} selected={node.id} onSelect={setSelected} /></ul></section>
        <OpjProperties key={node.id} node={node} text={text} onChange={setText} files={files} />
      </div>
      <SourceViewer title="프로젝트 원문" text={text} />
    </div>
  );
}