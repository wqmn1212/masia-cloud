import React from 'react';
import { Card } from '@/components/ui/card';

export default function GuideSection({ no, title, children, mock }) {
  return (
    <Card className="p-5 md:p-6 grid gap-5 lg:grid-cols-2 lg:items-start">
      <div className="space-y-2 min-w-0">
        <span className="text-xs font-bold text-primary">{no}</span>
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
      </div>
      <div className="min-w-0">{mock}</div>
    </Card>
  );
}