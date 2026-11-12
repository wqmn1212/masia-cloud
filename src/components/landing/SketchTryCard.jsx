import React, { useEffect, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sketchTry as T } from '@/lib/landingSketch';
import { tx } from '@/lib/landingContent';
import { shrinkImage, createTrial, getTrial, inquireTrial, savedToken, forgetTrial } from '@/lib/sketchTrialApi';
import FileDropArea from '@/components/files/FileDropArea';
import InquiryField from './InquiryField';
import SketchTryResult from './SketchTryResult';

const EMPTY = { idea: '', contact_name: '', phone: '', email: '', company: '', website: '' };
const errText = (code, lang) => tx(T.errors[code] || T.errors.fallback, lang);

// 스케치 올리기 → 시안 3장 → 고른 시안으로 견적 문의. 새로 고쳐도 마지막 결과를 다시 보여 준다
export default function SketchTryCard({ lang }) {
  const [values, setValues] = useState(EMPTY);
  const [image, setImage] = useState(null);
  const [trial, setTrial] = useState(null);
  const [phase, setPhase] = useState('form'); // form | loading | result
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = savedToken();
    if (!token) return;
    getTrial(token).then((t) => { if (t?.status === 'READY') { setTrial(t); setPhase('result'); } else forgetTrial(); }).catch(() => {});
  }, []);

  // 기다리는 동안 안내 문구를 바꿔 준다
  useEffect(() => {
    if (phase !== 'loading') return undefined;
    setStep(0);
    const a = setTimeout(() => setStep(1), 12000), b = setTimeout(() => setStep(2), 45000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [phase]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const pickFile = async (list) => {
    const file = Array.from(list || [])[0];
    if (!file) return;
    setError('');
    try { setImage(await shrinkImage(file)); } catch { setImage(null); setError(errText('image_type', lang)); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!image) { setError(tx(T.drop, lang)); return; }
    setError(''); setPhase('loading');
    base44.analytics?.track?.({ eventName: 'sketch_trial_started' });
    try {
      const t = await createTrial(values, image, lang);
      if (t?.status !== 'READY') throw Object.assign(new Error('trial'), { code: 'generate' });
      setTrial(t); setPhase('result');
      base44.analytics?.track?.({ eventName: 'sketch_trial_ready' });
    } catch (err) { setError(errText(err.code, lang)); setPhase('form'); }
  };

  const inquire = async (variant, extra) => {
    setBusy(true); setError('');
    try {
      setTrial(await inquireTrial(trial.token, variant, { ...extra, company: values.company }));
      base44.analytics?.track?.({ eventName: 'sketch_trial_inquired' });
    } catch { setError(errText('fallback', lang)); }
    setBusy(false);
  };
  const retry = () => { forgetTrial(); setTrial(null); setImage(null); setError(''); setPhase('form'); };

  const shell = 'w-full bg-white border border-landing-line rounded-2xl p-6 sm:p-[30px] shadow-[0_10px_32px_rgba(23,23,25,.08)]';

  if (phase === 'result' && trial) return <div className={shell}><SketchTryResult trial={trial} lang={lang} onInquire={inquire} onRetry={retry} busy={busy} error={error} /></div>;

  if (phase === 'loading') {
    return (
      <div className={`${shell} text-center`} aria-live="polite">
        {image && <img src={image.preview} alt="" className="mx-auto h-40 w-40 rounded-xl border border-landing-line object-cover" />}
        <Loader2 className="mx-auto mt-6 h-7 w-7 animate-spin text-landing-brand" />
        <p className="mt-4 text-[15px] font-bold text-landing-ink">{tx(T.loading[step], lang)}</p>
        <p className="mt-2 text-[13px] text-landing-muted2">{tx(T.loadingNote, lang)}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={shell}>
      <FileDropArea onFiles={pickFile}>
        <label className="flex cursor-pointer items-center gap-4 rounded-[12px] border border-dashed border-landing-tint-border bg-landing-tint-soft p-4">
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { pickFile(e.target.files); e.target.value = ''; }} />
          {image
            ? <img src={image.preview} alt="" className="h-20 w-20 flex-none rounded-lg border border-landing-line object-cover" />
            : <span className="flex h-20 w-20 flex-none items-center justify-center rounded-lg bg-landing-tint text-landing-brand"><ImagePlus className="h-7 w-7" /></span>}
          <span className="min-w-0">
            <span className="block text-[14.5px] font-bold text-landing-ink">{tx(image ? T.change : T.drop, lang)}</span>
            <span className="mt-1 block text-[12.5px] leading-[1.5] text-landing-muted2">{tx(T.dropSub, lang)}</span>
          </span>
        </label>
      </FileDropArea>

      <div className="mt-4">
        <InquiryField label={tx(T.idea, lang)} placeholder={tx(T.ideaPh, lang)} value={values.idea} onChange={set('idea')} required />
      </div>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <InquiryField label={tx(T.name, lang)} value={values.contact_name} onChange={set('contact_name')} required />
        <InquiryField label={tx(T.phone, lang)} value={values.phone} onChange={set('phone')} required type="tel" />
        <InquiryField label={tx(T.email, lang)} value={values.email} onChange={set('email')} required type="email" />
        <InquiryField label={tx(T.company, lang)} value={values.company} onChange={set('company')} />
      </div>
      {/* 자동 프로그램 거르기용 칸: 사람에게는 보이지 않는다 */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} className="hidden" aria-hidden="true" />

      <button type="submit" className="mt-5 w-full bg-landing-ink hover:bg-landing-brand-hover text-white text-[15.5px] font-bold py-[15px] rounded-[11px] transition-colors">{tx(T.submit, lang)}</button>
      {error && <p className="mt-3 text-[13px] text-landing-danger bg-landing-danger-bg rounded-lg px-3 py-2">{error}</p>}
      <p className="mt-3 text-center text-[12.5px] font-semibold text-landing-brand">{tx(T.free, lang)}</p>
      <p className="mt-2 text-xs leading-[1.55] text-landing-muted2">{tx(T.consent, lang)}</p>
    </form>
  );
}
