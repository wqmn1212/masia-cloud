import React, { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { capabilities, DEMO_PARTS } from '@/lib/landingCapabilities';
import { tx } from '@/lib/landingContent';

// three.js 는 무거워서 화면에 보일 때만 불러온다
const ConceptCanvas = lazy(() => import('@/components/prototype/concept/ConceptCanvas'));

// WebGL 을 못 쓰는 브라우저에서도 메인페이지가 깨지지 않게 막는다
class Guard extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const canWebGL = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
};

export default function ConceptDemo({ lang }) {
  const host = useRef(null);
  const [visible, setVisible] = useState(false);
  const [webgl] = useState(canWebGL);

  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const placeholder = (text) => <div className="absolute inset-0 flex items-center justify-center text-[13px] text-landing-muted">{text}</div>;

  return (
    <figure className="min-w-0">
      <div ref={host} className="relative h-[340px] sm:h-[420px] overflow-hidden rounded-[14px] border border-landing-line bg-gradient-to-b from-landing-page to-white">
        {!webgl ? placeholder(tx(capabilities.demoFallback, lang)) : visible ? (
          <Guard fallback={placeholder(tx(capabilities.demoFallback, lang))}>
            <Suspense fallback={placeholder(tx(capabilities.demoLoading, lang))}>
              <ConceptCanvas parts={DEMO_PARTS} autoRotate xray={false} explode={false} highlightId={null} />
            </Suspense>
          </Guard>
        ) : placeholder(tx(capabilities.demoLoading, lang))}
        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-landing-ink px-3 py-1 text-[12px] font-bold text-white">{tx(capabilities.demoTitle, lang)}</span>
          {capabilities.demoTags.map((t) => <span key={t[0]} className="rounded-full border border-landing-line bg-white/85 px-2.5 py-1 text-[11.5px] font-semibold text-landing-ink3">{tx(t, lang)}</span>)}
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] leading-[1.6] text-landing-ink3">
        {tx(capabilities.demoCaption, lang)} <span className="text-landing-muted2">{tx(capabilities.demoNote, lang)}</span>
      </figcaption>
    </figure>
  );
}
