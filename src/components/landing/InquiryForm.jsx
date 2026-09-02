import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { form, formTags, tx } from '@/lib/landingContent';
import InquiryField from './InquiryField';
import { cn } from '@/lib/utils';

const EMPTY = { company: '', contact_name: '', phone: '', email: '', quantity: '', target_price: '', detail: '' };
const ACCEPT = '.step,.stp,.dwg,.pdf,.jpg,.jpeg,.png';
const MAX_FILES = 5;

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function InquiryForm({ lang }) {
  const [values, setValues] = useState(EMPTY);
  const [tags, setTags] = useState([]);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const toggleTag = (val) => setTags((t) => (t.includes(val) ? t.filter((x) => x !== val) : [...t, val]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      const attachments = await Promise.all(
        files.slice(0, MAX_FILES).map(async (f) => ({ name: f.name, type: f.type, data: await toBase64(f) }))
      );
      await base44.functions.invoke('submitInquiry', {
        ...values,
        categories: tags,
        attachments,
        lang,
        referrer: document.referrer || '',
      });
      setStatus('done');
    } catch (err) {
      const code = err?.response?.status || err?.status;
      setErrorMsg(tx(code === 429 ? form.tooMany : form.error, lang));
      setStatus('error');
    }
  };

  const reset = () => { setValues(EMPTY); setTags([]); setFiles([]); setStatus('idle'); setErrorMsg(''); };

  if (status === 'done') {
    return (
      <div className="w-full lg:w-[520px] lg:flex-none bg-white border border-landing-line rounded-2xl p-[30px] shadow-[0_10px_32px_rgba(23,23,25,.08)] text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-landing-tint flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-landing-brand" />
        </div>
        <h3 className="mt-5 text-xl font-extrabold tracking-[-0.5px] text-landing-ink">{tx(form.doneTitle, lang)}</h3>
        <p className="mt-2.5 text-[14.5px] leading-[1.66] text-landing-ink3">{tx(form.doneBody, lang)}</p>
        <button type="button" onClick={reset} className="mt-6 bg-white text-landing-ink border border-landing-line3 hover:border-landing-brand hover:text-landing-brand text-sm font-bold px-5 py-2.5 rounded-[9px] transition-colors">
          {tx(form.again, lang)}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full lg:w-[520px] lg:flex-none bg-white border border-landing-line rounded-2xl p-[30px] shadow-[0_10px_32px_rgba(23,23,25,.08)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <InquiryField label={tx(form.company, lang)} placeholder={tx(form.companyPh, lang)} value={values.company} onChange={set('company')} required />
        <InquiryField label={tx(form.name, lang)} placeholder={tx(form.namePh, lang)} value={values.contact_name} onChange={set('contact_name')} required />
        <InquiryField label={tx(form.phone, lang)} placeholder={tx(form.phonePh, lang)} value={values.phone} onChange={set('phone')} required type="tel" />
        <InquiryField label={tx(form.email, lang)} placeholder={tx(form.emailPh, lang)} value={values.email} onChange={set('email')} required type="email" />
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-landing-ink2">{tx(form.category, lang)}</span>
        <div className="flex flex-wrap gap-[7px]">
          {formTags.map((t) => {
            const on = tags.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleTag(t.value)}
                className={cn(
                  'flex-none whitespace-nowrap text-[13px] font-semibold px-[13px] py-2 rounded-lg border transition-colors',
                  on ? 'bg-landing-tint border-landing-brand text-landing-brand' : 'bg-white border-landing-line2 text-landing-ink2'
                )}
              >
                {tx(t.label, lang)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
        <InquiryField label={tx(form.quantity, lang)} placeholder={tx(form.quantityPh, lang)} value={values.quantity} onChange={set('quantity')} />
        <InquiryField label={tx(form.price, lang)} placeholder={tx(form.pricePh, lang)} value={values.target_price} onChange={set('target_price')} />
      </div>

      <div className="mt-4">
        <InquiryField label={tx(form.detail, lang)} placeholder={tx(form.detailPh, lang)} value={values.detail} onChange={set('detail')} textarea />
      </div>

      <label className="mt-3.5 border border-dashed border-landing-tint-border bg-[#F8FAFF] rounded-[10px] p-4 flex items-center gap-3 cursor-pointer">
        <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, MAX_FILES))} />
        <div className="w-[34px] h-[34px] rounded-lg bg-[#DCE9FE] flex items-center justify-center font-mono font-bold text-xs text-landing-brand flex-none">＋</div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-landing-ink">{tx(form.attach, lang)}</div>
          <div className="text-[12.5px] text-landing-muted2 mt-0.5 truncate">
            {files.length > 0 ? files.map((f) => f.name).join(', ') : tx(form.attachSub, lang)}
          </div>
        </div>
      </label>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="mt-5 w-full bg-landing-ink hover:bg-landing-brand-hover disabled:opacity-60 text-white text-[15.5px] font-bold py-[15px] rounded-[11px] transition-colors"
      >
        {status === 'sending' ? tx(form.sending, lang) : tx(form.submit, lang)}
      </button>
      {status === 'error' && (
        <p className="mt-3 text-[13px] text-landing-danger bg-landing-danger-bg rounded-lg px-3 py-2">{errorMsg}</p>
      )}
      <p className="mt-3 text-xs text-landing-muted2 leading-[1.55] text-center">{tx(form.consent, lang)}</p>
    </form>
  );
}