import React, { useState } from 'react';
import { Presentation, ChevronRight, FileText, Loader2, Check, Circle, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { meetingSteps, meetingReport, certChecklist } from '@/lib/devkit/meetingReport';
import { estimateCost } from '@/lib/devkit/cost';
import { errorText, uploadProtoFile, addProtoFiles } from '@/lib/prototypeApi';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

// 미팅 모드: 단계 진행 막대 + 다음 단계 + 참석자·결정·할 일 메모 → 미팅 결과 요약 / 인증 준비 자료 (내려받기 + 시제품 파일에 저장)
export default function MeetingBar({ project, dev, change, concept, circuits, step, go, steps, user, onSaved, onClose }) {
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
        ? meetingReport(project, dev, { concept, circuits, hw, cost: estimateCost({ moldSummary: dev.mold_design?.summary, hwPkg: hw }), ...m })
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
    </section>
  );
}
