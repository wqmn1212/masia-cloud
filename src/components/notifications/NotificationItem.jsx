import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { notificationMeta } from './notificationMeta';

export default function NotificationItem({ item, onRead }) {
  const meta = notificationMeta(item.type);
  const body = (
    <div className={cn('flex gap-2.5 px-3 py-2.5 hover:bg-muted/60 transition-colors', !item.read && 'bg-primary/5')}>
      <span className="text-base leading-none mt-0.5">{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug truncate', !item.read && 'font-semibold')}>{item.title}</p>
        {item.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>}
        <p className="text-[10px] text-muted-foreground mt-1">
          {item.created_date ? formatDistanceToNow(new Date(item.created_date), { addSuffix: true, locale: ko }) : ''}
        </p>
      </div>
      {!item.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
    </div>
  );

  if (!item.link) return <div onClick={() => onRead(item)}>{body}</div>;
  return <Link to={item.link} onClick={() => onRead(item)} className="block">{body}</Link>;
}