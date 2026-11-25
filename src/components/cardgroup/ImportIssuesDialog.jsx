import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SEVERITY, ISSUE_STATUS, ISSUE_SOURCE, callGroup } from '@/lib/cardGroup';

// 엑셀 이슈 가져오기: 「문제점」(또는 「문제」) 칸이 있는 표를 찾아 미리 보여 주고, 확인하면 새 줄만 등록한다
export default function ImportIssuesDialog({ group, cards, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cardId, setCardId] = useState(group.main_card_id || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const ref = useRef(null);

  const pickFile = async (f) => {
    if (!f) return;
    setBusy('read'); setError(''); setPreview(null); setResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      const p = await callGroup('import_preview', { group_id: group.id, file_url, file_name: f.name });
      setFile({ url: file_url, name: f.name }); setPreview(p);
    } catch (e) { setError(e.message); }
    setBusy('');
  };
  const apply = async () => {
    setBusy('apply'); setError('');
    try {
      const r = await callGroup('import_apply', { group_id: group.id, file_url: file.url, file_name: file.name, card_id: cardId });
      setResult(r); onDone?.();
    } catch (e) { setError(e.message); }
    setBusy('');
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>엑셀에서 이슈 가져오기</DialogTitle></DialogHeader>
        <p className="text-label text-muted-foreground">조립 문제점 관리표, 작업지도서 검토표처럼 <b>문제점</b>(또는 <b>문제</b>) 칸이 있는 표를 읽습니다. 부위·원인·업체·중요도·상태·담당·목표일 칸이 있으면 함께 가져오고, 이미 등록한 줄은 건너뜁니다. 엑셀 칸 안의 사진은 옮겨지지 않으니 이슈를 열어 사진을 넣어 주세요.</p>
        <button type="button" onClick={() => ref.current?.click()} disabled={!!busy}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-body text-muted-foreground hover:border-primary hover:text-primary">
          {busy === 'read' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
          {file ? file.name : '엑셀 파일을 고르거나 끌어다 놓으세요 (.xlsx)'}
        </button>
        <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />

        {preview && !result && (
          <div className="space-y-3">
            <p className="text-body">
              {preview.sheets.map((s) => `「${s.name}」 ${s.count}줄 (${ISSUE_SOURCE[s.source]})`).join(' · ') || '읽은 표 없음'} — <b>새 이슈 {preview.new_count}건</b>
              {preview.items.length - preview.new_count > 0 && <span className="text-muted-foreground"> · 이미 있는 {preview.items.length - preview.new_count}건 건너뜀</span>}
            </p>
            {preview.warnings?.length > 0 && <ul className="list-disc pl-5 text-caption text-warning-text">{preview.warnings.slice(0, 6).map((w) => <li key={w}>{w}</li>)}</ul>}
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <table className="w-full text-label">
                <thead className="sticky top-0 bg-muted text-left text-caption"><tr><th className="p-2">부위</th><th className="p-2">문제점</th><th className="p-2">중요도</th><th className="p-2">상태</th></tr></thead>
                <tbody className="divide-y">
                  {preview.items.map((it) => (
                    <tr key={it.import_key} className={it.duplicate ? 'text-muted-foreground line-through' : ''}>
                      <td className="p-2 align-top">{it.area}</td>
                      <td className="p-2 align-top">{it.title}</td>
                      <td className="p-2 align-top"><span className={`rounded px-1.5 py-0.5 text-micro font-semibold ${SEVERITY[it.severity]?.cls}`}>{SEVERITY[it.severity]?.label}</span></td>
                      <td className="p-2 align-top whitespace-nowrap">{ISSUE_STATUS[it.status]?.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="block text-label font-medium">관련 카드
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-body" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                <option value="">그룹 전체</option>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
          </div>
        )}
        {result && <p className="rounded-lg bg-success/10 p-3 text-body text-success-text">이슈 {result.created}건을 등록했습니다{result.skipped ? ` (이미 있는 ${result.skipped}건은 건너뜀)` : ''}.</p>}
        {error && <p className="text-label text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          {preview && !result && <Button onClick={apply} disabled={!!busy || !preview.new_count}>{busy === 'apply' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{preview.new_count}건 등록</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
