import React, { useState } from 'react';
import { Sparkles, Cpu, Boxes } from 'lucide-react';
import ProductDemo from '@/components/prototype/develop/ProductDemo';
import SimStep from '@/components/prototype/develop/SimStep';
import TeardownView from '@/components/teardown/TeardownView';

/**
 * 고객에게 보이는 3D: '시연'(작동 순서 자동 재생 + 쉬운 조작)이 먼저, '상세'(전압·전류·온도 시뮬레이션)는 탭으로.
 * 공유 모형(model: {dev, parts, title, overall_mm})에서 컨셉 모양을 만들어 둘에 같이 넘긴다.
 */
export function modelConcept(model, id) {
  return model?.parts?.length ? { id, preview: { parts: model.parts, title: model.title || '', overall_mm: model.overall_mm || null, tour: model.tour || null } } : null;
}

// 워크벤치에서는 viewer={false}(설정 편집 가능) + 상세가 먼저, 시연 탭은 '고객 시연 미리보기'
// '작동 원리' 탭: 컨셉 부품으로 자동 해설 투어 (워크벤치에서는 AI 투어·질문 답변·HTML/영상 저장까지)
export default function ModelShowcase({ concept, dev, change, pin = null, initial = 'demo', viewer = true, labels = ['시연', '상세 시뮬레이션'], onConceptChanged }) {
  const [tab, setTab] = useState(initial);
  const hasParts = !!concept?.preview?.parts?.length;
  const tabs = [['demo', labels[0], Sparkles], ['detail', labels[1], Cpu]];
  const order = [...(initial === 'detail' ? [...tabs].reverse() : tabs), ...(hasParts ? [['tour', '작동 원리', Boxes]] : [])];
  // 공유 모형(shared-·room-)은 실제 컨셉 id 가 아니므로 AI 투어·질문은 직원 워크벤치에서만
  const realConceptId = !viewer && concept?.id && !/^(shared|room)-/.test(concept.id) ? concept.id : null;
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="보기">
        {order.map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label ${tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>
      {tab === 'tour' && hasParts
        ? <TeardownView parts={concept.preview.parts} savedTour={concept.preview.tour} dev={dev} title={concept.preview.title} overall={concept.preview.overall_mm}
            conceptId={realConceptId} version={concept.version_no} onChanged={onConceptChanged} staff={!viewer} />
        : tab === 'demo' ? <ProductDemo key={concept?.id || 'box'} concept={concept} dev={dev} pin={pin} autoPlay={viewer} /> : <SimStep concept={concept} dev={dev} change={change} viewer={viewer} pin={pin} />}
    </div>
  );
}
