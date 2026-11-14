import React, { useState } from 'react';
import { ListChecks, Plus, Trash2, Wand2, Cpu, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Card, Field } from '@/components/prototype/develop/DevBits';
import { FEATURE_KINDS, FEATURE_GROUPS, MCUS, makeFeature, suggestFeatures, heaterWatts, lightSpec } from '@/lib/devkit/features';

const ACCESS = { read: '읽기', write: '쓰기', notify: '알림' };
const PIN_KIND = { gpio: '디지털', pwm: 'PWM', adc: 'ADC', none: '-' };

// 3단계: 원하는 기능을 정한다. 기능 하나 = 핀 하나 + 회로 블록 하나 + 블루투스 값 하나
export default function FeaturesStep({ concept, dev, change }) {
  const [kind, setKind] = useState('button');
  const list = dev.features || [];
  const setList = (fn) => change((d) => ({ features: fn(d.features || []) }));
  const update = (id, patch) => setList((l) => l.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const move = (i, d) => setList((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const suggest = () => {
    const add = suggestFeatures(concept?.preview?.parts, list);
    if (!add.length) { toast({ title: '컨셉 부품 이름에서 찾은 기능이 없습니다. 아래에서 직접 추가하세요.' }); return; }
    setList((l) => [...l, ...add]);
    toast({ title: `컨셉에서 기능 ${add.length}개를 가져왔습니다`, description: add.map((f) => f.name).join(', ') });
  };
  const pinsFor = (f) => {
    const m = MCUS[dev.mcu] || MCUS.esp32c3;
    const k = FEATURE_KINDS[f.kind];
    return [...new Set(k.pin === 'adc' ? m.adc : [...m.io, ...m.adc])].sort((a, b) => a - b);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card title="원하는 기능" icon={ListChecks} tag={`${list.length}개`}
        actions={concept && <Button size="sm" variant="outline" onClick={suggest}><Wand2 className="w-4 h-4" />컨셉 부품에서 가져오기</Button>}>
        {list.length === 0 && <p className="rounded-lg bg-secondary px-4 py-6 text-center text-caption text-muted-foreground">미팅에서 정한 기능(버튼, 표시등, 모터, 센서…)을 추가하세요. 회로 블록·부품표·블루투스 항목·펌웨어가 기능 목록에서 자동으로 만들어집니다.</p>}
        <div className="space-y-2">
          {list.map((f, i) => {
            const k = FEATURE_KINDS[f.kind];
            if (!k) return null;
            return (
              <div key={f.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-semibold text-primary">{FEATURE_GROUPS[k.group]}</span>
                  <span className="text-caption text-muted-foreground">{k.label}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로"><ArrowUp className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="아래로"><ArrowDown className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => { if (window.confirm(`${f.name} 기능을 목록에서 뺄까요?`)) setList((l) => l.filter((x) => x.id !== f.id)); }} aria-label="빼기"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
                  <Input value={f.name} maxLength={40} onChange={(e) => update(f.id, { name: e.target.value })} className="h-9" aria-label="기능 이름" />
                  {k.pin !== 'none' ? (
                    <select value={Number.isInteger(f.pin) ? f.pin : ''} onChange={(e) => update(f.id, { pin: e.target.value === '' ? null : Number(e.target.value) })} className="h-9 rounded-md border bg-background px-2 text-label tabular-nums" aria-label="핀">
                      <option value="">자동 핀</option>
                      {pinsFor(f).map((p) => <option key={p} value={p}>GPIO{p}</option>)}
                    </select>
                  ) : <span className="flex h-9 items-center text-caption text-muted-foreground">핀 없음</span>}
                </div>
                {f.kind === 'heater' && (
                  <label className="flex flex-wrap items-center gap-2 text-caption">
                    <span className="font-medium">정격 전력</span>
                    <Input type="number" min={1} max={3000} step="1" value={heaterWatts(f)} onChange={(e) => update(f.id, { power_w: Math.max(1, Number(e.target.value) || 1) })} className="h-8 w-24 tabular-nums" aria-label="히터 정격 전력 W" />
                    <span>W</span>
                    <span className="text-muted-foreground tabular-nums">구동 전원 {dev.supply_v} V 에서 약 {(heaterWatts(f) / (Number(dev.supply_v) || 5)).toFixed(2)} A · 히터 저항 {((Number(dev.supply_v) || 5) ** 2 / heaterWatts(f)).toFixed(1)} Ω</span>
                  </label>
                )}
                {f.kind === 'light' && (() => { const ls = lightSpec(f); return (
                  <div className="flex flex-wrap items-center gap-2 text-caption">
                    <select value={ls.face} onChange={(e) => update(f.id, { face: e.target.value })} className="h-8 rounded-md border bg-background px-2 text-caption" aria-label="발광면"><option value="front">앞면</option><option value="rear">뒷면</option></select>
                    <span className="font-medium">LED</span><Input type="number" min={0.1} max={200} step="0.1" value={ls.power_w} onChange={(e) => update(f.id, { power_w: Math.max(0.1, Number(e.target.value) || 1) })} className="h-8 w-20 tabular-nums" aria-label="LED 최대 전력 W" /><span>W</span>
                    <Input type="number" min={1800} max={6500} step="100" value={ls.cct} onChange={(e) => update(f.id, { cct: Math.max(1800, Math.min(6500, Number(e.target.value) || 4000)) })} className="h-8 w-24 tabular-nums" aria-label="색온도 K" /><span>K</span>
                    <span className="text-muted-foreground tabular-nums">약 {Math.round(ls.power_w * ls.lm_per_w * ls.trans / 100)} lm (효율 {ls.lm_per_w} lm/W × 확산 {ls.trans} %){ls.face === 'front' ? ` · 45 cm 정면 약 ${Math.round((ls.power_w * ls.lm_per_w * ls.trans / 100) / (Math.PI * 0.2025))} lux` : ''}</span>
                  </div>
                ); })()}
                <p className="text-caption text-muted-foreground">{k.block}</p>
                <p className="flex flex-wrap gap-x-3 text-micro text-muted-foreground">
                  <span>핀 {PIN_KIND[k.pin]}{Number.isInteger(f.pin) ? ` · GPIO${f.pin}` : ''}</span>
                  <span>앱: {k.ble.access.map((a) => ACCESS[a]).join('·')} · {k.ble.desc}</span>
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <Field label="기능 추가">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-label">
              {Object.entries(FEATURE_GROUPS).map(([g, gl]) => (
                <optgroup key={g} label={gl}>{Object.entries(FEATURE_KINDS).filter(([, k]) => k.group === g).map(([key, k]) => <option key={key} value={key}>{k.label}</option>)}</optgroup>
              ))}
            </select>
          </Field>
          <Button size="sm" onClick={() => setList((l) => [...l, makeFeature(kind)])}><Plus className="w-4 h-4" />추가</Button>
        </div>
      </Card>

      <Card title="장치 기본" icon={Cpu}>
        <Field label="MCU 모듈" hint={`ADC 핀: ${(MCUS[dev.mcu] || MCUS.esp32c3).adc.map((p) => `GPIO${p}`).join(', ')}`}>
          <select value={dev.mcu} onChange={(e) => change({ mcu: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-label">
            {Object.entries(MCUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="블루투스 장치 이름" hint="광고에 쓰는 이름 (영문·숫자 20자)">
          <Input value={dev.device_name} maxLength={20} onChange={(e) => change({ device_name: e.target.value.replace(/[^A-Za-z0-9_-]/g, '') })} className="h-9 font-mono" />
        </Field>
        <Field label="구동 전원 (모터·히터) V">
          <Input type="number" min={3} max={48} step="0.5" value={dev.supply_v} onChange={(e) => change({ supply_v: Number(e.target.value) || 5 })} className="h-9 tabular-nums" />
        </Field>
        <p className="text-micro text-muted-foreground">핀을 비워 두면 기능 순서대로 자동으로 정합니다. 저장하면 블루투스 UUID 도 함께 고정됩니다.</p>
      </Card>
    </div>
  );
}
