import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ArrowRight, Box, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Layers, Pause, Play, Plug, Power, RotateCcw, RotateCw, Scissors, Split, X } from 'lucide-react';
import { createTeardown } from '@/lib/teardown/engine';
import { buildDefaultTour } from '@/lib/teardown/tour';
import { setupStage, onAccent } from '@/lib/stage3d';
import { PRODUCTS, productBySlug } from '@/lib/showroom/products';
import { evaluate, liveStep, impactOf, removableParts } from '@/lib/showroom/workCheck';
import { createSim, stepSim, setInput } from '@/lib/devkit/deviceSim';
import { isOutput } from '@/lib/devkit/features';
import '@/components/landing/landingMinimal.css';

// 공개 3D 쇼룸 (/showroom/<제품>) — 인스타 광고·프로필에서 계정 없이 연다.
// 화면 대부분을 3D 에 쓰고, 위 정보 카드·아래 조작판은 접을 수 있다. 버튼 색은 제품 강조색을 따른다.
const VIEWS = [['solid', '실물', Box], ['glass', '투명', Layers], ['section', '단면', Scissors]];
const contactHref = (slug) => `/?ref=showroom_${slug}#contact`;
const MODES = [['tour', '둘러보기'], ['parts', '부품 하나씩'], ['work', '작동해 보기']];
const LAYER = { SHELL: '외장', UI: '조작부', INTERNAL: '내부 부품', PCB: '기판·전원', OTHER: '기타' };
const short = (s) => String(s || '').split(/\s[(—-]/)[0].trim() || String(s || '');
const lvl = (f, v) => (!(Number(v) > 0) ? '꺼짐' : ['relay', 'display'].includes(f.kind) ? '켜짐' : `${Math.round(v)}%`);
// 버튼 기능 중 실제로 무언가를 켜는 것만 (규칙이 있는 버튼)
const pressables = (p) => p.features.filter((f) => f.kind === 'button' && (p.rules || []).some((r) => r.type === 'event' && r.src === f.id));
const freshSim = (p) => { const s = createSim({ features: p.features, rules: p.rules, supply_v: p.supplyV }, { source: 'usb', usb_plugged: true }); stepSim(s, 0.5); return s; };

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
  const [mode, setMode] = useState('tour');
  const [partIdx, setPartIdx] = useState(0);
  const [removed, setRemoved] = useState([]);
  const [out, setOut] = useState({});
  const [note, setNote] = useState('');
  const simRef = useRef(null);
  const stRef = useRef(st); stRef.current = st;
  const check = useMemo(() => evaluate(product, removed), [product, removed]);
  const canRemove = useMemo(() => removableParts(product), [product]);
  const part = product.parts[Math.min(partIdx, product.parts.length - 1)];
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
    setMode('tour'); setPartIdx(0); setRemoved([]); setOut({}); setNote('');
    simRef.current = freshSim(product);
    return () => { api.current = null; t.destroy(); };
  }, [product, tour]);

  // 뺀 부품은 3D 에서 사라진다 (모든 모드 공통)
  useEffect(() => { api.current?.setHidden(removed); }, [removed]);

  // 작동해 보기: 가상 시제품을 돌리고, 켜진 것만 3D 에 (전원·제어가 없으면 모두 꺼진 채로)
  const alive = check.power.ok && check.control.ok;
  useEffect(() => {
    if (mode !== 'work') return undefined;
    if (!alive) simRef.current = freshSim(product);
    const tick = () => {
      const s = simRef.current; if (!s) return;
      stepSim(s, 0.1);
      const o = alive ? { ...s.out } : {};
      setOut((prev) => (JSON.stringify(prev) === JSON.stringify(o) ? prev : o));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [mode, alive, product]);
  useEffect(() => {
    if (mode !== 'work') return;
    api.current?.live({ ...liveStep(product, check, out, removed), view: 'glass', explode: 0 });
  }, [mode, out, check, removed, product]);

  // 부품 하나씩: 그 부품을 강조하고 카메라를 가까이 (내부 부품은 투명 보기로)
  const showPart = (i) => {
    const n = product.parts.length;
    const k = ((i % n) + n) % n;
    setPartIdx(k);
    const p = product.parts[k];
    api.current?.show({ id: `part-${p.id}`, title: '', caption: '', focus: [p.id], explode: stRef.current.explode, view: p.layer === 'SHELL' || p.layer === 'UI' ? 'solid' : 'glass', flows: [], actions: [] });
  };
  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m); setNote('');
    if (window.innerWidth < 640) setInfoOpen(false);
    if (m === 'parts') showPart(partIdx);
    else if (m === 'work') api.current?.show({ id: 'work', title: '', caption: '', focus: [], view: 'glass', explode: 0, flows: [], actions: [] });
    else if (m === 'tour') { const cur = stRef.current; api.current?.live({ id: 'idle', title: '', caption: '', focus: [], flows: [], actions: [], view: cur.view, explode: cur.explode }); }
  };
  const toggleRemoved = (id) => setRemoved((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const press = (f) => {
    if (!check.power.ok) { setNote(check.power.reason); return; }
    if (!check.control.ok) { setNote(check.control.reason); return; }
    if (!check.features[f.id]?.ok) { setNote(check.features[f.id].reason); return; }
    setNote('');
    const s = simRef.current;
    setInput(s, { pressed: { ...s.input.pressed, [f.id]: true } }); stepSim(s, 0.05);
    setInput(s, { pressed: { ...s.input.pressed, [f.id]: false } }); stepSim(s, 0.05);
    setOut({ ...s.out });
  };

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
  const step = mode === 'tour' && started && (st.playing || st.index >= 0) ? st.step : null;
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
        <section className={`pointer-events-auto mx-auto max-w-[960px] rounded-[20px] border border-white/70 bg-white/80 shadow-[0_10px_30px_rgba(23,23,25,.08)] backdrop-blur-md sm:ml-0 sm:max-w-[440px] ${mode === 'tour' ? '' : 'max-sm:hidden'}`}>
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
            <div className="grid grid-cols-3 rounded-[16px] bg-white/85 p-1 shadow-sm backdrop-blur" role="tablist">
              {MODES.map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => switchMode(k)} className={`rounded-[12px] px-2 py-2.5 text-[14px] font-bold ${mode === k ? 'shadow-sm' : 'text-landing-ink3'}`} style={mode === k ? { background: accent, color: ink } : undefined}>{l}</button>
              ))}
            </div>
          )}
          {dockOpen && mode === 'parts' && part && <PartCard product={product} part={part} index={partIdx} removed={removed} accent={accent} onPrev={() => showPart(partIdx - 1)} onNext={() => showPart(partIdx + 1)} onToggle={() => toggleRemoved(part.id)} canRemove={canRemove.some((x) => x.id === part.id)} />}
          {dockOpen && mode === 'work' && <WorkPanel product={product} check={check} out={out} removed={removed} canRemove={canRemove} note={note} accent={accent} ink={ink} onPress={press} onToggle={toggleRemoved} onReset={() => { setRemoved([]); setNote(''); }} />}
          {dockOpen && mode === 'tour' && (
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
          {removed.length > 0 && mode !== 'work' && (
            <p className="text-center text-[12px] font-semibold text-landing-ink3">뺀 부품 {removed.length}개 · <button type="button" className="underline" onClick={() => setRemoved([])}>모두 다시 넣기</button></p>
          )}
          <p className="text-center text-[11px] text-landing-muted">가상 예시 제품 · 3D 는 개념 시각화 · 끌어서 돌리기</p>
        </div>
      </div>
    </div>
  );
}

