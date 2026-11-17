import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Usb, Play, Check, X, Loader2, Save, RotateCcw, Cpu, Languages } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { useProtoProject, actorName, errorText } from '@/lib/prototypeApi';
import { serialSupported, SerialMonitor, flashBinary, localEpoch } from '@/lib/devkit/flasher';
import { factoryPlan, parseSelftest, judgeAuto, verdictOf, nextSerial, unitRecord } from '@/lib/devkit/factoryTest';

const mem = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch { /* 저장소 없음 */ } return v; };

// 출하 검사대: USB 로 기기를 꽂고 굽기(선택) → 자동 검사 → 버튼·출력 확인 → 판정 → 일련번호와 함께 양산 시리얼 기록에 저장. 공장에서는 중국어로 본다.
export default function PrototypeFactoryTest() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { data: project, isLoading } = useProtoProject(projectId);
  const [zh, setZh] = useState(() => mem('factoryTestLang') !== 'ko');
  const T = (ko, cn) => (zh ? cn : ko);
  const dev = project?.dev || {};
  const plan = useMemo(() => factoryPlan(dev), [project?.dev]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mon, setMon] = useState(null);
  const [json, setJson] = useState(null);
  const [results, setResults] = useState({});
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState('');
  const [waiting, setWaiting] = useState(''); // 누르기를 기다리는 항목 id
  const [bin, setBin] = useState(null);
  const [flashP, setFlashP] = useState(null);
  const [prefix, setPrefix] = useState(() => mem(`ftPrefix-${projectId}`) || 'SN');
  const [lot, setLot] = useState(() => mem(`ftLot-${projectId}`));
  const [serial, setSerial] = useState('');
  const [count, setCount] = useState({ pass: 0, fail: 0 });
  const [log, setLog] = useState([]);
  const jsonWait = useRef(null);
  const monRef = useRef(null);
  monRef.current = mon;
  useEffect(() => () => { monRef.current?.close(); }, []);
  useEffect(() => { if (project && !serial) setSerial(nextSerial(prefix, mem(`ftLast-${projectId}`))); }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLine = (l) => {
    setLog((x) => [...x.slice(-60), l]);
    const j = parseSelftest(l);
    if (j && jsonWait.current) { jsonWait.current(j); jsonWait.current = null; }
  };
  const selftest = (m, ms = 3000) => new Promise((resolve, reject) => {
    jsonWait.current = resolve;
    setTimeout(() => { if (jsonWait.current === resolve) { jsonWait.current = null; reject(new Error(T('기기가 응답하지 않습니다 (펌웨어·USB 확인)', '设备无应答（请检查固件和USB）'))); } }, ms);
    m.send('selftest').catch(reject);
  });
  const connect = async () => {
    setBusy('connect');
    try { const m = new SerialMonitor(onLine); await m.open(); setMon(m); return m; }
    catch (e) { toast({ title: errorText(e), variant: 'destructive' }); return null; }
    finally { setBusy(''); }
  };
  const reset = () => { setJson(null); setResults({}); setValues({}); setWaiting(''); setFlashP(null); };
  const runFlash = async () => {
    setBusy('flash');
    try {
      await mon?.close(); setMon(null);
      await flashBinary(bin.bytes, { mcu: dev.mcu, onProgress: setFlashP });
      toast({ title: T('굽기 완료 — "연결"을 다시 누르세요', '烧录完成 — 请重新点击"连接"') });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };
  const runAuto = async () => {
    setBusy('auto');
    try {
      const m = mon || await connect();
      if (!m) return;
      await m.send(`time ${localEpoch()}`).catch(() => {});
      const j = await selftest(m);
      setJson(j);
      const rows = judgeAuto(plan, j);
      setResults((r) => ({ ...r, ...Object.fromEntries(rows.map((x) => [x.id, x.ok])) }));
      setValues((v) => ({ ...v, ...Object.fromEntries(rows.map((x) => [x.id, String(x.value ?? '')])) }));
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };
  // 버튼: 8초 안에 눌림(값 1)이 보이면 통과
  const runPress = async (p) => {
    setWaiting(p.id);
    let ok = false;
    try {
      for (let i = 0; i < 20 && !ok; i++) { const j = await selftest(mon, 1500); ok = j[p.key] === 1; if (!ok) await new Promise((r) => setTimeout(r, 250)); }
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setResults((r) => ({ ...r, [p.id]: ok }));
    setWaiting('');
  };
  const outOn = async (o, on) => { try { await mon.send(`out ${o.index} ${on ? o.on : 0}`); } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); } };
  const markOut = async (o, ok) => { await outOn(o, false); setResults((r) => ({ ...r, [o.id]: ok })); };

  const verdict = verdictOf(plan, results);
  const save = async () => {
    if (!project.card_id) { toast({ title: T('업무 카드가 연결되지 않아 기록을 저장할 수 없습니다', '未关联业务卡片，无法保存记录'), variant: 'destructive' }); return; }
    if (!serial.trim()) { toast({ title: T('일련번호를 넣으세요', '请输入序列号') }); return; }
    setBusy('save');
    try {
      await base44.entities.ProductionUnit.create(unitRecord({ project, plan, serial: serial.trim(), lot, json, results, values, inspector: actorName(user) }));
      mem(`ftLast-${projectId}`, serial.trim()); mem(`ftPrefix-${projectId}`, prefix); mem(`ftLot-${projectId}`, lot);
      setCount((c) => ({ pass: c.pass + (verdict === 'PASS' ? 1 : 0), fail: c.fail + (verdict === 'FAIL' ? 1 : 0) }));
      toast({ title: T(`${serial} 저장 (${verdict})`, `${serial} 已保存（${verdict}）`) });
      setSerial(nextSerial(prefix, serial.trim()));
      reset();
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  if (isLoading || !project) return <div className="py-24 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  const Row = ({ ok, label, value, children }) => (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-label ${ok === true ? 'border-success/40 bg-success/5' : ok === false ? 'border-destructive/40 bg-destructive/5' : ''}`}>
      <span className="w-5">{ok === true ? <Check className="w-4 h-4 text-success-text" /> : ok === false ? <X className="w-4 h-4 text-destructive" /> : <span className="block h-2 w-2 rounded-full bg-muted-foreground/40" />}</span>
      <span className="min-w-[160px] flex-1">{label}</span>
      {value != null && <span className="font-mono text-caption text-muted-foreground">{value}</span>}
      {children}
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link to={`/prototypes/${project.id}/develop?step=test`} className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />{project.title}</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{T('출하 검사', '出货检验')} · {plan.device_name}</h1>
          <p className="text-caption text-muted-foreground">{T(`검사 항목 ${plan.total}개 · 오늘 합격 ${count.pass} · 불합격 ${count.fail}`, `检验项目 ${plan.total} 项 · 今日合格 ${count.pass} · 不合格 ${count.fail}`)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setZh((v) => { mem('factoryTestLang', v ? 'ko' : 'zh'); return !v; }); }}><Languages className="w-4 h-4" />{zh ? '한국어' : '中文'}</Button>
      </div>
      {!serialSupported() && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-caption text-warning-text">{T('이 브라우저는 USB 시리얼을 지원하지 않습니다. 데스크톱 크롬·엣지에서 여세요.', '此浏览器不支持USB串口，请使用电脑版 Chrome 或 Edge。')}</p>}

      <section className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-title font-semibold">1. {T('연결', '连接')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={connect} disabled={!!mon || !!busy || !serialSupported()}><Usb className="w-4 h-4" />{mon ? T('연결됨', '已连接') : T('USB 연결', '连接USB')}</Button>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border px-3 text-label"><Cpu className="w-4 h-4" />{bin ? bin.name : T('펌웨어 파일 (선택)', '固件文件（可选）')}<input type="file" accept=".bin" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setBin({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }); e.target.value = ''; }} /></label>
          {bin && <Button variant="outline" onClick={runFlash} disabled={!!busy}>{busy === 'flash' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{T('이 기기에 굽기', '烧录到此设备')}{flashP != null ? ` ${Math.round(flashP * 100)}%` : ''}</Button>}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-title font-semibold">2. {T('자동 검사', '自动检测')}</p>
          <Button onClick={runAuto} disabled={!!busy || !serialSupported()}>{busy === 'auto' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}{T('검사 시작', '开始检测')}</Button>
        </div>
        {plan.auto.map((a) => <Row key={a.id} ok={results[a.id]} label={T(a.label[0], a.label[1])} value={values[a.id]} />)}
      </section>

      {plan.press.length > 0 && (
        <section className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-title font-semibold">3. {T('버튼', '按键')}</p>
          {plan.press.map((p) => (
            <Row key={p.id} ok={results[p.id]} label={T(p.label[0], p.label[1])}>
              <Button size="sm" variant="outline" onClick={() => runPress(p)} disabled={!mon || !!waiting || !json}>{waiting === p.id ? <><Loader2 className="w-4 h-4 animate-spin" />{T('누르세요…', '请按下…')}</> : T('시작', '开始')}</Button>
            </Row>
          ))}
        </section>
      )}

      {plan.outputs.length > 0 && (
        <section className="rounded-xl border bg-card p-4 space-y-2">
          <p className="text-title font-semibold">{plan.press.length ? 4 : 3}. {T('출력 (눈으로 확인)', '输出（目视确认）')}</p>
          {plan.outputs.map((o) => (
            <Row key={o.id} ok={results[o.id]} label={T(o.label[0], o.label[1])}>
              <Button size="sm" variant="outline" onClick={() => outOn(o, true)} disabled={!mon || !json}>{T('켜기', '打开')}</Button>
              <Button size="sm" onClick={() => markOut(o, true)} disabled={!mon || !json}><Check className="w-4 h-4" />{T('정상', '正常')}</Button>
              <Button size="sm" variant="destructive" onClick={() => markOut(o, false)} disabled={!mon || !json}><X className="w-4 h-4" />{T('불량', '不良')}</Button>
            </Row>
          ))}
        </section>
      )}

      <section className={`rounded-xl border-2 p-4 space-y-3 ${verdict === 'PASS' ? 'border-success bg-success/10' : verdict === 'FAIL' ? 'border-destructive bg-destructive/10' : 'bg-card'}`} aria-live="polite">
        <p className={`text-center text-4xl font-black tracking-tight ${verdict === 'PASS' ? 'text-success-text' : verdict === 'FAIL' ? 'text-destructive' : 'text-muted-foreground'}`}>{verdict === 'PASS' ? T('합격', '合格') : verdict === 'FAIL' ? T('불합격', '不合格') : T('검사 중', '检验中')}</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto_auto]">
          <Input aria-label={T('일련번호 접두어', '序列号前缀')} value={prefix} onChange={(e) => { const v = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); setPrefix(v); setSerial(nextSerial(v || 'SN', mem(`ftLast-${projectId}`))); }} placeholder={T('접두어', '前缀')} />
          <Input aria-label={T('로트', '批次')} value={lot} onChange={(e) => setLot(e.target.value)} placeholder={T('로트', '批次')} />
          <Input aria-label={T('일련번호', '序列号')} value={serial} onChange={(e) => setSerial(e.target.value)} className="font-mono" />
          <Button onClick={save} disabled={verdict === 'INCOMPLETE' || !!busy}>{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{T('기록 저장 · 다음', '保存记录 · 下一台')}</Button>
          <Button variant="outline" onClick={reset} disabled={!!busy}><RotateCcw className="w-4 h-4" />{T('다시', '重测')}</Button>
        </div>
        {!project.card_id && <p className="text-caption text-warning-text">{T('이 시제품에 업무 카드가 연결되지 않았습니다. 금형 견적 요청에서 업무 카드를 고르면 연결됩니다.', '此样机未关联业务卡片。')}</p>}
        {json?.mac && <p className="text-center font-mono text-caption text-muted-foreground">{json.mac} · {json.fw} · {json.chip}</p>}
      </section>
      <details className="text-caption"><summary className="cursor-pointer text-muted-foreground">{T('시리얼 기록', '串口日志')}</summary><div className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-secondary px-3 py-2 font-mono text-micro">{log.map((l, i) => <p key={i} className="whitespace-pre-wrap break-all">{l}</p>)}</div></details>
    </div>
  );
}
