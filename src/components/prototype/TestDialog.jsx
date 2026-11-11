import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import RowsEditor from '@/components/prototype/RowsEditor';
import { TEST_STATUS } from '@/lib/prototype';
import { actorName, errorText, addTestEvidence, removeTestEvidence, checkProtoFileSize, PROTO_FILE_MAX_LABEL } from '@/lib/prototypeApi';

const MEAS_COLS = [{ key: 'name', label: '항목', width: 140 }, { key: 'value', label: '측정값', width: 90 }, { key: 'unit', label: '단위', width: 60 }, { key: 'spec', label: '기준', width: 120 }];
const TEXTS = [['conditions', '시험 조건'], ['procedure', '절차'], ['expected', '합격 기준'], ['result_note', '결과 메모'], ['defects', '불량·문제'], ['repro_steps', '재현 절차']];

// 시험 계획 만들기·결과 기록 (test 없으면 새 시험)
export default function TestDialog({ open, onOpenChange, project, version, test, retestOf, user, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  // 새로 고른 증거 파일은 저장 때까지 화면에만 둔다 (저장 후 서버가 비공개 저장소에 올려 시험에 붙인다)
  const [pending, setPending] = useState([]);
  const input = useRef(null);
  useEffect(() => {
    if (!open) return;
    setForm(test ? { ...test } : retestOf
      ? { title: `${retestOf.title} (재시험)`, conditions: retestOf.conditions, procedure: retestOf.procedure, expected: retestOf.expected, measurements: (retestOf.measurements || []).map((m) => ({ ...m, value: '' })), status: 'PLANNED', evidence: [] }
      : { title: '', status: 'PLANNED', measurements: [], evidence: [] });
    setPending([]);
  }, [open, test, retestOf]);

  const addEvidence = (files) => {
    try { checkProtoFileSize(files); setPending((p) => [...p, ...files]); }
    catch (e) { window.alert(errorText(e)); }
    if (input.current) input.current.value = '';
  };

  const save = async () => {
    if (!form.title?.trim()) { window.alert('시험 이름을 입력해 주세요'); return; }
    setSaving(true);
    try {
      const recorded = form.status !== 'PLANNED';
      const data = {
        title: form.title.trim(), status: form.status, measurements: form.measurements || [], log_text: form.log_text || '',
        ...Object.fromEntries(TEXTS.map(([k]) => [k, form[k] || ''])),
        ...(recorded && !test?.tested_at ? { tested_at: new Date().toISOString(), tester_name: actorName(user) } : {}),
      };
      // 증거 파일(evidence)은 여기서 쓰지 않는다 — 서버가 올리고 붙이고 뗀다
      const saved = test
        ? await base44.entities.ProtoTest.update(test.id, data)
        : await base44.entities.ProtoTest.create({ ...data, evidence: [], tenant_id: project.tenant_id, project_id: project.id, version_id: version?.id || null, version_no: version?.version_no || null, retest_of: retestOf?.id || null });
      const testId = test?.id || saved.id;
      const kept = new Set((form.evidence || []).map((f) => f.id));
      // 시험 기록은 이미 저장됐다 — 첨부가 실패해도 다시 저장해 시험이 두 번 생기지 않게 알리고 닫는다
      try {
        for (const f of (test?.evidence || []).filter((x) => !kept.has(x.id))) await removeTestEvidence(project.id, testId, f.id);
        if (pending.length) await addTestEvidence(project.id, testId, pending);
      } catch (e) { window.alert(`시험은 저장했지만 첨부 파일을 처리하지 못했습니다: ${errorText(e)}`); }
      onSaved(form.status);
    } catch (e) { window.alert(errorText(e)); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-title">{test ? '시험 결과 기록' : retestOf ? '재시험 계획' : '새 시험 계획'}{version ? ` · v${version.version_no}` : ''}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <div className="space-y-1.5"><Label>시험 이름</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 히터 온도 제어 정확도 (60℃ 설정)" /></div>
            <div className="space-y-1.5"><Label>판정</Label>
              <select className="h-9 w-full rounded-md border bg-transparent px-2 text-body" value={form.status || 'PLANNED'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(TEST_STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {TEXTS.map(([k, label]) => <div key={k} className="space-y-1.5"><Label>{label}</Label><Textarea rows={3} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>)}
          </div>
          <div className="space-y-1.5"><Label>측정값</Label><RowsEditor rows={form.measurements} columns={MEAS_COLS} onChange={(measurements) => setForm({ ...form, measurements })} addLabel="측정 항목 추가" /></div>
          <div className="space-y-1.5"><Label>로그</Label><Textarea rows={4} className="font-mono" value={form.log_text || ''} onChange={(e) => setForm({ ...form, log_text: e.target.value })} placeholder="시리얼·디버그 로그 일부" /></div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>사진·영상·자료</Label>
              <input ref={input} type="file" multiple className="hidden" onChange={(e) => addEvidence(Array.from(e.target.files || []))} />
              <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={saving}><Paperclip className="w-4 h-4" />첨부</Button>
              <span className="text-caption text-muted-foreground">파일당 {PROTO_FILE_MAX_LABEL} 이하 · 저장할 때 올라갑니다</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(form.evidence || []).map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-caption">{f.name}
                  <button type="button" onClick={() => setForm({ ...form, evidence: form.evidence.filter((x) => x.id !== f.id) })}><X className="w-3 h-3" /></button>
                </span>
              ))}
              {pending.map((f, i) => (
                <span key={`new-${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-caption">{f.name}
                  <button type="button" disabled={saving} onClick={() => setPending(pending.filter((x) => x !== f))} aria-label={`${f.name} 빼기`}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}