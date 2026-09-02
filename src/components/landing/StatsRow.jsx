import { stats, tx } from '@/lib/landingContent';

export default function StatsRow({ lang }) {
  return (
    <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-px bg-landing-line border border-landing-line rounded-[14px] overflow-hidden">
      {stats.map((s, i) => (
        <div key={i} className="bg-white px-[22px] py-6">
          <div className="text-[32px] font-extrabold tracking-[-1.2px] text-landing-brand">
            {s.value}<span className="text-xl">{tx(s.unit, lang)}</span>
          </div>
          <div className="text-[13px] text-landing-muted mt-1 font-semibold">{tx(s.label, lang)}</div>
        </div>
      ))}
    </div>
  );
}