// 부품 하나씩: 번호 · 이름 · 하는 일 · 재질 + 이 부품을 빼면 멈추는 기능
function PartCard({ product, part, index, removed, accent, onPrev, onNext, onToggle, canRemove }) {
  const out = removed.includes(part.id);
  const hit = useMemo(() => (out ? [] : impactOf(product, removed, part.id)), [product, removed, part.id, out]);
  const n = product.parts.length;
  return (
    <section className="rounded-[18px] bg-white/90 p-4 shadow-sm backdrop-blur" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12px] font-semibold tracking-[.14em] text-landing-muted">PART {String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
        <span className="rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={{ background: `${accent}1A`, color: accent }}>{LAYER[part.layer] || part.layer}</span>
      </div>
      <h2 className="mt-1.5 text-[19px] font-extrabold leading-snug tracking-[-0.4px]">{part.name}{out && <span className="ml-2 align-middle text-[12px] font-bold text-red-600">빠져 있음</span>}</h2>
      {part.role && <p className="mt-1 text-[14px] leading-[1.55] text-landing-ink3">{part.role}</p>}
      {part.material && <p className="mt-1 text-[12.5px] text-landing-muted">재질 · {part.material}</p>}
      <div className="mt-2.5 rounded-[12px] bg-landing-page px-3 py-2 text-[13px] leading-[1.5]">
        {out ? <span className="text-landing-ink3">이 부품을 뺀 상태입니다. ‘작동해 보기’에서 무엇이 멈췄는지 볼 수 있어요.</span>
          : !canRemove ? <span className="text-landing-ink3">빼도 작동은 같습니다 (외장·구조 부품)</span>
            : hit.length ? <><b className="text-landing-ink">빼면 멈추는 기능</b><span className="mt-0.5 block text-landing-ink3">{hit.map((f) => f.name).join(' · ')}</span></>
              : <span className="text-landing-ink3">지금은 빼도 멈추는 기능이 없습니다 (다른 부품이 대신함)</span>}
      </div>
      <div className="mt-3 grid grid-cols-[48px_1fr_48px] gap-2">
        <button type="button" onClick={onPrev} aria-label="이전 부품" className="inline-flex h-11 items-center justify-center rounded-[12px] bg-landing-page text-landing-ink"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={onToggle} disabled={!canRemove && !out} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[12px] border text-[14px] font-bold disabled:opacity-40" style={{ borderColor: out ? accent : '#E5E7EB', color: out ? accent : '#171719' }}>
          {out ? <><RotateCcw className="h-4 w-4" />다시 넣기</> : <><X className="h-4 w-4" />이 부품 빼 보기</>}
        </button>
        <button type="button" onClick={onNext} aria-label="다음 부품" className="inline-flex h-11 items-center justify-center rounded-[12px] bg-landing-page text-landing-ink"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </section>
  );
}

