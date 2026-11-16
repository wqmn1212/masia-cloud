import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Lock, GitPullRequest, Check, X, Loader2, ClipboardCheck } from 'lucide-react';
import { bringupItems, bringupSummary } from '@/lib/devkit/bringup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Card } from '@/components/prototype/develop/DevBits';
import { estimateCost } from '@/lib/devkit/cost';
import { snapshotOf, diffDesign, impactOf, canApproveEco, ecoTasks, ecoNotice } from '@/lib/devkit/freeze';
import { base44 } from '@/api/base44Client';
import { uploadProtoFile, addProtoFiles } from '@/lib/prototypeApi';
import { actorName } from '@/lib/prototypeApi';
import { useQueryClient } from '@tanstack/react-query';
import { useProtoClient } from '@/components/prototype/develop/ClientSharePanel';

const won = (v) => `${Math.round(v).toLocaleString('ko-KR')}원`;

// 수량별 원가 추정: 금형용 설계 요약(사출 부품) + 회로(기판·부품) → 금형비·개당 원가
export function CostCard({ project, dev, change }) {
  const [hwPkg, setHwPkg] = useState(null);
  const [assembly, setAssembly] = useState(1500);
  useEffect(() => {
    let alive = true;
    if (!(dev.features || []).length) return undefined;
    Promise.all([import('@/lib/hw/kicadLib.data.js'), import('@/lib/hw/exportHw.js')]).then(([lib, ex]) => { if (alive) setHwPkg(ex.buildHwPackage(dev, lib, { title: project.title, seed: project.id })); }).catch(() => {});
    return () => { alive = false; };
  }, [JSON.stringify([dev.features, dev.mcu, dev.supply_v, dev.mold_design?.template, dev.mold_design?.params, dev.hw])]); // eslint-disable-line react-hooks/exhaustive-deps
  const quotes = dev.cost_quotes || null;
  const est = useMemo(() => estimateCost({ moldSummary: dev.mold_design?.summary, hwPkg, settings: { assembly_krw: assembly }, quotes }), [dev.mold_design?.summary, hwPkg, assembly, quotes]);
  const [qOpen, setQOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const setQ = (patch) => change?.((d) => ({ cost_quotes: { currency: 'CNY', fx: 195, parts: {}, ...(d.cost_quotes || {}), ...patch } }));
  const setQPart = (name, patch) => change?.((d) => { const q = { currency: 'CNY', fx: 195, parts: {}, ...(d.cost_quotes || {}) }; return { cost_quotes: { ...q, parts: { ...q.parts, [name]: { ...(q.parts?.[name] || {}), ...patch } } } }; });
  const readFile = async (file) => {
    if (!file) return;
    setReading(true);
    try {
      const { readMoldQuote } = await import('@/lib/devkit/moldQuote');
      const r = await readMoldQuote(file, est.moldRows.map((x) => x.name));
      const parts = { ...(quotes?.parts || {}) };
      r.rows.filter((x) => x.match).forEach((x) => { parts[x.match] = { mold: x.mold || '', unit: x.unit || '', cavities: x.cavities || '' }; });
      setQ({ factory: r.factory || quotes?.factory || '', date: r.date || quotes?.date || '', currency: r.currency, parts, notes: r.notes, file_name: file.name });
      const miss = r.rows.filter((x) => !x.match).map((x) => x.part);
      toast({ title: `견적서에서 ${r.rows.filter((x) => x.match).length}개 부품을 읽었습니다`, description: miss.length ? `맞는 부품을 못 찾음: ${miss.join(', ')} — 아래 표에 직접 넣으세요` : '값을 확인하고 틀린 곳은 고치세요' });
      setQOpen(true);
    } catch (e) { toast({ title: `견적서를 읽지 못했습니다: ${e.message || e}`, variant: 'destructive' }); }
    setReading(false);
  };
  return (
    <Card title="수량별 원가 추정" icon={Calculator} tag="초기 감 잡기">
      {est.missing.length > 0 && <p className="text-caption text-warning-text">아직 빠진 것: {est.missing.join(', ')}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-caption">
          <thead className="text-left text-muted-foreground"><tr><th className="py-1.5 pr-2 font-medium">수량</th><th className="py-1.5 pr-2 text-right font-medium">개당 생산비</th><th className="py-1.5 pr-2 text-right font-medium">금형·준비비 / 개</th><th className="py-1.5 pr-2 text-right font-medium">개당 합계</th><th className="py-1.5 text-right font-medium">총액</th></tr></thead>
          <tbody>{est.byQty.map((r) => <tr key={r.qty} className="border-t tabular-nums"><td className="py-1.5 pr-2">{r.qty.toLocaleString()}개</td><td className="py-1.5 pr-2 text-right">{won(r.unit)}</td><td className="py-1.5 pr-2 text-right">{won(r.tooling_per_unit)}</td><td className="py-1.5 pr-2 text-right font-semibold">{won(r.total_per_unit)}</td><td className="py-1.5 text-right">{won(r.total)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-caption font-semibold">사출 부품 (금형비 합 {won(est.tooling)})</p>
          {est.moldRows.map((r) => <p key={r.name} className="text-micro text-muted-foreground tabular-nums">{r.name} · {r.material} {r.weight} g · {r.cavities}캐비티 · 사이클 {r.cycle}초{r.slides ? ` · 슬라이드 ${r.slides}` : ''} → 금형 {won(r.mold)} <span className={r.source.mold === 'quote' ? 'font-semibold text-success-text' : ''}>({r.source.mold === 'quote' ? `견적, 추정 ${won(r.est.mold)}` : '추정'})</span>, 개당 {won(r.unit)} ({r.source.unit === 'quote' ? '견적' : '추정'})</p>)}
        </div>
        <div className="space-y-1">
          <p className="text-caption font-semibold">기판 (준비비 합 {won(est.setup)})</p>
          {est.boards.map((b) => <p key={b.name} className="text-micro text-muted-foreground tabular-nums">{b.name} · {b.area_cm2} cm² · 부품 {b.parts_count}개 → 기판 {won(b.pcb)} + 실장 {won(b.smt)} + 부품 {won(b.parts)}</p>)}
          <label className="flex items-center gap-2 text-micro">조립 인건비 (개당) <Input aria-label="조립 인건비" type="number" value={assembly} onChange={(e) => setAssembly(Number(e.target.value) || 0)} className="h-7 w-24 text-micro" /> 원 · 포장 {won(est.settings.packaging_krw)}</label>
        </div>
      </div>
      {change && est.moldRows.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-caption font-semibold">공장 견적 반영</p>
            {est.quote ? <span className="text-micro text-success-text">{est.quote.factory || '공장'} {est.quote.date} · {est.quote.quoted}/{est.quote.of}개 부품 견적 · 금형비 추정 대비 {est.quote.tooling_diff >= 0 ? '+' : ''}{won(est.quote.tooling_diff)}</span> : <span className="text-micro text-muted-foreground">아직 추정치입니다</span>}
            <div className="ml-auto flex gap-1.5">
              <label className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 text-micro ${reading ? 'opacity-60' : ''}`}>{reading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}견적서 파일 읽기<input type="file" className="sr-only" accept=".xlsx,.xls,.pdf,.doc,.docx,.png,.jpg,.jpeg" disabled={reading} onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
              <Button size="sm" variant="outline" className="h-7" onClick={() => setQOpen((v) => !v)}>{qOpen ? '접기' : '직접 넣기'}</Button>
            </div>
          </div>
          {qOpen && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-4">
                <Input aria-label="공장 이름" placeholder="공장 이름" value={quotes?.factory || ''} onChange={(e) => setQ({ factory: e.target.value })} className="h-8 text-caption" />
                <Input aria-label="견적 날짜" type="date" value={quotes?.date || ''} onChange={(e) => setQ({ date: e.target.value })} className="h-8 text-caption" />
                <select aria-label="통화" value={quotes?.currency || 'CNY'} onChange={(e) => setQ({ currency: e.target.value, fx: e.target.value === 'KRW' ? 1 : e.target.value === 'USD' ? 1380 : 195 })} className="h-8 rounded-md border bg-background px-2 text-caption"><option value="CNY">위안 (CNY)</option><option value="USD">달러 (USD)</option><option value="KRW">원 (KRW)</option></select>
                <label className="flex items-center gap-1.5 text-micro text-muted-foreground">환율<Input aria-label="환율 (1 단위 = 원)" type="number" value={quotes?.fx ?? 195} disabled={(quotes?.currency || 'CNY') === 'KRW'} onChange={(e) => setQ({ fx: Number(e.target.value) || 0 })} className="h-8 w-20 text-caption" />원</label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-caption">
                  <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-2 font-medium">부품</th><th className="py-1 pr-2 font-medium">금형비 ({quotes?.currency || 'CNY'})</th><th className="py-1 pr-2 font-medium">사출 단가</th><th className="py-1 font-medium">캐비티</th></tr></thead>
                  <tbody>{est.moldRows.map((r) => { const q = quotes?.parts?.[r.name] || {}; return (
                    <tr key={r.name} className="border-t"><td className="py-1 pr-2">{r.name}</td>
                      {['mold', 'unit', 'cavities'].map((k) => <td key={k} className="py-1 pr-2"><Input aria-label={`${r.name} ${k === 'mold' ? '금형비' : k === 'unit' ? '사출 단가' : '캐비티'}`} type="number" value={q[k] ?? ''} onChange={(e) => setQPart(r.name, { [k]: e.target.value === '' ? '' : Number(e.target.value) })} className="h-7 w-28 text-micro" /></td>)}
                    </tr>); })}</tbody>
                </table>
              </div>
              {quotes?.notes && <p className="text-micro text-muted-foreground">견적 조건: {quotes.notes}</p>}
              <p className="text-micro text-muted-foreground">비워 둔 칸은 추정치를 그대로 씁니다. 값은 자동 저장됩니다.</p>
            </div>
          )}
        </div>
      )}
      <p className="text-micro text-muted-foreground">수지 단가, 사출기 시간당 비용, 금형 크기 계수, 기판·실장 단가, 부품 대략 단가로 계산한 추정치입니다. 공장 견적이 오면 그 값으로 바꾸세요.</p>
    </Card>
  );
}

// 설계 확정(동결)과 변경 요청서(ECO): 확정본 뒤에 바뀐 점을 모아 검토·승인하면 새 확정본이 된다
export function FreezeCard({ dev, change, user, project, onSaved, dirty }) {
  const qc = useQueryClient();
  const { data: pc } = useProtoClient(project?.card_id ? project.id : null);
  const sentToPortal = (no) => (pc?.share?.ecos || []).some((e) => e.no === no && !e.withdrawn);
  const clientSaid = (no) => pc?.review?.ecos?.[no] || null;
  const [reason, setReason] = useState('');
  const [needClient, setNeedClient] = useState(false);
  const approver = canApproveEco(user);
  const [busy, setBusy] = useState(false);
  const fz = dev.freeze;
  const changes = useMemo(() => (fz ? diffDesign(fz.snapshot, dev) : []), [fz, dev]);
  const ecos = dev.ecos || [];
  const open = ecos.filter((e) => e.status === 'OPEN' || e.status === 'WAIT_CLIENT');
  const by = actorName(user);
  const freeze = (eco) => {
    setBusy(true);
    const version = (fz?.version || 0) + 1;
    change((d) => ({
      // 화면에 보이는 설계(자동 배정 핀까지 채운 dev)를 확정한다. 원본 d 로 찍으면 자동 핀이 '바뀐 점'으로 잡힌다.
      freeze: { version, at: new Date().toISOString(), by, snapshot: snapshotOf({ ...d, features: dev.features }), eco_no: eco?.no || null },
      history: [...(d.history || []), ...(fz ? [{ ...fz }] : [])], // 예전 확정본은 모두 남긴다 (지우지 않음, 개수 제한 없음)
      ecos: eco ? (d.ecos || []).map((e) => (e.no === eco.no ? { ...e, status: 'APPROVED', decided_by: by, decided_at: new Date().toISOString(), to_version: version } : e)) : d.ecos,
    }));
    toast({ title: `설계 확정본 v${version} 을 만들었습니다`, description: '잠시 뒤 자동 저장됩니다' });
    if (eco) makeTasks(eco);
    setBusy(false);
  };
  // 승인된 변경의 "다시 할 일"을 업무 카드 할 일로 만든다 (시제품이 업무 카드에 묶여 있을 때)
  const makeTasks = async (eco) => {
    const tasks = ecoTasks(eco);
    if (!project?.card_id || !tasks.length) { if (tasks.length) toast({ title: '업무 카드가 연결되지 않아 할 일은 만들지 않았습니다', description: '금형 견적 요청에서 업무 카드를 고르면 연결됩니다' }); return; }
    try {
      for (const t of tasks) await base44.entities.TaskItem.create({ tenant_id: project.tenant_id, card_id: project.card_id, status: 'TODO', priority: 'HIGH', cn_manual: true, ...t });
      toast({ title: `${eco.no}: 업무 카드에 할 일 ${tasks.length}개를 만들었습니다` });
    } catch (e) { toast({ title: `할 일을 만들지 못했습니다: ${e.message || e}`, variant: 'destructive' }); }
  };
  // 고객 확인이 필요한 변경: 고객 포털 "개발" 탭으로 승인 요청을 보내고(업무 카드가 있을 때), 통지서도 시제품 파일로 남긴다
  const askClient = async (eco) => {
    if (dirty) { toast({ title: '설정을 먼저 저장하세요', description: '저장된 변경 요청서만 고객에게 보낼 수 있습니다 (잠시 뒤 자동 저장)' }); return; }
    setBusy(true);
    try {
      let portal = false;
      if (project?.card_id) {
        const res = await base44.functions.invoke('protoClient', { action: 'share_eco', project_id: project.id, no: eco.no });
        if (res.data?.error) throw new Error(res.data.error);
        portal = true;
        qc.invalidateQueries({ queryKey: ['proto-client', project.id] });
      }
      const name = `${eco.no}-design-change-notice.md`;
      const f = await uploadProtoFile(new File([ecoNotice(project, eco)], name, { type: 'text/markdown' }), user, { category: 'REFERENCE', note: `설계 변경 통지서 ${eco.no} (고객 확인용)` });
      await addProtoFiles(project.id, [f]);
      onSaved?.();
      change((d) => ({ ecos: (d.ecos || []).map((e) => (e.no === eco.no ? { ...e, status: 'WAIT_CLIENT', sent_by: by, sent_at: new Date().toISOString(), notice_file: name, portal } : e)) }));
      toast(portal
        ? { title: '고객 포털로 승인을 요청했습니다', description: '고객이 업무 카드 “개발” 탭에서 승인하면 여기서 새 확정본을 만들 수 있습니다. 통지서도 시제품 파일에 남겼습니다.' }
        : { title: '설계 변경 통지서를 시제품 파일에 저장했습니다', description: '업무 카드가 없어 포털로는 보내지 못했습니다. 전자서명 등으로 확인을 받은 뒤 승인하세요' });
    } catch (e) { toast({ title: `보내지 못했습니다: ${e?.response?.data?.error || e.message || e}`, variant: 'destructive' }); }
    setBusy(false);
  };
  const makeEco = () => {
    if (!reason.trim()) { toast({ title: '변경 이유를 적으세요' }); return; }
    const no = `ECO-${String(ecos.length + 1).padStart(3, '0')}`;
    change((d) => ({ ecos: [...(d.ecos || []), { no, at: new Date().toISOString(), by, reason: reason.trim(), from_version: fz.version, changes, impact: impactOf(changes), need_client: needClient, status: 'OPEN' }] }));
    setReason(''); setNeedClient(false);
    toast({ title: `${no} 변경 요청서를 만들었습니다` });
  };
  const reject = (eco) => change((d) => ({ ecos: (d.ecos || []).map((e) => (e.no === eco.no ? { ...e, status: 'REJECTED', decided_by: by, decided_at: new Date().toISOString() } : e)) }));

  return (
    <Card title="설계 확정 · 변경 관리" icon={Lock} tag={fz ? `확정본 v${fz.version}` : '확정 전'}>
      {!fz ? (
        <>
          <p className="text-caption text-muted-foreground">외장 치수·기능·핀·동작 규칙·기판 구성·블루투스 UUID 를 지금 값으로 확정합니다. 확정한 뒤 바뀐 점은 변경 요청서(ECO)로 검토·승인해야 새 확정본이 됩니다.</p>
          <Button size="sm" onClick={() => freeze(null)} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}지금 설계로 확정 (v1)</Button>
        </>
      ) : (
        <>
          <p className="text-caption">확정본 v{fz.version} · {fz.at?.slice(0, 10)} · {fz.by}{fz.eco_no ? ` · ${fz.eco_no} 승인` : ''}</p>
          {changes.length === 0 ? <p className="flex items-center gap-1.5 text-caption text-success-text"><Check className="w-4 h-4" />확정본 뒤로 바뀐 점이 없습니다.</p> : (
            <div className="space-y-1.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="text-caption font-semibold text-warning-text">확정본 뒤로 바뀐 점 {changes.length}건</p>
              <ul className="space-y-0.5 text-micro">{changes.slice(0, 20).map((c, i) => <li key={i}><span className="text-muted-foreground">[{c.area}]</span> {c.text}</li>)}</ul>
              <p className="text-micro text-muted-foreground">다시 할 일: {impactOf(changes).join(' · ')}</p>
              <div className="flex flex-wrap gap-2">
                <Input aria-label="변경 이유" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="변경 이유 (예: 금형 업체 제안으로 구배 2° → 3°)" className="h-8 min-w-[240px] flex-1 text-caption" />
                <label className="flex items-center gap-1.5 text-micro"><input type="checkbox" checked={needClient} onChange={(e) => setNeedClient(e.target.checked)} />고객 확인 필요</label>
                <Button size="sm" variant="outline" onClick={makeEco}><GitPullRequest className="w-4 h-4" />변경 요청서(ECO) 만들기</Button>
              </div>
            </div>
          )}
        </>
      )}
      {ecos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-caption font-semibold">변경 요청서</p>
          {[...ecos].reverse().map((e) => (
            <div key={e.no} className="rounded-lg bg-secondary px-3 py-2 text-micro space-y-0.5">
              <p className="flex flex-wrap items-center gap-2"><span className="font-semibold">{e.no}</span><span>{e.reason}</span><span className="text-muted-foreground">v{e.from_version} · {e.at?.slice(0, 10)} · {e.by}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 font-semibold ${e.status === 'APPROVED' ? 'bg-success/15 text-success-text' : e.status === 'REJECTED' ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning-text'}`}>{e.status === 'APPROVED' ? `승인 → v${e.to_version}` : e.status === 'REJECTED' ? '반려' : e.status === 'WAIT_CLIENT' ? '고객 확인 대기' : '검토 중'}</span></p>
              <p className="text-muted-foreground">{(e.changes || []).length}건 · 다시 할 일: {(e.impact || []).join(' · ') || '없음'}</p>
              {sentToPortal(e.no) && (() => {
                const c = clientSaid(e.no);
                return <p className={c?.decision === 'APPROVED' ? 'text-success-text' : c ? 'text-destructive' : 'text-warning-text'}>고객 포털: {c ? `${c.decision === 'APPROVED' ? '고객 승인' : '고객 반려'} · ${c.by} · ${String(c.at).slice(0, 10)}${c.note ? ` — ${c.note}` : ''}` : '고객 승인 기다리는 중 (고객이 승인해야 새 확정본을 만들 수 있습니다)'}</p>;
              })()}
              {(e.status === 'OPEN' || e.status === 'WAIT_CLIENT') && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {e.need_client && e.status === 'OPEN' && <Button size="sm" variant="outline" className="h-7" onClick={() => askClient(e)} disabled={busy || !project}>{project?.card_id ? '고객에게 승인 요청' : '고객 통지서 만들기'}</Button>}
                  <Button size="sm" className="h-7" onClick={() => freeze(e)} disabled={busy || !approver || e !== open[open.length - 1] || (e.need_client && e.status === 'OPEN') || (sentToPortal(e.no) && clientSaid(e.no)?.decision !== 'APPROVED')}><Check className="w-3.5 h-3.5" />{e.status === 'WAIT_CLIENT' ? (sentToPortal(e.no) ? '승인하고 새 확정본' : '고객 확인 받음 · 승인하고 새 확정본') : '승인하고 새 확정본'}</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => reject(e)} disabled={!approver}><X className="w-3.5 h-3.5" />반려</Button>
                  {!approver && <span className="text-muted-foreground">승인·반려는 대표·팀 관리자만 할 수 있습니다</span>}
                  {e.need_client && e.status === 'OPEN' && approver && <span className="text-muted-foreground">고객 확인이 필요한 변경입니다 — 고객에게 먼저 보내세요</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// 실물 시제품 검증: 설계에서 만든 확인 항목마다 통과·불합격·측정값·메모를 남긴다 (자동 저장). 불합격은 미팅 요약과 변경 관리로 이어진다
export function BringupCard({ dev, change, user }) {
  const items = useMemo(() => bringupItems(dev), [dev]);
  const res = dev.bringup?.items || {};
  const sum = bringupSummary(dev);
  const set = (id, patch) => change((d) => ({ bringup: { ...(d.bringup || {}), items: { ...(d.bringup?.items || {}), [id]: { ...(d.bringup?.items?.[id] || {}), ...patch, at: new Date().toISOString(), by: actorName(user) } } } }));
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <Card title="실물 시제품 검증" icon={ClipboardCheck} tag={`${sum.pass}/${sum.total} 통과${sum.fail ? ` · 불합격 ${sum.fail}` : ''}`}>
      <p className="text-caption text-muted-foreground">기판과 외장 시제품이 오면 위에서부터 확인하세요. 화면 안 검산으로는 볼 수 없는 전원·부품 방향·블루투스 거리·발열·외장 맞춤을 실물로 닫는 목록입니다.</p>
      {groups.map((g) => (
        <div key={g} className="space-y-1">
          <p className="text-caption font-semibold">{g}</p>
          {items.filter((i) => i.group === g).map((i) => {
            const r = res[i.id] || {};
            return (
              <div key={i.id} className={`rounded-lg border px-3 py-2 text-caption ${r.result === 'fail' ? 'border-destructive/40 bg-destructive/5' : r.result === 'pass' ? 'border-success/30 bg-success/5' : ''}`}>
                <div className="flex flex-wrap items-start gap-2">
                  <p className="min-w-[200px] flex-1">{i.text}</p>
                  <div className="flex items-center gap-1" role="group" aria-label={`${i.text} 결과`}>
                    {i.measure && <span className="flex items-center gap-1"><Input aria-label={`${i.text} 측정값`} defaultValue={r.value ?? ''} onBlur={(e) => { if (e.target.value !== (r.value ?? '')) set(i.id, { value: e.target.value }); }} className="h-7 w-16 text-micro" /><span className="text-micro text-muted-foreground">{i.measure}</span></span>}
                    <Button size="sm" variant={r.result === 'pass' ? 'default' : 'outline'} className="h-7 px-2" aria-pressed={r.result === 'pass'} onClick={() => set(i.id, { result: r.result === 'pass' ? '' : 'pass' })}><Check className="w-3.5 h-3.5" />통과</Button>
                    <Button size="sm" variant={r.result === 'fail' ? 'destructive' : 'outline'} className="h-7 px-2" aria-pressed={r.result === 'fail'} onClick={() => set(i.id, { result: r.result === 'fail' ? '' : 'fail' })}><X className="w-3.5 h-3.5" />불합격</Button>
                  </div>
                </div>
                {(r.result === 'fail' || r.note) && <Input aria-label={`${i.text} 메모`} defaultValue={r.note || ''} onBlur={(e) => { if (e.target.value !== (r.note || '')) set(i.id, { note: e.target.value }); }} placeholder="무엇이 어떻게 달랐는지, 고칠 방법" className="mt-1.5 h-7 text-micro" />}
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}
