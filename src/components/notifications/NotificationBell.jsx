import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import NotificationItem from './NotificationItem';

export default function NotificationBell({ user }) {
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => base44.entities.Notification.filter({ recipient_id: user.id }, '-created_date', 30),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const unread = items.filter((n) => !n.read);

  const markRead = useMutation({
    mutationFn: (ids) => base44.entities.Notification.updateMany({ id: { $in: ids } }, { $set: { read: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', user?.id] }),
  });

  if (!user?.id) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-[18px] h-[18px]" />
          {unread.length > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">알림</span>
          {unread.length > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate(unread.map((n) => n.id))}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" />모두 읽음
            </button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto divide-y">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">알림이 없습니다</p>
          ) : (
            items.map((n) => (
              <NotificationItem key={n.id} item={n} onRead={(item) => !item.read && markRead.mutate([item.id])} />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}