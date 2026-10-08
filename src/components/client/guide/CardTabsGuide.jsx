import React, { useState } from 'react';
import GuideSection from './GuideSection';
import MockFrame from './MockFrame';
import { MockOverviewBody, MockQuotationBody, MockChatBody, MockSettlementBody, MockFilesBody } from './MockCardBodies';
import { TAB_TEXT, G, M, t } from './guideI18n';

const BODIES = [MockOverviewBody, MockQuotationBody, MockChatBody, MockSettlementBody, MockFilesBody];

export default function CardTabsGuide({ lang = 'ko' }) {
  const [idx, setIdx] = useState(0);
  const Body = BODIES[idx];
  const label = t(TAB_TEXT[idx][0], lang);
  return (
    <GuideSection
      no="04"
      title={t(G.s4, lang)}
      mock={
        <MockFrame lang={lang} title={`${t(G.detail, lang)} · ${label}`}>
          <p className="text-xs font-semibold mb-2">{t(M.p1, lang)}</p>
          <div className="flex gap-3 border-b border-border mb-3 overflow-x-auto">
            {TAB_TEXT.map(([l], i) => (
              <span key={i} className={`text-[11px] pb-1.5 whitespace-nowrap ${i === idx ? 'border-b-2 border-primary font-semibold' : 'text-muted-foreground'}`}>{t(l, lang)}</span>
            ))}
          </div>
          <Body lang={lang} />
        </MockFrame>
      }
    >
      <p>{t(G.s4d, lang)}</p>
      <div className="flex flex-wrap gap-2">
        {TAB_TEXT.map(([l], i) => (
          <button key={i} type="button" onClick={() => setIdx(i)}
            className={`px-3 py-1.5 rounded-full text-xs border ${i === idx ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground'}`}>
            {t(l, lang)}
          </button>
        ))}
      </div>
      <div className="rounded-lg bg-muted/50 p-3"><p className="font-semibold text-foreground mb-1">{label}</p><p>{t(TAB_TEXT[idx][1], lang)}</p></div>
    </GuideSection>
  );
}