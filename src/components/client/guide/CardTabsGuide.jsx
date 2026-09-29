import React, { useState } from 'react';
import GuideSection from './GuideSection';
import MockFrame from './MockFrame';
import { MockOverviewBody, MockQuotationBody, MockChatBody, MockSettlementBody, MockFilesBody } from './MockCardBodies';

const TABS = [
  { label: '진행 정보', Body: MockOverviewBody, desc: '일정과 현재 단계, 목표일, 그리고 요청하신 요구사항이 정리되어 있습니다. 이 탭에서 고객사가 직접 수정하실 수 있는 항목은 요구사항 하나뿐이며, 저장하면 중국 현지 담당자에게 번역되어 전달됩니다.' },
  { label: '견적서', Body: MockQuotationBody, desc: '담당자가 공개한 견적서 목록이 발행일과 함께 표시되고, 오른쪽 PDF 버튼으로 내려받습니다. 금액은 화면에 표시되지 않고 PDF 안에 담겨 있습니다. 아직 공개된 견적서가 없으면 비어 있다고 안내됩니다.' },
  { label: '문의', Body: MockChatBody, desc: '담당자와 주고받는 대화 창입니다. 파일도 첨부할 수 있습니다. 한국어로 쓰시면 중국 현지 직원에게 중국어로 전달되므로 번역 없이 그대로 쓰시면 됩니다.' },
  { label: '결제', Body: MockSettlementBody, desc: '선금과 잔금의 승인 상태를 보여줍니다. 입금 확인은 담당자가 처리하며, 승인되면 제작 공정이 시작됩니다.' },
  { label: '파일', Body: MockFilesBody, desc: '견적서, 공장 실사 사진, QC 검수 리포트처럼 공유된 자료를 내려받는 곳입니다. 담당자가 공개한 파일만 표시됩니다.' },
];

export default function CardTabsGuide() {
  const [idx, setIdx] = useState(0);
  const tab = TABS[idx];
  return (
    <GuideSection
      no="04"
      title="프로젝트를 누르면 다섯 개 탭이 열립니다"
      mock={
        <MockFrame title={`프로젝트 상세 · ${tab.label}`}>
          <p className="text-xs font-semibold mb-2">드립백 포장기 도입</p>
          <div className="flex gap-3 border-b border-border mb-3 overflow-x-auto">
            {TABS.map((t, i) => (
              <span key={t.label} className={`text-[11px] pb-1.5 whitespace-nowrap ${i === idx ? 'border-b-2 border-primary font-semibold' : 'text-muted-foreground'}`}>{t.label}</span>
            ))}
          </div>
          <tab.Body />
        </MockFrame>
      }
    >
      <p>대시보드나 보드에서 프로젝트를 누르면 상세 화면이 열립니다. 아래 탭을 눌러 각 화면에서 무엇을 할 수 있는지 확인해 보세요.</p>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t, i) => (
          <button key={t.label} type="button" onClick={() => setIdx(i)}
            className={`px-3 py-1.5 rounded-full text-xs border ${i === idx ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="rounded-lg bg-muted/50 p-3"><p className="font-semibold text-foreground mb-1">{tab.label}</p><p>{tab.desc}</p></div>
    </GuideSection>
  );
}