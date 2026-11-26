import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Save, Search, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLeaveGuard } from '@/lib/useLeaveGuard';
import { downloadNativeFile, encodeNativeText } from '@/lib/pcbArt/opj';
import { parsePads, padsHeader, patchPadsToken } from '@/lib/pcbArt/pads';
import PadsSectionList from '@/components/pcb/PadsSectionList';
import PadsRecordTable from '@/components/pcb/PadsRecordTable';
import PadsRecordEditor from '@/components/pcb/PadsRecordEditor';
import SourceViewer from '@/components/pcb/SourceViewer';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

export default function PadsViewer({ file, onSave, onDirtyChange }) {
  const [text, setText] = useState(file.text);
  const [clean, setClean] = useState(file.text);
  const [history, setHistory] = useState([]);
  const [section, setSection] = useState(() => Math.max(0, parsePads(file.text).sections.findIndex(s => s.records.length)));
  const [sel, setSel] = useState(null);
  const [query, setQuery] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const lastPush = useRef(0);
  const parsed = useMemo(() => parsePads(text), [text]);
  const header = useMemo(() => padsHeader(text), [text]);
  const dirty = text !== clean;
  const ext = (file.name.match(/\.[^.]+$/) || ['.asc'])[0];
  const base = file.name.slice(0, file.name.length - ext.length) || 'board';

  useLeaveGuard(dirty, { message: '수정한 PADS 파일을 아직 저장하거나 내려받지 않았습니다. 떠날까요?' });
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const apply = (next) => {
    const now = Date.now();
    if (now - lastPush.current > 900) { setHistory(h => [...h.slice(-49), text]); lastPush.current = now; }
    setText(next);
  };
  const undo = () => {
    if (!history.length) return;
    setText(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setFieldError('');
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const out = [];
      parsed.sections.forEach((sec, s) => sec.records.forEach((record, r) => {
        if (record.tokens.some(t => t.value.toLowerCase().includes(q))) out.push({ s, r, record });
      }));
      return out;
    }
    const sec = parsed.sections[section];
    return sec ? sec.records.map((record, r) => ({ s: section, r, record })) : [];
  }, [parsed, section, query]);

  const selected = sel ? parsed.sections[sel.s]?.records[sel.r] : null;

  const patch = (index, value) => {
    if (!selected) return;
    try { apply(patchPadsToken(text, selected.tokens[index], value)); setFieldError(''); }
    catch (e) { setFieldError(e.message); }
  };
  const download = () => { downloadNativeFile(encodeNativeText(file, text), `${base}-edited${ext}`); setClean(text); };
  const save = async () => {
    setBusy(true); setSaveError('');
    try { await onSave(encodeNativeText(file, text), `${base}-${stamp()}${ext}`); setClean(text); }
    catch (e) { setSaveError(e?.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title font-semibold">PADS ASCII 뷰어{dirty ? ' · 수정됨' : ''}</h2>
            <p className="mt-1 flex flex-wrap gap-1.5 text-micro text-muted-foreground">
              {[header.product, header.version, header.units && `${header.units} 단위`, `${parsed.sections.length}개 구역`, `${parsed.records}개 기록`].filter(Boolean).map((v, i) => <span key={i} className="rounded bg-secondary px-2 py-0.5">{v}</span>)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => downloadNativeFile(file.bytes, file.name)}>업로드 원본 받기</Button>
            <Button variant="outline" onClick={undo} disabled={!history.length}><Undo2 />되돌리기</Button>
            <Button onClick={download}><Download />수정본 {ext} 다운로드</Button>
            {onSave && <Button variant="outline" disabled={busy || !dirty} onClick={save}>{busy ? <Loader2 className="animate-spin" /> : <Save />}시제품에 수정본 저장</Button>}
          </div>
        </div>
        <p className="mt-2 text-caption text-muted-foreground">구역과 기록을 표로 확인하고 필드 값을 고칩니다. 좌표 필드의 의미는 PADS 버전마다 달라 회로를 추측해 그리지 않으며, 회로도 편집은 PADS에서 하세요.</p>
        {saveError && <p role="alert" className="mt-2 text-caption text-destructive">{saveError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="기록 검색" className="pl-8" value={query} onChange={e => setQuery(e.target.value)} placeholder="부품·넷·좌표 값으로 기록 찾기" />
        </div>
        {query && <Button variant="ghost" onClick={() => setQuery('')}>검색 지우기</Button>}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          <p className="text-label font-semibold">구역</p>
          <PadsSectionList sections={parsed.sections} active={section} onSelect={(i) => { setSection(i); setSel(null); setQuery(''); }} />
        </div>
        <div className="space-y-3">
          <PadsRecordTable rows={rows} sections={parsed.sections} sel={sel} onSelect={setSel} total={rows.length} />
          <PadsRecordEditor record={selected} section={sel ? parsed.sections[sel.s]?.label : ''} error={fieldError} onPatch={patch} />
        </div>
      </div>

      <SourceViewer title="PADS ASCII 원문" text={text} />
    </div>
  );
}