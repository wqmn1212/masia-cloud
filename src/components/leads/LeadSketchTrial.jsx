import React from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// 메인페이지 '스케치 시안 체험'으로 들어온 문의: 만들어 준 시안과 고객이 고른 시안
export default function LeadSketchTrial({ lead }) {
  const t = lead.sketch_trial;
  if (lead.source !== 'sketch_tool' || !t) return null;
  const state = t.status === 'FAILED' ? '시안 생성 실패' : t.status !== 'READY' ? '시안 만드는 중' : t.inquired_at ? '시안을 골라 견적을 문의함' : '시안만 받아 봄 (견적 문의 전)';
  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">스케치 시안 체험</Badge>
        <span className="text-caption text-muted-foreground">{state}</span>
      </div>
      {t.variants?.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {t.variants.map((v, i) => (
            <a key={v.url} href={v.url} target="_blank" rel="noreferrer" className={`overflow-hidden rounded-lg border-2 bg-card ${t.chosen === i ? 'border-primary' : 'border-transparent'}`}>
              <img src={v.url} alt={v.label} className="aspect-square w-full object-cover" />
              <span className="flex items-center gap-1 px-2 py-1.5 text-caption font-medium">{t.chosen === i && <Check className="w-3.5 h-3.5 text-primary" />}{v.label}</span>
            </a>
          ))}
        </div>
      )}
      {t.error && <p className="text-caption text-destructive">{t.error}</p>}
      <p className="text-micro text-muted-foreground">고객이 올린 스케치는 아래 첨부에 있습니다. 시안은 AI 가 만든 개념 이미지입니다.{!t.inquired_at && t.status === 'READY' ? ' 아직 견적 문의를 누르지 않았으니 먼저 연락해 보세요.' : ''}</p>
    </div>
  );
}
