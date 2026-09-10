import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageCircle, Send, Loader2, Inbox } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ChatConsultations() {
  const [user, setUser] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState('');
  const qc = useQueryClient();
  const scrollRef = useRef(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['chat-threads'],
    queryFn: () => base44.entities.PublicChatThread.list('-last_message_at', 100),
    refetchInterval: 15000,
  });

  const selected = threads.find((t) => t.id === selectedId) || null;

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-thread-messages', selectedId],
    queryFn: () => base44.entities.PublicChatMessage.filter({ thread_id: selectedId }, 'created_date', 200),
    enabled: !!selectedId,
    refetchInterval: 8000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const open = (t) => {
    setSelectedId(t.id);
    if (t.unread_by_staff) {
      base44.entities.PublicChatThread.update(t.id, { unread_by_staff: false }).then(() => qc.invalidateQueries({ queryKey: ['chat-threads'] }));
    }
  };

  const send = useMutation({
    mutationFn: async () => {
      const text = reply.trim();
      if (!text || !selected) return;
      await base44.entities.PublicChatMessage.create({
        tenant_id: selected.tenant_id,
        thread_id: selected.id,
        sender_role: 'STAFF',
        sender_name: user?.full_name || user?.account_label || user?.email || '담당자',
        message_text: text,
      });
      await base44.entities.PublicChatThread.update(selected.id, {
        unread_by_visitor: true,
        unread_by_staff: false,
        last_message_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['chat-thread-messages', selectedId] });
      qc.invalidateQueries({ queryKey: ['chat-threads'] });
    },
  });

  const unreadCount = useMemo(() => threads.filter((t) => t.unread_by_staff).length, [threads]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">실시간 상담</h1>
        <p className="text-sm text-muted-foreground mt-1">랜딩 페이지 상담 위젯으로 들어온 문의 · 미확인 {unreadCount}건</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Inbox className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">아직 상담 문의가 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[640px] overflow-y-auto">
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => open(t)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                    selectedId === t.id && 'bg-muted/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{t.visitor_name || '방문자'}</span>
                    {t.unread_by_staff && <span className="w-2 h-2 rounded-full bg-primary flex-none" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{t.visitor_contact || '연락처 미기재'}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t.last_message_at ? format(new Date(t.last_message_at), 'MM.dd HH:mm') : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col h-[640px] overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <MessageCircle className="w-5 h-5" />
              왼쪽에서 상담을 선택하세요
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex-none">
                <p className="font-semibold text-sm">{selected.visitor_name || '방문자'}</p>
                <p className="text-xs text-muted-foreground">{selected.visitor_contact || '연락처 미기재'}{selected.product_name ? ` · ${selected.product_name}` : ''}</p>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                {messages.map((m) => {
                  const mine = m.sender_role === 'STAFF';
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] rounded-xl px-3 py-2', mine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                        <p className="text-[10px] opacity-70">{m.sender_name} · {m.created_date ? format(new Date(m.created_date), 'MM.dd HH:mm') : ''}</p>
                        <p className="text-sm whitespace-pre-wrap mt-0.5 leading-relaxed">{m.message_text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 items-end border-t border-border p-3 flex-none">
                <Textarea
                  rows={2}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="답변을 입력하세요"
                  className="text-sm"
                />
                <Button size="icon" disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()}>
                  {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
