import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Moon, Sun, Power, Smartphone, Clock, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/prototype/develop/DevBits';
import SimCanvas, { fallbackParts } from '@/components/prototype/develop/SimCanvas';
import { findLidPart } from '@/lib/devkit/features';
import { defaultRules, validRules, hhmm } from '@/lib/devkit/rules';
import { defaultPower, createSim, stepSim, setInput, setClock, clockText, lampModes, setLampMode, setLampBright, lampIsOn } from '@/lib/devkit/deviceSim';
import { DEFAULT_SIM_PARAMS } from '@/lib/devkit/thermal';
import { mainShellId, partParams } from '@/lib/devkit/solidcraft';
import { simLinks } from '@/lib/devkit/simLinks';
import { demoScript, tapInput } from '@/lib/devkit/demoScript';

const shortName = (f) => String(f?.name || '').split(/\s[(—-]/)[0].trim() || f?.name || '';
const HIDE_KINDS = ['temp', 'custom', 'current', 'voltage'];
const minus = (t, min) => { const m = (hhmm(t) - min + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/**
 * 고객 시연 화면: 3D 를 돌려 보고, '시연 보기'로 정해진 순서대로 작동을 보거나, 오른쪽에서 직접 눌러 본다.
 * 전압·전류 같은 설계 숫자는 보이지 않는다 (그건 '상세 시뮬레이션' 에서). 바꾼 값은 저장되지 않는다.
 * pin: 위치 의견 {mode, onPick, pins, onHover} (디자인 리뷰 방·고객 포털)
 */
export default function ProductDemo({ concept, dev, pin = null, autoPlay = true }) {
  const features = dev.features || [];
  const rules = useMemo(() => validRules(dev.rules ?? defaultRules(features), features), [dev.rules, features]);
  const power = useMemo(() => ({ ...defaultPower(features), ...(dev.power || {}) }), [dev.power, features]);
  const simParams = useMemo(() => {
    const cp = concept?.preview?.parts;
    const main = cp?.length ? partParams(cp, dev.cad?.part_id || mainShellId(cp)) : null;
    const base = main ? { case_w: Number(main.width) || 120, case_d: Number(main.shape === 'round' ? main.width : main.depth) || 80, case_h: Number(main.height) || 50 } : {};
    return { ...DEFAULT_SIM_PARAMS, ...base, ...(dev.sim_params || {}) };
  }, [concept?.id, dev.cad, dev.sim_params]);
  const conceptParts = concept?.preview?.parts;
  const usingFallback = !conceptParts?.length;
  const parts = useMemo(() => (usingFallback ? fallbackParts(features) : conceptParts), [conceptParts, features, usingFallback]);
  const lidPartId = usingFallback ? 'lid-plate' : (dev.lid_part_id ?? findLidPart(conceptParts)?.id ?? null);
  const links = useMemo(() => simLinks(features, parts, usingFallback), [features, parts, usingFallback]);
  const steps = useMemo(() => demoScript({ ...dev, features, rules }), [dev, features, rules]);
  const modes = useMemo(() => lampModes(features), [features]);

  const fresh = () => createSim({ ...dev, features, rules, sim_params: {} }, power, simParams);
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = fresh();
  const [, setFrame] = useState(0);
  const redraw = () => setFrame((n) => n + 1);
  const [night, setNight] = useState(() => features.some((f) => f.kind === 'light'));
  const [speed, setSpeed] = useState(1);
  // 시연 진행: idx = 지금 단계, playing = 자동으로 넘어가는 중, el = 이 단계에서 지난 초
  const demo = useRef({ idx: -1, playing: false, el: 0 });

  const startStep = (i) => {
    const s = simRef.current;
    demo.current = { idx: i, playing: true, el: 0 };
    steps[i].setup(s);
    redraw();
  };
  const playFromStart = () => { simRef.current = fresh(); startStep(0); };
  const stopDemo = () => { demo.current = { ...demo.current, playing: false }; redraw(); };
  // 직접 만지면 시연은 멈추고 1배속으로
  const manual = (fn) => { if (demo.current.playing) demo.current = { ...demo.current, playing: false }; setSpeed(1); fn(simRef.current); stepSim(simRef.current, 0.02); redraw(); };

  useEffect(() => {
    if (!autoPlay || !steps.length || pin?.mode) return undefined;
    const t = setTimeout(() => { if (demo.current.idx < 0) startStep(0); }, 1200);
    return () => clearTimeout(t);
  }, [steps.length]);
  useEffect(() => {
    const id = setInterval(() => {
      const s = simRef.current;
      const d = demo.current;
      const st = d.playing ? steps[d.idx] : null;
      if (st) {
        st.tick?.(s, d.el);
        stepSim(s, 0.1 * st.speed);
        d.el += 0.1;
        if (d.el >= st.dur) { if (d.idx + 1 < steps.length) startStep(d.idx + 1); else demo.current = { ...d, playing: false, done: true }; }
      } else stepSim(s, 0.1 * speed);
      redraw();
    }, 100);
    return () => clearInterval(id);
  }, [speed, steps]);

  const s = simRef.current;
  const d = demo.current;
  const cur = d.idx >= 0 ? steps[d.idx] : null;
  const dial = features.find((f) => f.kind === 'encoder');
  const lights = features.filter((f) => f.kind === 'light');
  const hasClock = features.some((f) => f.kind === 'display') || rules.some((r) => r.type === 'schedule');
  const sched = rules.find((r) => r.type === 'schedule');
  const sleepSw = sched && features.find((f) => f.id === sched.src && f.kind === 'switch');
  const pairBtn = features.find((f) => f.kind === 'button' && rules.some((r) => r.type === 'event' && r.src === f.id && r.action === 'pair'));
  const otherButtons = features.filter((f) => f.kind === 'button' && f.id !== pairBtn?.id);
  const otherSwitches = features.filter((f) => f.kind === 'switch' && f.id !== sleepSw?.id);
  const on = lampIsOn(s);
  const level = Math.round(Math.max(0, ...lights.map((f) => s.levels[f.id] || 0)));
  // 지금 실제로 켜진 빛 (수면·기상 일정이 다이얼 모드와 다른 빛을 켤 수 있다)
  const lit = lights.filter((f) => (s.levels[f.id] || 0) >= 0.5);
  const litText = lit.length > 1 && lit.length === lights.length ? '모두 함께' : lit.map(shortName).join(' + ');
  const press = (id, v) => { setInput(s, { pressed: { ...s.input.pressed, [id]: v } }); stepSim(s, 0.02); redraw(); };
  const togglePower = () => manual((x) => { if (dial) tapInput(x, dial.id); else x.levels = { ...x.levels, ...Object.fromEntries(lights.map((f) => [f.id, on ? 0 : x.lamp.bright])) }; });
  const flip = (id) => manual((x) => setInput(x, { switches: { ...x.input.switches, [id]: !x.input.switches[id] } }));
  const shown = features.filter((f) => !HIDE_KINDS.includes(f.kind));
  const size = concept?.preview?.overall_mm;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-2">
      <div className="relative h-[360px] overflow-hidden rounded-xl border sm:h-[500px]"
        style={{ background: night ? 'radial-gradient(ellipse at 50% 35%, #1f2633 0%, #0b0e14 75%)' : 'linear-gradient(180deg, hsl(var(--secondary)) 0%, hsl(var(--card)) 100%)', transition: 'background 0.6s' }}>
        <SimCanvas parts={parts} links={links} lidPartId={lidPartId} simRef={simRef} night={night} camera={[1, 0.42, 1.15]}
          onPress={(id, v) => { if (demo.current.playing) stopDemo(); press(id, v); }} onLid={() => manual((x) => setInput(x, { lid: x.input.lid > 0.5 ? 0 : 1 }))} onSwitch={flip}
          pivot={dev.pivot} pinMode={!!pin?.mode} onPickPart={pin?.onPick} pins={pin?.pins} onHover={pin?.onHover} />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          {lights.length > 0 && <span className="rounded-full bg-card/85 px-2.5 py-1 text-caption font-medium backdrop-blur">{lit.length ? `${litText} ${level} %` : '꺼짐'}</span>}
          {hasClock && <span className="rounded-full bg-card/85 px-2.5 py-1 text-caption font-semibold tabular-nums backdrop-blur">{clockText(s)}{sleepSw && s.input.switches[sleepSw.id] ? ' · 수면 모드' : ''}</span>}
          {s.input.app && <span className="rounded-full bg-primary/90 px-2.5 py-1 text-caption text-primary-foreground backdrop-blur">앱 연결됨</span>}
          {(d.playing ? cur?.speed : speed) > 1 && <span className="rounded-full bg-warning/90 px-2.5 py-1 text-caption text-black backdrop-blur">{d.playing ? cur.speed : speed}배 빠르게</span>}
        </div>
        <Button size="sm" variant="outline" className="absolute right-3 top-3 h-8 bg-card/85 backdrop-blur" onClick={() => setNight(!night)} aria-pressed={night}>
          {night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{night ? '밝은 방' : '어두운 방'}
        </Button>

        {pin?.mode && <p className="pointer-events-none absolute right-3 top-14 max-w-[240px] rounded-lg bg-primary px-2.5 py-1.5 text-micro text-primary-foreground">의견을 남길 곳을 누르세요. 드래그는 회전입니다.</p>}
      </div>
        <div className="space-y-2">
          {!cur && steps.length > 0 && <p className="rounded-xl border bg-card p-3 text-body text-muted-foreground">“시연 보기”를 누르면 켜기부터 잠들 때·일어날 때까지 순서대로 작동을 보여 드립니다. 원하는 장면만 눌러 봐도 됩니다.</p>}
          {cur && (
            <div className="rounded-xl border bg-card p-3" aria-live="polite">
              <p className="text-micro font-semibold text-primary">{d.done && !d.playing ? '시연 끝 · 직접 눌러 보세요' : `시연 ${d.idx + 1} / ${steps.length} · ${cur.title}`}</p>
              <p className="mt-0.5 text-body">{cur.caption}</p>
              {d.playing && <div className="mt-2 h-1 rounded-full bg-muted"><div className="h-1 rounded-full bg-primary transition-[width] duration-100" style={{ width: `${Math.min(100, (d.el / cur.dur) * 100)}%` }} /></div>}
            </div>
          )}
          {steps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {d.playing
                ? <Button size="sm" variant="outline" onClick={stopDemo}><Pause className="h-4 w-4" />멈춤</Button>
                : <Button size="sm" onClick={cur && !d.done ? () => { demo.current = { ...demo.current, playing: true }; redraw(); } : playFromStart}><Play className="h-4 w-4" />{cur && !d.done ? '이어서' : '시연 보기'}</Button>}
              {cur && <Button size="sm" variant="outline" onClick={playFromStart}><RotateCcw className="h-4 w-4" />처음부터</Button>}
              <div className="flex flex-wrap gap-1">
                {steps.map((st, i) => (
                  <button key={st.key} type="button" onClick={() => startStep(i)} aria-current={i === d.idx ? 'step' : undefined}
                    className={`rounded-full border px-2.5 py-1 text-micro ${i === d.idx ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-secondary'}`}>{i + 1}. {st.title}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Card title="직접 해 보기" icon={Sparkles}>
          {lights.length > 0 && (
            <div className="space-y-3">
              <Button className="w-full" variant={on ? 'default' : 'outline'} onClick={togglePower}><Power className="h-4 w-4" />{on ? '끄기' : '켜기'}{dial ? ` (${shortName(dial)} 누르기)` : ''}</Button>
              {modes.length > 1 && (
                <div className="space-y-1">
                  <p className="text-caption text-muted-foreground">빛{dial ? ` (${shortName(dial)} 길게 누르기)` : ''}</p>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border p-0.5" role="radiogroup" aria-label="빛 고르기">
                    {modes.map((m) => (
                      <button key={m.key} type="button" role="radio" aria-checked={s.lamp.face === m.key} onClick={() => manual((x) => { setLampMode(x, m.key); if (!lampIsOn(x)) { if (dial) tapInput(x, dial.id); else setLampBright(x, x.lamp.bright); } })}
                        className={`rounded-md px-2 py-1.5 text-caption ${s.lamp.face === m.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{m.label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <p className="flex justify-between text-caption text-muted-foreground"><span>밝기{dial ? ` (${shortName(dial)} 돌리기)` : ''}</span><span className="tabular-nums">{Math.round(s.lamp.bright)} %</span></p>
                <Slider min={1} max={100} step={1} value={[Math.round(s.lamp.bright)]} onValueChange={([v]) => manual((x) => setLampBright(x, v))} aria-label="밝기" />
              </div>
            </div>
          )}
          {sleepSw && (
            <div className="space-y-2 rounded-lg bg-secondary/60 p-2.5">
              <label className="flex items-center justify-between gap-2 text-label"><span className="flex items-center gap-2"><Moon className="h-4 w-4 text-muted-foreground" />수면 모드</span><Switch checked={!!s.input.switches[sleepSw.id]} onCheckedChange={() => flip(sleepSw.id)} aria-label="수면 모드" /></label>
              <p className="text-micro text-muted-foreground">취침 {sched.bed} 전 {sched.dim_min}분 서서히 어둡게 → 소등, 기상 {sched.wake} 전 {sched.rise_min}분 서서히 밝게</p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => manual((x) => { setClock(x, minus(sched.bed, Number(sched.dim_min) + 1)); setInput(x, { switches: { ...x.input.switches, [sleepSw.id]: true } }); })}>잠들기 직전으로</Button>
                <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => manual((x) => { setClock(x, minus(sched.wake, Number(sched.rise_min) + 1)); setInput(x, { switches: { ...x.input.switches, [sleepSw.id]: true } }); })}>일어나기 직전으로</Button>
              </div>
            </div>
          )}
          {hasClock && (
            <div className="flex flex-wrap items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input type="time" value={clockText(s)} onChange={(e) => { if (e.target.value) manual((x) => setClock(x, e.target.value)); }} className="h-8 w-28 tabular-nums" aria-label="시각" />
              <div className="flex rounded-md border p-0.5">{[1, 60, 600].map((x) => <button key={x} type="button" onClick={() => { if (demo.current.playing) stopDemo(); setSpeed(x); }} className={`rounded px-2 py-0.5 text-micro tabular-nums ${speed === x && !d.playing ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{x === 1 ? '실제 시간' : `${x}배`}</button>)}</div>
            </div>
          )}
          {pairBtn && <Button size="sm" variant={s.input.app ? 'default' : 'outline'} onClick={() => manual((x) => { if (!x.input.app) tapInput(x, pairBtn.id); else setInput(x, { app: false }); })}><Smartphone className="h-4 w-4" />{s.input.app ? '앱 연결 끊기' : `${shortName(pairBtn)} 누르기 (앱 연결)`}</Button>}
          {otherButtons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{otherButtons.map((b) => (
              <Button key={b.id} size="sm" variant={s.input.pressed[b.id] ? 'default' : 'outline'} className="select-none"
                onPointerDown={() => { if (demo.current.playing) stopDemo(); press(b.id, true); }} onPointerUp={() => press(b.id, false)} onPointerLeave={() => s.input.pressed[b.id] && press(b.id, false)}>{shortName(b)}</Button>
            ))}</div>
          )}
          {otherSwitches.map((f) => <label key={f.id} className="flex items-center justify-between gap-2 text-label">{shortName(f)}<Switch checked={!!s.input.switches[f.id]} onCheckedChange={() => flip(f.id)} aria-label={f.name} /></label>)}
          <p className="text-micro text-muted-foreground">3D 의 버튼·다이얼 부품을 눌러도 됩니다. 드래그로 돌려 보고, 휠·두 손가락으로 확대합니다.</p>
        </Card>
        <Card title="제품" icon={Info}>
          {concept?.preview?.title && <p className="text-label font-semibold">{concept.preview.title}</p>}
          {size && <p className="text-caption text-muted-foreground tabular-nums">크기 (가로 × 깊이 × 높이) 약 {[size.x ?? size.w, size.z ?? size.d, size.y ?? size.h].filter(Boolean).map((v) => Math.round(v)).join(' × ')} mm</p>}
          <ul className="space-y-1 text-caption">{shown.map((f) => <li key={f.id} className="flex gap-1.5"><span className="text-primary">•</span><span>{f.name}</span></li>)}</ul>
          <p className="text-micro text-muted-foreground">개발 중인 설계의 시뮬레이션입니다. 실제 제품의 색·빛·크기는 시제품에서 확인해 주세요.</p>
        </Card>
      </div>
    </div>
  );
}
