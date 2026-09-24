import React from 'react';
import { supply, tx } from '@/lib/landingContent';

export default function SupplyStructureCard({ lang }) {
  return (
    <div className="lm-supply">
      <div className="lm-supply-title"><span aria-hidden="true" />{tx(supply.title, lang)}</div>
      <div className="lm-flow">
        <div className="lm-node"><small>{tx(supply.koreaLabel, lang)}</small><strong>{tx(supply.korea, lang)}</strong></div>
        <div className="lm-connector"><small>{tx(supply.aegisLabel, lang)}</small><strong>AEGIS</strong><p>{tx(supply.aegisDesc, lang)}</p></div>
        <div className="lm-node"><small>{tx(supply.chinaLabel, lang)}</small><strong>{tx(supply.china, lang)}</strong></div>
      </div>
      <div className="lm-removed"><s>{tx(supply.removed, lang)}</s><span>{tx(supply.removedTag, lang)}</span></div>
    </div>
  );
}