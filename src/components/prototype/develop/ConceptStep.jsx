import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, PenLine, Box, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConceptCanvas from '@/components/prototype/concept/ConceptCanvas';
import { Card } from '@/components/prototype/develop/DevBits';
import { fmtDate } from '@/lib/prototype';

const FLOW = [
  [PenLine, '현장 스케치', '미팅에서 그린 스케치·사진을 올리면 정면 시안 3장을 만들고 고객이 고릅니다.'],
  [Image, '시안 → 측면', '고른 시안으로 측면을 만들어 비율을 맞춥니다.'],
  [Box, '컨셉 3D', '외형 3D 와 부품 배치(기본 도형)로 미팅에서 돌려 보며 확인합니다.'],
];

// 1단계: 컨셉 스튜디오에서 만든 컨셉을 보여 주고 다음 단계(3D 도면)로 넘긴다
export default function ConceptStep({ project, concept, concepts, onNext }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card title="컨셉" icon={Sparkles} tag={concept ? `v${concept.version_no}` : null}
        actions={<Button size="sm" variant="outline" asChild><Link to={`/prototypes/${project.id}/concept`}>컨셉 스튜디오 열기</Link></Button>}>
        {concept ? (
          <>
            <div className="relative h-[360px] overflow-hidden rounded-xl border bg-gradient-to-b from-secondary to-card">
              <ConceptCanvas parts={concept.preview.parts} autoRotate overall={concept.preview.overall_mm} />
            </div>
            <p className="text-body">{concept.preview.summary || concept.title}</p>
            <p className="text-caption text-muted-foreground">부품 {concept.preview.parts.length}개 · 약 {concept.preview.overall_mm?.x} × {concept.preview.overall_mm?.z} × {concept.preview.overall_mm?.y} mm · 버전 {concepts.length}개 · 최근 {fmtDate(concept.updated_date)}</p>
          </>
        ) : (
          <div className="rounded-xl bg-secondary px-4 py-10 text-center space-y-2">
            <p className="text-body">아직 3D 컨셉이 없습니다.</p>
            <p className="text-caption text-muted-foreground">컨셉 스튜디오에서 미팅 스케치를 올리거나 아이디어를 적어 시작하세요. 컨셉 없이도 다음 단계에서 치수를 직접 넣어 진행할 수 있습니다.</p>
          </div>
        )}
      </Card>
      <div className="space-y-4">
        <Card title="현장 미팅 흐름">
          <ol className="space-y-3">
            {FLOW.map(([Icon, t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="w-4 h-4" /></span>
                <div><p className="text-label font-semibold">{i + 1}. {t}</p><p className="text-caption text-muted-foreground">{d}</p></div>
              </li>
            ))}
          </ol>
        </Card>
        <Button className="w-full" onClick={onNext}>3D 도면 단계로<ArrowRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
