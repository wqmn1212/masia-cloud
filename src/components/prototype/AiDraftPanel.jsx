import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { errorText } from '@/lib/prototypeApi';

// AI 설계 초안 만들기 — 결과는 원본과 분리된 'AI 초안' 버전으로 저장되어 검토를 기다린다
export default function AiDraftPanel({ project, baseVersion, onCreated }) {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('prototypeAction', { action: 'draft', project_id: project.id, base_version_id: baseVersion?.id, instruction });
      setInstruction('');
      onCreated(res.data.version);
      toast({ title: `v${res.data.version.version_no} AI 초안을 만들었습니다`, description: '검토 후 승인하거나 수정해 주세요.' });
    } catch (e) { toast({ title: 'AI 초안을 만들지 못했습니다', description: errorText(e), variant: 'destructive' }); }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-chart-4/30 bg-chart-4/5 p-5 space-y-3">
      <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-chart-4" /><p className="text-title font-semibold">AI 설계 초안</p></div>
      <p className="text-caption text-muted-foreground">
        요구사항과 이미지·PDF 도면을 분석해 누락·모순·위험, 동작 원리, 부품표, 연결 관계, 회로·펌웨어·사출·금형 초안을 만듭니다.
        {baseVersion ? ` v${baseVersion.version_no}을 기준으로 고칩니다.` : ''} 결과는 검증 전 초안입니다. 고급 모델을 써서 1~3분 걸리고 크레딧이 더 듭니다.
      </p>
      <Textarea rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="추가 지시 (선택) — 예: ESP32 대신 저전력 MCU, 배터리 2000mAh 기준" disabled={busy} />
      <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{busy ? '설계 중… (1~3분)' : 'AI 초안 만들기'}</Button>
    </div>
  );
}