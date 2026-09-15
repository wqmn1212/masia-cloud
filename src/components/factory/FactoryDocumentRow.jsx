import { useRef } from 'react';
import { ArrowUp, ArrowDown, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import FileVisibilitySwitch from '@/components/files/FileVisibilitySwitch';

export default function FactoryDocumentRow({ doc, index, count, canManage, busy, onAction }) {
  const input = useRef(null);
  return <div className="group flex items-center gap-2 flex-wrap border-t py-2">
    <div className="min-w-0 flex-1"><p className="text-sm truncate" title={doc.file_name}>{doc.file_name}</p><p className="text-xs text-muted-foreground">{doc.uploader_name || '등록자 미기재'} · {doc.client_visible === true ? '연결된 고객 카드에 공개' : '비공개'}</p></div>
    <div className="flex items-center gap-0.5">
      <FileVisibilitySwitch visible={doc.client_visible} disabled={!canManage || busy} onChange={() => onAction({ action: 'visibility', doc })} />
      <DocumentOpenButton document={doc} kind="factory" />
      {canManage && <>
        <Button size="icon" variant="ghost" disabled={busy || index === 0} title="위로" onClick={() => onAction({ action: 'move', doc, direction: -1 })}><ArrowUp /></Button>
        <Button size="icon" variant="ghost" disabled={busy || index === count - 1} title="아래로" onClick={() => onAction({ action: 'move', doc, direction: 1 })}><ArrowDown /></Button>
        <Button size="icon" variant="ghost" disabled={busy} title="원본 파일 교체 (연결된 모든 카드에 반영)" onClick={() => input.current?.click()}><RefreshCw /></Button>
        <Button size="icon" variant="ghost" disabled={busy} title="삭제" onClick={() => { if (window.confirm('원본 자료를 삭제하면 연결된 모든 카드에서 사라집니다. 삭제할까요?')) onAction({ action: 'delete', doc }); }}><Trash2 /></Button>
        <input type="file" className="hidden" ref={input} onChange={e => { const file = e.target.files?.[0]; if (file && window.confirm('이 자료를 참조하는 모든 카드에 새 원본이 반영됩니다. 교체할까요?')) onAction({ action: 'replace', doc, files: [file] }); e.target.value = ''; }} />
      </>}
    </div>
  </div>;
}