import React, { useState } from 'react';
import { Sparkles, Loader2, GitBranch } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import Pill from '@/components/prototype/Pill';
import { SEVERITY } from '@/lib/prototype';
import { errorText } from '@/lib/prototypeApi';

const VERDICT = { WORKING: ['작동 확인', 'bg-success/15 text-success-text'], PARTIAL: ['부분 작동', 'bg-warning/15 text-warning-text'], NOT_WORKING: ['작동 안 함', 'bg-destructive/10 text-destructive'], UNKNOWN: ['판단 불가', 'bg-muted text-muted-foreground'] };
const AREA = { CIRCUIT: '회로', BOM: '부품', FIRMWARE: '펌웨어', MECHANICAL: '기구', MOLD: '금형', TEST: '시험' };

// AI 시험 분석 → 개선안 선택 → 새 설계 버전 초안
export default function TestAnalysis({ project, test, onChanged, onVersionCreated }) {
  const [busy, setBusy] = useState('');
  const [picked, setPicked] = useState([]);
  const a = test.ai_analysis;

  const analyze = async () => {
    setBusy('analyze');
    try { await base44.functions.invoke('prototypeAction', { action: 'analyze_test', project_id: project.id, test_id: test.id }); onChanged(); }
    catch (e) { toast({ title: 'AI 분석을 하지 못했습니다', description: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  const apply = async () => {
    setBusy('apply');
    const chosen = picked.map((i) => a.improvements[i]);
    const instruction = `시험 '${test.title}'의 개선안을 반영한다:\n${chosen.map((c) => `- [${AREA[c.area] || c.area}] ${c.title}: ${c.detail}`).join('\n')}`;
    try {
      const res = await base44.functions.invoke('prototypeAction', { action: 'draft', project_id: project.id, base_version_id: test.version_id, source_test_id: test.id, instruction });
      setPicked([]);
      toast({ title: `개선안을 반영한 v${res.data.version.version_no} 초안을 만들었습니다` });
      onVersionCreated();
    } catch (e) { toast({ title: '새 버전을 만들지 못했습니다', description: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  return (
    <div className="rounded-lg border border-chart-4/30 bg-chart-4/5 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="w-4 h-4 text-chart-4" /><p className="text-label font-semibold mr-auto">AI 시험 분석</p>
        <Button size="sm" variant="outline" onClick={analyze} disabled={!!busy || test.status === 'PLANNED'}>{busy === 'analyze' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{a ? '다시 분석' : '분석하기'}</Button>
      </div>
      {test.status === 'PLANNED' && <p className="text-caption text-muted-foreground">결과를 기록하면 분석할 수 있습니다.</p>}
      {a && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Pill meta={{ label: VERDICT[a.verdict]?.[0], className: VERDICT[a.verdict]?.[1] }} /><p className="text-body">{a.summary}</p></div>
          {a.unverified?.length > 0 && <div><p className="text-caption font-semibold">미확인 항목</p><ul className="list-disc pl-5 text-caption text-muted-foreground">{a.unverified.map((u, i) => <li key={i}>{u}</li>)}</ul></div>}
          {a.causes?.length > 0 && <div><p className="text-caption font-semibold">원인 후보</p><ul className="space-y-1 mt-1">{a.causes.map((c, i) => <li key={i} className="text-caption"><Pill meta={SEVERITY[c.likelihood]}>{`가능성 ${SEVERITY[c.likelihood]?.label || '-'}`}</Pill> <span className="font-medium">{c.title}</span> — <span className="text-muted-foreground">{c.evidence}</span></li>)}</ul></div>}
          {a.improvements?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-caption font-semibold">개선안 — 반영할 항목을 고르세요</p>
              {a.improvements.map((m, i) => (
                <label key={i} className="flex items-start gap-2 rounded-md bg-card p-2 cursor-pointer">
                  <Checkbox className="mt-0.5" checked={picked.includes(i)} onCheckedChange={(on) => setPicked(on ? [...picked, i] : picked.filter((x) => x !== i))} />
                  <span className="text-caption"><span className="font-medium">[{AREA[m.area] || m.area}] {m.title}</span> <Pill meta={SEVERITY[m.priority]} /><br /><span className="text-muted-foreground">{m.detail}</span></span>
                </label>
              ))}
              <Button size="sm" onClick={apply} disabled={!picked.length || !!busy || !!test.improvement_version_id}>{busy === 'apply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}{test.improvement_version_id ? '새 버전에 반영됨' : `선택한 ${picked.length}개로 새 설계 버전 만들기`}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}