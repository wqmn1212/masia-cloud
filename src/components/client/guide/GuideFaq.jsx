import React from 'react';
import { Card } from '@/components/ui/card';

const FAQ = [
  ['프로젝트가 하나도 안 보입니다.', '담당자가 검토를 마치고 공개해야 화면에 나타납니다. 문의를 접수하신 직후에는 비어 있는 것이 정상이며, 보통 영업일 기준 하루 안에 표시됩니다.'],
  ['단계를 제가 옮길 수 있나요?', '아니요. 단계는 AEGIS 담당자가 진행 상황에 맞춰 업데이트합니다. 고객사에서 직접 바꾸실 수 있는 것은 요구사항과 문의 메시지입니다.'],
  ['견적서 탭이 비어 있습니다.', '견적서는 담당자가 공개 처리한 뒤에 보입니다. 취합·검토 중에는 “아직 발행된 견적서가 없습니다”로 표시됩니다.'],
  ['견적 금액이 화면에 안 보입니다.', '금액은 화면에 표시하지 않고 PDF 견적서 안에만 담습니다. 목록 오른쪽 PDF 버튼으로 금액이 포함된 견적서를 내려받으실 수 있습니다.'],
  ['중국어로 써야 하나요?', '한국어로 쓰시면 됩니다. 문의와 요구사항은 중국어로 번역되어 현지 담당자에게 전달됩니다.'],
  ['계정을 추가하고 싶습니다.', '담당자에게 요청하시면 같은 회사 계정을 추가로 발급해 드립니다. 추가된 계정도 같은 프로젝트를 보게 됩니다.'],
];

export default function GuideFaq() {
  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-lg font-bold mb-4">자주 묻는 질문</h2>
      <div className="divide-y divide-border">
        {FAQ.map(([q, a]) => (
          <div key={q} className="py-3">
            <p className="text-sm font-semibold">{q}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}