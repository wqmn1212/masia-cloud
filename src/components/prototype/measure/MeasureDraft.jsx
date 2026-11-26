import React, { useState } from 'react';
import { Save, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fmtMeasure } from '@/lib/measure3d';

// 방금 찍은 측정 — 설계값·허용 오차를 넣으면 바로 일치/차이를 판정한다
export default function MeasureDraft({ draft, partNames = [], saving, onSave, onCancel }) {
  const [label, setLabel] = useState('');
  const [design, setDesign] = useState('');
  const [tolerance, setTolerance] = useState(String(draft.unit === 'deg' ? 1 : 0.5));
  const [note, setNote] = useState('');

  const designValue = design === '' ? null : Number(design);
  const tolValue = tolerance === '' ? 0 : Number(tolerance);
  const diff = designValue == null ? null : Number((draft.value - designValue).toFixed(2));
  const ok = diff != null && Math.abs(diff) <= tolValue;
  const unitLabel = draft.unit === 'deg' ? '도(°)' : 'mm';

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-caption font-semibold text-primary">{draft.kind === 'ANGLE' ? '각도 측정' : '거리 측정'}</p>
          <p className="text-title font-bold">{fmtMeasure(draft.value, draft.unit)}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel}><RotateCcw className="h-4 w-4" />다시 찍기</Button>
      </div>
      {partNames.length > 0 && <p className="text-micro text-muted-foreground">찍은 부품: {partNames.join(', ')}</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="block text-micro text-muted-foreground">설계값 ({unitLabel})</span>
          <Input value={design} onChange={(e) => setDesign(e.target.value)} inputMode="decimal" placeholder="예: 42.0" className="h-8 text-body" />
        </label>
        <label className="space-y-1">
          <span className="block text-micro text-muted-foreground">허용 오차 (±)</span>
          <Input value={tolerance} onChange={(e) => setTolerance(e.target.value)} inputMode="decimal" className="h-8 text-body" />
        </label>
      </div>
      {diff != null && (
        <p className={`flex items-center gap-1 text-caption ${ok ? 'text-success-text' : 'text-destructive'}`}>
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          차이 {diff > 0 ? '+' : ''}{diff}{draft.unit === 'deg' ? '°' : ' mm'} · {ok ? '설계값과 일치합니다' : '설계값과 차이가 있습니다 (수정 필요)'}
        </p>
      )}
      <label className="block space-y-1">
        <span className="block text-micro text-muted-foreground">측정 이름</span>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={draft.kind === 'ANGLE' ? '예: 커버 개방 각도' : '예: 케이스 폭'} className="h-8 text-body" />
      </label>
      <label className="block space-y-1">
        <span className="block text-micro text-muted-foreground">메모 (선택)</span>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="수정 사항·확인 내용" className="h-8 text-body" />
      </label>
      <Button
        size="sm"
        className="w-full"
        disabled={saving}
        onClick={() => onSave({ label, designValue, tolerance: tolValue, note })}
      >
        <Save className="h-4 w-4" />{saving ? '저장 중…' : '측정 저장'}
      </Button>
      <p className="text-micro text-muted-foreground">저장하면 이 시제품을 보고 있는 팀원 화면에도 바로 나타납니다.</p>
    </div>
  );
}