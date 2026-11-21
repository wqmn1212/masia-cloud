import React, { useEffect, useState } from 'react';
import { Check, Download, FileText, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import InquiryField from '@/components/landing/InquiryField';
import LandingFooter from '@/components/landing/LandingFooter';
import '@/components/landing/landingMinimal.css';

// 무료 자료 신청 페이지 (/free/<주소>) — 계정 없이 연다. 동의는 필수(개인정보)·선택(광고 수신) 두 가지를 따로 받고, 선택은 미리 체크하지 않는다
const call = async (body) => {
  try { return (await base44.functions.invoke('leadMagnet', body)).data; }
  catch (e) { const d = e?.response?.data; const err = new Error(d?.error || e.message); err.code = d?.code; throw err; }
};
const EMPTY = { name: '', email: '', company: '', phone: '', idea: '', website: '' };

function Consent({ id, checked, onChange, text, required }) {
  const [head, ...rest] = text.split(' — ');
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-landing-line2 bg-white p-3 text-[13px] leading-[1.6] text-landing-ink3">
      <input id={id} type="checkbox" className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[#0066FF]" checked={checked} onChange={(e) => onChange(e.target.checked)} required={required} />
      <span><b className={required ? 'text-landing-ink' : 'text-landing-ink2'}>{head}</b>{rest.length ? <span className="block text-landing-muted">{rest.join(' — ')}</span> : null}</span>
    </label>
  );
}

function Report({ r }) {
  const L = ({ t, xs }) => (xs?.length ? <div><p className="text-[13px] font-bold text-landing-ink">{t}</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13.5px] text-landing-ink3">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null);
  return (
    <div className="space-y-3 rounded-[12px] border border-landing-line2 bg-landing-page p-4 text-left">
      <p className="text-[15px] font-bold text-landing-ink">{r.product}</p>
      {r.users && <p className="text-[13.5px] text-landing-muted">{r.users}</p>}
      <L t="주요 부품" xs={r.parts?.map((x) => `${x.name}${x.note ? ` — ${x.note}` : ''}`)} />
      {r.molds && <L t="금형 (추정)" xs={[r.molds]} />}
      <L t="필요할 수 있는 인증 (확인 필요)" xs={r.certs} />
      <L t="개발 단계" xs={r.steps?.map((x) => `${x.step}${x.weeks ? ` · ${x.weeks}` : ''}`)} />
      <L t="양산에서 조심할 점" xs={r.risks} />
      <L t="지금 정하면 좋은 것" xs={r.next} />
    </div>
  );
}

export default function LeadMagnetPublic() {
  const slug = window.location.pathname.split('/')[2] || '';
  const ref = new URLSearchParams(window.location.search).get('ref') || new URLSearchParams(window.location.search).get('utm_source') || '';
  const [m, setM] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [v, setV] = useState(EMPTY);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    call({ action: 'page', slug }).then((d) => { setM(d.magnet); document.title = `${d.magnet.title} — ${d.magnet.operator.company || 'AEGIS'}`; }).catch((e) => setLoadErr(e.message));
  }, [slug]);

  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!privacy) { setErr('개인정보 수집·이용에 동의해야 자료를 보내 드릴 수 있습니다.'); return; }
    setBusy(true);
    try { setDone(await call({ action: 'submit', slug, ...v, privacy: true, marketing, ref })); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  if (loadErr) return <main className="landing-minimal flex min-h-screen items-center justify-center bg-landing-page px-4 font-landing"><p className="text-[15px] text-landing-muted">신청이 마감되었거나 없는 페이지입니다.</p></main>;
  if (!m) return <main className="flex min-h-screen items-center justify-center bg-landing-page"><Loader2 className="h-6 w-6 animate-spin text-landing-muted" /></main>;
  const report = m.kind === 'report';

  return (
    <div lang="ko" className="landing-minimal min-h-screen bg-landing-page font-landing text-landing-ink antialiased" style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
      <div className="border-b border-landing-line bg-white px-4 py-4 lg:px-8"><div className="mx-auto flex max-w-[1080px] items-center"><span className="text-[20px] font-extrabold tracking-[-0.8px]">AEGIS</span>{m.operator.company && m.operator.company !== 'AEGIS' && <span className="ml-3 text-[13px] text-landing-muted2">{m.operator.company}</span>}</div></div>
      <main><div className="mx-auto grid max-w-[1080px] gap-8 px-4 py-10 lg:grid-cols-[1fr_440px] lg:gap-12 lg:px-8 lg:py-16">
        <section className="space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-landing-tint px-3 py-1 text-[12.5px] font-bold text-landing-brand">{report ? <Sparkles className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}무료 {report ? '진단' : '자료'}</span>
          <h1 className="text-[30px] font-extrabold leading-[1.3] tracking-[-0.8px] sm:text-[38px]">{m.title}</h1>
          {m.subtitle && <p className="text-[16.5px] leading-[1.7] text-landing-ink3">{m.subtitle}</p>}
          {m.bullets?.length > 0 && (
            <ul className="space-y-2.5">
              {m.bullets.map((b, i) => <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.6] text-landing-ink2"><Check className="mt-[3px] h-[18px] w-[18px] shrink-0 text-landing-brand" />{b}</li>)}
            </ul>
          )}
          <div aria-hidden className="relative hidden h-[220px] max-w-[360px] lg:block">
            <div className="absolute left-6 top-4 h-[200px] w-[300px] rotate-[-4deg] rounded-[14px] border border-landing-line2 bg-white shadow-sm" />
            <div className="absolute left-0 top-0 h-[200px] w-[300px] rounded-[14px] border border-landing-line2 bg-white p-5 shadow-md">
              <p className="text-[12px] font-bold text-landing-brand">{report ? '양산 진단 리포트' : 'PDF'}</p>
              <p className="mt-1 line-clamp-2 text-[16px] font-bold leading-[1.4]">{m.title}</p>
              <div className="mt-4 space-y-2">{[90, 75, 82, 60].map((w, i) => <div key={i} className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-[4px] border-2 border-landing-brand/60" /><span className="h-2 rounded bg-landing-line" style={{ width: `${w}%` }} /></div>)}</div>
            </div>
          </div>
        </section>

        <section className="rounded-[16px] border border-landing-line2 bg-white p-5 shadow-sm sm:p-6 lg:self-start">
          {done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-landing-tint"><Check className="h-6 w-6 text-landing-brand" /></div>
              <h2 className="text-[20px] font-bold">{done.again ? '이미 신청하셨습니다' : '신청되었습니다'}</h2>
              <p className="text-[14.5px] leading-[1.7] text-landing-ink3">
                {done.again ? '조금 전에 보내 드린 메일을 확인해 주세요.' : done.email_sent ? `${v.email} 로 ${report ? '리포트를' : '자료를'} 보냈습니다. 메일이 안 보이면 스팸함도 확인해 주세요.` : '메일 발송이 늦어지고 있습니다. 담당자가 확인해 곧 보내 드리겠습니다.'}
              </p>
              {done.material_token && <a href={`/d/${done.material_token}`} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-landing-brand text-[15px] font-bold text-white hover:bg-landing-brand-hover"><Download className="h-5 w-5" />지금 바로 받기</a>}
              {done.report && <Report r={done.report} />}
              {m.thanks && <p className="text-[14px] text-landing-muted">{m.thanks}</p>}
              <a href="/" className="inline-block text-[13.5px] font-semibold text-landing-brand underline">{m.operator.company || 'AEGIS'} 더 알아보기</a>
            </div>
          ) : (
            <form className="space-y-3.5" onSubmit={submit} noValidate>
              <h2 className="text-[18px] font-bold">{report ? '아이디어를 적고 무료 진단 받기' : '이메일로 무료로 받기'}</h2>
              {report && <InquiryField label="만들고 싶은 제품 *" textarea value={v.idea} onChange={set('idea')} placeholder="예: 캠핑용 충전식 랜턴. 밝기 3단, USB-C 충전, 생활 방수" required />}
              <div className="grid gap-3.5 sm:grid-cols-2">
                <InquiryField label="이름 *" value={v.name} onChange={set('name')} autoComplete="name" required />
                {m.ask.company && <InquiryField label="회사명" value={v.company} onChange={set('company')} autoComplete="organization" />}
              </div>
              <InquiryField label="이메일 *" type="email" value={v.email} onChange={set('email')} autoComplete="email" required placeholder="name@company.com" />
              {m.ask.phone && <InquiryField label="전화번호" type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" />}
              {!report && m.ask.idea && <InquiryField label="만들고 싶은 제품 (선택)" textarea value={v.idea} onChange={set('idea')} />}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={v.website} onChange={set('website')} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
              <div className="space-y-2 pt-1">
                <Consent id="c-privacy" checked={privacy} onChange={setPrivacy} text={m.consent.privacy} required />
                <Consent id="c-marketing" checked={marketing} onChange={setMarketing} text={m.consent.marketing} />
              </div>
              {err && <p role="alert" className="text-[13.5px] font-semibold text-destructive">{err}</p>}
              <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-landing-brand text-[15.5px] font-bold text-white hover:bg-landing-brand-hover disabled:opacity-60">
                {busy && <Loader2 className="h-5 w-5 animate-spin" />}{busy ? (report ? 'AI 가 진단하는 중… (30초 정도)' : '보내는 중…') : m.button_label}
              </button>
              <p className="text-[12px] leading-[1.6] text-landing-muted2">
                개인정보 처리자: {m.operator.company}{m.operator.email ? ` · ${m.operator.email}` : ''}{m.operator.phone ? ` · ${m.operator.phone}` : ''}
                {m.operator.privacy_url && <> · <a href={m.operator.privacy_url} target="_blank" rel="noopener noreferrer" className="underline">개인정보 처리방침</a></>}
              </p>
            </form>
          )}
        </section>
      </div></main>
      <LandingFooter lang="ko" />
    </div>
  );
}
