import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Hand, DoorOpen, Move3d, Battery, Plug, Zap, AlertTriangle, ShieldCheck, Cpu, Smartphone, ListTree, Link2, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, Field } from '@/components/prototype/develop/DevBits';
import SimCanvas, { fallbackParts } from '@/components/prototype/develop/SimCanvas';
import SimChart from '@/components/prototype/develop/SimChart';
import RulesEditor from '@/components/prototype/develop/RulesEditor';
import { FEATURE_KINDS, OUTPUT_LEVELS, isOutput, findLidPart } from '@/lib/devkit/features';
import { defaultRules, validRules } from '@/lib/devkit/rules';
import { POWER_SOURCES, defaultPower, createSim, stepSim, setInput, appWrite, appValues, runtimeHours, tiltOf, refill } from '@/lib/devkit/deviceSim';

const SPEEDS = [1, 10, 60, 600];
const BOOL_TEXT = { button: ['—', '눌림'], lid: ['닫힘', '열림'], tilt: ['바로 섬', '기울어짐'], water: ['물 있음', '물 부족'] };
const fmtA = (i) => (i >= 1 ? `${i.toFixed(2)} A` : `${Math.round(i * 1000)} mA`);
const fmtT = (s) => (s < 60 ? `${s.toFixed(1)}초` : s < 3600 ? `${Math.floor(s / 60)}분 ${Math.floor(s % 60)}초` : `${(s / 3600).toFixed(1)}시간`);
const unit = (f) => FEATURE_KINDS[f.kind]?.ble.unit || '';

