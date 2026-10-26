import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// 고정된 PDF 를 쪽별 이미지로 그려 보여 준다 (휴대폰 브라우저마다 다른 PDF 뷰어 대신). 다시 그리지 않고 파일 그대로 그린다.
// 화면에 들어온 쪽만 그리고, 마지막 쪽 아래 표시가 보이면 onReachEnd 를 한 번 부른다.
let pdfjsPromise = null;
const loadPdfjs = () => {
  pdfjsPromise ||= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.js?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return pdfjsPromise;
};

function Page({ doc, number, width }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(number <= 2);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el || visible) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible || !width) return undefined;
    let task, cancelled = false;
    (async () => {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale: (width / base.width) * dpr });
      const canvas = ref.current;
      if (!canvas || cancelled) return;
      canvas.width = vp.width; canvas.height = vp.height;
      task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
      await task.promise.catch(() => {});
    })();
    return () => { cancelled = true; task?.cancel?.(); };
  }, [doc, number, width, visible]);
  return (
    <div className="relative overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-black/5" style={{ width, height: width * ratio }}>
      <canvas ref={ref} className="h-full w-full" aria-label={`${number}쪽`} />
      <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">{number}</span>
    </div>
  );
}

export default function PdfViewer({ url, onReachEnd, className = '' }) {
  const box = useRef(null);
  const end = useRef(null);
  const fired = useRef(false);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let alive = true, loaded = null;
    setDoc(null); setError(''); fired.current = false;
    loadPdfjs().then((lib) => lib.getDocument({ url }).promise).then((d) => { loaded = d; if (alive) setDoc(d); }).catch((e) => { console.error('PdfViewer', e); if (alive) setError('계약서를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.'); });
    return () => { alive = false; loaded?.destroy?.(); };
  }, [url]);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(820, Math.floor(e.contentRect.width - 16))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !end.current || !onReachEnd) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !fired.current) { fired.current = true; onReachEnd(); } }, { root: box.current, threshold: 1 });
    io.observe(end.current);
    return () => io.disconnect();
  }, [doc, onReachEnd]);

  return (
    <div ref={box} className={`overflow-y-auto rounded-lg bg-muted/60 p-2 ${className}`}>
      {error ? <p className="py-10 text-center text-sm text-destructive">{error}</p>
        : !doc ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : (
          <div className="flex flex-col items-center gap-2">
            {width > 0 && Array.from({ length: doc.numPages }, (_, i) => <Page key={i} doc={doc} number={i + 1} width={width} />)}
            <div ref={end} className="py-2 text-center text-[11px] text-muted-foreground">— 계약서 끝 ({doc.numPages}쪽) —</div>
          </div>
        )}
    </div>
  );
}
