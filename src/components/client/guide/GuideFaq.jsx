import React from 'react';
import { Card } from '@/components/ui/card';
import { FAQ, G, t } from './guideI18n';

export default function GuideFaq({ lang = 'ko' }) {
  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-lg font-bold mb-4">{t(G.faq, lang)}</h2>
      <div className="divide-y divide-border">
        {FAQ.map(([q, a], i) => (
          <div key={i} className="py-3">
            <p className="text-sm font-semibold">{t(q, lang)}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t(a, lang)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}