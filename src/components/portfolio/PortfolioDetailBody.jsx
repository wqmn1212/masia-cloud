import React from 'react';
import { Download, Lock, Play } from 'lucide-react';

const pick = (o, lang) => o?.[lang] || o?.ko || '';

export default function PortfolioDetailBody({ item, lang, contactHref }) {
  const specs = item.spec_files || [];
  const videos = item.videos || [];
  const images = item.images || [];
  const facts = [
    item.moq && ['MOQ', item.moq],
    item.lead_time && ['LEAD TIME', item.lead_time],
    item.certifications?.length && ['CERTIFICATION', item.certifications.join(', ')],
  ].filter(Boolean);

  return (
    <div className="max-w-[900px] mx-auto px-5 lg:px-8 py-12 lg:py-16">
      <h1 className="text-[30px] lg:text-[40px] font-bold tracking-[-1px] text-landing-ink">{pick(item.title, lang)}</h1>
      <p className="mt-3 text-[16px] leading-[1.7] text-landing-muted">{pick(item.summary, lang)}</p>

      {facts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
          {facts.map(([label, value]) => (
            <div key={label} className="border border-landing-line rounded-[13px] p-4 bg-landing-tint-soft">
              <div className="text-[11px] font-bold font-mono text-landing-brand">{label}</div>
              <div className="mt-1 text-[14.5px] font-semibold text-landing-ink">{value}</div>
            </div>
          ))}
        </div>
      )}

      {item.thumbnail_url && (
        <img src={item.thumbnail_url} alt="" className="mt-10 w-full rounded-[13px] border border-landing-line object-cover" />
      )}

      {pick(item.body, lang) && (
        <div className="mt-10 whitespace-pre-line text-[15.5px] leading-[1.8] text-landing-ink2">{pick(item.body, lang)}</div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10">
          {images.map((im, i) => (
            <figure key={i} className="border border-landing-line rounded-[13px] overflow-hidden bg-white">
              <img src={im.url} alt={pick(im.caption, lang)} className="w-full h-[220px] object-cover" />
              {pick(im.caption, lang) && <figcaption className="p-3 text-[13px] text-landing-muted">{pick(im.caption, lang)}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="mt-10 space-y-3">
          {videos.filter((v) => v.url).map((v, i) => (
            <a key={i} href={v.url} target="_blank" rel="noreferrer"
               className="flex items-center gap-3 border border-landing-line rounded-[13px] p-4 hover:border-landing-brand transition-colors">
              <Play className="w-5 h-5 text-landing-brand" />
              <span className="text-[14.5px] font-semibold text-landing-ink">{pick(v.title, lang) || v.url}</span>
            </a>
          ))}
        </div>
      )}

      {specs.length > 0 && (
        <div className="mt-10 space-y-3">
          {specs.map((f) => (
            f.url ? (
              <a key={f.index} href={f.url} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between gap-3 border border-landing-line rounded-[13px] p-4 hover:border-landing-brand transition-colors">
                <span className="text-[14.5px] font-semibold text-landing-ink">{pick(f.label, lang)}</span>
                <Download className="w-4 h-4 text-landing-brand" />
              </a>
            ) : (
              <a key={f.index} href={contactHref}
                 className="flex items-center justify-between gap-3 border border-dashed border-landing-line2 rounded-[13px] p-4 bg-landing-page">
                <span className="text-[14.5px] font-semibold text-landing-muted">{pick(f.label, lang)}</span>
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-landing-muted2"><Lock className="w-3.5 h-3.5" /> 문의 후 제공</span>
              </a>
            )
          ))}
        </div>
      )}

      <a href={contactHref}
         className="inline-flex mt-12 items-center justify-center rounded-full bg-landing-brand hover:bg-landing-brand-hover text-white font-bold text-[14.5px] px-6 py-3.5 transition-colors">
        이 품목으로 견적 문의
      </a>
    </div>
  );
}