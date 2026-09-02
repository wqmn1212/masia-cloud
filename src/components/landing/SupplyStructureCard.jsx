import { supply, tx } from '@/lib/landingContent';

const Connector = () => (
  <div className="flex justify-center"><div className="w-0.5 h-4 bg-landing-tint-border" /></div>
);

export default function SupplyStructureCard({ lang }) {
  return (
    <div className="w-full lg:w-[400px] lg:flex-none bg-white border border-landing-line rounded-2xl p-[26px] shadow-[0_8px_28px_rgba(23,23,25,.07)]">
      <div className="text-xs font-bold tracking-[.6px] text-landing-muted2 uppercase font-mono">{tx(supply.title, lang)}</div>
      <div className="flex flex-col gap-2.5 mt-[18px]">
        <div className="border border-landing-line2 rounded-[11px] px-4 py-3.5 bg-landing-page">
          <div className="text-[11px] font-bold text-landing-muted2 tracking-[.4px]">{tx(supply.koreaLabel, lang)}</div>
          <div className="text-[15px] font-bold mt-[3px]">{tx(supply.korea, lang)}</div>
        </div>
        <Connector />
        <div className="border-[1.5px] border-landing-brand rounded-[11px] px-4 py-[15px] bg-landing-tint-soft">
          <div className="text-[11px] font-bold text-landing-brand tracking-[.4px]">{tx(supply.aegisLabel, lang)}</div>
          <div className="text-[15px] font-extrabold mt-[3px] text-landing-brand-deep">AEGIS</div>
          <div className="text-[12.5px] text-landing-ink3 mt-1.5 leading-[1.5]">{tx(supply.aegisDesc, lang)}</div>
        </div>
        <Connector />
        <div className="border border-dashed border-landing-line3 rounded-[11px] px-4 py-3 bg-landing-page flex items-center gap-2.5 opacity-75">
          <span className="text-[13.5px] font-semibold text-landing-muted2 line-through">{tx(supply.removed, lang)}</span>
          <span className="ml-auto text-[11px] font-bold text-landing-danger bg-landing-danger-bg px-[7px] py-[3px] rounded-[5px]">{tx(supply.removedTag, lang)}</span>
        </div>
        <Connector />
        <div className="border border-landing-line2 rounded-[11px] px-4 py-3.5 bg-landing-page">
          <div className="text-[11px] font-bold text-landing-muted2 tracking-[.4px]">{tx(supply.chinaLabel, lang)}</div>
          <div className="text-[15px] font-bold mt-[3px]">{tx(supply.china, lang)}</div>
        </div>
      </div>
    </div>
  );
}