// 전원 표시: '배터리 2개 · USB-C' 처럼 짧게
const powerText = (via) => {
  const bat = via.filter((v) => /배터리|battery/i.test(v)).length;
  const rest = [...new Set(via.filter((v) => !/배터리|battery/i.test(v)).map((v) => (/USB-C/i.test(v) ? 'USB-C' : v)))];
  return [bat ? `배터리${bat > 1 ? ` ${bat}개` : ''}` : '', ...rest].filter(Boolean).join(' · ');
};

// 작동해 보기: 버튼을 눌러 보고, 부품을 빼 보면 무엇이 왜 안 되는지가 바로 바뀐다
function WorkPanel({ product, check, out, removed, canRemove, note, accent, ink, onPress, onToggle, onReset }) {
  const buttons = pressables(product);
  const outputs = product.features.filter((f) => isOutput(f.kind));
  const okFns = check.functions.filter((f) => f.ok);
  // 안 되는 기능은 이유가 같은 것끼리 묶는다 (센서 하나가 빠지면 여러 기능이 같은 이유로 멈춘다)
  const groups = [];
  check.functions.filter((f) => !f.ok).forEach((f) => {
    const g = groups.find((x) => x.reason === f.reasons[0]);
    if (g) g.names.push(f.name); else groups.push({ reason: f.reasons[0], names: [f.name] });
  });
  const head = !check.power.ok ? check.power.reason : !check.control.ok ? check.control.reason : '';
  const running = (f) => { const def = product.functions.find((x) => x.id === f.id); return !!def?.feature && Number(out[def.feature]) > 0; };
  return (
    <section className="space-y-2 rounded-[18px] bg-white/90 p-3 shadow-sm backdrop-blur">
      <div className={`flex items-start gap-2 rounded-[12px] px-3 py-2 text-[13px] leading-[1.45] ${head ? 'bg-red-50 text-red-700' : 'bg-landing-page text-landing-ink3'}`}>
        {head ? <Power className="mt-[2px] h-4 w-4 shrink-0" /> : <Plug className="mt-[2px] h-4 w-4 shrink-0" style={{ color: accent }} />}
        <span>{head || <>전원 <b className="text-landing-ink">{powerText(check.power.via)}</b>{outputs.map((f) => <span key={f.id}> · {short(f.name)} <b className="text-landing-ink">{removed.includes(f.part_id) ? '빠짐' : lvl(f, out[f.id])}</b></span>)}</>}</span>
      </div>
      <div className="flex gap-2">
        {buttons.map((f) => {
          const ok = check.power.ok && check.control.ok && check.features[f.id]?.ok;
          return (
            <button key={f.id} type="button" onClick={() => onPress(f)} title={`${f.name} 누르기`} className={`inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[12px] px-2 text-[14px] font-bold shadow-sm ${ok ? '' : 'opacity-45'}`} style={ok ? { background: accent, color: ink } : { background: '#E5E7EB', color: '#6B7280' }}>
              <Power className="h-4 w-4 shrink-0" /><span className="truncate">{short(f.name)}</span>
            </button>
          );
        })}
      </div>
      {note && <p role="status" className="px-1 text-[12.5px] font-semibold text-red-600">{note}</p>}
      <div>
        <p className="px-1 pb-1 text-[12px] font-bold text-landing-muted">부품 빼 보기 <span className="font-medium">· 눌러서 빼고 다시 눌러 넣기</span>{removed.length > 0 && <button type="button" onClick={onReset} className="ml-2 underline">모두 넣기</button>}</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap">
          {canRemove.map((p) => {
            const off = removed.includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => onToggle(p.id)} aria-pressed={off} className={`shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${off ? 'border-red-300 bg-red-50 text-red-700 line-through' : 'border-landing-line2 bg-white text-landing-ink2'}`}>
                {short(p.name)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="max-h-[24vh] space-y-1.5 overflow-y-auto sm:max-h-[220px]">
        <p className="px-1 text-[12px] font-bold text-landing-muted">기능 {okFns.length} / {check.functions.length} 작동{okFns.some(running) && <span className="font-medium"> · 진한 색 = 지금 작동 중</span>}</p>
        {groups.map((g) => (
          <div key={g.reason} className="flex items-start gap-2 rounded-[10px] bg-red-50 px-2.5 py-1.5 text-[13px] leading-[1.45]">
            <X className="mt-[2px] h-4 w-4 shrink-0 text-red-600" />
            <span className="min-w-0"><b className="text-red-700">{g.names.join(' · ')}</b><span className="block text-red-700/90">{g.reason}</span></span>
          </div>
        ))}
        {okFns.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {okFns.map((f) => (
              <span key={f.id} title={f.desc} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={running(f) ? { background: accent, color: ink } : { background: '#F4F5F7', color: '#33363D' }}>
                <Check className="h-3.5 w-3.5" />{f.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
