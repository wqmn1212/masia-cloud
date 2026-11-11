import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import ConceptPreviewPanel from '@/components/prototype/concept/ConceptPreviewPanel';

// 예시 데이터 (화면 구성 확인용) — 실제 컨셉 연결 전까지만 쓴다
const SAMPLE = {
  title: '휴대용 미니 공기청정기 (예시 데이터)',
  summary: '원통형 본체 하단에서 공기를 빨아들여 상단으로 내보내는 탁상용 컨셉. 내부에 팬·필터·기판·배터리를 세로로 쌓았습니다.',
  overall_mm: { x: 90, y: 180, z: 90 },
  parts: [
    { id: 'p1', name: '본체 하우징', role: '외장 케이스', layer: 'SHELL', shape: 'cylinder', size: { x: 90, y: 150, z: 90 }, position: { x: 0, y: 85, z: 0 }, color: '#eef1f5', finish: 'matte', material: 'ABS' },
    { id: 'p2', name: '상단 그릴', role: '배기구', layer: 'SHELL', shape: 'cylinder', size: { x: 90, y: 14, z: 90 }, position: { x: 0, y: 167, z: 0 }, color: '#2b2f36', finish: 'gloss', material: 'PC/ABS' },
    { id: 'p3', name: '받침', role: '흡기 간격 확보', layer: 'SHELL', shape: 'cylinder', size: { x: 80, y: 10, z: 80 }, position: { x: 0, y: 5, z: 0 }, color: '#2b2f36', finish: 'rubber', material: 'TPU' },
    { id: 'p4', name: 'HEPA 필터', role: '미세먼지 여과', layer: 'INTERNAL', shape: 'cylinder', size: { x: 70, y: 55, z: 70 }, position: { x: 0, y: 45, z: 0 }, color: '#d9e6c8', finish: 'matte' },
    { id: 'p5', name: 'DC 팬', role: '송풍', layer: 'INTERNAL', shape: 'cylinder', size: { x: 72, y: 22, z: 72 }, position: { x: 0, y: 90, z: 0 }, color: '#3a4250', finish: 'matte' },
    { id: 'p6', name: '메인 기판', role: '제어·충전', layer: 'PCB', shape: 'cylinder', size: { x: 66, y: 2, z: 66 }, position: { x: 0, y: 112, z: 0 }, color: '#1f7a4a', finish: 'matte' },
    { id: 'p7', name: '배터리', role: '18650 2셀', layer: 'INTERNAL', shape: 'rounded_box', size: { x: 40, y: 20, z: 60 }, position: { x: 0, y: 128, z: 0 }, color: '#2f6fd6', finish: 'gloss' },
    { id: 'p8', name: '전원 버튼', role: '터치 조작', layer: 'UI', shape: 'cylinder', size: { x: 14, y: 3, z: 14 }, position: { x: 0, y: 120, z: 45 }, rotation_deg: { x: 90, y: 0, z: 0 }, color: '#0066ff', finish: 'gloss' },
  ],
};

export default function PrototypeConcept() {
  const { projectId } = useParams();
  const [highlightId, setHighlightId] = useState(null);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <Link to={`/prototypes/${projectId}`} className="inline-flex items-center gap-1 text-label text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />시제품으로</Link>
        <div className="mt-2 flex items-center gap-2 text-primary"><Sparkles className="w-5 h-5" /><span className="text-label font-semibold">컨셉 스튜디오</span></div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">아이디어를 미팅에서 바로 보여 주는 3D 프리뷰</h1>
      </div>
      <ConceptPreviewPanel preview={SAMPLE} highlightId={highlightId} onHighlight={setHighlightId} />
    </div>
  );
}