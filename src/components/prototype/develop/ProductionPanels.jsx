import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Lock, GitPullRequest, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Card } from '@/components/prototype/develop/DevBits';
import { estimateCost } from '@/lib/devkit/cost';
import { snapshotOf, diffDesign, impactOf } from '@/lib/devkit/freeze';
import { actorName } from '@/lib/prototypeApi';

const won = (v) => `${Math.round(v).toLocaleString('ko-KR')}원`;

// 수량별 원가 추정: 금형용 설계 요약(사출 부품) + 회로(기판·부품) → 금형비·개당 원가
export function CostCard({ project, dev }) {
  const [hwPkg, setHwPkg] = useState(null);
  const [assembly, setAssembly] = useState(1500);
  useEffect(() => {
    let alive = true;
    if (!(dev.features || []).length) return undefined;
    Promise.all([import('@/lib/hw/kicadLib.data.js'), import('@/lib/hw/exportHw.js')]).then(([lib, ex]) => { if (alive) setHwPkg(ex.buildHwPackage(dev, lib, { title: project.title, seed: project.id })); }).catch(() => {});
    return () => { alive = false; };
  }, [JSON.stringify([dev.features, dev.mcu, dev.supply_v, dev.mold_design?.template, dev.mold_design?.params, dev.hw])]); // eslint-disable-line react-hooks/exhaustive-deps
  const est = useMemo(() => estimateCost({ moldSummary: dev.mold_design?.summary, hwPkg, settings: { assembly_krw: assembly } }), [dev.mold_design?.summary, hwPkg, assembly]);
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
          {est.moldRows.map((r) => <p key={r.name} className="text-micro text-muted-foreground tabular-nums">{r.name} · {r.material} {r.weight} g · {r.cavities}캐비티 · 사이클 {r.cycle}초{r.slides ? ` · 슬라이드 ${r.slides}` : ''} → 금형 {won(r.mold)}, 개당 {won(r.unit)}</p>)}
        </div>
        <div className="space-y-1">
          <p className="text-caption font-semibold">기판 (준비비 합 {won(est.setup)})</p>
          {est.boards.map((b) => <p key={b.name} className="text-micro text-muted-foreground tabular-nums">{b.name} · {b.area_cm2} cm² · 부품 {b.parts_count}개 → 기판 {won(b.pcb)} + 실장 {won(b.smt)} + 부품 {won(b.parts)}</p>)}
          <label className="flex items-center gap-2 text-micro">조립 인건비 (개당) <Input aria-label="조립 인건비" type="number" value={assembly} onChange={(e) => setAssembly(Number(e.target.value) || 0)} className="h-7 w-24 text-micro" /> 원 · 포장 {won(est.settings.packaging_krw)}</label>
        </div>
      </div>
      <p className="text-micro text-muted-foreground">수지 단가, 사출기 시간당 비용, 금형 크기 계수, 기판·실장 단가, 부품 대략 단가로 계산한 추정치입니다. 공장 견적이 오면 그 값으로 바꾸세요.</p>
    </Card>
  );
}

// 설계 확정(동결)과 변경 요청서(ECO): 확정본 뒤에 바뀐 점을 모아 검토·승인하면 새 확정본이 된다
export function FreezeCard({ dev, change, user }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const fz = dev.freeze;
  const changes = useMemo(() => (fz ? diffDesign(fz.snapshot, dev) : []), [fz, dev]);
  const ecos = dev.ecos || [];
  const open = ecos.filter((e) => e.status === 'OPEN');
  const by = actorName(user);
  const freeze = (eco) => {
    setBusy(true);
    const version = (fz?.version || 0) + 1;
    change((d) => ({
      freeze: { version, at: new Date().toISOString(), by, snapshot: snapshotOf(d), eco_no: eco?.no || null },
      history: [...(d.history || []), ...(fz ? [{ ...fz, snapshot: fz.snapshot }] : [])].slice(-20), // 예전 확정본도 남긴다 (지우지 않음)
      ecos: eco ? (d.ecos || []).map((e) => (e.no === eco.no ? { ...e, status: 'APPROVED', decided_by: by, decided_at: new Date().toISOString(), to_version: version } : e)) : d.ecos,
    }));
    toast({ title: `설계 확정본 v${version} 을 만들었습니다`, description: '잠시 뒤 자동 저장됩니다' });
    setBusy(false);
  };
  const makeEco = () => {
    if (!reason.trim()) { toast({ title: '변경 이유를 적으세요' }); return; }
    const no = `ECO-${String(ecos.length + 1).padStart(3, '0')}`;
    change((d) => ({ ecos: [...(d.ecos || []), { no, at: new Date().toISOString(), by, reason: reason.trim(), from_version: fz.version, changes, impact: impactOf(changes), status: 'OPEN' }] }));
    setReason('');
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
                <span className={`ml-auto rounded-full px-2 py-0.5 font-semibold ${e.status === 'APPROVED' ? 'bg-success/15 text-success-text' : e.status === 'REJECTED' ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning-text'}`}>{e.status === 'APPROVED' ? `승인 → v${e.to_version}` : e.status === 'REJECTED' ? '반려' : '검토 중'}</span></p>
              <p className="text-muted-foreground">{(e.changes || []).length}건 · 다시 할 일: {(e.impact || []).join(' · ') || '없음'}</p>
              {e.status === 'OPEN' && (
                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" className="h-7" onClick={() => freeze(e)} disabled={busy || e !== open[open.length - 1]}><Check className="w-3.5 h-3.5" />승인하고 새 확정본</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => reject(e)}><X className="w-3.5 h-3.5" />반려</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
