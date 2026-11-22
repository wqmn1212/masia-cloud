import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ArrowRight, Box, ChevronDown, ChevronUp, Layers, Pause, Play, RotateCw, Scissors, Split } from 'lucide-react';
import { createTeardown } from '@/lib/teardown/engine';
import { buildDefaultTour } from '@/lib/teardown/tour';
import { setupStage, onAccent } from '@/lib/stage3d';
import { PRODUCTS, productBySlug } from '@/lib/showroom/products';
import '@/components/landing/landingMinimal.css';

// 공개 3D 쇼룸 (/showroom/<제품>) — 인스타 광고·프로필에서 계정 없이 연다.
// 화면 대부분을 3D 에 쓰고, 위 정보 카드·아래 조작판은 접을 수 있다. 버튼 색은 제품 강조색을 따른다.
const VIEWS = [['solid', '실물', Box], ['glass', '투명', Layers], ['section', '단면', Scissors]];
const contactHref = (slug) => `/?ref=showroom_${slug}#contact`;

export default function Showroom() {
  const slugFromPath = window.location.pathname.split('/')[2] || '';
  const ref = new URLSearchParams(window.location.search).get('ref') || '';
  const [slug, setSlug] = useState(() => productBySlug(slugFromPath).slug);
  const product = productBySlug(slug);
  const index = PRODUCTS.findIndex((p) => p.slug === product.slug);
  const tour = useMemo(() => buildDefaultTour({ parts: product.parts, features: product.features, title: product.title, overall: product.overall, supplyV: product.supplyV }), [product]);

  const hostRef = useRef(null);
  const topRef = useRef(null);
  const dockRef = useRef(null);
  const api = useRef(null);
  const [st, setSt] = useState({ view: 'solid', explode: 0, playing: false, step: null, index: -1, count: 0 });
  const [spin, setSpin] = useState(true);
  const [infoOpen, setInfoOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(true);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const accent = product.accent;
  const ink = onAccent(accent);

  useEffect(() => { document.title = `${product.title} — AEGIS 3D 쇼룸`; }, [product]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let t;
    try {
      t = createTeardown(host, { THREE, OrbitControls, RoundedBoxGeometry, RoomEnvironment, stage: setupStage }, { parts: product.parts, tour, title: product.title, idleSpin: true, onChange: setSt });
    } catch { setFailed(true); return undefined; }
    t.setLabels('focus');
    api.current = t;
    fitInsets();
    setSt(t.getState());
    setSpin(true);
    setStarted(false);
    return () => { api.current = null; t.destroy(); };
  }, [product, tour]);

  // 위 카드·아래 조작판이 덮는 만큼 3D 를 가운데 띠로 (패널 크기가 바뀌면 다시)
  function fitInsets() {
    const h = window.innerHeight;
    // 넓은 화면에서는 정보 카드가 왼쪽에만 있어 가운데를 가리지 않는다
    const top = window.innerWidth >= 640 ? 72 : topRef.current?.getBoundingClientRect().bottom || 0;
    const dockTop = dockRef.current?.getBoundingClientRect().top || h;
    api.current?.setInsets({ top: top + 8, bottom: Math.max(0, h - dockTop) + 8 });
  }
  useEffect(() => {
    const ro = new ResizeObserver(() => fitInsets());
    [topRef.current, dockRef.current].forEach((el) => el && ro.observe(el));
    window.addEventListener('resize', fitInsets);
    return () => { ro.disconnect(); window.removeEventListener('resize', fitInsets); };
  }, []);

  const pick = (p) => {
    if (p.slug === slug) return;
    setSlug(p.slug);
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    window.history.replaceState(null, '', `/showroom/${p.slug}${q}`);
  };
  // 분해·조립: 카메라도 그 범위에 맞춰 따라간다
  const toggleExplode = () => api.current?.show({ id: 'explode', title: '', caption: '', focus: [], explode: st.explode > 0.5 ? 0 : 1, view: st.view, flows: [], actions: [] });
  const toggleSpin = () => { const v = !spin; setSpin(v); api.current?.setSpin(v); };
  const step = started && (st.playing || st.index >= 0) ? st.step : null;
  const playTour = () => { setStarted(true); api.current?.toggle(); };

  return (
    <div lang="ko" className="landing-minimal fixed inset-0 overflow-hidden font-landing text-landing-ink antialiased stage-bg" style={{ wordBreak: 'keep-all' }}>
      {/* 3D */}
      <div ref={hostRef} className="absolute inset-0" data-testid="showroom-stage" />
      {failed && <p className="absolute inset-x-4 top-1/2 text-center text-[15px] text-landing-muted">이 브라우저에서는 3D 를 열 수 없습니다.</p>}

      {/* 위: 로고 + 정보 카드 */}
      <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 p-3 sm:p-5" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="pointer-events-auto mx-auto flex max-w-[960px] items-center justify-between px-1 pb-2 sm:max-w-none">
          <a href="/" className="text-[20px] font-extrabold tracking-[-0.8px] text-landing-ink">AEGIS <span className="text-[13px] font-semibold tracking-normal text-landing-muted">3D 쇼룸</span></a>
          <a href={contactHref(product.slug)} className="rounded-full bg-white/80 px-3.5 py-2 text-[13px] font-bold text-landing-ink shadow-sm backdrop-blur">문의하기</a>
        </div>
        <section className="pointer-events-auto mx-auto max-w-[960px] rounded-[20px] border border-white/70 bg-white/80 shadow-[0_10px_30px_rgba(23,23,25,.08)] backdrop-blur-md sm:max-w-[440px] sm:ml-0">
          <button type="button" onClick={() => setInfoOpen((v) => !v)} aria-expanded={infoOpen} className="flex w-full items-start justify-between gap-3 px-5 pb-3 pt-4 text-left">
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-landing-muted">가상 예시 · {product.category}</span>
              <span className="mt-1 block truncate text-[24px] font-extrabold leading-tight tracking-[-0.8px] sm:text-[28px]">{product.title}</span>
              {infoOpen && <span className="mt-1 block text-[14.5px] text-landing-ink3">{product.tagline}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2 pt-0.5 font-mono text-[12px] font-semibold tracking-[.12em] text-landing-muted">
              {String(index + 1).padStart(2, '0')} / {String(PRODUCTS.length).padStart(2, '0')}
              {infoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
          {infoOpen && (
            <div className="space-y-3 px-5 pb-4">
              <div className="hidden flex-wrap gap-1.5 sm:flex">
                {product.facts.map(([k, v]) => <span key={k} className="rounded-full bg-landing-page px-2.5 py-1 text-[12px] text-landing-ink3"><b className="font-bold text-landing-ink">{k}</b> {v}</span>)}
              </div>
              <ul className="hidden space-y-1 text-[13.5px] leading-[1.55] text-landing-ink3 sm:block">
                {product.points.map((p) => <li key={p} className="flex gap-2"><span style={{ color: accent }}>●</span>{p}</li>)}
              </ul>
              <a href={contactHref(product.slug)} className="flex h-12 items-center justify-between rounded-[12px] px-4 text-[15px] font-bold" style={{ background: accent, color: ink }}>
                이런 제품, 양산까지 맡기기<ArrowRight className="h-5 w-5" />
              </a>
            </div>
          )}
        </section>
      </div>

      {/* 해설 (작동 원리 재생 중) */}
      {step && (
        <div className="pointer-events-none absolute inset-x-3 z-10 mx-auto max-w-[560px] rounded-[16px] bg-landing-ink/85 px-4 py-3 text-white backdrop-blur" style={{ bottom: dockOpen ? 'calc(300px + env(safe-area-inset-bottom))' : 'calc(72px + env(safe-area-inset-bottom))' }} aria-live="polite">
          <p className="text-[14px] font-bold">{st.index + 1}/{st.count} · {step.title}</p>
          {step.caption && <p className="mt-0.5 line-clamp-2 text-[13px] leading-[1.5] text-white/80">{step.caption}</p>}
        </div>
      )}

      {/* 아래: 조작판 (접을 수 있음) */}
      <div ref={dockRef} className="absolute inset-x-0 bottom-0 p-3 sm:p-5" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-[720px] space-y-2">
          <div className="flex justify-center">
            <button type="button" onClick={() => setDockOpen((v) => !v)} aria-expanded={dockOpen} className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-[12.5px] font-semibold text-landing-ink3 shadow-sm backdrop-blur">
              {dockOpen ? <>조작판 접기 <ChevronDown className="h-4 w-4" /></> : <>조작판 펴기 <ChevronUp className="h-4 w-4" /></>}
            </button>
          </div>
          {dockOpen && (
            <>
              <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <div className="grid grid-cols-3 rounded-[16px] bg-white/85 p-1 shadow-sm backdrop-blur">
                  {VIEWS.map(([k, l, Icon]) => (
                    <button key={k} type="button" onClick={() => api.current?.setView(k)} aria-pressed={st.view === k} className={`inline-flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2.5 text-[14px] font-semibold ${st.view === k ? 'bg-landing-ink text-white' : 'text-landing-ink3'}`}>
                      <Icon className="h-4 w-4" />{l}
                    </button>
                  ))}
                </div>
                <div className="grid h-[50px] grid-cols-[50px_1fr_1fr] gap-2">
                  <button type="button" onClick={toggleSpin} aria-pressed={spin} title={spin ? '천천히 돌기 멈춤' : '천천히 돌기'} className={`inline-flex items-center justify-center rounded-[16px] shadow-sm backdrop-blur ${spin ? 'bg-white/85 text-landing-ink' : 'bg-white/60 text-landing-muted'}`}>
                    <RotateCw className="h-5 w-5" /><span className="sr-only">천천히 돌기</span>
                  </button>
                  <button type="button" onClick={playTour} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[16px] bg-white/85 px-3 text-[15px] font-bold text-landing-ink shadow-sm backdrop-blur">
                    {st.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}작동 원리
                  </button>
                  <button type="button" onClick={toggleExplode} aria-pressed={st.explode > 0.5} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[16px] px-3 text-[15px] font-bold shadow-sm" style={{ background: accent, color: ink }}>
                    <Split className="h-4 w-4" />{st.explode > 0.5 ? '조립하기' : '분해하기'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto rounded-[18px] bg-white/80 p-2 shadow-sm backdrop-blur [scrollbar-width:none]">
                {PRODUCTS.map((p) => (
                  <button key={p.slug} type="button" onClick={() => pick(p)} aria-current={p.slug === slug} className={`flex w-[124px] shrink-0 flex-col items-center gap-1 rounded-[14px] p-1.5 text-center ${p.slug === slug ? 'bg-white shadow-sm' : ''}`}>
                    <span className="block h-[64px] w-[112px] overflow-hidden rounded-[10px]" style={{ background: 'linear-gradient(#f6f4f0,#e1e6ec)' }}><img src={`/showroom/${p.slug}.png`} alt="" width="112" height="64" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /></span>
                    <span className="line-clamp-1 text-[12.5px] font-semibold">{p.title}</span>
                    <span className="h-[3px] w-8 rounded-full" style={{ background: p.slug === slug ? p.accent : 'transparent' }} />
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="text-center text-[11px] text-landing-muted">가상 예시 제품 · 3D 는 개념 시각화 · 끌어서 돌리기</p>
        </div>
      </div>
    </div>
  );
}
