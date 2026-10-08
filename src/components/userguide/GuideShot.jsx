import React, { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// 캡처 이미지: src/assets/guide/{이름}.{ko|zh}.webp (2배 해상도)
const FILES = import.meta.glob('../../assets/guide/*.webp', { eager: true, import: 'default' });
const IMAGES = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [path.split('/').pop().replace('.webp', ''), url]));
// 화면 기준 가로 크기(px). 이보다 크게 늘리지 않는다.
const WIDTH = { app: 1280, owner: 896, create: 896, draft: 896, complete: 420, qc: 420, delay: 896, sub: 896, mywork: 784, board: 834, ops: 1260, bell: 380, holidays: 1008, schedule: 772, locked: 764, client: 454 };

export const guideImage = (name, lang) => IMAGES[`${name}.${lang}`] || IMAGES[`${name}.ko`];

export default function GuideShot({ shot, lang, content }) {
  const [open, setOpen] = useState(false);
  const src = guideImage(shot.img, shot.lang || lang);
  const width = WIDTH[shot.img] || 900;
  const narrow = width <= 500;
  const alt = shot.caption || shot.points[0];
  return (
    <figure className={cn('grid gap-4', narrow && 'lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-6')}>
      <div className={cn('min-w-0', narrow && 'lg:w-[var(--shot-w)]')} style={{ '--shot-w': `${width}px` }}>
        {shot.caption && <figcaption className="mb-2 text-xs font-semibold text-muted-foreground">{shot.caption}</figcaption>}
        <button type="button" onClick={() => setOpen(true)} style={{ maxWidth: width }}
          className="group relative block w-full overflow-hidden rounded-lg border bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img src={src} alt={alt} loading="lazy" className="block h-auto w-full" />
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" />{content.zoom}
          </span>
        </button>
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{content.legend}</p>
        <ol className="space-y-2.5">
          {shot.points.map((point, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-6">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white">{i + 1}</span>
              <span className="min-w-0">{point}</span>
            </li>
          ))}
        </ol>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(96vw,1320px)] p-3 sm:p-4">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="max-h-[85vh] overflow-auto">
            <img src={src} alt={alt} className="mx-auto block h-auto" style={{ width, maxWidth: 'none' }} />
          </div>
        </DialogContent>
      </Dialog>
    </figure>
  );
}
