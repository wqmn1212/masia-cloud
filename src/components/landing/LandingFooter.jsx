import { footer, tx } from '@/lib/landingContent';

export default function LandingFooter({ lang }) {
  return (
    <footer className="border-t border-landing-line bg-white px-5 lg:px-8 py-10">
      <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <span className="text-[19px] font-extrabold tracking-[-0.5px] text-landing-ink leading-none">AEGIS</span>
        <div className="text-[13px] text-landing-muted2">{tx(footer.tagline, lang)}</div>
        <div className="flex-1" />
        <div className="text-[12.5px] text-landing-muted3 font-mono">{footer.copyright}</div>
      </div>
    </footer>
  );
}