// 6단계: 동작 시뮬레이션 — 전원·버튼·뚜껑·기울기·센서·앱 명령을 넣으면 규칙대로 움직이고 전압·전류·온도를 계산한다
export default function SimStep({ concept, dev, change }) {
  const features = dev.features || [];
  const rules = useMemo(() => validRules(dev.rules ?? defaultRules(features), features), [dev.rules, features]);
  const power = useMemo(() => ({ ...defaultPower(features), ...(dev.power || {}) }), [dev.power, features]);
  const conceptParts = concept?.preview?.parts;
  const parts = useMemo(() => (conceptParts?.length ? conceptParts : fallbackParts(features)), [conceptParts, features]);
  const usingFallback = !conceptParts?.length;
  const lidPartId = usingFallback ? 'lid-plate' : (dev.lid_part_id ?? findLidPart(conceptParts)?.id ?? null);
  const links = useMemo(() => {
    const m = {};
    features.forEach((f) => {
      const pid = usingFallback ? (parts.some((p) => p.id === f.id) ? f.id : null) : (f.part_id || parts.find((p) => p.name === f.name)?.id);
      if (pid) m[pid] = { feature_id: f.id, kind: f.kind };
    });
    return m;
  }, [features, parts, usingFallback]);

  const simRef = useRef(null);
  const [, setFrame] = useState(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [resetN, setResetN] = useState(0);
  const shape = `${features.map((f) => `${f.id}:${f.kind}`).join(',')}|${dev.supply_v}`;

  useEffect(() => { simRef.current = createSim({ ...dev, features, rules }, power); setFrame((n) => n + 1); }, [shape, resetN]);  
  useEffect(() => { if (simRef.current) simRef.current.rules = rules; }, [rules]);
  useEffect(() => { if (simRef.current) Object.assign(simRef.current.power, power); }, [power]);
  useEffect(() => {
    const id = setInterval(() => {
      const s = simRef.current;
      if (s && running) stepSim(s, 0.1 * speed);
      setFrame((n) => n + 1);
    }, 100);
    return () => clearInterval(id);
  }, [running, speed]);

  const s = simRef.current;
  if (!features.length) return <Card title="동작 시뮬레이션" icon={Cpu}><p className="text-caption text-muted-foreground">3단계에서 기능을 먼저 추가하세요. 버튼·센서·구동부를 넣으면 전원과 함께 실제처럼 움직여 볼 수 있습니다.</p></Card>;
  if (!s) return null;

  // 조작: 누르는 순간을 놓치지 않게 바로 한 칸 계산한다
  const press = (id, on) => { setInput(s, { pressed: { ...s.input.pressed, [id]: on } }); stepSim(s, 0.02); setFrame((n) => n + 1); };
  const setLid = (v) => { setInput(s, { lid: v }); stepSim(s, 0.02); setFrame((n) => n + 1); };
  const setTilt = (patch) => { setInput(s, { tilt: { ...s.input.tilt, ...patch } }); setFrame((n) => n + 1); };
  const setPower = (patch) => change((d) => ({ power: { ...defaultPower(d.features || []), ...(d.power || {}), ...patch } }));
  const angle = tiltOf(s.input.tilt);
  const app = appValues(s);
  const hours = runtimeHours(s);
  const buttons = features.filter((f) => f.kind === 'button');
  const hasLid = !!lidPartId || features.some((f) => f.kind === 'lid');
  const warnings = Object.values(s.warnings);
  const blockedName = (id) => (s.blockedBy[id] ? '안전 조건으로 꺼짐' : '');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="relative min-h-[460px] overflow-hidden rounded-xl border bg-gradient-to-b from-secondary to-card">
          <SimCanvas parts={parts} links={links} lidPartId={lidPartId} simRef={simRef} onPress={press} onLid={() => setLid(s.input.lid > 0.5 ? 0 : 1)} />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2.5 py-1 text-caption font-medium backdrop-blur ${s.mcu.on ? 'bg-success/15 text-success-text' : 'bg-destructive/15 text-destructive'}`}>{s.mcu.on ? 'MCU 동작' : 'MCU 꺼짐·재부팅'}</span>
            <span className="rounded-full bg-card/85 px-2.5 py-1 text-caption tabular-nums backdrop-blur">입력 {s.rails.vin.toFixed(2)} V · {fmtA(s.rails.i)}</span>
            {s.power.source === 'battery' && <span className="rounded-full bg-card/85 px-2.5 py-1 text-caption tabular-nums backdrop-blur">배터리 {s.phys.soc.toFixed(1)} %</span>}
            {angle > 5 && <span className="rounded-full bg-warning/15 px-2.5 py-1 text-caption text-warning-text backdrop-blur">기울기 {Math.round(angle)}°</span>}
            {s.mcu.resets > 0 && <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-caption text-destructive backdrop-blur">리셋 {s.mcu.resets}회</span>}
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={running ? 'outline' : 'default'} onClick={() => setRunning(!running)}>{running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{running ? '멈춤' : '재생'}</Button>
            <div className="flex rounded-md border bg-card/90 p-0.5">{SPEEDS.map((x) => <button key={x} type="button" onClick={() => setSpeed(x)} className={`rounded px-2 py-1 text-caption tabular-nums ${speed === x ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{x}×</button>)}</div>
            <Button size="sm" variant="outline" onClick={() => setResetN((n) => n + 1)}><RotateCcw className="w-4 h-4" />처음부터</Button>
            <span className="ml-auto rounded-full bg-card/85 px-2.5 py-1 text-caption tabular-nums text-muted-foreground backdrop-blur">{fmtT(s.t)}</span>
          </div>
          <p className="pointer-events-none absolute right-3 top-3 hidden max-w-[220px] rounded-lg md:block bg-card/85 px-2.5 py-1.5 text-micro text-muted-foreground backdrop-blur">{usingFallback ? '컨셉이 없어 기본 상자 모형으로 보여 줍니다. ' : ''}파란 버튼 부품을 누르고 있으면 눌림, 뚜껑을 누르면 열림·닫힘. 드래그로 회전.</p>
        </div>

        <div className="space-y-3">
          <Card title="조작" icon={Hand}>
            {buttons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {buttons.map((b) => (
                  <Button key={b.id} size="sm" variant={s.input.pressed[b.id] ? 'default' : 'outline'} className="select-none"
                    onPointerDown={() => press(b.id, true)} onPointerUp={() => press(b.id, false)} onPointerLeave={() => s.input.pressed[b.id] && press(b.id, false)}>
                    {b.name} 누르기
                  </Button>
                ))}
              </div>
            )}
            {hasLid && (
              <Field group label={`뚜껑 ${s.input.lid > 0.15 ? '열림' : '닫힘'}`}>
                <div className="flex items-center gap-3"><DoorOpen className="w-4 h-4 text-muted-foreground" /><Slider min={0} max={100} step={5} value={[Math.round(s.input.lid * 100)]} onValueChange={([v]) => setLid(v / 100)} className="flex-1" aria-label="뚜껑 열림" /></div>
              </Field>
            )}
            <Field group label={`기울이기 · 앞뒤 ${Math.round(s.input.tilt.pitch)}° · 좌우 ${Math.round(s.input.tilt.roll)}°`}>
              <div className="space-y-2">
                <Slider min={-90} max={90} step={1} value={[s.input.tilt.pitch]} onValueChange={([v]) => setTilt({ pitch: v })} aria-label="앞뒤 기울기" />
                <Slider min={-90} max={90} step={1} value={[s.input.tilt.roll]} onValueChange={([v]) => setTilt({ roll: v })} aria-label="좌우 기울기" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setTilt({ pitch: 0, roll: 0 })}><Move3d className="w-4 h-4" />바로 세우기</Button>
                  <Button size="sm" variant="outline" onClick={() => setTilt({ pitch: 88, roll: 0 })}>넘어뜨리기</Button>
                </div>
              </div>
            </Field>
            {features.filter((f) => f.kind === 'analog').map((f) => (
              <Field group key={f.id} label={`${f.name} ${Math.round((s.input.dial[f.id] ?? 0.5) * 100)} %`}>
                <Slider min={0} max={100} step={1} value={[Math.round((s.input.dial[f.id] ?? 0.5) * 100)]} onValueChange={([v]) => { setInput(s, { dial: { ...s.input.dial, [f.id]: v / 100 } }); setFrame((n) => n + 1); }} />
              </Field>
            ))}
            {s.hasHeater && (
              <Field group label={`물탱크 ${Math.round(s.phys.water)} / ${power.tank_ml} ml${s.phys.steamRate > 1 ? ` · 가습 ${Math.round(s.phys.steamRate)} ml/h` : ''}`}>
                <div className="flex items-center gap-3">
                  <Droplets className="w-4 h-4 text-muted-foreground" />
                  <Slider min={0} max={Number(power.tank_ml) || 3000} step={10} value={[Math.round(s.phys.water)]} onValueChange={([v]) => { refill(s, v); setFrame((n) => n + 1); }} className="flex-1" aria-label="물 양" />
                  <Button size="sm" variant="outline" onClick={() => { refill(s); setFrame((n) => n + 1); }}>물 채우기</Button>
                </div>
              </Field>
            )}
            <Field group label={`주변 온도 ${s.power.ambient} °C`}>
              <Slider min={-10} max={45} step={1} value={[Number(power.ambient)]} onValueChange={([v]) => setPower({ ambient: v })} aria-label="주변 온도" />
            </Field>
            <label className="flex items-center justify-between gap-2 text-label"><span className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-muted-foreground" />앱 연결 (블루투스)</span><Switch checked={s.input.app} onCheckedChange={(v) => { setInput(s, { app: v }); setFrame((n) => n + 1); }} /></label>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card title="전원" icon={Zap}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="전원 종류" hint={POWER_SOURCES[power.source]?.note}>
              <select value={power.source} onChange={(e) => setPower({ source: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-label">
                {Object.entries(POWER_SOURCES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
              </select>
            </Field>
            {power.source === 'usb' && (
              <Field label="USB 전류 한도">
                <select value={power.usb_limit} onChange={(e) => setPower({ usb_limit: Number(e.target.value) })} className="h-9 w-full rounded-md border bg-background px-2 text-label">
                  <option value={0.5}>0.5 A (PC 포트)</option><option value={1.5}>1.5 A (USB-C)</option><option value={3}>3 A (USB-C 충전기)</option>
                </select>
              </Field>
            )}
            {power.source === 'adapter' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="전압 V"><Input type="number" step="0.5" value={power.adapter_v} onChange={(e) => setPower({ adapter_v: Number(e.target.value) || 5 })} className="h-9 tabular-nums" /></Field>
                <Field label="정격 A"><Input type="number" step="0.1" value={power.adapter_a} onChange={(e) => setPower({ adapter_a: Number(e.target.value) || 1 })} className="h-9 tabular-nums" /></Field>
              </div>
            )}
            {power.source === 'battery' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="용량 mAh"><Input type="number" step="100" value={power.battery_mah} onChange={(e) => setPower({ battery_mah: Math.max(50, Number(e.target.value) || 1000) })} className="h-9 tabular-nums" /></Field>
                <Field label="시작 잔량 %"><Input type="number" min={0} max={100} value={power.soc0} onChange={(e) => setPower({ soc0: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className="h-9 tabular-nums" /></Field>
              </div>
            )}
          </div>
          {power.source === 'battery' && (
            <label className="flex items-center justify-between gap-2 text-label"><span className="flex items-center gap-2"><Plug className="w-4 h-4 text-muted-foreground" />USB 충전기 꽂기</span><Switch checked={!!power.usb_plugged} onCheckedChange={(v) => setPower({ usb_plugged: v })} /></label>
          )}
          <div className="grid grid-cols-2 gap-2 text-caption sm:grid-cols-4">
            {[['입력', `${s.rails.vin.toFixed(2)} V`], ['3.3 V 레일', `${s.rails.v33.toFixed(2)} V`], ['전류', fmtA(s.rails.i)], ['전력', `${(s.rails.vin * s.rails.i).toFixed(2)} W`]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-secondary px-3 py-2"><p className="text-micro text-muted-foreground">{l}</p><p className="text-label font-semibold tabular-nums">{v}</p></div>
            ))}
          </div>
          {hours != null && <p className="flex items-center gap-1.5 text-caption"><Battery className="w-4 h-4 text-muted-foreground" />지금 쓰는 전류로 약 <b className="tabular-nums">{hours >= 1 ? `${hours.toFixed(1)}시간` : `${Math.round(hours * 60)}분`}</b> 더 쓸 수 있습니다.</p>}
          {s.rails.boost && <p className="text-micro text-muted-foreground">배터리 전압이 구동 전압({dev.supply_v} V)보다 낮아 승압(효율 85 %)으로 계산합니다.</p>}
          <SimChart history={s.history} rows={[
            { label: '입력 전압', get: (h) => h.v, fmt: (v) => `${v.toFixed(2)} V`, color: 'hsl(var(--primary))', min: 0, span: 1 },
            { label: '3.3 V 레일', get: (h) => h.v33, fmt: (v) => `${v.toFixed(2)} V`, color: 'hsl(var(--chart-2))', min: 0, max: 3.6, ref: 2.8 },
            { label: '전류', get: (h) => h.i, fmt: fmtA, color: 'hsl(var(--chart-4))', min: 0, span: 0.1, ref: Number.isFinite(s.rails.limit) && s.rails.limit < 10 ? s.rails.limit : null },
            ...(s.power.source === 'battery' ? [{ label: '배터리', get: (h) => h.soc, fmt: (v) => `${v.toFixed(1)} %`, color: 'hsl(var(--chart-3))', min: 0, max: 100 }] : []),
            ...(s.hasHeater || features.some((f) => f.kind === 'temp') ? [{ label: '히터 온도', get: (h) => h.temp, fmt: (v) => `${v.toFixed(1)} °C`, color: 'hsl(var(--chart-5))', min: 0, span: 10, ref: s.hasHeater ? 128 : null }] : []),
            ...(s.hasHeater && (power.tank_ml > 0) && (s.phys.water > 0 || s.phys.steamTotal > 0) ? [{ label: '가습량', get: (h) => h.steam || 0, fmt: (v) => `${Math.round(v)} ml/h`, color: 'hsl(var(--chart-1))', min: 0, span: 20 }] : []),
          ]} />
        </Card>

        <div className="space-y-4">
          <Card title="출력·센서 상태" icon={Cpu}>
            <div className="divide-y">
              {features.filter((f) => f.kind !== 'custom').map((f) => {
                const out = isOutput(f.kind);
                const v = out ? s.out[f.id] || 0 : s.readings[f.id];
                const load = s.loads.find((l) => l.name === f.name);
                const extra = f.kind === 'motor' ? ` · 속도 ${Math.round((s.phys.motor[f.id] || 0) * 100)} %` : f.kind === 'servo' ? ` · 현재 ${Math.round(s.phys.servo[f.id] || 0)}°` : f.kind === 'heater' ? ` · ${s.phys.heaterT.toFixed(1)} °C${s.phys.fuseBlown ? ' · 퓨즈 끊어짐' : ''}` : '';
                return (
                  <div key={f.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-caption">
                    <span className="font-medium">{f.name}</span>
                    {out && s.blockedBy[f.id] && (s.levels[f.id] || 0) > 0 && <span className="rounded bg-warning/15 px-1.5 text-micro text-warning-text">{blockedName(f.id)}</span>}
                    <span className="ml-auto tabular-nums">{typeof v === 'boolean' ? (BOOL_TEXT[f.kind] || ['아니오', '예'])[v ? 1 : 0] : `${v ?? '—'}${unit(f)}`}{extra}</span>
                    {load && <span className="w-16 text-right text-micro tabular-nums text-muted-foreground">{fmtA(load.i)}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="설계 점검" icon={warnings.length ? AlertTriangle : ShieldCheck}>
            {warnings.length === 0
              ? <p className="text-caption text-muted-foreground">아직 문제를 찾지 못했습니다. 버튼을 눌러 구동부를 켜고, 기울이거나 뚜껑을 열거나, 전원을 바꿔 보세요.</p>
              : <ul className="space-y-1.5">{warnings.map((w) => <li key={w.key} className={`rounded-lg px-3 py-2 text-caption ${w.level === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning-text'}`}><span className="tabular-nums opacity-70">{fmtT(w.t)}</span> {w.text}</li>)}</ul>}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <RulesEditor features={features} rules={rules} onChange={(next) => change({ rules: next })} />
        <div className="space-y-4">
          <Card title="앱 화면 (블루투스로 보이는 값)" icon={Smartphone}>
            {!s.input.app && <p className="text-caption text-muted-foreground">조작판에서 ‘앱 연결’을 켜면 앱에서 출력을 바꿔 볼 수 있습니다.</p>}
            <div className="space-y-2">
              {features.filter((f) => f.kind !== 'custom').map((f) => {
                const v = app[f.id];
                const L = OUTPUT_LEVELS[f.kind];
                return (
                  <div key={f.id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-baseline gap-2 text-caption"><span className="font-medium">{f.name}</span><span className="ml-auto font-semibold tabular-nums">{s.input.app ? `${v ?? '—'}${unit(f)}` : '—'}</span></div>
                    {L && s.input.app && (L.on === 1
                      ? <Switch className="mt-1" checked={(s.levels[f.id] || 0) > 0} onCheckedChange={(on) => { appWrite(s, f.id, on ? 1 : 0); setFrame((n) => n + 1); }} />
                      : <Slider className="mt-2" min={0} max={L.on} step={f.kind === 'buzzer' ? 100 : 1} value={[s.levels[f.id] || 0]} onValueChange={([x]) => { appWrite(s, f.id, x); setFrame((n) => n + 1); }} aria-label={`${f.name} 앱 값`} />)}
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="동작 기록" icon={ListTree}>
            <div className="max-h-56 overflow-y-auto font-mono text-micro">
              {s.events.length === 0 ? <p className="text-muted-foreground">아직 없음</p> : s.events.map((e, i) => (
                <p key={i} className={`flex gap-2 py-0.5 ${e.kind === 'error' ? 'text-destructive' : e.kind === 'warn' ? 'text-warning-text' : e.kind === 'safe' ? 'text-primary' : ''}`}><span className="shrink-0 text-muted-foreground">{e.t.toFixed(2)}s</span><span>{e.text}</span></p>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {!usingFallback && (
        <Card title="3D 부품 연결" icon={Link2}>
          <p className="text-caption text-muted-foreground">기능을 컨셉의 어느 부품이 보여 줄지 정합니다. 연결한 버튼 부품은 3D 에서 눌러지고, LED·모터·히터 부품은 상태에 따라 빛나거나 돌거나 달아오릅니다.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="뚜껑 부품">
              <select value={lidPartId || ''} onChange={(e) => change({ lid_part_id: e.target.value || null })} className="h-9 w-full rounded-md border bg-background px-2 text-label">
                <option value="">없음</option>
                {conceptParts.filter((p) => p.layer === 'SHELL').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            {features.filter((f) => ['button', 'led', 'motor', 'heater', 'servo', 'buzzer', 'relay'].includes(f.kind)).map((f) => (
              <Field key={f.id} label={f.name}>
                <select value={f.part_id || ''} onChange={(e) => change((d) => ({ features: (d.features || []).map((x) => (x.id === f.id ? { ...x, part_id: e.target.value || null } : x)) }))} className="h-9 w-full rounded-md border bg-background px-2 text-label">
                  <option value="">연결 안 함</option>
                  {conceptParts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
