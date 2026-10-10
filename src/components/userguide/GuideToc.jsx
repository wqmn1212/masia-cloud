import React, { useEffect, useRef, useState } from 'react';

export default function GuideToc({ items }) {
  const [active, setActive] = useState(items[0]?.id);
  const bar = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id.replace('ch-', ''));
    }, { rootMargin: '-120px 0px -60% 0px' });
    items.forEach((it) => { const el = document.getElementById(`ch-${it.id}`); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [items]);

  useEffect(() => {
    const chip = bar.current?.querySelector(`[data-id="${active}"]`);
    if (chip && bar.current) bar.current.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' });
  }, [active]);

  const go = (id) => document.getElementById(`ch-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur">
      <div ref={bar} className="flex gap-2 overflow-x-auto pb-1">
        {items.map((it, i) => (
          <button key={it.id} data-id={it.id} onClick={() => go(it.id)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs border ${active === it.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted'}`}>
            {i + 1}. {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}