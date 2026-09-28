import React, { useEffect, useRef } from 'react';
import { fastShipping, tx } from '@/lib/landingContent';

// 업로드할 인포그래픽 영상의 공개 URL을 여기에 넣으면 됩니다.
const SHIPPING_VIDEO_URL = '';

export default function ShippingVideo({ lang }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !SHIPPING_VIDEO_URL) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.currentTime = 0;
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
      {SHIPPING_VIDEO_URL ? (
        <video ref={videoRef} src={SHIPPING_VIDEO_URL} muted playsInline loop preload="metadata" aria-label={tx(fastShipping.videoCaption, lang)} className="w-full aspect-video object-cover rounded-xl border border-landing-line" />
      ) : (
        <div className="w-full aspect-video flex items-center justify-center rounded-xl border border-landing-line bg-landing-page text-landing-muted text-sm" role="img" aria-label={tx(fastShipping.videoPlaceholder, lang)}>{tx(fastShipping.videoPlaceholder, lang)}</div>
      )}
      <figcaption className="mt-2 text-xs text-landing-muted">{tx(fastShipping.videoCaption, lang)}</figcaption>
    </figure>
  );
}