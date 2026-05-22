import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import { translateFieldsToCN } from '@/lib/translate';

const ROLE_COLOR = {
  HQ: 'bg-primary text-primary-foreground',
  AGENT: 'bg-muted text-foreground',
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatTab({ card, user, viewLang = 'KR' }) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();
  const bottomRef = useRef();
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['card-chat', card.id],
    queryFn: () => base44.entities.CardChat.filter({ card_id: card.id }, 'created_date', 200),
    refetchInterval: 3000,
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.CardChat.subscribe((event) => {
      if (event.data?.card_id === card.id) {
        queryClient.invalidateQueries({ queryKey: ['card-chat', card.id] });
      }
    });
    return unsub;
  }, [card.id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (msg) => {
      const cn = await translateFieldsToCN({ message_text: msg.message_text });
      return base44.entities.CardChat.create({ ...msg, message_text_cn: cn.message_text || '' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['card-chat', card.id] }),
  });

  const handleSend = () => {
    if (!text.trim()) return;
    sendMutation.mutate({
      card_id: card.id,
      sender_name: user?.full_name || '사용자',
      sender_email: user?.email || '',
      sender_role: user?.role === 'admin' ? 'HQ' : 'AGENT',
      message_text: text.trim(),
    });
    setText('');
  };

  const handleFileAttach = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    sendMutation.mutate({
      card_id: card.id,
      sender_name: user?.full_name || '사용자',
      sender_email: user?.email || '',
      sender_role: user?.role === 'admin' ? 'HQ' : 'AGENT',
      message_text: `📎 ${file.name}`,
      file_url,
      file_name: file.name,
    });
    setUploading(false);
  };

  const isMyMsg = (msg) => msg.sender_email === user?.email;

  return (
    <div className="flex flex-col h-[420px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-1 pb-2">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground pt-8">아직 메시지가 없습니다. 먼저 말을 걸어보세요!</div>
        )}
        {messages.map((msg) => {
          const mine = isMyMsg(msg);
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${ROLE_COLOR[msg.sender_role] || 'bg-muted'}`}>
                {msg.sender_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className={`max-w-[72%] space-y-1 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!mine && <p className="text-[10px] text-muted-foreground px-1">{msg.sender_name} · {msg.sender_role}</p>}
                <div className={`px-3 py-2 rounded-2xl text-sm leading-snug ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
                  {viewLang === 'CN' ? (msg.message_text_cn || msg.message_text) : msg.message_text}
                  {msg.file_url && (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                       className={`block text-xs mt-1 underline ${mine ? 'text-primary-foreground/80' : 'text-primary'}`}>
                      📎 {msg.file_name || '첨부파일'}
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground px-1">{formatTime(msg.created_date)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t pt-3 flex items-center gap-2">
        <button onClick={() => fileInputRef.current?.click()} className="text-muted-foreground hover:text-foreground transition-colors" disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileAttach(e.target.files[0])} />
        <Input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="메시지를 입력하세요... (Enter로 전송)"
          className="flex-1 text-sm"
        />
        <Button size="icon" onClick={handleSend} disabled={!text.trim() || sendMutation.isPending} className="shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}