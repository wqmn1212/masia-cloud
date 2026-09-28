import React, { useEffect, useRef, useState } from 'react';
import { fastShipping, tx } from '@/lib/landingContent';

const SHIPPING_VIDEOS = [
  'https://media.base44.com/videos/public/6a0c1b56a385588fbd4454f5/a02bc5f16_aegis_01.mp4',
  'https://media.base44.com/videos/public/6a0c1b56a385588fbd4454f5/6fc968ace_aegis_02.mp4',
  'https://media.base44.com/videos/public/6a0c1b56a385588fbd4454f5/dec852104_aegis_03.mp4',
  'https://media.base44.com/videos/public/6a0c1b56a385588fbd4454f5/ce7bcb9d3_aegis_04.mp4',
];

export default function ShippingVideo({ lang }) {
  const videoRef = useRef(null);
  const visibleRef = useRef(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, { threshold: 0.3 });
    observer.observe(video);
    return () => { observer.disconnect(); video.pause(); };
  }, []);

  return (
    <figure className="mt-7">
      <video
        ref={videoRef}
        src={SHIPPING_VIDEOS[index]}
        muted
        playsInline
        preload="metadata"
        onCanPlay={() => { if (visibleRef.current) videoRef.current?.play().catch(() => {}); }}
        onEnded={() => setIndex(i => (i + 1) % SHIPPING_VIDEOS.length)}
        aria-label={tx(fastShipping.videoCaption, lang)}
        className="w-full aspect-video object-cover rounded-xl border border-landing-line"
      />
      <figcaption className="mt-2 text-xs text-landing-muted">{tx(fastShipping.videoCaption, lang)}</figcaption>
    </figure>
  );
}