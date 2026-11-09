import React from 'react';
import { AlertTriangle, HelpCircle, Info } from 'lucide-react';

const Block = ({ icon, title, items, tone }) => (items?.length ? (
  <div className="space-y-1">
    <p className={`text-label font-semibold flex items-center gap-1.5 ${tone}`}>{icon}{title}</p>
    <ul className="list-disc pl-5 space-y-0.5 text-caption text-muted-foreground">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
  </div>
) : null);

// 가정·미확인·한계를 눈에 띄게 따로 보여 준다
export default function SimNotes({ result }) {
  const ai = result.ai || {};
  const general = (result.checks || []).filter((c) => !c.step_id).map((c) => `${c.severity === 'HIGH' ? '[높음]' : '[보통]'} ${c.title} — ${c.detail}`);
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 space-y-3">
      <Block icon={<AlertTriangle className="w-4 h-4" />} title="계산으로 찾은 문제" items={general} tone="text-destructive" />
      <Block icon={<HelpCircle className="w-4 h-4" />} title="미확인 항목 (계산에서 빠짐)" items={[...(result.unknowns || []), ...(ai.unverified || [])]} tone="text-warning-text" />
      <Block icon={<Info className="w-4 h-4" />} title="AI가 둔 가정" items={ai.assumptions} tone="" />
      <Block icon={<Info className="w-4 h-4" />} title="이 결과의 한계" items={ai.limitations} tone="" />
      {result.ai_error && <p className="text-caption text-destructive">AI 설명을 만들지 못했습니다 ({result.ai_error}). 수치·파형·재생은 계산값으로 그대로 볼 수 있습니다.</p>}
    </div>
  );
}