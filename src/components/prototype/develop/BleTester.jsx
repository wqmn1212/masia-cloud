import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bluetooth, BluetoothOff, Loader2, Send, Cpu, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { encodeValue, decodeValue, bytesHex, showValue } from '@/lib/devkit/ble';
import DeviceTools from '@/components/prototype/develop/DeviceTools';

const now = () => new Date().toTimeString().slice(0, 8);

// 가상 장치: 실제 장치 없이 앱 화면·통신 흐름을 미리 보는 용도. 펌웨어와 같은 값 형식으로 움직인다
function virtualDevice(gatt, onNotify, onSys) {
  const vals = new Map();
  const cal = {};
  let clock = { base: 0, at: Date.now() };
  let sched = new Uint8Array([1, 23, 0, 30, 8, 0, 30, 100]);
  const devUnits = (c) => { const v = decodeValue(c, vals.get(c.uuid)) ?? 0; return Math.round(c.kind === 'temp' ? v * 10 + 7 : c.kind === 'analog' ? v * 1.03 : v); }; // 일부러 조금 틀린 센서
  gatt.chars.forEach((c) => vals.set(c.uuid, encodeValue(c, c.kind === 'temp' ? 24.8 : c.kind === 'battery' ? 87 : c.kind === 'analog' ? 1650 : 0)));
  let t = 0;
  const timer = setInterval(() => {
    t += 1;
    gatt.chars.forEach((c) => {
      if (!c.access.includes('notify') || c.type === 'bytes') return;
      let v = null;
      if (c.kind === 'temp') v = 24.8 + Math.sin(t / 5) * 0.6;
      if (c.kind === 'analog') v = 1650 + Math.sin(t / 3) * 900;
      if (c.kind === 'battery' && t % 10 === 0) v = Math.max(0, decodeValue(c, vals.get(c.uuid)) - 1);
      if (c.kind === 'button' && t % 7 === 0) v = 1;
      if (c.kind === 'button' && t % 7 === 1) v = 0;
      if (v == null) return;
      const b = encodeValue(c, v);
      if (bytesHex(b) === bytesHex(vals.get(c.uuid))) return;
      vals.set(c.uuid, b);
      onNotify(c, b);
    });
  }, 700);
  const reply = (key, bytes, ms) => setTimeout(() => onSys(key, bytes), ms);
  const ota = { size: 0, got: 0, on: false };
  const ota5 = (code, v) => { const r = new Uint8Array(5); r[0] = code; new DataView(r.buffer).setUint32(1, v >>> 0, true); return r; };
  return {
    read: async (c) => vals.get(c.uuid) || new Uint8Array(0),
    write: async (c, b) => { vals.set(c.uuid, b); if (c.type === 'bytes') setTimeout(() => onNotify(c, b), 120); },
    sysRead: async (key) => {
      if (key === 'time') { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, (clock.base + Math.floor((Date.now() - clock.at) / 1000)) >>> 0, true); return b; }
      if (key === 'schedule') return sched.slice();
      return new Uint8Array(0);
    },
    sysWrite: async (key, b) => {
      if (key === 'ping') reply('ping', b.slice(), 25 + Math.random() * 35);
      if (key === 'ota') { // 가상 장치: 받은 크기만 센다
        if (b[0] === 0x01) { ota.size = new DataView(b.buffer, b.byteOffset).getUint32(1, true); ota.got = 0; ota.on = true; reply('ota', ota5(0x01, ota.size), 30); }
        else if (b[0] === 0x02 && ota.on) ota.got += b.length - 1;
        else if (b[0] === 0x03 && ota.on) { ota.on = false; reply('ota', ota5(ota.got === ota.size ? 0x03 : 0xe3, ota.got), 60); }
        else if (b[0] === 0x04) { ota.on = false; reply('ota', ota5(0x04, 0), 20); }
      }
      if (key === 'time') clock = { base: new DataView(b.buffer, b.byteOffset).getUint32(0, true), at: Date.now() };
      if (key === 'schedule') sched = b.slice(0, 8);
      if (key === 'calib') {
        if (b[0] === 0x01) {
          const c = gatt.chars.find((x) => x.index === b[1]);
          const raw = c ? devUnits(c) : 0;
          const k = cal[b[1]] || { off: 0, gain: 1000 };
          const r = new Uint8Array(10); const dv = new DataView(r.buffer);
          r[0] = 1; r[1] = b[1]; dv.setInt32(2, raw, true); dv.setInt32(6, Math.round((raw * k.gain) / 1000) + k.off, true);
          reply('calib', r, 40);
        } else if (b[0] === 0x02) { const dv = new DataView(b.buffer, b.byteOffset); cal[b[1]] = { off: dv.getInt16(2, true), gain: dv.getUint16(4, true) }; reply('calib', new Uint8Array([2, b[1]]), 40); }
        else if (b[0] === 0x03) { Object.keys(cal).forEach((k) => delete cal[k]); reply('calib', new Uint8Array([3]), 40); }
      }
    },
    close: () => clearInterval(timer),
  };
}

