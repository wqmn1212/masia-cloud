import React, { useState } from 'react';
import { Presentation, ChevronRight, FileText, Loader2, Check, Circle, X, ShieldCheck, Share2, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { shareSnapshot, shareLink, shareInvite } from '@/lib/devkit/meetingShare';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { meetingSteps, meetingReport, certChecklist } from '@/lib/devkit/meetingReport';
import { estimateCost } from '@/lib/devkit/cost';
import { errorText, uploadProtoFile, addProtoFiles } from '@/lib/prototypeApi';
import { useCostVersion } from '@/components/prototype/develop/ProductionPanels';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

// 미팅 모드: 단계 진행 막대 + 다음 단계 + 참석자·결정·할 일 메모 → 미팅 결과 요약 / 인증 준비 자료 (내려받기 + 시제품 파일에 저장)
export default function MeetingBar({ project, dev, change, concept, circuits, step, go, steps, user, onSaved, onClose }) {
  const costVersion = useCostVersion(project);
  const [busy, setBusy] = useState('');
  const m = dev.meeting || {};
  const setM = (patch) => change((d) => ({ meeting: { ...(d.meeting || {}), ...patch } }));
  const list = meetingSteps(project, dev, { concept, circuits });
  const idx = steps.findIndex((s) => s.key === step);
  const next = steps[idx + 1];
  const hwPkg = async () => {
    if (!(dev.features || []).length) return null;
    const [lib, ex] = await Promise.all([import('@/lib/hw/kicadLib.data.js'), import('@/lib/hw/exportHw.js')]);
    return ex.buildHwPackage(dev, lib, { title: project.title, seed: project.id });
  };
  const make = async (kind) => {
    setBusy(kind);
    try {
      const hw = await hwPkg().catch(() => null);
      const text = kind === 'report'
        ? meetingReport(project, dev, { concept, circuits, hw, cost: estimateCost({ moldSummary: dev.mold_design?.summary, hwPkg: hw, quotes: dev.cost_quotes, designBom: costVersion?.bom, bomPrices: dev.cost_parts }), ...m })
        : certChecklist(project, dev, { hw });
      const name = `${dev.device_name || 'project'}-${kind === 'report' ? 'meeting' : 'kc-cert-prep'}-${stamp()}.md`;
      const { downloadText } = await import('@/lib/devkit/conceptExport');
      downloadText(text, name, 'text/markdown');
      const f = await uploadProtoFile(new File([text], name, { type: 'text/markdown' }), user, { category: 'REFERENCE', note: kind === 'report' ? '개발 미팅 결과 요약 (워크벤치 자동 작성)' : 'KC 인증 준비 체크리스트 (워크벤치 자동 작성)' });
      await addProtoFiles(project.id, [f]);
      onSaved?.();
      toast({ title: kind === 'report' ? '미팅 결과 요약을 만들어 시제품 파일에 저장했습니다' : '인증 준비 자료를 만들어 시제품 파일에 저장했습니다' });
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };
  // 고객과 공유: 링크 + PIN (내부 정보는 빼고 진행 단계·요약·결정 사항·할 일만). 고객이 결정 사항마다 확인을 남긴다
  const [shared, setShared] = useState(null);
  const [shares, setShares] = useState(null);
  const loadShares = () => base44.functions.invoke('protoShare', { action: 'list', project_id: project.id }).then((r) => setShares(r.data?.shares || [])).catch(() => setShares([]));
  const share = async () => {
    setBusy('share');
    try {
      const { data } = await base44.functions.invoke('protoShare', { action: 'create', project_id: project.id, days: 14, snapshot: shareSnapshot(project, dev, { concept, circuits }) });
      if (data?.error) throw new Error(data.error);
      setShared({ link: shareLink(window.location.origin, data.token), pin: data.pin, expires_at: data.expires_at });
      loadShares();
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast({ title: '복사했습니다' }); } catch { toast({ title: '복사하지 못했습니다', variant: 'destructive' }); } };
  const doneCount = list.filter((s) => s.done).length;

  return (
    <section className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3" aria-label="미팅 모드">
      <div className="flex flex-wrap items-center gap-2">
        <Presentation className="w-5 h-5 text-primary" />
        <p className="text-title font-semibold">미팅 모드</p>
        <span className="text-caption text-muted-foreground">{doneCount}/{list.length} 단계 완료</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {next && <Button size="sm" onClick={() => go(next.key)}>다음: {next.label}<ChevronRight className="w-4 h-4" /></Button>}
          <Button size="sm" variant="outline" onClick={() => make('report')} disabled={!!busy}>{busy === 'report' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}미팅 결과 요약</Button>
          <Button size="sm" variant="outline" onClick={() => make('cert')} disabled={!!busy}>{busy === 'cert' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}인증 준비 자료</Button>
          <Button size="sm" variant="outline" onClick={share} disabled={!!busy}>{busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}고객과 공유</Button>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="미팅 모드 닫기"><X className="w-4 h-4" /></Button>
        </div>
      </div>
      <ol className="grid gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {list.map((s) => (
          <li key={s.key}>
            <button type="button" onClick={() => go(s.key)} className={`w-full rounded-lg border px-2.5 py-1.5 text-left ${s.key === step ? 'border-primary bg-card' : 'bg-card/60'}`}>
              <span className="flex items-center gap-1 text-micro font-semibold">{s.done ? <Check className="w-3.5 h-3.5 text-success-text" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}{s.label}</span>
              <span className="block truncate text-micro text-muted-foreground">{s.detail}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="grid gap-2 md:grid-cols-3">
        <Input aria-label="참석자" value={m.attendees || ''} onChange={(e) => setM({ attendees: e.target.value })} placeholder="참석자 (예: 고객사 김 대표, 우리 이 팀장)" className="h-9 text-caption md:col-span-3" />
        <Textarea aria-label="결정 사항" value={m.decisions || ''} onChange={(e) => setM({ decisions: e.target.value })} placeholder="결정 사항 (한 줄에 하나)" className="min-h-[72px] text-caption" />
        <Textarea aria-label="할 일" value={m.actions || ''} onChange={(e) => setM({ actions: e.target.value })} placeholder="할 일 (한 줄에 하나)" className="min-h-[72px] text-caption md:col-span-2" />
      </div>
      {shared && (
        <div className="rounded-lg border bg-card p-3 text-caption space-y-1.5">
          <p>고객용 링크를 만들었습니다 (기한 {shared.expires_at?.slice(0, 10)}). 내부 정보(핀·부품·원가·공장 견적)는 들어가지 않습니다. 고객이 결정 사항마다 “확인”을 누를 수 있습니다.</p>
          <div className="flex flex-wrap items-center gap-2"><code className="truncate rounded bg-secondary px-2 py-1">{shared.link}</code><code className="rounded bg-secondary px-2 py-1 tabular-nums">PIN {shared.pin}</code><Button size="sm" variant="outline" onClick={() => copy(shareInvite({ ...shared, title: project.title }))}><Copy className="w-3.5 h-3.5" />안내 문구 복사</Button></div>
        </div>
      )}
      <details className="text-caption" onToggle={(e) => { if (e.currentTarget.open && !shares) loadShares(); }}>
        <summary className="cursor-pointer text-muted-foreground">고객 확인 현황</summary>
        <div className="mt-1.5 space-y-1">
          {!shares ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : shares.length === 0 ? <p className="text-muted-foreground">아직 공유한 링크가 없습니다.</p> : shares.map((s) => (
            <div key={s.id} className="rounded-lg bg-card px-3 py-1.5">
              <p>{String(s.created_date || '').slice(0, 10)} 공유 · {s.status === 'ACTIVE' ? `열림 (~${String(s.expires_at).slice(0, 10)})` : s.status === 'EXPIRED' ? '기한 지남' : '닫음'} · 결정 {s.decisions}건 중 {s.confirmations.length}건 확인{s.last_opened_at ? ` · 마지막 열람 ${String(s.last_opened_at).slice(0, 10)}` : ' · 아직 안 열어 봄'}</p>
              {s.confirmations.map((c) => <p key={c.index} className="text-micro text-success-text">✓ {c.text} — {c.name} ({String(c.at).slice(0, 10)})</p>)}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
