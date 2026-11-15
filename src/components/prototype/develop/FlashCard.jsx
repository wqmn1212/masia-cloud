import React, { useEffect, useRef, useState } from 'react';
import { Usb, Hammer, Loader2, Upload, Cpu, Clock, Info, ExternalLink, Save, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Card, CommandLine } from '@/components/prototype/develop/DevBits';
import { MCUS } from '@/lib/devkit/features';
import { serialSupported, buildStatus, buildAndWait, flashBinary, SerialMonitor, localEpoch, CHIP_NAME } from '@/lib/devkit/flasher';
import { errorText, uploadProtoFile, addProtoFiles } from '@/lib/prototypeApi';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

// 펌웨어 빌드 → USB 로 굽기 → 시리얼로 동작 확인. 빌드 서버(GitHub Actions)가 없으면 직접 만든 .bin 을 고른다.
export default function FlashCard({ project, dev, sketch, user, onSaved }) {
  const mcu = MCUS[dev.mcu] ? dev.mcu : 'esp32c3';
  const M = MCUS[mcu];
  const [server, setServer] = useState(null); // { ready, repo }
  const [bin, setBin] = useState(null); // { bytes, name, from }
  const [build, setBuild] = useState(null); // { state, secs, run_url, error }
  const [flash, setFlash] = useState(null); // { progress, chip, done, error }
  const [lines, setLines] = useState([]);
  const [monitor, setMonitor] = useState(null);
  const [busy, setBusy] = useState('');
  const abort = useRef(null);
  const logRef = useRef(null);
  const portRef = useRef(null);
  const canSerial = serialSupported();
  const push = (l) => setLines((x) => [...x.slice(-300), l]);

  useEffect(() => { buildStatus().then(setServer).catch(() => setServer({ ready: false })); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [lines]);
  const monRef = useRef(null);
  monRef.current = monitor;
  useEffect(() => () => { abort.current?.abort(); monRef.current?.close(); }, []); // 화면을 떠날 때만
  useEffect(() => { setBin(null); setBuild(null); }, [sketch]); // 펌웨어가 바뀌면 예전 바이너리는 쓰지 않는다

  const runBuild = async () => {
    setBusy('build');
    setBuild({ state: 'queued', secs: 0 });
    abort.current = new AbortController();
    try {
      const r = await buildAndWait(sketch, M.fqbn, { signal: abort.current.signal, onState: (state, secs, run_url) => setBuild({ state, secs, run_url }) });
      setBin({ bytes: r.bin, name: r.name, from: '빌드 서버' });
      setBuild({ state: 'done', run_url: r.run_url });
      toast({ title: `컴파일 완료 (${(r.bin.length / 1024).toFixed(0)} KB)`, description: 'USB 로 굽기를 누르세요' });
    } catch (e) { setBuild({ state: 'failed', error: e.message, run_url: e.run_url }); }
    setBusy('');
  };
  const pickBin = async (file) => {
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 0xe9) { toast({ title: 'ESP32 바이너리가 아닙니다', description: 'Arduino IDE 의 "컴파일된 바이너리 내보내기"로 만든 *.merged.bin 을 고르세요 (0x0 에 굽습니다).', variant: 'destructive' }); return; }
    setBin({ bytes, name: file.name, from: '직접 고른 파일' });
  };
  const runFlash = async () => {
    setBusy('flash');
    setFlash({ progress: 0 });
    await monitor?.close(); setMonitor(null);
    try {
      const r = await flashBinary(bin.bytes, { mcu, onLog: push, onProgress: (p) => setFlash((f) => ({ ...f, progress: p })) });
      portRef.current = r.port;
      setFlash({ progress: 1, chip: r.chip, done: true });
      toast({ title: `${r.chip} 에 구웠습니다`, description: '시리얼 모니터로 부팅 메시지를 확인하세요' });
    } catch (e) { setFlash({ error: errorText(e) }); push(`오류: ${errorText(e)}`); }
    setBusy('');
  };
  const openMonitor = async () => {
    try {
      const m = new SerialMonitor((l) => push(l));
      // USB 내장(C3·S3)은 다시 시작하면 포트가 새로 잡혀 다시 골라야 할 수 있다
      try { await m.open(portRef.current || undefined); } catch { await m.open(); }
      portRef.current = m.port;
      setMonitor(m);
      await m.send('info');
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
  };
  const closeMonitor = async () => { await monitor?.close(); setMonitor(null); };
  const saveSketch = async () => {
    setBusy('save');
    try {
      const files = [new File([sketch], `${dev.device_name || 'firmware'}-${stamp()}.ino`, { type: 'text/plain' })];
      if (bin?.bytes) files.push(new File([bin.bytes], `${dev.device_name || 'firmware'}-${stamp()}.merged.bin`, { type: 'application/octet-stream' }));
      const up = [];
      for (const f of files) up.push(await uploadProtoFile(f, user, { category: 'CODE', note: `워크벤치 펌웨어 (${M.board}${f.name.endsWith('.bin') ? ', 0x0 에 굽는 합친 바이너리' : ''})` }));
      await addProtoFiles(project.id, up);
      onSaved?.();
      toast({ title: `펌웨어 ${up.length}개 파일을 시제품 파일에 저장했습니다` });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  const sketchDir = (dev.device_name || 'firmware').replace(/[^A-Za-z0-9_-]/g, '_');
  return (
    <Card title="펌웨어 빌드 · 굽기" icon={Usb} tag={CHIP_NAME[mcu]}
      actions={<Button size="sm" variant="outline" onClick={saveSketch} disabled={!!busy}>{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}프로젝트에 저장</Button>}>
      <ol className="grid gap-3 md:grid-cols-3">
        <li className="rounded-lg border p-3 space-y-2">
          <p className="text-label font-semibold">1. 컴파일</p>
          {server?.ready ? (
            <Button size="sm" onClick={runBuild} disabled={!!busy}>{busy === 'build' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}빌드 서버에서 컴파일</Button>
          ) : (
            <p className="text-micro text-muted-foreground">{server ? '빌드 서버가 아직 연결되지 않았습니다 (관리자: GitHub 토큰 설정 필요). 아래 명령으로 직접 컴파일해 .bin 을 고를 수 있습니다.' : '빌드 서버 확인 중…'}</p>
          )}
          {build && (
            <p className={`text-micro ${build.state === 'failed' ? 'text-destructive whitespace-pre-wrap' : 'text-muted-foreground'}`}>
              {build.state === 'queued' && `대기 중… ${build.secs || 0}초`}
              {build.state === 'building' && `컴파일 중… ${build.secs || 0}초 (처음은 3~5분)`}
              {build.state === 'done' && '컴파일 완료'}
              {build.state === 'failed' && (build.error || '컴파일 실패')}
              {build.run_url && <a href={build.run_url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary">기록<ExternalLink className="w-3 h-3" /></a>}
            </p>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1 text-micro text-primary">
            <Upload className="w-3.5 h-3.5" />직접 만든 .bin 고르기
            <input type="file" accept=".bin" className="sr-only" onChange={(e) => pickBin(e.target.files?.[0])} />
          </label>
        </li>
        <li className="rounded-lg border p-3 space-y-2">
          <p className="text-label font-semibold">2. USB 로 굽기</p>
          {bin ? <p className="text-micro text-muted-foreground">{bin.name} · {(bin.bytes.length / 1024).toFixed(0)} KB ({bin.from})</p> : <p className="text-micro text-muted-foreground">컴파일된 바이너리가 아직 없습니다.</p>}
          <Button size="sm" onClick={runFlash} disabled={!bin || !canSerial || !!busy}>{busy === 'flash' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}USB 로 굽기</Button>
          {flash && !flash.error && <div className="h-1.5 rounded-full bg-secondary"><div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${Math.round((flash.progress || 0) * 100)}%` }} /></div>}
          {flash?.error && <p className="text-micro text-destructive">{flash.error}</p>}
          {!canSerial && <p className="text-micro text-warning-text">이 브라우저는 USB 시리얼을 지원하지 않습니다. 데스크톱 크롬·엣지에서 여세요.</p>}
        </li>
        <li className="rounded-lg border p-3 space-y-2">
          <p className="text-label font-semibold">3. 동작 확인</p>
          <div className="flex flex-wrap gap-1.5">
            {monitor
              ? <Button size="sm" variant="outline" onClick={closeMonitor}><Square className="w-4 h-4" />모니터 닫기</Button>
              : <Button size="sm" variant="outline" onClick={openMonitor} disabled={!canSerial || busy === 'flash'}><Usb className="w-4 h-4" />시리얼 모니터</Button>}
            <Button size="sm" variant="outline" onClick={() => monitor?.send('info')} disabled={!monitor}><Info className="w-4 h-4" />버전</Button>
            <Button size="sm" variant="outline" onClick={() => monitor?.send(`time ${localEpoch()}`)} disabled={!monitor}><Clock className="w-4 h-4" />시각 맞추기</Button>
            <Button size="sm" variant="outline" onClick={() => monitor?.send('read')} disabled={!monitor}>입력값</Button>
          </div>
          <p className="text-micro text-muted-foreground">그다음 아래 ‘장치 시험’에서 블루투스로 연결해 버튼·센서·출력을 확인합니다.</p>
        </li>
      </ol>
      <div ref={logRef} className="max-h-40 overflow-y-auto rounded-lg bg-secondary px-3 py-2 font-mono text-micro" aria-live="polite">
        {lines.length ? lines.map((l, i) => <p key={i} className="whitespace-pre-wrap">{l}</p>) : <p className="text-muted-foreground">굽기·시리얼 기록이 여기에 나옵니다.</p>}
      </div>
      <details className="text-caption">
        <summary className="cursor-pointer text-muted-foreground">직접 컴파일하기 (arduino-cli)</summary>
        <div className="mt-2 space-y-1.5">
          <CommandLine label="ESP32 코어 설치 (한 번)" cmd="arduino-cli core install esp32:esp32@3.0.7 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json" />
          <CommandLine label={`컴파일 (${sketchDir}/${sketchDir}.ino)`} cmd={`arduino-cli compile --fqbn ${M.fqbn} --export-binaries ${sketchDir}`} />
          <p className="text-micro text-muted-foreground">{sketchDir}/build/ 아래 *.merged.bin 을 위 ‘직접 만든 .bin 고르기’로 고르면 이 화면에서 굽습니다.</p>
        </div>
      </details>
    </Card>
  );
}
