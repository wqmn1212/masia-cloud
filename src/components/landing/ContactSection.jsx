import { contact, tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';
import InquiryForm from './InquiryForm';

export default function ContactSection({ lang }) {
  return (
    <section id="contact" className="px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-14 items-start">
        <div className="flex-1 min-w-0">
          <SectionHeading eyebrow={contact.eyebrow} title={tx(contact.h2, lang)} maxWidth="" />
          <p className="mt-4 text-base leading-[1.68] text-landing-ink3 max-w-[440px]">{tx(contact.body, lang)}</p>
          <div className="mt-[30px] border-t border-landing-line pt-[22px] flex flex-col gap-3.5">
            <div>
              <div className="text-xs font-bold text-landing-muted2 tracking-[.3px]">{tx(contact.hqLabel, lang)}</div>
              <div className="text-[15px] font-semibold mt-[3px]">{tx(contact.hq, lang)}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-landing-muted2 tracking-[.3px]">{tx(contact.szLabel, lang)}</div>
              <div className="text-[15px] font-semibold mt-[3px]">{tx(contact.sz, lang)}</div>
            </div>
          </div>
        </div>
        <InquiryForm lang={lang} />
      </div>
    </section>
  );
}