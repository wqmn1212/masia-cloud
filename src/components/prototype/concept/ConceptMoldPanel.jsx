import React, { useState } from 'react';
import { Factory, Loader2, Play, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConceptMoldResult from '@/components/prototype/concept/ConceptMoldResult';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';
import { MOLD_MATERIALS } from '@/lib/moldReview/materials';
import { AI_READABLE_FILE, CONCEPT_DISCLAIMER, TEXTURE_DEPTHS } from '@/lib/concept';

const NUMS = [['length_mm', '가로 (mm)'], ['width_mm', '세로 (mm)'], ['height_mm', '높이 (mm)'], ['wall_mm', '기본 살 두께 (mm)'], ['wall_max_mm', '가장 두꺼운 곳 (mm)'], ['wall_min_mm', '가장 얇은 곳 (mm)'], ['rib_mm', '리브 두께 (mm)'], ['draft_deg', '빼기 구배 (°)']];

// 사출·금형 검토: 재질·치수·살 두께·구조 → 규칙 계산 + AI 위치별 검토 초안
export default function ConceptMoldPanel({ concept, project, onChanged, highlightId, onHighlight }) {
  const m = concept.mold;
  const o = concept.preview?.overall_mm;
  const [form, setForm] = useState(() => (m?.inputs ? { ...m.inputs, texture_depth_mm: String(m.inputs.texture_depth_mm || 0), file_ids: (m.files || []).map((f) => f.id) } : {
    material: 'ABS', length_mm: o ? Math.max(o.x, o.z) : '', width_mm: o ? Math.min(o.x, o.z) : '', height_mm: o?.y ?? '', wall_mm: '', wall_max_mm: '', wall_min_mm: '', rib_mm: '', draft_deg: '',
    texture_depth_mm: '0', undercuts: '', structure: '', conditions: '', file_ids: [],
  }));
  const [editing, setEditing] = useState(!m);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const drawings = (project.files || []).filter((f) => AI_READABLE_FILE.test(f.name || '') && ['MOLD_DRAWING', 'DRAWING', 'PHOTO', 'REFERENCE'].includes(f.category));
  const toggleFile = (id) => setForm({ ...form, file_ids: form.file_ids.includes(id) ? form.file_ids.filter((x) => x !== id) : [...form.file_ids, id] });

  const run = async () => {
    setBusy('사출·금형 검토 초안을 만드는 중… (1~2분)'); setError('');
    try {
      const res = await runConcept('mold', { concept_id: concept.id, inputs: form }, () => setBusy('시간이 걸리고 있습니다. 결과를 확인하는 중…'));
      setEditing(false);
      onChanged(res.concept);
    } catch (e) { setError(errorText(e)); }
    setBusy('');
  };

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4 min-w-0">
      <div className="flex items-center gap-2">
        <Factory className="w-5 h-5 text-primary" />
        <p className="text-title font-semibold mr-auto">사출·금형 검토</p>
        {m && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>조건 바꿔 다시 실행</Button>}
      </div>
      <p className="flex items-start gap-1.5 text-caption text-muted-foreground"><Info className="w-4 h-4 shrink-0 mt-0.5" />{CONCEPT_DISCLAIMER.mold}</p>

      {editing && (
        <div className="space-y-3 rounded-xl bg-secondary p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>재질</Label>
              <Select value={form.material} onValueChange={(v) => setForm({ ...form, material: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MOLD_MATERIALS.map((x) => <SelectItem key={x.key} value={x.key}>{x.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>표면</Label>
              <Select value={form.texture_depth_mm} onValueChange={(v) => setForm({ ...form, texture_depth_mm: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TEXTURE_DEPTHS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {NUMS.map(([k, label]) => <div key={k} className="space-y-1.5"><Label>{label}</Label><Input type="number" value={form[k] ?? ''} onChange={set(k)} placeholder="모르면 비움" /></div>)}
          </div>
          <div className="space-y-1.5"><Label>언더컷 (선택)</Label><Input value={form.undercuts || ''} onChange={set('undercuts')} placeholder="예: 측면 스냅 후크 2곳, 옆면 USB 구멍" /></div>
          <div className="space-y-1.5"><Label>구조 설명</Label><Textarea rows={3} value={form.structure || ''} onChange={set('structure')} placeholder="예: 상·하 2피스 케이스, 내부 보스 4개에 나사 체결, 상단 그릴 슬롯" /></div>
          <div className="space-y-1.5"><Label>제조 조건 (선택)</Label><Input value={form.conditions || ''} onChange={set('conditions')} placeholder="예: 2캐비티, 연 5만 개, 외관면 게이트 자국 불가" /></div>
          {drawings.length > 0 && (
            <div className="space-y-1.5">
              <Label>함께 볼 도면 (최대 4개)</Label>
              {drawings.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-label"><Checkbox checked={form.file_ids.includes(f.id)} onCheckedChange={() => toggleFile(f.id)} /><span className="truncate">{f.name}</span></label>
              ))}
            </div>
          )}
          <p className="text-caption text-muted-foreground">비워 둔 치수는 ‘미확인’으로 표시되고 그 항목은 판단하지 않습니다.</p>
          {error && <p className="text-caption text-destructive">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {busy && <p className="text-caption text-muted-foreground">{busy}</p>}
            {m && <Button variant="ghost" onClick={() => setEditing(false)} disabled={!!busy}>취소</Button>}
            <Button onClick={run} disabled={!!busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}사출·금형 검토 실행</Button>
          </div>
        </div>
      )}
      {m && !editing && <ConceptMoldResult mold={m} parts={concept.preview?.parts} highlightId={highlightId} onHighlight={onHighlight} />}
    </div>
  );
}