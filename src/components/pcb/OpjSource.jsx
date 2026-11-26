import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OpjSource({ text }) {
  const [size, setSize] = useState(14);
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b p-3"><h2 className="text-label font-semibold">프로젝트 원문</h2><div className="flex items-center gap-2"><Button size="sm" variant="ghost" aria-label="원문 축소" disabled={size <= 12} onClick={() => setSize(s => s - 2)}><Minus /></Button><span className="text-caption tabular-nums">{Math.round(size / 14 * 100)}%</span><Button size="sm" variant="ghost" aria-label="원문 확대" disabled={size >= 28} onClick={() => setSize(s => s + 2)}><Plus /></Button></div></div>
      <pre tabIndex={0} className="max-h-[55vh] overflow-auto p-4 font-mono leading-relaxed" style={{ fontSize: size }}>{text}</pre>
    </section>
  );
}