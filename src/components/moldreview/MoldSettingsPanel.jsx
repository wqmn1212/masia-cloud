import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { MOLD_MATERIALS, TEXTURE_OPTIONS } from '@/lib/moldReview/materials';

const PULL_OPTIONS = [
  { value: 'auto', label: '자동 (언더컷 최소)' },
  { value: 'z', label: 'Z축' },
  { value: 'y', label: 'Y축' },
  { value: 'x', label: 'X축' },
  { value: 'z+', label: 'Z+ 쪽이 고정측' },
  { value: 'z-', label: 'Z− 쪽이 고정측' },
  { value: 'y+', label: 'Y+ 쪽이 고정측' },
  { value: 'y-', label: 'Y− 쪽이 고정측' },
  { value: 'x+', label: 'X+ 쪽이 고정측' },
  { value: 'x-', label: 'X− 쪽이 고정측' },
];

const COSMETIC_OPTIONS = [
  { value: 'cavity', label: '고정측 (캐비티)' },
  { value: 'core', label: '가동측 (코어)' },
  { value: 'both', label: '양면 (투명·양면 외관)' },
];

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * 검토 조건. 형상 계산에 쓰는 조건(analysis)은 바꾸면 다시 검토해야 하고,
 * 재질·구배·부식·캐비티(settings)는 바로 판정에 반영된다.
 */
export default function MoldSettingsPanel({ analysis, onAnalysisChange, settings, onSettingsChange, onRerun, canRerun, dirty, cavitiesAuto }) {
  const setA = (patch) => onAnalysisChange({ ...analysis, ...patch });
  const setS = (patch) => onSettingsChange({ ...settings, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="재질">
          <Select value={settings.materialKey} onValueChange={(v) => setS({ materialKey: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOLD_MATERIALS.map((m) => <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="캐비티 수">
          <Input
            type="number" min={1} max={32} step={1} className="h-9 text-xs"
            value={settings.cavities ?? ''}
            placeholder={cavitiesAuto ? `자동 (${cavitiesAuto}개)` : '자동'}
            onChange={(e) => setS({ cavities: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
        <Field label="최소 구배 (°)">
          <Input
            type="number" min={0.25} max={5} step={0.25} className="h-9 text-xs"
            value={settings.draftMin}
            onChange={(e) => setS({ draftMin: Math.max(0.25, Number(e.target.value) || 1) })}
          />
        </Field>
        <Field label="외관 부식(텍스처)">
          <Select value={String(settings.textureDepth)} onValueChange={(v) => setS({ textureDepth: Number(v) })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEXTURE_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="rounded-lg border border-dashed p-3 space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground">형상 조건 — 바꾸면 다시 검토합니다</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="빼기 방향">
            <Select value={analysis.pull} onValueChange={(v) => setA({ pull: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PULL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="외관면">
            <Select value={analysis.cosmetic} onValueChange={(v) => setA({ cosmetic: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COSMETIC_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="두꺼움 기준 (기본 두께의 배)">
            <Input
              type="number" min={1.1} max={2} step={0.05} className="h-9 text-xs"
              value={analysis.sinkRatio}
              onChange={(e) => setA({ sinkRatio: Math.min(2, Math.max(1.1, Number(e.target.value) || 1.25)) })}
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" variant={dirty ? 'default' : 'outline'} size="sm" className="w-full" disabled={!canRerun} onClick={onRerun}>
              <RefreshCw className="w-3.5 h-3.5" />
              다시 검토
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
