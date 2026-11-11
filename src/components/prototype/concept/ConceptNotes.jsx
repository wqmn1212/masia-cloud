import React from 'react';
import { HelpCircle, Info, Wrench } from 'lucide-react';

const KINDS = {
  assume: { icon: Info, tone: 'text-foreground', label: '가정' },
  unverified: { icon: HelpCircle, tone: 'text-warning-text', label: '검증 필요' },
  vendor: { icon: Wrench, tone: 'text-primary', label: '전문 검토 필요' },
  limit: { icon: Info, tone: 'text-muted-foreground', label: '한계' },
};

// 가정 · 검증 필요 · 전문 검토 필요를 결과와 따로, 항상 같은 모양으로 보여 준다
export default function ConceptNotes({ groups }) {
  const shown = (groups || []).filter((g) => g.items?.length);
  if (!shown.length) return null;
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 space-y-3">
      {shown.map((g) => {
        const k = KINDS[g.kind] || KINDS.assume;
        return (
          <div key={g.title} className="space-y-1">
            <p className={`flex items-center gap-1.5 text-label font-semibold ${k.tone}`}><k.icon className="w-4 h-4" />{g.title}<span className="rounded-full bg-card px-2 py-0.5 text-micro font-medium">{k.label}</span></p>
            <ul className="list-disc pl-5 space-y-0.5 text-caption text-muted-foreground">{g.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        );
      })}
    </div>
  );
}