import React from 'react';
import { GitBranch, Plus, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/prototype/develop/DevBits';
import { FEATURE_KINDS, isOutput } from '@/lib/devkit/features';
import { EVENT_ACTIONS, GUARD_CONDS, ALL, defaultRules, newRule, describeRule } from '@/lib/devkit/rules';

const Sel = ({ value, onChange, children, label }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-8 max-w-[11rem] rounded-md border bg-background px-2 text-caption">{children}</select>
);
const TYPE_LABEL = { event: '버튼 동작', guard: '안전 조건', show: '표시등' };

// 동작 규칙 편집: 시뮬레이터와 펌웨어가 함께 쓴다
export default function RulesEditor({ features, rules, onChange }) {
  const outs = features.filter((f) => isOutput(f.kind));
  const buttons = features.filter((f) => f.kind === 'button');
  const guardSrc = features.filter((f) => Object.values(GUARD_CONDS).some((c) => c.kinds.includes(f.kind)));
  const leds = features.filter((f) => f.kind === 'led');
  const set = (id, patch) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const opts = (list, withAll) => [...(withAll ? [<option key="all" value={ALL}>모든 구동부 (모터·히터·릴레이)</option>] : []), ...list.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)];

  return (
    <Card title="동작 규칙" icon={GitBranch} tag="시뮬레이터·펌웨어 공용"
      actions={<Button size="sm" variant="ghost" onClick={() => { if (window.confirm('기능 목록으로 만든 기본 규칙으로 바꿀까요? 지금 규칙은 바뀝니다.')) onChange(defaultRules(features)); }}><RotateCcw className="w-4 h-4" />기본 규칙</Button>}>
      {rules.length === 0 && <p className="text-caption text-muted-foreground">규칙이 없습니다. 버튼을 눌러도 아무것도 바뀌지 않고, 앱 명령으로만 출력이 움직입니다.</p>}
      <div className="space-y-2">
        {rules.map((r) => {
          const src = features.find((f) => f.id === r.src);
          const conds = Object.entries(GUARD_CONDS).filter(([, c]) => !src || c.kinds.includes(src.kind));
          return (
            <div key={r.id} className="rounded-lg border p-2.5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5 text-caption">
                <span className="rounded bg-muted px-1.5 py-0.5 text-micro font-semibold text-muted-foreground">{TYPE_LABEL[r.type]}</span>
                {r.type === 'event' && <>
                  <Sel label="버튼" value={r.src} onChange={(v) => set(r.id, { src: v })}>{opts(buttons)}</Sel><span>누르면 →</span>
                  <Sel label="출력" value={r.dst} onChange={(v) => set(r.id, { dst: v })}>{opts(outs, true)}</Sel>
                  <Sel label="동작" value={r.action} onChange={(v) => set(r.id, { action: v })}>{Object.entries(EVENT_ACTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Sel>
                </>}
                {r.type === 'guard' && <>
                  <Sel label="입력" value={r.src} onChange={(v) => { const f = features.find((x) => x.id === v); const c = Object.entries(GUARD_CONDS).find(([, x]) => x.kinds.includes(f?.kind)); set(r.id, { src: v, cond: c?.[0] || r.cond }); }}>{opts(guardSrc)}</Sel>
                  <Sel label="조건" value={r.cond} onChange={(v) => set(r.id, { cond: v })}>{conds.map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</Sel>
                  {GUARD_CONDS[r.cond]?.value && <><Input type="number" value={r.value} onChange={(e) => set(r.id, { value: Number(e.target.value) })} className="h-8 w-20 tabular-nums text-caption" aria-label="기준값" /><span>{FEATURE_KINDS[src?.kind]?.ble.unit}</span></>}
                  <span>→</span><Sel label="끌 출력" value={r.dst} onChange={(v) => set(r.id, { dst: v })}>{opts(outs, true)}</Sel><span>끄기</span>
                </>}
                {r.type === 'show' && <>
                  <Sel label="출력" value={r.src} onChange={(v) => set(r.id, { src: v })}>{opts(outs.filter((f) => f.kind !== 'led'), true)}</Sel><span>동작하면 →</span>
                  <Sel label="표시등" value={r.dst} onChange={(v) => set(r.id, { dst: v })}>{opts(leds)}</Sel><span>켜기</span>
                </>}
                <button type="button" onClick={() => onChange(rules.filter((x) => x.id !== r.id))} className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive" aria-label="규칙 빼기"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-micro text-muted-foreground">{describeRule(r, features)}</p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!buttons.length || !outs.length} onClick={() => onChange([...rules, newRule('event', features)])}><Plus className="w-4 h-4" />버튼 동작</Button>
        <Button size="sm" variant="outline" disabled={!guardSrc.length || !outs.length} onClick={() => onChange([...rules, newRule('guard', features)])}><Plus className="w-4 h-4" />안전 조건</Button>
        <Button size="sm" variant="outline" disabled={!leds.length} onClick={() => onChange([...rules, newRule('show', features)])}><Plus className="w-4 h-4" />표시등</Button>
      </div>
      <p className="text-micro text-muted-foreground">규칙을 바꾸면 시뮬레이션에 바로 반영되고, 저장하면 블루투스·앱 단계의 펌웨어에도 같은 규칙이 들어갑니다.</p>
    </Card>
  );
}
