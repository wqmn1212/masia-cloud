import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { serviceGuideContent } from '@/components/guide/serviceGuideContent';
import GuideIntro from '@/components/guide/GuideIntro';
import GuideOutline from '@/components/guide/GuideOutline';
import GuideStep from '@/components/guide/GuideStep';

export default function ServiceGuide() {
  const { lang } = useLanguage();
  const content = serviceGuideContent[lang] || serviceGuideContent.ko;
  const { data: user } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me() });
  const [active, setActive] = useState(content.steps[0].id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      let current = content.steps[0].id;
      for (const step of content.steps) {
        const element = document.getElementById(`guide-${step.id}`);
        if (element && element.getBoundingClientRect().top <= 190) current = step.id;
      }
      setActive(current);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, [content]);
  return (
    // break-keep 은 한국어 낱말 단위 줄바꿈. 중국어에 쓰면 쉼표에서만 줄이 바뀐다
    <div className={`mx-auto w-full min-w-0 max-w-5xl space-y-5 pb-10 [overflow-wrap:anywhere] ${lang === 'zh' ? '' : 'break-keep'}`}>
      <GuideIntro content={content} />
      <GuideOutline content={content} active={active} />
      <div className="space-y-6">{content.steps.map((step, index) => <GuideStep key={step.id} step={step} index={index} content={content} user={user} />)}</div>
      <footer className="rounded-xl border border-dashed px-5 py-6 text-center">
        <h2 className="text-title font-semibold">{content.footer}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-body leading-7 text-muted-foreground">{content.footerBody}</p>
      </footer>
    </div>
  );
}