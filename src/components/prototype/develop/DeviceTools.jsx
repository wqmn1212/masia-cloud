import React, { useState } from 'react';
import { Gauge, Timer, Clock, Moon, Loader2, Save, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { localEpoch } from '@/lib/devkit/flasher';

const UNIT = { temp: { label: '°C', toDev: (v) => v * 10, fromDev: (v) => v / 10 }, analog: { label: 'mV', toDev: (v) => v, fromDev: (v) => v }, battery: { label: '%', toDev: (v) => v, fromDev: (v) => v } };
const i32 = (u, o) => new DataView(u.buffer, u.byteOffset, u.byteLength).getInt32(o, true);
const pad = (n) => String(n).padStart(2, '0');

/** 2점(또는 1점) 보정: 장치 단위의 (원시값, 기준값) 점들 → { gain, offset } */
export function solveCalibration(points) {
  if (!points.length) return null;
  let gain = 1;
  if (points.length >= 2 && points[1].raw !== points[0].raw) gain = (points[1].ref - points[0].ref) / (points[1].raw - points[0].raw);
  gain = Math.max(0.5, Math.min(2, gain));
  const offset = Math.round(points[0].ref - gain * points[0].raw);
  return { gain: Math.round(gain * 1000) / 1000, offset: Math.max(-32768, Math.min(32767, offset)) };
}

// 실제 장치 보정·점검: 센서 2점 보정(장치에 저장), 블루투스 응답 시간, 시각 맞추기, 수면 일정
export default function DeviceTools({ gatt, api, calibration = {}, onRecord }) {
  const has = (k) => (gatt.sys || []).some((s) => s.key === k);
  const cals = gatt.chars.filter((c) => UNIT[c.kind]);
  const [state, setState] = useState({}); // uuid → { raw, val, points: [{raw, ref}], ref }
  const [busy, setBusy] = useState('');
  const [ping, setPing] = useState(null);
  const [sched, setSched] = useState(null);
  const [devTime, setDevTime] = useState(null);
  const S = (c) => state[c.uuid] || { points: [] };
  const patch = (c, p) => setState((s) => ({ ...s, [c.uuid]: { ...S(c), ...p } }));
  const run = async (key, fn) => { setBusy(key); try { await fn(); } catch (e) { toast({ title: e?.message || '장치와 주고받지 못했습니다', variant: 'destructive' }); } setBusy(''); };

  const readRaw = (c) => run(`raw-${c.uuid}`, async () => {
    const r = await api.request('calib', new Uint8Array([0x01, c.index]), (b) => b[0] === 0x01 && b[1] === c.index);
    patch(c, { raw: i32(r, 2), val: i32(r, 6) });
  });
  const addPoint = (c) => {
    const s = S(c);
    const ref = Number(s.ref);
    if (s.raw == null || !Number.isFinite(ref)) { toast({ title: '먼저 원시값을 읽고, 기준 계측기 값을 넣으세요' }); return; }
    patch(c, { points: [...s.points.slice(-1), { raw: s.raw, ref: UNIT[c.kind].toDev(ref) }], ref: '' });
  };
  const saveCal = (c) => run(`save-${c.uuid}`, async () => {
    const sol = solveCalibration(S(c).points);
    if (!sol) throw new Error('기록한 점이 없습니다');
    const b = new Uint8Array(6);
    const dv = new DataView(b.buffer);
    b[0] = 0x02; b[1] = c.index; dv.setInt16(2, sol.offset, true); dv.setUint16(4, Math.round(sol.gain * 1000), true);
    await api.request('calib', b, (r) => r[0] === 0x02 && r[1] === c.index);
    onRecord?.({ ...calibration, [c.feature_id]: { name: c.name, kind: c.kind, offset: sol.offset, gain: sol.gain, points: S(c).points, at: new Date().toISOString() } });
    toast({ title: `${c.name} 보정을 장치에 저장했습니다`, description: `배율 ${sol.gain} · 오프셋 ${UNIT[c.kind].fromDev(sol.offset)} ${UNIT[c.kind].label}` });
    await readRaw(c);
  });
  const clearCal = () => run('clear', async () => {
    await api.request('calib', new Uint8Array([0x03]), (r) => r[0] === 0x03);
    const next = { ...calibration };
    cals.forEach((c) => delete next[c.feature_id]);
    onRecord?.(next);
    toast({ title: '장치의 센서 보정을 지웠습니다' });
  });
  const runPing = () => run('ping', async () => {
    const times = [];
    let lost = 0;
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      try { await api.request('ping', new Uint8Array([0xa5, i, 0, 0]), (r) => r[0] === 0xa5 && r[1] === i, 2000); times.push(performance.now() - t0); } catch { lost++; }
      setPing({ running: true, n: i + 1 });
    }
    const sorted = [...times].sort((a, b) => a - b);
    const res = { avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, min: Math.round(sorted[0] ?? 0), max: Math.round(sorted[sorted.length - 1] ?? 0), p90: Math.round(sorted[Math.floor(sorted.length * 0.9)] ?? 0), lost, at: new Date().toISOString() };
    setPing(res);
    onRecord?.({ ...calibration, ping: res });
  });
  const setTime = () => run('time', async () => {
    const t = localEpoch();
    const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, t >>> 0, true);
    await api.write('time', b);
    const back = await api.read('time');
    const v = new DataView(back.buffer, back.byteOffset).getUint32(0, true);
    setDevTime({ v, diff: v - t });
  });
  const readSched = () => run('sched', async () => { const b = await api.read('schedule'); if (b.length >= 8) setSched(Array.from(b.slice(0, 8))); });
  const writeSched = () => run('sched', async () => { await api.write('schedule', new Uint8Array(sched)); toast({ title: '수면 일정을 장치에 저장했습니다' }); });
  const setS = (i, v) => setSched((s) => s.map((x, j) => (j === i ? Math.max(0, Math.min(255, Number(v) || 0)) : x)));
  const hm = (h, m) => `${pad(h)}:${pad(m)}`;
  const setHm = (i, text) => { const [h, m] = String(text).split(':').map(Number); setSched((s) => s.map((x, j) => (j === i ? (h || 0) % 24 : j === i + 1 ? (m || 0) % 60 : x))); };

  if (!api) return null;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-label font-semibold">실제 장치 보정 · 점검</p>
      {has('calib') && cals.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-caption font-semibold"><Gauge className="w-4 h-4 text-primary" />센서 보정 (2점, 장치에 저장)</p>
          <p className="text-micro text-muted-foreground">기준 계측기(온도계·멀티미터)로 잰 값과 장치 원시값을 두 점에서 기록하면 배율·오프셋을 계산해 장치에 저장합니다. 한 점만 기록하면 오프셋만 맞춥니다.</p>
          {cals.map((c) => {
            const s = S(c), U = UNIT[c.kind];
            const sol = solveCalibration(s.points);
            const saved = calibration[c.feature_id];
            return (
              <div key={c.uuid} className="rounded-lg bg-secondary px-3 py-2 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-caption">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">원시 {s.raw == null ? '—' : `${U.fromDev(s.raw)} ${U.label}`} · 보정 후 {s.val == null ? '—' : `${U.fromDev(s.val)} ${U.label}`}</span>
                  {saved && <span className="text-micro text-success-text">저장됨 ×{saved.gain} {saved.offset >= 0 ? '+' : ''}{U.fromDev(saved.offset)}</span>}
                  <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => readRaw(c)} disabled={!!busy}>{busy === `raw-${c.uuid}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}원시값 읽기</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label={`${c.name} 기준값`} value={s.ref ?? ''} onChange={(e) => patch(c, { ref: e.target.value })} placeholder={`기준값 (${U.label})`} className="h-8 w-32 text-caption" inputMode="decimal" />
                  <Button size="sm" variant="outline" className="h-8" onClick={() => addPoint(c)}>{s.points.length ? '2점 기록' : '1점 기록'}</Button>
                  <span className="text-micro text-muted-foreground tabular-nums">{s.points.map((p, i) => `점${i + 1}: 원시 ${U.fromDev(p.raw)} → ${U.fromDev(p.ref)}`).join(' · ') || '기록 없음'}</span>
                  {sol && <span className="text-micro tabular-nums">→ 배율 {sol.gain}, 오프셋 {U.fromDev(sol.offset)} {U.label}</span>}
                  <Button size="sm" className="h-8" onClick={() => saveCal(c)} disabled={!sol || !!busy}><Save className="w-3.5 h-3.5" />장치에 저장</Button>
                </div>
              </div>
            );
          })}
          <Button size="sm" variant="ghost" onClick={clearCal} disabled={!!busy}><Eraser className="w-4 h-4" />장치 보정 모두 지우기</Button>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {has('ping') && (
          <div className="rounded-lg bg-secondary px-3 py-2 space-y-1">
            <p className="flex items-center gap-1.5 text-caption font-semibold"><Timer className="w-4 h-4 text-primary" />블루투스 응답 시간</p>
            <Button size="sm" variant="outline" className="h-7" onClick={runPing} disabled={!!busy}>{busy === 'ping' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}20번 왕복 재기</Button>
            {ping && (ping.running ? <p className="text-micro text-muted-foreground">{ping.n}/20</p> : <p className="text-micro tabular-nums">평균 {ping.avg ?? '—'} ms · 최소 {ping.min} · 90% {ping.p90} · 최대 {ping.max} ms · 잃음 {ping.lost}</p>)}
            {!ping && calibration.ping && <p className="text-micro text-muted-foreground tabular-nums">지난번 평균 {calibration.ping.avg} ms</p>}
          </div>
        )}
        {has('time') && (
          <div className="rounded-lg bg-secondary px-3 py-2 space-y-1">
            <p className="flex items-center gap-1.5 text-caption font-semibold"><Clock className="w-4 h-4 text-primary" />장치 시각</p>
            <Button size="sm" variant="outline" className="h-7" onClick={setTime} disabled={!!busy}>지금 시각으로 맞추기</Button>
            {devTime && <p className="text-micro tabular-nums">장치 {new Date(devTime.v * 1000).toISOString().slice(11, 19)} (차이 {devTime.diff} 초)</p>}
          </div>
        )}
        {has('schedule') && (
          <div className="rounded-lg bg-secondary px-3 py-2 space-y-1">
            <p className="flex items-center gap-1.5 text-caption font-semibold"><Moon className="w-4 h-4 text-primary" />수면 일정 (장치)</p>
            {!sched ? <Button size="sm" variant="outline" className="h-7" onClick={readSched} disabled={!!busy}>장치에서 읽기</Button> : (
              <div className="space-y-1 text-micro">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!sched[0]} onChange={(e) => setS(0, e.target.checked ? 1 : 0)} />일정 켜기</label>
                <div className="flex items-center gap-1">취침 <Input aria-label="취침 시각" type="time" value={hm(sched[1], sched[2])} onChange={(e) => setHm(1, e.target.value)} className="h-7 w-24" /> 감광 <Input aria-label="감광 분" value={sched[3]} onChange={(e) => setS(3, e.target.value)} className="h-7 w-12" />분</div>
                <div className="flex items-center gap-1">기상 <Input aria-label="기상 시각" type="time" value={hm(sched[4], sched[5])} onChange={(e) => setHm(4, e.target.value)} className="h-7 w-24" /> 증광 <Input aria-label="증광 분" value={sched[6]} onChange={(e) => setS(6, e.target.value)} className="h-7 w-12" />분</div>
                <div className="flex items-center gap-1">기상 밝기 <Input aria-label="기상 밝기" value={sched[7]} onChange={(e) => setS(7, e.target.value)} className="h-7 w-12" />%
                  <Button size="sm" className="ml-auto h-7" onClick={writeSched} disabled={!!busy}>저장</Button></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
