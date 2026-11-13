import React, { useEffect, useRef, useState } from 'react';
import { MousePointer2, Spline, RotateCw, Trash2, LineChart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { PARTS, PART_GROUPS, LED_COLORS, parseSI, formatSI, terminals, TERMINAL_NAMES } from '@/lib/circuit/parts';
import { traceLabel } from '@/lib/circuit/scope';
import { PART_MODELS, modelOf } from '@/lib/circuit/library';

const UNIT = { 'Ω': 'Ω', F: 'F', H: 'H', V: 'V', A: 'A', Hz: 'Hz' };

/** 부품 고르기 */
export function PartPalette({ tool, setTool }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        <ToolButton active={tool === 'select'} onClick={() => setTool('select')} icon={MousePointer2} label="선택" hint="V" />
        <ToolButton active={tool === 'wire'} onClick={() => setTool('wire')} icon={Spline} label="전선" hint="W" />
      </div>
      {PART_GROUPS.map((g) => {
        const items = Object.entries(PARTS).filter(([k, d]) => d.group === g && k !== 'wire');
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="px-1 pb-1 text-micro font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
            <div className="space-y-0.5">
              {items.map(([k, d]) => (
                <button key={k} type="button" onClick={() => setTool(k)}
                  className={cn('w-full rounded-md px-2 py-1.5 text-left text-label transition-colors', tool === k ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted')}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ToolButton({ active, onClick, icon: Icon, label, hint }) {
  return (
    <button type="button" onClick={onClick} title={`${label} (${hint})`}
      className={cn('flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-label', active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>
      <Icon className="h-3.5 w-3.5" />{label}
    </button>
  );
}

/** 숫자 입력: "4.7k" 같은 단위 접두어 허용, 엔터·포커스 아웃 때 반영 */
function NumField({ value, unit, onCommit }) {
  const [text, setText] = useState(formatSI(value, '').replace(' ', ''));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(formatSI(value, '').replace(' ', '')); setBad(false); }, [value]);
  const commit = () => {
    const v = parseSI(text);
    if (!Number.isFinite(v)) { setBad(true); return; }
    setBad(false);
    if (v !== value) onCommit(v);
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }}
        className={cn('h-8 font-mono text-label', bad && 'border-destructive')} aria-invalid={bad} />
      {unit && <span className="w-10 shrink-0 text-caption text-muted-foreground">{UNIT[unit] || unit}</span>}
    </div>
  );
}

/** 선택한 부품의 값과 측정값 */
export function PropertiesPanel({ part, info, onProps, onRotate, onDelete, onScope, refName, children }) {
  if (!part) return null;
  const def = PARTS[part.type] || { label: part.type, fields: [] };
  const q = part.props || {};
  const n = terminals(part).length;
  // 값을 직접 바꾸면 고른 부품 모델과 달라지므로 모델 이름을 뗀다
  const set = (k, v) => { const next = { ...q, [k]: v }; delete next.model; onProps(next); };
  const models = PART_MODELS[part.type] || [];
  const model = modelOf(part);
  const rows = [];
  if (info) {
    if (n === 1) rows.push(['전압', formatSI(info.volts[0], 'V')]);
    else if (n === 2) {
      rows.push(['양단 전압', formatSI(info.voltage, 'V')]);
      if (part.type !== 'voltmeter') rows.push(['전류', formatSI(info.current, 'A')]);
    } else {
      TERMINAL_NAMES[part.type]?.forEach((nm, k) => rows.push([`${nm} 전압`, formatSI(info.volts[k], 'V')]));
      TERMINAL_NAMES[part.type]?.forEach((nm, k) => { if (Math.abs(info.ti[k]) > 1e-12) rows.push([`${nm} 전류`, formatSI(info.ti[k], 'A')]); });
    }
    if (!['wire', 'probe', 'voltmeter', 'ground'].includes(part.type)) rows.push([info.power < 0 ? '공급 전력' : '소비 전력', formatSI(Math.abs(info.power), 'W')]);
    if (info.region) rows.push(['동작 영역', info.region]);
    if (part.type === 'led') { rows.push(['평균 전류', formatSI(info.avgCurrent, 'A')]); rows.push(['밝기(정격 대비)', `${Math.round((info.brightness || 0) * 100)}%`]); }
  }
  const canScope = !['wire', 'ground'].includes(part.type);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-title font-semibold">{def.label}{refName && <span className="ml-2 font-mono text-label text-muted-foreground">{refName}</span>}</p>
        <div className="flex gap-1">
          {part.type !== 'probe' && <Button size="icon" variant="ghost" className="h-8 w-8" title="90° 돌리기 (R)" onClick={onRotate}><RotateCw className="h-4 w-4" /></Button>}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="지우기 (Delete)" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {models.length > 0 && (
        <div className="space-y-1">
          <label className="text-caption text-muted-foreground">부품 모델</label>
          <select className="h-8 w-full rounded-md border bg-transparent px-2 text-label" value={model?.key || ''}
            onChange={(e) => { const m = models.find((x) => x.key === e.target.value); if (m) onProps({ ...q, ...m.props, model: m.key }); else { const next = { ...q }; delete next.model; onProps(next); } }}>
            <option value="">직접 입력</option>
            {models.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          {model?.note && <p className="text-micro text-muted-foreground">{model.note}</p>}
          {model && <p className="text-micro text-muted-foreground">데이터시트 대표값으로 맞춘 근사 모델입니다.</p>}
        </div>
      )}

      {def.fields?.length > 0 && (
        <div className="space-y-3">
          {def.fields.map(([k, label, unit, kind, options]) => (
            <div key={k} className="space-y-1">
              <label className="text-caption text-muted-foreground">{label}</label>
              {kind === 'bool' ? (
                <div><Switch checked={!!q[k]} onCheckedChange={(v) => set(k, v)} aria-label={label} /></div>
              ) : kind === 'select' ? (
                <select className="h-8 w-full rounded-md border bg-transparent px-2 text-label" value={q[k]} onChange={(e) => set(k, e.target.value)}>
                  {Object.entries(options).map(([ok, ov]) => <option key={ok} value={ok}>{ov.label}</option>)}
                </select>
              ) : unit === '0~1' ? (
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={1} step={0.01} value={Number(q[k] ?? 0.5)} onChange={(e) => set(k, Number(e.target.value))} className="flex-1 accent-primary" aria-label={label} />
                  <span className="w-11 text-right font-mono text-caption">{Math.round(Number(q[k] ?? 0.5) * 100)}%</span>
                </div>
              ) : (
                <NumField value={Number(q[k])} unit={unit} onCommit={(v) => set(k, v)} />
              )}
            </div>
          ))}
          {part.type === 'led' && <p className="text-micro text-muted-foreground">순방향 전압 약 {LED_COLORS[q.color]?.vf} V (20 mA 기준)</p>}
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg bg-muted/50 p-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-label">
            {rows.map(([k, v]) => (<React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-mono tabular-nums">{v}</dd></React.Fragment>))}
          </dl>
        </div>
      )}

      {children}

      {canScope && onScope && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => onScope('v')}><LineChart className="h-3.5 w-3.5" />{traceLabel(part, 'v', '').trim()} 스코프</Button>
          {!['probe', 'voltmeter'].includes(part.type) && <Button size="sm" variant="outline" onClick={() => onScope('i')}><LineChart className="h-3.5 w-3.5" />{traceLabel(part, 'i', '').trim()} 스코프</Button>}
        </div>
      )}
    </div>
  );
}

const SPANS = [[1e-3, '1 ms'], [5e-3, '5 ms'], [0.02, '20 ms'], [0.1, '100 ms'], [0.5, '0.5 s'], [2, '2 s']];

/** 스코프: 기록한 파형 그리기 (자체 루프, 초당 약 20회) */
export function ScopePanel({ recorder, span, onSpan, version, onRemove, dark }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf, last = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 50) return;
      last = now;
      const cv = ref.current;
      if (!cv) return;
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = r.width, H = r.height;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) { const x = (W * i) / 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let i = 1; i < 4; i++) { const y = (H * i) / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      recorder.traces.forEach((t) => {
        const data = recorder.series(t);
        const vals = data.filter(Number.isFinite);
        if (!vals.length) return;
        let lo = Math.min(...vals), hi = Math.max(...vals);
        if (hi - lo < 1e-12) { const m = Math.abs(hi) || 1; lo -= m * 0.1; hi += m * 0.1; }
        const pad = (hi - lo) * 0.08;
        lo -= pad; hi += pad;
        t.lo = lo; t.hi = hi;
        ctx.strokeStyle = t.color; ctx.lineWidth = 1.6; ctx.beginPath();
        const N = 1000;
        const off = N - data.length;
        data.forEach((v, i) => {
          if (!Number.isFinite(v)) return;
          const x = ((off + i) / (N - 1)) * W, y = H - ((v - lo) / (hi - lo)) * H;
          if (i === 0 || !Number.isFinite(data[i - 1])) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [recorder, dark]);

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-label font-semibold">스코프</p>
        <span className="text-caption text-muted-foreground">가로 한 칸 {formatSI(span / 10, 's')}</span>
        <select className="ml-auto h-7 rounded-md border bg-transparent px-2 text-caption" value={span} onChange={(e) => onSpan(Number(e.target.value))} aria-label="스코프 시간 범위">
          {SPANS.map(([v, l]) => <option key={v} value={v}>화면 전체 {l}</option>)}
        </select>
      </div>
      {recorder.traces.length === 0 ? (
        <p className="py-6 text-center text-caption text-muted-foreground">부품을 고르고 오른쪽의 ‘스코프’ 버튼을 누르면 파형이 여기 그려집니다.</p>
      ) : (
        <>
          <canvas ref={ref} className="block h-36 w-full" />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" data-version={version}>
            {recorder.traces.map((t, i) => (
              <span key={`${t.partId}${t.kind}`} className="inline-flex items-center gap-1.5 text-caption">
                <span className="h-2 w-3 rounded-sm" style={{ background: t.color }} />
                <span>{t.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{formatSI(t.last, t.kind === 'v' ? 'V' : 'A')}</span>
                {Number.isFinite(t.lo) && <span className="font-mono text-micro text-muted-foreground">({formatSI(t.lo, '')} ~ {formatSI(t.hi, '')})</span>}
                <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => onRemove(i)} aria-label={`${t.label} 빼기`}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
