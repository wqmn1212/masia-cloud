import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function ClientChatPanel({ cardId, chats }) {
  const [text, setText] = useState('');
  const qc = useQueryClient();

  const send = useMutation({
    mutationFn: () => base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'chat', message: text }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
        {chats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">아직 대화가 없습니다. 문의를 남겨보세요.</p>
        ) : (
          chats.map((c) => {
            const mine = c.sender_role === 'CLIENT';
            return (
              <div key={c.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-xl px-3 py-2', mine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <p className="text-[10px] opacity-70">{c.sender_name} · {c.created_date ? format(new Date(c.created_date), 'MM.dd HH:mm') : ''}</p>
                  <p className="text-sm whitespace-pre-wrap mt-0.5 leading-relaxed">{c.message_text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex gap-2 items-end border-t pt-3">
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="담당자에게 보낼 메시지를 입력하세요"
          className="text-sm"
        />
        <Button size="icon" disabled={!text.trim() || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}