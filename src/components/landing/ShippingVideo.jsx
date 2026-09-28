import React, { useEffect, useRef } from 'react';
import { fastShipping, tx } from '@/lib/landingContent';

const SHIPPING_VIDEO_URL = 'https://media.base44.com/videos/public/6a0c1b56a385588fbd4454f5/a1a7089da_Minimal-elegant-2D-flat-motion-graphicsonline-video-cuttercom.mp4';

export default function ShippingVideo({ lang }) {
  const videoRef = useRef(null);
  const visibleRef = useRef(false);

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
        src={SHIPPING_VIDEO_URL}
        muted
        playsInline
        loop
        preload="metadata"
        onCanPlay={() => { if (visibleRef.current) videoRef.current?.play().catch(() => {}); }}
        aria-label={tx(fastShipping.videoCaption, lang)}
        className="w-full aspect-video object-cover rounded-xl border border-landing-line"
      />
      <figcaption className="mt-2 text-xs text-landing-muted">{tx(fastShipping.videoCaption, lang)}</figcaption>
    </figure>
  );
}