// 실제 장치: Web Bluetooth (크롬·엣지 데스크톱, 안드로이드 크롬). 서비스 UUID 로 걸러 찾는다
async function realDevice(gatt, onNotify, onGone, onSys) {
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [gatt.service] }], optionalServices: [gatt.service] });
  device.addEventListener('gattserverdisconnected', onGone);
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService(gatt.service);
  const chars = new Map();
  for (const c of gatt.chars) {
    try {
      const ch = await svc.getCharacteristic(c.uuid);
      chars.set(c.uuid, ch);
      if (c.access.includes('notify')) {
        ch.addEventListener('characteristicvaluechanged', (e) => onNotify(c, new Uint8Array(e.target.value.buffer)));
        await ch.startNotifications();
      }
    } catch { /* 펌웨어에 없는 항목은 건너뛴다 */ }
  }
  const sys = new Map();
  for (const c of gatt.sys || []) {
    try {
      const ch = await svc.getCharacteristic(c.uuid);
      sys.set(c.key, ch);
      if (c.access.includes('notify')) {
        ch.addEventListener('characteristicvaluechanged', (e) => onSys(c.key, new Uint8Array(e.target.value.buffer)));
        await ch.startNotifications();
      }
    } catch { /* 예전 펌웨어에는 시스템 항목이 없다 */ }
  }
  let fw = '';
  try { fw = new TextDecoder().decode((await svc.getCharacteristic(gatt.info.uuid).then((x) => x.readValue())).buffer); } catch { /* 없음 */ }
  return {
    name: device.name, fw, missing: gatt.chars.filter((c) => !chars.has(c.uuid)).map((c) => c.name),
    read: async (c) => new Uint8Array((await chars.get(c.uuid).readValue()).buffer),
    write: async (c, b) => chars.get(c.uuid).writeValue(b),
    sysRead: async (key) => { const ch = sys.get(key); if (!ch) throw new Error('장치 펌웨어에 이 항목이 없습니다 (펌웨어를 다시 구우세요)'); return new Uint8Array((await ch.readValue()).buffer); },
    sysWrite: async (key, b) => { const ch = sys.get(key); if (!ch) throw new Error('장치 펌웨어에 이 항목이 없습니다 (펌웨어를 다시 구우세요)'); await ch.writeValue(b); },
    sysKeys: [...sys.keys()],
    close: () => { try { device.gatt.disconnect(); } catch { /* 이미 끊김 */ } },
  };
}

