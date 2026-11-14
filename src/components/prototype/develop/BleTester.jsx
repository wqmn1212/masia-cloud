import React, { useEffect, useRef, useState } from 'react';
import { Bluetooth, BluetoothOff, Loader2, Send, Cpu, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { encodeValue, decodeValue, bytesHex, showValue } from '@/lib/devkit/ble';

const now = () => new Date().toTimeString().slice(0, 8);

// 가상 장치: 실제 장치 없이 앱 화면·통신 흐름을 미리 보는 용도. 펌웨어와 같은 값 형식으로 움직인다
function virtualDevice(gatt, onNotify) {
  const vals = new Map();
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
  return {
    read: async (c) => vals.get(c.uuid) || new Uint8Array(0),
    write: async (c, b) => { vals.set(c.uuid, b); if (c.type === 'bytes') setTimeout(() => onNotify(c, b), 120); },
    close: () => clearInterval(timer),
  };
}

// 실제 장치: Web Bluetooth (크롬·엣지 데스크톱, 안드로이드 크롬). 서비스 UUID 로 걸러 찾는다
async function realDevice(gatt, onNotify, onGone) {
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
  let fw = '';
  try { fw = new TextDecoder().decode((await svc.getCharacteristic(gatt.info.uuid).then((x) => x.readValue())).buffer); } catch { /* 없음 */ }
  return {
    name: device.name, fw, missing: gatt.chars.filter((c) => !chars.has(c.uuid)).map((c) => c.name),
    read: async (c) => new Uint8Array((await chars.get(c.uuid).readValue()).buffer),
    write: async (c, b) => chars.get(c.uuid).writeValue(b),
    close: () => { try { device.gatt.disconnect(); } catch { /* 이미 끊김 */ } },
  };
}

export default function BleTester({ gatt }) {
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
  const stop = () => { dev.current?.close(); dev.current = null; setMode(null); setInfo(null); };
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
      const d = kind === 'sim' ? virtualDevice(gatt, onNotify) : await realDevice(gatt, onNotify, () => { setErr('장치 연결이 끊겼습니다.'); stop(); });
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