export default function BleTester({ gatt, calibration, onCalibration }) {
  const [mode, setMode] = useState(null); // null | 'sim' | 'real'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState(null);
  const [vals, setVals] = useState({});
  const [drafts, setDrafts] = useState({});
  const [log, setLog] = useState([]);
  const dev = useRef(null);
  const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  const push = (dir, c, b) => setLog((l) => [{ t: now(), dir, name: c.name, hex: bytesHex(b), value: showValue(c, decodeValue(c, b)) }, ...l].slice(0, 60));
  const onNotify = (c, b) => { setVals((v) => ({ ...v, [c.uuid]: decodeValue(c, b) })); push('←', c, b); };
  const listeners = useRef(new Map());
  const onSys = (key, b) => (listeners.current.get(key) || new Set()).forEach((fn) => fn(b));
  const stop = () => { dev.current?.close(); dev.current = null; setMode(null); setInfo(null); };
  // 시스템 항목(보정·응답 확인·시각·일정) 주고받기: request 는 알림으로 온 답을 기다린다
  const api = useMemo(() => (mode ? {
    read: (key) => dev.current.sysRead(key),
    write: (key, b) => dev.current.sysWrite(key, b),
    request: (key, b, match, timeout = 3000) => new Promise((resolve, reject) => {
      const set = listeners.current.get(key) || new Set();
      listeners.current.set(key, set);
      let timer = null;
      const fn = (r) => { if (match(r)) { done(); resolve(r); } };
      const done = () => { set.delete(fn); clearTimeout(timer); };
      set.add(fn);
      timer = setTimeout(() => { done(); reject(new Error('장치가 응답하지 않습니다 (펌웨어에 이 항목이 있는지 확인하세요)')); }, timeout);
      dev.current.sysWrite(key, b).catch((e) => { done(); reject(e); });
    }),
  } : null), [mode]);
  useEffect(() => () => dev.current?.close(), []);
  useEffect(() => { stop(); setVals({}); setLog([]); }, [gatt.service]);  

  const readAll = async (d = dev.current) => {
    const next = {};
    for (const c of gatt.chars) if (c.access.includes('read')) { try { next[c.uuid] = decodeValue(c, await d.read(c)); } catch { /* 건너뜀 */ } }
    setVals((v) => ({ ...v, ...next }));
  };

  const start = async (kind) => {
    setErr(''); setBusy(true);
    try {
      const d = kind === 'sim' ? virtualDevice(gatt, onNotify, onSys) : await realDevice(gatt, onNotify, () => { setErr('장치 연결이 끊겼습니다.'); stop(); }, onSys);
      dev.current = d;
      setMode(kind);
      setInfo(kind === 'sim' ? { name: `${gatt.device_name} (가상)`, fw: '가상 장치' } : { name: d.name, fw: d.fw, missing: d.missing });
      await readAll(d);
    } catch (e) {
      setErr(e?.name === 'NotFoundError' ? '장치를 고르지 않았거나 찾지 못했습니다. 장치가 광고 중인지, 펌웨어의 서비스 UUID 가 같은지 확인하세요.' : e?.message || '연결하지 못했습니다.');
    }
    setBusy(false);
  };

  const send = async (c, value) => {
    const b = encodeValue(c, value);
    try { await dev.current.write(c, b); push('→', c, b); if (c.type !== 'bytes') setVals((v) => ({ ...v, [c.uuid]: decodeValue(c, b) })); }
    catch (e) { setErr(e?.message || '보내지 못했습니다.'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {mode ? (
          <>
            <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-caption font-medium text-success-text"><Bluetooth className="w-3.5 h-3.5" />{info?.name} 연결됨{info?.fw ? ` · ${info.fw}` : ''}</span>
            <Button size="sm" variant="outline" onClick={() => readAll()}><RefreshCw className="w-4 h-4" />다시 읽기</Button>
            <Button size="sm" variant="ghost" onClick={stop}><BluetoothOff className="w-4 h-4" />끊기</Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => start('real')} disabled={!supported || busy || !gatt.chars.length}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />}실제 장치 연결</Button>
            <Button size="sm" variant="outline" onClick={() => start('sim')} disabled={busy || !gatt.chars.length}><Cpu className="w-4 h-4" />가상 장치로 시험</Button>
            {!supported && <span className="text-micro text-muted-foreground">이 브라우저는 웹 블루투스를 지원하지 않습니다 (크롬·엣지 데스크톱 또는 안드로이드 크롬).</span>}
          </>
        )}
      </div>
      {err && <p className="text-caption text-destructive">{err}</p>}
      {info?.missing?.length > 0 && <p className="text-caption text-warning-text">장치 펌웨어에 없는 항목: {info.missing.join(', ')} — 펌웨어를 다시 올리세요.</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        {gatt.chars.map((c) => {
          const canWrite = !!mode && c.access.includes('write');
          const v = vals[c.uuid];
          const draft = drafts[c.uuid] ?? (c.type === 'bytes' ? '' : v ?? 0);
          return (
            <div key={c.uuid} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-baseline gap-2">
                <p className="text-label font-semibold truncate">{c.name}</p>
                <p className="ml-auto text-title font-semibold tabular-nums">{mode ? showValue(c, v) : '—'}</p>
              </div>
              {c.access.includes('write') && c.type !== 'bytes' && c.max === 1 && (
                <label className="flex items-center gap-2 text-caption"><Switch checked={!!v} disabled={!canWrite} onCheckedChange={(on) => send(c, on ? 1 : 0)} />{v ? '켬' : '끔'}</label>
              )}
              {c.access.includes('write') && c.type !== 'bytes' && c.max > 1 && (
                <div className="flex items-center gap-3">
                  <Slider min={c.min} max={c.max} step={c.max > 1000 ? 50 : 1} value={[Number(draft) || 0]} disabled={!canWrite}
                    onValueChange={([x]) => setDrafts((d) => ({ ...d, [c.uuid]: x }))} onValueCommit={([x]) => send(c, x)} className="flex-1" />
                  <span className="w-16 text-right text-caption tabular-nums">{draft}{c.unit ? ` ${c.unit}` : ''}</span>
                </div>
              )}
              {c.access.includes('write') && c.type === 'bytes' && (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(c, draft); }}>
                  <Input value={draft} placeholder="01 05 또는 글자" disabled={!canWrite} onChange={(e) => setDrafts((d) => ({ ...d, [c.uuid]: e.target.value }))} className="h-8 font-mono text-caption" />
                  <Button size="sm" type="submit" disabled={!canWrite}><Send className="w-4 h-4" /></Button>
                </form>
              )}
              <p className="text-micro text-muted-foreground truncate">{c.desc}</p>
            </div>
          );
        })}
      </div>

      {mode && <DeviceTools gatt={gatt} api={api} calibration={calibration} onRecord={mode === 'real' ? onCalibration : undefined} />}

      <div className="rounded-lg border">
        <p className="border-b px-3 py-1.5 text-caption font-semibold text-muted-foreground">통신 기록 (→ 앱이 보냄 · ← 장치 알림)</p>
        <div className="max-h-48 overflow-y-auto px-3 py-1.5 font-mono text-micro">
          {log.length === 0 ? <p className="py-2 text-muted-foreground">아직 없음</p> : log.map((l, i) => (
            <p key={i} className="flex gap-2 py-0.5"><span className="text-muted-foreground">{l.t}</span><span className={l.dir === '→' ? 'text-primary' : 'text-success-text'}>{l.dir}</span><span className="truncate">{l.name}</span><span className="ml-auto shrink-0">{l.value}</span><span className="shrink-0 text-muted-foreground">[{l.hex}]</span></p>
          ))}
        </div>
      </div>
    </div>
  );
}
